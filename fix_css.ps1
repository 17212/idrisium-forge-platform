$path = "c:\Users\Admin\Documents\GitHub\idrisium-forge-platform\tailwind.css"
$content = Get-Content $path -Raw
$content = $content -replace '-webkit-line-clamp: 1;', "-webkit-line-clamp: 1;`r`n  line-clamp: 1;"
$content = $content -replace '-webkit-line-clamp: 2;', "-webkit-line-clamp: 2;`r`n  line-clamp: 2;"
$content = $content -replace '-webkit-line-clamp: 3;', "-webkit-line-clamp: 3;`r`n  line-clamp: 3;"
Set-Content $path $content
Write-Host "CSS Fixed"
