#!/bin/bash
# Right-click this file in Finder -> Open (not a plain double-click —
# see docs/self-hosting.md for why: Gatekeeper blocks unsigned scripts
# downloaded from the internet on first run either way, right-click ->
# Open is the one that actually offers an "Open" button). Sets up
# Veilwright MCP with no manual terminal commands needed — opens a
# Terminal window to show progress, but nothing needs to be typed.
cd "$(dirname "$0")" || exit 1

if ! command -v node &> /dev/null; then
  echo "Node.js was not found on this Mac."
  echo "Install it from https://nodejs.org (choose the LTS version, not 'Current'), then run this again."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

node setup.js
STATUS=$?

echo ""
read -r -p "Press Enter to close this window..."
exit $STATUS
