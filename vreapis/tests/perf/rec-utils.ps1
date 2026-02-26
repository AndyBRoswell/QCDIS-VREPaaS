param(
    [string]$browser_process_filter = '',                                   # record resource usage for browser. use this param to specify re pattern to filter browser processes from ps entries
    [switch]$JupyterLab_backend = $false,                                   # record resource usage for JupyterLab backend
    [switch]$RStudio_backend = $false,                                      # record resource usage for RStudio backend
    [alias('v')][string]$vreapi_process_filter = '',                        # record resource usage for vreapi [common backend]. use this param to specify re pattern to filter vreapi process from ps entries
    [alias('d')][string]$database_process_filter = '',                      # record resource usage for db. use this param to specify re pattern to filter db processes from ps entries
    [alias('vp')][string]$vreapi_pod_filter = '',                           # record resource usage for vreapi pod [common backend]. use this param to specify re pattern to filter vreapi pod from kubectl top pod entries
    [alias('dp')][string]$database_pod_filter = '',                         # record resource usage for db pod [common backend]. use this param to specify re pattern to filter db pod from kubectl top pod entries
    [string]$log_dir = 'log',                                               # directory to store log files
    [string]$log_filename_prefix = (Get-Date -Format 'yyyyMMdd-HHmmss'),    # prefix for log filename. if not specified, current date and time will be used
    [int]$interval = 1,                                                     # interval between 2 adjacent resource usage captures [seconds]. [pidstat only supports integer intervals]
    [long]$number_of_records = 0,                                           # 0 or negative means infinite records. positive means number of records to capture
    [switch]$console = $false                                               # print usage data to console
)

# intro messages before recording
if ($console) {
    Write-Host -NoNewline 'Recording CPU & mem usage at '
    Write-Host -NoNewline -ForegroundColor Green 'console'
    Write-Host -NoNewline ' every '
    Write-Host -NoNewline -ForegroundColor Green $interval
    Write-Host ' second(s) ...'
} else {
    if ((Test-Path $log_dir) -eq $false) { & '/usr/bin/mkdir' -p $log_dir }

    $CPU_log_file = $log_dir + "/$log_filename_prefix.CPU.csv"
    $mem_log_file = $log_dir + "/$log_filename_prefix.mem.csv"
    $cooked_log_file = $log_dir + "/$log_filename_prefix.cooked.csv"

    Write-Host -NoNewline 'Recording CPU & mem usage at '
    Write-Host -NoNewline -ForegroundColor Green $CPU_log_file
    Write-Host -NoNewline ' and '
    Write-Host -NoNewline -ForegroundColor Green $mem_log_file
    Write-Host -NoNewline ' and '
    Write-Host -NoNewline -ForegroundColor Green $cooked_log_file
    Write-Host -NoNewline ' every '
    Write-Host -NoNewline -ForegroundColor Green $interval
    Write-Host ' second(s) ...'
}

class Process_CPU_Entry { # pidstat [sudo apt install sysstat] used here. ps shows average CPU util only while top always show units like m, g, t, p for mem util thus less precise
    # columns for CPU util: [time], UID, PID, %usr, %system, %guest, %wait, %CPU, CPU, Command
    [DateTime]$time
    [int]$UID = -1
    [int]$PID = -1
    [double]$pct_usr = 0
    [double]$pct_system = 0
    [double]$pct_guest = 0
    [double]$pct_wait = 0
    [double]$pct_CPU = 0
    [int]$CPU = 0
    [string]$Command = ''
    Process_CPU_Entry([DateTime]$time, [int]$UID, [int]$_PID, [double]$pct_usr, [double]$pct_system, [double]$pct_guest, [double]$pct_wait, [double]$pct_CPU, [int]$CPU, [string]$Command) {
        $this.time = $time
        $this.UID = $UID
        $this.PID = $_PID
        $this.pct_usr = $pct_usr
        $this.pct_system = $pct_system
        $this.pct_guest = $pct_guest
        $this.pct_wait = $pct_wait
        $this.pct_CPU = $pct_CPU
        $this.CPU = $CPU
        $this.Command = $Command
    }
}

