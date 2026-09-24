#!/bin/bash
# Run this (double-click if your file manager supports it, or
# `./update-linux.sh` in a terminal) to update Veilwright MCP to the
# latest version. Downloads the latest release, replaces the shipped
# files, reinstalls dependencies, and verifies it actually works before
# saying so.
cd "$(dirname "$0")" || exit 1

if ! command -v node &> /dev/null; then
  echo "Node.js was not found. Install it via your distribution's package manager (or https://nvm.sh), then run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

node update.js
STATUS=$?

echo ""
read -r -p "Press Enter to close..."
exit $STATUS
