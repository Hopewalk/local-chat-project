#!/bin/bash

# Exit on error
set -e

echo "=== Starting Hope Chat Setup & Server ==="

# Check if python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is not installed. Please install Python to continue."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment (.venv)..."
    python3 -m venv .venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Install or upgrade requirements
echo "Checking and installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Start the Flask app
echo "Starting Flask Server on port 5001..."
python app.py
