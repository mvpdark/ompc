@echo off
setlocal

cd /d "%~dp0"
title OMPC Workspace Launcher

echo.
echo ========================================
echo   OMPC Workspace Launcher
echo   Shell:  C:\TRAE\OMPC
echo   Project: C:\TRAE\OMPC-SSB
echo ========================================
echo.

REM ------------------------------------------------------------------
REM Bug 3: .bat delegates to start_ompc.py (new version with health
REM        checks). Bugs 1 & 2 (startup delays + absolute cf-config
REM        path) are handled inside the Python script, so delegating
REM        resolves all three issues in one place.
REM ------------------------------------------------------------------

REM Prefer the project venv Python; fall back to system python on PATH.
set "PYTHON_EXE=%~dp0..\OMPC-SSB\.venv\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
    echo   Project venv not found, trying system python ...
    where python >nul 2>nul
    if errorlevel 1 (
        echo ERROR: Python not found.
        echo   Expected venv: %PYTHON_EXE%
        echo   Or add python.exe to PATH.
        goto :fail
    )
    set "PYTHON_EXE=python"
)

REM Delegate to the Python launcher (health checks + delays + abs paths).
echo Launching start_ompc.py ...
"%PYTHON_EXE%" "%~dp0start_ompc.py" %*
set "EXIT_CODE=%errorlevel%"

REM Open the app in browser only when starting services (no --status/--stop).
if "%~1"=="" (
    if "%EXIT_CODE%"=="0" (
        timeout /t 2 /nobreak >nul
        start "" "http://127.0.0.1:60000/?theme=mint"
    )
)

echo.
if "%EXIT_CODE%"=="0" (
    echo OMPC launcher finished successfully.
) else (
    echo OMPC launcher exited with code %EXIT_CODE%.
)

if /I "%OMPC_LAUNCHER_NO_PAUSE%"=="1" exit /b %EXIT_CODE%
pause
exit /b %EXIT_CODE%

:fail
if /I "%OMPC_LAUNCHER_NO_PAUSE%"=="1" exit /b 1
pause
exit /b 1
