#!/bin/bash
#
# PiCanvas Analytics Server Startup Script
#
# This script:
#   1. Checks dependencies
#   2. Installs npm packages if needed
#   3. Collects VS Code logs
#   4. Starts the analytics server
#
# Usage:
#   ./start-analytics.sh
#   ./start-analytics.sh --dev
#

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ANALYTICS_DIR="$SCRIPT_DIR"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_banner() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║    🎨 PiCanvas Analytics Server Startup                    ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}✗ $1 not found${NC}"
        return 1
    fi
    echo -e "${GREEN}✓ $1 found${NC}"
    return 0
}

print_banner

echo ""
echo -e "${BLUE}📋 Checking dependencies...${NC}"
echo ""

# Check Node.js
check_command "node" || {
    echo -e "${RED}Please install Node.js from https://nodejs.org${NC}"
    exit 1
}

# Check npm
check_command "npm" || {
    echo -e "${RED}Please install npm${NC}"
    exit 1
}

# Check Python (optional, for VS Code log collection)
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓ python3 found${NC}"
else
    echo -e "${YELLOW}⚠ python3 not found (VS Code log collection will be skipped)${NC}"
fi

echo ""
echo -e "${BLUE}📦 Installing dependencies...${NC}"
echo ""

cd "$ANALYTICS_DIR"

# Install npm packages if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing npm packages..."
    npm install
else
    echo "npm packages already installed"
fi

echo ""
echo -e "${BLUE}🔄 Collecting VS Code logs...${NC}"
echo ""

# Collect VS Code logs if Python is available
if command -v python3 &> /dev/null; then
    python3 "$ANALYTICS_DIR/collect_vscode_logs.py" --data-dir "$ANALYTICS_DIR" || true
else
    echo -e "${YELLOW}⚠ Skipping VS Code log collection (python3 not found)${NC}"
fi

echo ""
echo -e "${BLUE}🚀 Starting Analytics Server...${NC}"
echo ""

# Start server
if [ "$1" == "--dev" ]; then
    echo "Starting in development mode with auto-reload..."
    npm run dev
else
    npm start
fi
