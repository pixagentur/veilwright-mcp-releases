#!/bin/bash
# Double-click this file in Finder. The FIRST time, macOS will block it
# ("Apple could not verify... is free of malware") — expected for any
# unsigned script downloaded from the internet, not a bug. See
# docs/self-hosting.md step 3 for the exact fix (System Settings ->
# Privacy & Security -> Open Anyway, then run it again) — still no
# Terminal typing needed. Sets up Veilwright MCP: opens a Terminal
# window to show progress, but nothing needs to be typed into it.
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
