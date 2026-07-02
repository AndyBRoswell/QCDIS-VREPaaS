param(
    [string]$browser_process_filter = '',               # record resource usage for browser. use this param to specify re pattern to filter browser processes from ps entries
    [switch]$JupyterLab_backend = $false,               # record resource usage for JupyterLab backend
    [switch]$RStudio_backend = $false,                  # record resource usage for RStudio backend
    [alias('v')][string]$vreapi_process_filter = '',    # record resource usage for vreapi [common backend]. use this param to specify re pattern to filter vreapi process from ps entries
    [alias('d')][string]$database_process_filter = '',  # record resource usage for db. use this param to specify re pattern to filter db processes from ps entries
    [alias('vp')][string]$vreapi_pod_filter = '',       # record resource usage for vreapi pod [common backend]. use this param to specify re pattern to filter vreapi pod from kubectl top pod entries
    [alias('dp')][string]$database_pod_filter = '',     # record resource usage for db pod [common backend]. use this param to specify re pattern to filter db pod from kubectl top pod entries
    [string]$log_dir = '.log',                          # directory to store log files
    [Double]$interval = 1,                              # interval between 2 adjacent resource usage captures [seconds]
    [long]$number_of_records = 0,                       # 0 or negative means infinite records. positive means number of records to capture
    [switch]$console = $false                           # print usage data to console
)

if ($console) {
    Write-Host -NoNewline 'Recording CPU & mem usage at '
    Write-Host -NoNewline -ForegroundColor Green 'console'
    Write-Host -NoNewline ' every '
    Write-Host -NoNewline -ForegroundColor Green $interval
    Write-Host ' second(s) ...'
} else {
    if ((Test-Path $log_dir) -eq $false) { & '/usr/bin/mkdir' -p $log_dir }

    $date = Get-Date -Format 'yyyyMMdd-HHmmss'
    $raw_log_file = $log_dir + "/$date.raw.csv"
    $cooked_log_file = $log_dir + "/$date.cooked.csv"

    Write-Host -NoNewline 'Recording CPU & mem usage at '
    Write-Host -NoNewline -ForegroundColor Green $raw_log_file
    Write-Host -NoNewline ' and '
    Write-Host -NoNewline -ForegroundColor Green $cooked_log_file
    Write-Host -NoNewline ' every '
    Write-Host -NoNewline -ForegroundColor Green $interval
    Write-Host ' second(s) ...'
}

class Simplified_ps_Entry {

    static [string] $header_row = 'user,pid,%cpu,rss,command' # complete header row: 'USER,PID,%CPU,%MEM,VSZ,RSS,TTY,STAT,START,TIME,COMMAND'
    static [string[]] $col_name = [Simplified_ps_Entry]::header_row -replace '%', '' -split ','
    static $col_name_index = @{}
    static [void] Init() {
        for ([int]$i = 0; $i -lt [Simplified_ps_Entry]::col_name.Count; ++$i) {
            [Simplified_ps_Entry]::col_name_index[[Simplified_ps_Entry]::col_name[$i]] = $i
        }
    }
    [string]$time = ''
    [string]$USER = ''
    [int]$PID = -1
    [double]$CPU = 0.0
    [int]$RSS = 0 # KB
    [string]$COMMAND = ''
    [void]constructor([string]$user, [int]$process_ID, [double]$cpu, [int]$rss, [string]$command) {
        $this.USER = $user
        $this.PID = $process_ID
        $this.CPU = $cpu
        $this.RSS = $rss
        $this.COMMAND = $command
    }
    Simplified_ps_Entry([string]$time, [string]$user, [int]$process_ID, [double]$cpu, [int]$rss, [string]$command) {
        $this.time = $time
        $this.constructor($user, $process_ID, $cpu, $rss, $command)
    }
    [void]constructor([string]$raw_entry) {
        $cooked_entry = $raw_entry -split '\s+'
        $this.USER = $cooked_entry[[Simplified_ps_Entry]::col_name_index['user']]
        $this.PID = [int]$cooked_entry[[Simplified_ps_Entry]::col_name_index['pid']]
        $this.CPU = [double]$cooked_entry[[Simplified_ps_Entry]::col_name_index['cpu']]
        $this.RSS = [int]$cooked_entry[[Simplified_ps_Entry]::col_name_index['rss']]
        $this.COMMAND = $cooked_entry[[Simplified_ps_Entry]::col_name_index['command']..($cooked_entry.count - 1)]
    }
    Simplified_ps_Entry([string]$time, [string]$raw_entry) {
        $this.time = $time
        $this.constructor($raw_entry)
    }
}
[Simplified_ps_Entry]::Init()

