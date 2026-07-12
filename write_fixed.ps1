$src = 'c:\TRAE\OMPC\fixed_files\app'
$dst = 'C:\TRAE\OMPC-SSB\backend\app'
$files = @(
    'services\content_source_context.py',
    'services\image_service.py',
    'services\workspace_service.py',
    'services\model_router.py',
    'api\v1\endpoints\images.py',
    'services\content_service.py',
    'services\trend_browser_collector.py'
)
foreach ($f in $files) {
    $s = Join-Path $src $f
    $d = Join-Path $dst $f
    try {
        $content = [System.IO.File]::ReadAllText($s, [System.Text.Encoding]::UTF8)
        # Atomic file replacement: write to temp file in same directory, then rename/replace
        $tmp = "$d.tmp"
        [System.IO.File]::WriteAllText($tmp, $content, (New-Object System.Text.UTF8Encoding $false))
        if ([System.IO.File]::Exists($d)) {
            [System.IO.File]::Replace($tmp, $d, $null)
        } else {
            [System.IO.File]::Move($tmp, $d)
        }
        Write-Output "WRITTEN: $f"
    } catch {
        Write-Output "FAILED: $f - $_"
    }
}
Write-Output "=== Done ==="
