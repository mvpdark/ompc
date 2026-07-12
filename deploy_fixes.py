"""
OMPC-SSB Bug Fix Deployment Script
====================================
Run this script from a terminal OUTSIDE the TRAE sandbox to deploy
the 7 fixed Python files to the target directory.

Usage:
    C:\\TRAE\\OMPC-SSB\\.venv\\Scripts\\python.exe deploy_fixes.py

Or simply:
    python deploy_fixes.py
"""
import shutil
import os
import sys
from pathlib import Path

# Source: fixed files in workspace
SRC = Path(r"c:\TRAE\OMPC\fixed_files\app")
# Target: actual backend directory
DST = Path(r"C:\TRAE\OMPC-SSB\backend\app")

FILES = [
    "services/content_source_context.py",
    "services/image_service.py",
    "services/workspace_service.py",
    "services/model_router.py",
    "api/v1/endpoints/images.py",
    "services/content_service.py",
    "services/trend_browser_collector.py",
]

print("=" * 60)
print("OMPC-SSB Bug Fix Deployment")
print("=" * 60)

# Step 1: Backup original files
backup_dir = DST.parent / "_bugfix_backup"
backup_dir.mkdir(exist_ok=True)
print(f"\n[1/3] Backing up original files to: {backup_dir}")
for f in FILES:
    src_file = DST / f
    bak_file = backup_dir / f
    if src_file.exists():
        bak_file.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copy2(src_file, bak_file)
            print(f"  Backed up: {f}")
        except (OSError, shutil.Error) as exc:
            print(f"  WARNING: Failed to back up {f}: {exc}")
    else:
        print(f"  WARNING: Source file not found: {f}")

# Step 2: Copy fixed files
print(f"\n[2/3] Deploying fixed files...")
success_count = 0
for f in FILES:
    src_file = SRC / f
    dst_file = DST / f
    if src_file.exists():
        try:
            shutil.copy2(src_file, dst_file)
            print(f"  Deployed: {f}")
            success_count += 1
        except (OSError, shutil.Error) as exc:
            print(f"  ERROR: Failed to deploy {f}: {exc}")
    else:
        print(f"  ERROR: Fixed file not found: {src_file}")

print(f"\n  {success_count}/{len(FILES)} files deployed successfully.")

# Step 3: Verify imports
print(f"\n[3/3] Verifying imports...")
os.chdir(DST.parent)

# Ensure we import from the actual target, not workspace
sys.path.insert(0, str(DST.parent))
# Remove workspace paths
sys.path = [p for p in sys.path if "fixed_files" not in p and "test_backend" not in p]

modules = [
    "app.services.content_source_context",
    "app.services.image_service",
    "app.services.workspace_service",
    "app.services.model_router",
    "app.api.v1.endpoints.images",
    "app.services.content_service",
    "app.services.trend_browser_collector",
]

import importlib
passed = 0
for mod_name in modules:
    try:
        importlib.import_module(mod_name)
        print(f"  OK: {mod_name}")
        passed += 1
    except Exception as e:
        print(f"  FAIL: {mod_name} - {type(e).__name__}: {e}")

print(f"\n{'=' * 60}")
print(f"Deployment complete: {success_count}/{len(FILES)} files, {passed}/{len(modules)} imports verified")
if success_count == len(FILES) and passed == len(modules):
    print("ALL FIXES DEPLOYED SUCCESSFULLY!")
else:
    print("Some issues detected. Check output above.")
    sys.exit(1)
print(f"{'=' * 60}")
print(f"\nBackup location: {backup_dir}")
print(f"To restore originals: copy files from {backup_dir} back to {DST}")