class Resource_Metric {
    [double]$CPU # %
    [double]$mem # Mi
    Resource_Metric() {
        $this.CPU = 0
        $this.mem = 0
    }
    Resource_Metric([double]$cpu, [double]$mem) {
        $this.CPU = $cpu
        $this.mem = $mem
    }
}

if ((-not $console) -and (-not (Test-Path $raw_log_file))) { (@('time') + [Simplified_ps_Entry]::col_name) -join ',' | Out-File $raw_log_file } # add csv headers first

$compound_resource_metric = [PSCustomObject]@{
    "time" = $null
}
$cpu_headers = $mem_headers = @()
if ($browser_process_filter -ne '') {
    $cpu_headers += "CPU:browser:$browser_process_filter"
    $mem_headers += "mem:browser:$browser_process_filter"
}
if ($JupyterLab_backend) {
    $cpu_headers += "CPU:JupyterLab backend"
    $mem_headers += "mem:JupyterLab backend"
}
if ($RStudio_backend) {
    $cpu_headers += "CPU:RStudio backend"
    $mem_headers += "mem:RStudio backend"
}
if ($vreapi_process_filter -ne '') {
    $cpu_headers += "CPU:vreapi:$vreapi_process_filter"
    $mem_headers += "mem:vreapi:$vreapi_process_filter"
}
if ($database_process_filter -ne '') {
    $cpu_headers += "CPU:database:$database_process_filter"
    $mem_headers += "mem:database:$database_process_filter"
}
if ($vreapi_pod_filter -ne '') {
    $vreapi_pod_filter = ((kubectl get pod | Select-String $vreapi_pod_filter).Line -split '\s+')[0]
    $cpu_headers += "CPU:pod:$vreapi_pod_filter"
    $mem_headers += "mem:pod:$vreapi_pod_filter"
}
if ($database_pod_filter -ne '') {
    $database_pod_filter = ((kubectl get pod | Select-String $database_pod_filter).Line -split '\s+')[0]
    $cpu_headers += "CPU:pod:$database_pod_filter"
    $mem_headers += "mem:pod:$database_pod_filter"
}
$cpu_headers + $mem_headers | ForEach-Object { $compound_resource_metric | Add-Member -MemberType NoteProperty -Name $_ -Value $null }
if ((-not $console) -and (-not (Test-Path $cooked_log_file))) { $compound_resource_metric | ConvertTo-Csv | Select-Object -First 1 | Out-File $cooked_log_file } # add csv headers first

$ps_pathname = '/usr/bin/ps'
$time_format = 'yyyy-MM-dd HH:mm:ss.fff'

