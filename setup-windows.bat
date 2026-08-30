@echo off
REM Double-click this file to set up Veilwright MCP — no manual
REM terminal commands needed. Opens a command-prompt window to show
REM progress, but nothing needs to be typed.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js was not found on this computer.
  echo Install it from https://nodejs.org (choose the LTS version, not "Current"), then double-click this file again.
  pause
  exit /b 1
)

node setup.js
set STATUS=%errorlevel%

echo.
pause
exit /b %STATUS%
