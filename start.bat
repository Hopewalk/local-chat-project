@echo off
echo === Starting Hope Chat Setup & Server ===

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in system PATH.
    pause
    exit /b 1
)

:: Create virtual environment if it doesn't exist
if not exist .venv (
    echo Creating virtual environment (.venv)...
    python -m venv .venv
)

:: Activate virtual environment
echo Activating virtual environment...
call .venv\Scripts\activate.bat

:: Install or upgrade requirements
echo Checking and installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Start the Flask app
echo Starting Flask Server on port 5001...
python app.py

pause
