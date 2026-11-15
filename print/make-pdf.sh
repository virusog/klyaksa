#!/bin/bash
# Renders print/invite-he.html to print/invite-he.pdf (A4 landscape, two A5 invitations).
set -euo pipefail
cd "$(dirname "$0")"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
profile=$(mktemp -d)
"$chrome" --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=8000 \
  --user-data-dir="$profile" --print-to-pdf="$PWD/invite-he.pdf" "file://$PWD/invite-he.html" 2>&1 | grep written
rm -rf "$profile"
