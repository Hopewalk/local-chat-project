@echo off
:: Get the directory of this batch file, then resolve parent directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%.."

echo === Starting Hope Chat Setup & Server ===

:: Activate virtual environment
echo Activating virtual environment...
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
) else (
    echo Error: .venv virtual environment not found.
    pause
    exit /b 1
)

:: Install or upgrade requirements
echo Checking and installing dependencies...
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Start the Flask app
echo Starting Flask Server...
python run.py

pause
