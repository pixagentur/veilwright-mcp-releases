@echo off
REM Double-click this file to update Veilwright MCP to the latest version.
REM Downloads the latest release, replaces the shipped files, reinstalls
REM dependencies, and verifies it actually works before saying so.
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js was not found on this computer.
  echo Install it from https://nodejs.org (choose the LTS version, not "Current"), then double-click this file again.
  pause
  exit /b 1
)

where tar >nul 2>nul
if %errorlevel% neq 0 (
  echo The "tar" command was not found. It ships by default with Windows 10/11 - if it is genuinely missing on this system, this can't proceed.
  pause
  exit /b 1
)

node update.js
set STATUS=%errorlevel%

echo.
pause
exit /b %STATUS%
