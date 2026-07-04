#!/bin/bash
if [ -f ".venv/bin/python" ]; then
    # Running from project root
    echo "Starting Hope Chat Server..."
    .venv/bin/python run.py
elif [ -f "../.venv/bin/python" ]; then
    # Running from inside scripts/ folder
    cd ..
    echo "Starting Hope Chat Server..."
    .venv/bin/python run.py
else
    echo "Error: .venv virtual environment not found."
    exit 1
fi
