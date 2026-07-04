#!/bin/bash
# Get the directory where the script is located, then go up one level to the project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

cd "$PROJECT_ROOT"

echo "=== Starting Hope Chat Setup & Server ==="
# Activate virtual environment
echo "Activating virtual environment..."
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Error: .venv virtual environment not found in $PROJECT_ROOT"
    exit 1
fi

# Install or upgrade requirements
echo "Checking and installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Start the Flask app
echo "Starting Flask Server..."
python run.py