class Process_Memory_Entry { # pidstat
    # columns for mem util: [time], UID, PID, minflt/s, majflt/s, VSZ, RSS, %MEM, Command
    [DateTime]$time
    [int]$UID = -1
    [int]$PID = -1
    [double]$minflt_p_s = 0
    [double]$majflt_p_s = 0
    [long]$VSZ = 0 # in KiB
    [long]$RSS = 0 # in KiB
    [double]$pct_MEM = 0
    [string]$Command = ''
    Process_Memory_Entry([DateTime]$time, [int]$UID, [int]$_PID, [double]$minflt_p_s, [double]$majflt_p_s, [long]$VSZ, [long]$RSS, [double]$pct_MEM, [string]$Command) {
        $this.time = $time
        $this.UID = $UID
        $this.PID = $_PID
        $this.minflt_p_s = $minflt_p_s
        $this.majflt_p_s = $majflt_p_s
        $this.VSZ = $VSZ
        $this.RSS = $RSS
        $this.pct_MEM = $pct_MEM
        $this.Command = $Command
    }
}

class Resource_Metric { # for what are sent by K8s metrics server, and cooked entries
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

# add columns according to the designated process/pod filters
$cooked_entry = [PSCustomObject]@{
    "time" = $null
}
$JupyterLab_backend_filter = 'jupyter.?lab'
$RStudio_backend_filter = 'rstudio-server'
$CPU_headers = New-Object System.Collections.Generic.List[string]
$mem_headers = New-Object System.Collections.Generic.List[string]
$process_filters = New-Object System.Collections.Generic.List[string]
$pod_filters = New-Object System.Collections.Generic.List[string]
if ($JupyterLab_backend) { $process_filters.Add($JupyterLab_backend_filter) }
if ($RStudio_backend) { $process_filters.Add($RStudio_backend_filter) }
foreach ($s in @(
    $browser_process_filter,
    $vreapi_process_filter,
    $database_process_filter
)) {
    if ($s -ne '') { $process_filters.Add($s) }
}
foreach ($s in @(
    $vreapi_pod_filter,
    $database_pod_filter
)) {
    if ($s -ne '') { $pod_filters.Add($s) }
}
foreach ($filter in $process_filters) {
    $CPU_headers += "CPU:process:$filter"
    $mem_headers += "mem:process:$filter"
}
foreach ($filter in $pod_filters) {
    $CPU_headers += "CPU:pod:$filter"
    $mem_headers += "mem:pod:$filter"
}
$CPU_headers + $mem_headers | ForEach-Object { $cooked_entry | Add-Member -MemberType NoteProperty -Name $_ -Value $null }

# main body
$time_format = 'yyyy-MM-dd HH:mm:ss.fff'
if ($env:LC_NUMERIC -eq $null) {
    $culture = [System.Globalization.CultureInfo]::CurrentCulture.Name
} else {
    $BCP_47_culture_name_for_pidstat = $env:LC_NUMERIC.Substring(0, $env:LC_NUMERIC.IndexOf('.')) # e.g. en-US, nl-NL
    $culture = New-Object System.Globalization.CultureInfo($BCP_47_culture_name_for_pidstat)
}
$loop_body = {
    # current time point
    $time = Get-Date -Format $time_format
    $cooked_entry.time = $time

    # convert text-based results from pidstat to .NET objects
    $process_info = (pidstat -rul -p ALL $interval 1) -join "`n" -split "\n\n" | Select-Object -Skip 1
    $util_rows = New-Object System.Collections.Generic.List[System.Collections.Generic.List[string[]]]
    for ($i = 0; $i -lt 2; ++$i) {
        $raw_rows = $process_info[$i] -split '\n' | Select-Object -Skip 1
        $split_rows = New-Object System.Collections.Generic.List[string[]]
        foreach ($raw_row in $raw_rows) {
            $columns = $raw_row -split '\s+'
            $split_rows.Add($columns)
        }
        $util_rows.Add($split_rows)
    }
    $CPU_util_rows = $util_rows[0]
    $mem_util_rows = $util_rows[1]
    $CPU_entries = New-Object System.Collections.Generic.List[Process_CPU_Entry]
    $CPU_entries_to_export = New-Object System.Collections.Generic.List[Process_CPU_Entry]
    $mem_entries = New-Object System.Collections.Generic.List[Process_Memory_Entry]
    $mem_entries_to_export = New-Object System.Collections.Generic.List[Process_Memory_Entry]
    foreach ($seg in $CPU_util_rows) {
        $e = [Process_CPU_Entry]::new(
            [DateTime]::ParseExact($time, $time_format, $null),
            [int]($seg[1]),
            [int]($seg[2]),
            [double]::Parse($seg[3], $culture),
            [double]::Parse($seg[4], $culture),
            [double]::Parse($seg[5], $culture),
            [double]::Parse($seg[6], $culture),
            [double]::Parse($seg[7], $culture),
            [int]($seg[8]),
            $seg[9..($seg.Length - 1)] -join ' '
        )
        $CPU_entries.Add($e)
    }
    foreach ($seg in $mem_util_rows) {
        $e = [Process_Memory_Entry]::new(
            [DateTime]::ParseExact($time, $time_format, $null),
            [int]($seg[1]),
            [int]($seg[2]),
            [double]::Parse($seg[3], $culture),
            [double]::Parse($seg[4], $culture),
            [long]($seg[5]),
            [long]($seg[6]),
            [double]::Parse($seg[7], $culture),
            $seg[8..($seg.Length - 1)] -join ' '
        )
        $mem_entries.Add($e)
    }

    # filter entries
    foreach ($filter in $process_filters) {
        $new_CPU_entries = $CPU_entries | Where-Object { $_.Command -match $filter }
        if ($new_CPU_entries.Count -gt 0) { $CPU_entries_to_export.AddRange(($new_CPU_entries -as [System.Collections.Generic.List[Process_CPU_Entry]])) }
        $new_mem_entries = $mem_entries | Where-Object { $_.Command -match $filter }
        if ($new_mem_entries.Count -gt 0) { $mem_entries_to_export.AddRange(($new_mem_entries -as [System.Collections.Generic.List[Process_Memory_Entry]])) }
        $metric = [Resource_Metric]::new(
            ($new_CPU_entries | Measure-Object -Property pct_CPU -Sum).Sum,
            ($new_mem_entries | Measure-Object -Property RSS -Sum).Sum / 1024.0 # convert KiB to MiB
        )
        $cooked_entry."CPU:process:$filter" = $metric.CPU
        $cooked_entry."mem:process:$filter" = $metric.mem
    }
    foreach ($filter in $pod_filters) {
        $pod_metric = kubectl top pod $filter --no-headers | ForEach-Object {
            $col = $_ -split '\s+'
            [Resource_Metric]::new([double]($col[1].substring(0, $col[1].Length - 'm'.Length)) / 10.0, [double]($col[2]).substring(0, $col[2].Length - 'Mi'.Length))
        }
        $cooked_entry."CPU:pod:$filter" = $pod_metric.CPU
        $cooked_entry."mem:pod:$filter" = $pod_metric.mem
    }

    # output
    if ($console) {
        $cooked_entry | Format-Table | Write-Output
    } else {
        $CPU_entries_to_export | Export-Csv -Append $CPU_log_file
        $mem_entries_to_export | Export-Csv -Append $mem_log_file
        $cooked_entry | Export-Csv -Append $cooked_log_file
    }

#    Start-Sleep($interval)
}

# main
if ($number_of_records -le 0) {
    while ($true) { & $loop_body }
} else {
    for ($i = 0; $i -lt $number_of_records; ++$i) { & $loop_body }
}
