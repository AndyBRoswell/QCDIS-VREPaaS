# duplicate rmd test files for test repetitions
# At present, Cell Containerizer from NaaVRE automatically generates Docker image name for a cell using login username and its 1st line comment. To bring more convenience to test repetitions, this script directly duplicates designated test files with suffix added to the 1st line comment.
# Example:
#   ./dup-test-files a.Rmd
# Results:
#   'a.Rmd' -> 'a.0.Rmd', 'a.1.Rmd', 'a.2.Rmd', ..., 'a.9.Rmd'
# Convert to ipynb:
#   ls a*.Rmd | % { cat -raw $_ | jupytext --from Rmd --to ipynb --opt split_at_heading=true -o - > "$($_.BaseName).ipynb" }

param(
    [Parameter(Mandatory = $true)][System.IO.FileInfo[]]$pathnames, # files to dup
    [int]$copies = 10,                                              # number of copies
    [string]$extension_prefix_prefix = '.',
    [string]$extension_prefix_suffix = '',
    [string]$magic_prefix = ' # C25B14E054D65738 [rpt ',            # to conveniently recognise copies
    [string]$magic_suffix = '] '
)

foreach ($pathname in $pathnames) {
    $content = Get-Content -Raw $pathname
    $re = '((^|[\r\n])```{r[^\r\n]+[\r\n]+(\s#\|[^\r\n]*[\r\n]+)*#[^\r\n]*)' # code chunk header to 1st line comment [chunk options w/ prefix #| skipped] [see https://yihui.org/knitr/options/?utm_source=chatgpt.com]
    # $res = $content | Select-String -AllMatches $re
    # $res.Matches | ForEach-Object { Write-Host $_.Value }
    for ($i = 0; $i -lt $copies; ++$i) {
        $new_content = $content -replace $re, "`$1$magic_prefix$i$magic_suffix"
        $dst = "$($pathname.DirectoryName)/$($pathname.BaseName)$extension_prefix_prefix$i$extension_prefix_suffix$($pathname.Extension)"
        Set-Content $dst $new_content
        Write-Host -NoNewline "new replica: "
        Write-Host -ForegroundColor Green $dst
    }
}
