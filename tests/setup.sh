#!/bin/bash
# PiCanvas Test Automation Setup Script
#
# This script sets up the Python environment for running PiCanvas tests.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "PiCanvas Test Automation Setup"
echo "======================================"

# Check Python version
echo ""
echo "Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version 2>&1)
    echo "Found: $PYTHON_VERSION"
else
    echo "Error: Python 3 is not installed"
    echo "Please install Python 3.9 or later"
    exit 1
fi

# Create virtual environment if it doesn't exist
VENV_DIR="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
    echo "Virtual environment created at: $VENV_DIR"
else
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt

# Install Playwright browsers
echo ""
echo "Installing Playwright browsers..."
playwright install chromium

echo ""
echo "======================================"
echo "Setup Complete!"
echo "======================================"
echo ""
echo "To activate the environment:"
echo "  source $VENV_DIR/bin/activate"
echo ""
echo "To run tests:"
echo "  python workbench_automation.py --headed"
echo ""
echo "To run interactive debugging:"
echo "  python interactive_debug.py"
echo ""
echo "Quick test for section-as-tab feature:"
echo "  python interactive_debug.py --headed --action test_section_tab"
echo ""
