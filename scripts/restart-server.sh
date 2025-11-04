#!/bin/bash

# Script to kill and restart the development server
# This script kills any existing dev server processes and starts a new one

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Killing existing dev server processes...${NC}"

# Kill processes on common dev server ports
# Port 5173 is the default Vite dev server port
# Port 3000 is also commonly used
for port in 5173 3000; do
  if lsof -ti:$port > /dev/null 2>&1; then
    echo -e "${YELLOW}Killing process on port $port...${NC}"
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
  fi
done

# Also try to kill any node processes that might be running the dev server
# This is a more aggressive approach - uncomment if needed
# pkill -f "vite" || true
# pkill -f "node.*dev" || true

echo -e "${GREEN}Existing processes killed.${NC}"

# Wait a moment for ports to be released
sleep 1

echo -e "${YELLOW}Starting dev server...${NC}"

# Navigate to project root
cd "$(dirname "$0")/.."

# Check which package manager is available and start the server
if command -v yarn &> /dev/null; then
  echo -e "${GREEN}Using yarn to start the server${NC}"
  yarn dev
elif command -v npm &> /dev/null; then
  echo -e "${GREEN}Using npm to start the server${NC}"
  npm run dev
else
  echo -e "${RED}Error: Neither yarn nor npm found. Please install one of them.${NC}"
  exit 1
fi

