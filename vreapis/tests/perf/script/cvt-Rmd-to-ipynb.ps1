param(
    [System.IO.FileInfo[]]$pathnames,   # files to convert
#    $kernelspec = @{
#        display_name = 'R [conda env:jupyterlab] *'
#        language = 'R'
#        name = 'conda-env-jupyterlab-r'
#    }
    $kernelspec = @{
        display_name = 'R'
        language = 'R'
        name = 'ir'
    },
    $language_info = @{
        codemirror_mode = 'r'
        file_extension = '.r'
        mimetype = 'text/x-r-source'
        name = 'R'
        pygments_lexer = 'r'
        version = '4.3.3'   # keep this unchanged even if the actual R version mismatches to let JupyterLab not adjust automatically [or it will ask to save the file, which brings impacts on performance test results]
    }
)

foreach ($pathname in $pathnames) {
    Write-Host -NoNewline "src: "
    Write-Host -ForegroundColor Yellow $pathname
    $dst = "$($pathname.DirectoryName)/$($pathname.BaseName).ipynb"
    Get-Content -Raw $pathname | jupytext --from Rmd --to ipynb --opt split_at_heading=true -o - > $dst
    $generated_ipynb = ConvertFrom-Json (Get-Content $dst -Raw)
    $generated_ipynb.metadata | Add-Member -NotePropertyName kernelspec -NotePropertyValue $kernelspec
    $generated_ipynb.metadata | Add-Member -NotePropertyName language_info -NotePropertyValue $language_info
    $serialized_ipynb = ($generated_ipynb | ConvertTo-Json -Depth 100) -split '\n'
    $serialized_ipynb | Set-Content $dst
#    $reindented_ipynb_builder = New-Object System.Text.StringBuilder
#    foreach ($row in $serialized_ipynb) { # adjust indentation to 1 space [JupyterLab's indentation preference]
#        $matches = $null
#        if ($row -match '^\s+') {
#            [void]$reindented_ipynb_builder.Append(' ' * ($matches[0].Length / 2))
#            [void]$reindented_ipynb_builder.Append($row.Substring($matches[0].Length))
#        } else {
#            [void]$reindented_ipynb_builder.Append($row)
#        }
#        [void]$reindented_ipynb_builder.Append("`n")
#    }
#    [void]$reindented_ipynb_builder.Remove($reindented_ipynb_builder.Length - 1, 1) # remove the last newline
#    $reindented_ipynb_builder.ToString() | Set-Content $dst
    Write-Host -NoNewline "dst: "
    Write-Host -ForegroundColor Green $dst
}
