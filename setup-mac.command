#!/bin/bash
# Double-click this file in Finder to set up Veilwright MCP — no manual
# terminal commands needed. Opens a Terminal window to show progress,
# but nothing needs to be typed.
cd "$(dirname "$0")" || exit 1

if ! command -v node &> /dev/null; then
  echo "Node.js was not found on this Mac."
  echo "Install it from https://nodejs.org (choose the LTS version, not 'Current'), then double-click this file again."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

node setup.js
STATUS=$?

echo ""
read -r -p "Press Enter to close this window..."
exit $STATUS
