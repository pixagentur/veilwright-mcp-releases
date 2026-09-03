#!/bin/bash
# Run this (double-click if your file manager supports it, or
# `./setup-linux.sh` in a terminal) to set up Veilwright MCP.
cd "$(dirname "$0")" || exit 1

if ! command -v node &> /dev/null; then
  echo "Node.js was not found. Install it via your distribution's package manager (or https://nvm.sh), then run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

node setup.js
STATUS=$?

echo ""
read -r -p "Press Enter to close..."
exit $STATUS
