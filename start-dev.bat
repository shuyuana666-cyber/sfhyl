@echo off
setlocal EnableExtensions DisableDelayedExpansion
title SFHYL Development Stack
pushd "%~dp0"
if errorlevel 1 (
  echo [launcher] Could not open the project directory.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [launcher] Node.js is not available on PATH. Install Node.js and reopen this command window.
  set "EXIT_CODE=9009"
  goto :failed
)

if not exist "scripts\dev-stack.mjs" (
  echo [launcher] Missing scripts\dev-stack.mjs. Run this file from the project folder.
  set "EXIT_CODE=2"
  goto :failed
)

node "scripts\dev-stack.mjs" %*
set "EXIT_CODE=%ERRORLEVEL%"
if "%EXIT_CODE%"=="0" goto :done

:failed
echo.
echo [launcher] Startup exited with code %EXIT_CODE%.
echo [launcher] Check logs under logs\dev\ when available.
echo Press any key to close this window.
pause >nul

:done
popd
exit /b %EXIT_CODE%
