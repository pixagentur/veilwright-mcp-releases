#!/bin/bash
# Double-click this file in Finder to update Veilwright MCP to the latest
# version. Unlike setup-mac.command, this file already lives inside your
# already-approved install folder — no new Gatekeeper "Apple could not
# verify..." block to click through, that only ever happens once, for a
# freshly-downloaded file. Downloads the latest release, replaces the
# shipped files, reinstalls dependencies, and verifies it actually works
# before saying so.
cd "$(dirname "$0")" || exit 1

if ! command -v node &> /dev/null; then
  echo "Node.js was not found on this Mac."
  echo "Install it from https://nodejs.org (choose the LTS version, not 'Current'), then run this again."
  read -r -p "Press Enter to close this window..."
  exit 1
fi

node update.js
STATUS=$?

echo ""
read -r -p "Press Enter to close this window..."
exit $STATUS
