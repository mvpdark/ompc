# Test different methods to overwrite an existing file
$target = 'C:\TRAE\OMPC-SSB\backend\app\services\content_source_context.py'

# Method 1: FileStream with FileMode.Create
try {
    $content = [System.IO.File]::ReadAllText('c:\TRAE\OMPC\fixed_files\app\services\content_source_context.py', [System.Text.Encoding]::UTF8)
    $fs = [System.IO.File]::Open($target, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    $writer = New-Object System.IO.StreamWriter($fs, (New-Object System.Text.UTF8Encoding $false))
    $writer.Write($content)
    $writer.Close()
    $fs.Close()
    Write-Output "Method 1 (FileStream Create): SUCCESS"
} catch {
    Write-Output "Method 1 (FileStream Create): FAILED - $_"
}

# Method 2: Move existing to .bak, then write new
$target2 = 'C:\TRAE\OMPC-SSB\backend\app\services\image_service.py'
$bak = "$target2.bak"
try {
    [System.IO.File]::Move($target2, $bak)
    $content2 = [System.IO.File]::ReadAllText('c:\TRAE\OMPC\fixed_files\app\services\image_service.py', [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($target2, $content2, (New-Object System.Text.UTF8Encoding $false))
    Write-Output "Method 2 (Move + Write): SUCCESS"
    # Clean up .bak
    try { [System.IO.File]::Delete($bak) } catch {}
} catch {
    Write-Output "Method 2 (Move + Write): FAILED - $_"
    # Try to restore
    try { if ([System.IO.File]::Exists($bak)) { [System.IO.File]::Move($bak, $target2) } } catch {}
}

# Method 3: Write to new file with different name, then rename
$target3 = 'C:\TRAE\OMPC-SSB\backend\app\services\workspace_service.py'
$tmp3 = "$target3.new"
try {
    $content3 = [System.IO.File]::ReadAllText('c:\TRAE\OMPC\fixed_files\app\services\workspace_service.py', [System.Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($tmp3, $content3, (New-Object System.Text.UTF8Encoding $false))
    # Now try to replace
    [System.IO.File]::Delete($target3)
    [System.IO.File]::Move($tmp3, $target3)
    Write-Output "Method 3 (Write new + Delete + Move): SUCCESS"
} catch {
    Write-Output "Method 3 (Write new + Delete + Move): FAILED - $_"
    try { [System.IO.File]::Delete($tmp3) } catch {}
}

Write-Output "=== Done ==="
