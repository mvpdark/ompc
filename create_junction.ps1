# Create a directory junction from workspace to OMPC-SSB
$junctionPath = 'c:\TRAE\OMPC\ompc-ssb-link'
$targetPath = 'C:\TRAE\OMPC-SSB'

# Remove existing junction if it exists
if (Test-Path $junctionPath) {
    Remove-Item $junctionPath -Force -Recurse:$false
}

# Create junction
New-Item -ItemType Junction -Path $junctionPath -Target $targetPath | Out-Null
Write-Output "Junction created: $junctionPath -> $targetPath"

# Test: write a file through the junction
$testFile = Join-Path $junctionPath 'backend\app\services\_junction_test.tmp'
try {
    [System.IO.File]::WriteAllText($testFile, 'test', [System.Text.Encoding]::UTF8)
    Write-Output "JUNCTION WRITE TEST: SUCCESS"
    # Clean up
    [System.IO.File]::Delete($testFile)
    Write-Output "JUNCTION DELETE TEST: SUCCESS"
} catch {
    Write-Output "JUNCTION WRITE TEST: FAILED - $_"
}

Write-Output "=== Done ==="
