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
        [System.IO.File]::Copy($s, $d, $true)
        Write-Output "COPIED: $f"
    } catch {
        Write-Output "FAILED: $f - $_"
    }
}
# Clean up test file if exists
$testFile = 'C:\TRAE\OMPC-SSB\backend\app\services\_sandbox_test.tmp'
if ([System.IO.File]::Exists($testFile)) {
    try {
        [System.IO.File]::Delete($testFile)
        Write-Output "CLEANED: _sandbox_test.tmp"
    } catch {
        Write-Output "WARN: could not delete _sandbox_test.tmp"
    }
}
Write-Output "=== Done ==="
