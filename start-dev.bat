@echo off
setlocal
cd /d "%~dp0"

:: Set console title
title SafeCity-Connect Launcher

:: Check for powershell
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] PowerShell is not installed or not in PATH.
    echo Please install Windows PowerShell to run this project.
    pause
    exit /b 1
)

:: Launch the main PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-project.ps1"
exit /b %errorlevel%
