@echo off
setlocal

cd /d "%~dp0"
title OMPC Workspace Launcher

echo.
echo ========================================
echo   OMPC Workspace Launcher
echo   Shell:  E:\OMPC
echo   Project: E:\OMPC-SSB
echo ========================================
echo.

set "PROJECT_DIR=E:\OMPC-SSB"
set "PYTHON_EXE=%PROJECT_DIR%\.venv\Scripts\python.exe"

if not exist "%PYTHON_EXE%" (
  echo Python venv not found at %PYTHON_EXE%
  echo Run: cd %PROJECT_DIR% ^&^& python scripts\setup_local.py
  goto :fail
)

echo [1/3] Starting backend on http://127.0.0.1:8010 ...
start "OMPC-SSB Backend" /D "%PROJECT_DIR%\backend" "%PYTHON_EXE%" -m uvicorn app.main:app --host 0.0.0.0 --port 8010

echo [2/3] Starting frontend on http://127.0.0.1:3000 ...
start "OMPC-SSB Frontend" /D "%PROJECT_DIR%\frontend" npm run dev:lan

echo [3/3] Starting Cloudflare tunnel ...
start "OMPC Cloudflare Tunnel" cloudflared tunnel run opc-social-content-automation-live

echo.
echo ========================================
echo   OMPC services starting:
echo.
echo   Frontend:  http://127.0.0.1:3000/?theme=mint
echo   Backend:   http://127.0.0.1:8010
echo   Public:    https://opc.mvpdark.top
echo.
echo   Close this window to keep services running.
echo   Or press any key to open the app in browser.
echo ========================================
echo.

start "" "http://127.0.0.1:3000/?theme=mint"

if /I "%OMPC_LAUNCHER_NO_PAUSE%"=="1" exit /b 0
pause
exit /b 0

:fail
if /I "%OMPC_LAUNCHER_NO_PAUSE%"=="1" exit /b 1
pause
exit /b 1
