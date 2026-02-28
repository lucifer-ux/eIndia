#!/bin/bash
# Start the Python voice server (STT + TTS)
cd "$(dirname "$0")"

# Use Python 3.11 (3.14 has compatibility issues with some ML packages)
PYTHON=python3.11
if ! command -v $PYTHON &> /dev/null; then
  PYTHON=python3.12
fi
if ! command -v $PYTHON &> /dev/null; then
  PYTHON=python3
fi

if [ ! -d "venv" ]; then
  echo "Creating Python virtual environment with $PYTHON..."
  $PYTHON -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies (this may take a few minutes on first run)..."
pip install --upgrade pip setuptools -q
pip install -r requirements.txt -q

echo "Starting voice server on port 5001..."
python server.py
