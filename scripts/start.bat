@echo off
:: Find project root relative to script location
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%.."

echo Starting Hope Chat Server...
.venv\Scripts\python.exe run.py

pause