$loop_body = {
    $time = Get-Date -Format $time_format
    $compound_resource_metric.time = $time
    $new_raw_ps_entries = New-Object System.Collections.Generic.List[Simplified_ps_Entry]
    if ($browser_process_filter -ne '') {
        $browser_processes = & $ps_pathname 'exo' $([Simplified_ps_Entry]::header_row) | Select-String -a $browser_process_filter
        $browser_metric = [Resource_Metric]::new()
        foreach ($process in $browser_processes) {
            $m = [Simplified_ps_Entry]::new($time, $process)
            $new_raw_ps_entries.Add($m)
            $browser_metric.CPU += $m.CPU
            $browser_metric.mem += $m.RSS * 1000 / 1024.0 / 1024
        }
        $compound_resource_metric."CPU:browser:$browser_process_filter" = $browser_metric.CPU
        $compound_resource_metric."mem:browser:$browser_process_filter" = $browser_metric.mem
    }
    if ($JupyterLab_backend) {
        $JupyterLab_backend_processes = & $ps_pathname 'exo' $([Simplified_ps_Entry]::header_row) | Select-String -a 'jupyter.?lab'
        $JupyterLab_backend_metric = [Resource_Metric]::new()
        foreach ($process in $JupyterLab_backend_processes) {
            $m = [Simplified_ps_Entry]::new($time, $process)
            $new_raw_ps_entries.Add($m)
            $JupyterLab_backend_metric.CPU += [double]$m.CPU
            $JupyterLab_backend_metric.mem += [double]$m.RSS * 1000 / 1024.0 / 1024
        }
        $compound_resource_metric."CPU:JupyterLab backend" = $JupyterLab_backend_metric.CPU
        $compound_resource_metric."mem:JupyterLab backend" = $JupyterLab_backend_metric.mem
    }
    if ($RStudio_backend) {
        $RStudio_backend_processes = & $ps_pathname 'axo' $([Simplified_ps_Entry]::header_row) | Select-String -a 'rstudio-server' # here 'axo' not 'exo' since all process got by the latter are contained in those got by the former
        $RStudio_backend_metric = [Resource_Metric]::new()
        foreach ($process in $RStudio_backend_processes) {
            $m = [Simplified_ps_Entry]::new($time, $process)
            $new_raw_ps_entries.Add($m)
            $RStudio_backend_metric.CPU += [double]$m.CPU
            $RStudio_backend_metric.mem += [double]$m.RSS * 1000 / 1024.0 / 1024
        }
        $compound_resource_metric."CPU:RStudio backend" = $RStudio_backend_metric.CPU
        $compound_resource_metric."mem:RStudio backend" = $RStudio_backend_metric.mem
    }
    if ($vreapi_process_filter -ne '') {
        $vreapi_processes = & $ps_pathname 'exo' $([Simplified_ps_Entry]::header_row) | Select-String -a $vreapi_process_filter
        $vreapi_metric = [Resource_Metric]::new()
        foreach ($process in $vreapi_processes) {
            $m = [Simplified_ps_Entry]::new($time, $process)
            $new_raw_ps_entries.Add($m)
            $vreapi_metric.CPU += $m.CPU
            $vreapi_metric.mem += $m.RSS * 1000 / 1024.0 / 1024
        }
        $compound_resource_metric."CPU:vreapi:$vreapi_process_filter" = $vreapi_metric.CPU
        $compound_resource_metric."mem:vreapi:$vreapi_process_filter" = $vreapi_metric.mem
    }
    if ($database_process_filter -ne '') {
        $database_processes = & $ps_pathname 'axo' $([Simplified_ps_Entry]::header_row) | Select-String -a $database_process_filter # axo works fine to filter postgres processes. not sure when it comes to other db systems
        $database_metric = [Resource_Metric]::new()
        foreach ($process in $database_processes) {
            $m = [Simplified_ps_Entry]::new($time, $process)
            $new_raw_ps_entries.Add($m)
            $database_metric.CPU += $m.CPU
            $database_metric.mem += $m.RSS * 1000 / 1024.0 / 1024
        }
        $compound_resource_metric."CPU:database:$database_process_filter" = $database_metric.CPU
        $compound_resource_metric."mem:database:$database_process_filter" = $database_metric.mem
    }
    if ($vreapi_pod_filter -ne '') {
        $pod_metric = kubectl top pod $vreapi_pod_filter --no-headers | ForEach-Object {
            $col = $_ -split '\s+'
            [Resource_Metric]::new([double]($col[1].substring(0, $col[1].Length - 'm'.Length)) / 10.0, [double]($col[2]).substring(0, $col[2].Length - 'Mi'.Length))
        }
        $compound_resource_metric."CPU:pod:$vreapi_pod_filter" = $pod_metric.CPU
        $compound_resource_metric."mem:pod:$vreapi_pod_filter" = $pod_metric.mem
    }
    if ($database_pod_filter -ne '') {
        $pod_metric = kubectl top pod $database_pod_filter --no-headers | ForEach-Object {
            $col = $_ -split '\s+'
            [Resource_Metric]::new([double]($col[1].substring(0, $col[1].Length - 'm'.Length)) / 10.0, [double]($col[2]).substring(0, $col[2].Length - 'Mi'.Length))
        }
        $compound_resource_metric."CPU:pod:$database_pod_filter" = $pod_metric.CPU
        $compound_resource_metric."mem:pod:$database_pod_filter" = $pod_metric.mem
    }
    if ($console) {
        $compound_resource_metric | Format-Table | Write-Output
    } else {
        $new_raw_ps_entries | Export-Csv -Append $raw_log_file
        $compound_resource_metric | Export-Csv -Append $cooked_log_file
    }
    Start-Sleep($interval)
}

if ($number_of_records -le 0) {
    while ($true) { & $loop_body }
} else {
    for ($i = 0; $i -lt $number_of_records; ++$i) { & $loop_body }
}
