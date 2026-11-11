#!/bin/bash
# Developer tool: renders a content file to a PNG and prints its check report.
# Usage: tools/shot.sh <lessons|pages|pixels|guides|lab|dots|dictation|oneline> <content-file-name> <out.png> [from] [count]
# Needs a local server on port 8123 at the project root.
set -u
kind=$1; file=$2; png=$3; from=${4:-0}; count=${5:-100}
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
url="http://localhost:8123/tools/preview.html?kind=$kind&file=$file&from=$from&count=$count&t=$$$RANDOM"
profile=$(mktemp -d)
flags=(--headless=new --disable-gpu --no-first-run --no-default-browser-check --hide-scrollbars --user-data-dir="$profile" --virtual-time-budget=25000)
dom=$("$chrome" "${flags[@]}" --window-size=1600,1200 --dump-dom "$url" 2>/dev/null)
report=$(printf '%s' "$dom" | grep -o 'REPORT {.* END' | sed 's/^REPORT //; s/ END$//; s/&lt;/</g; s/&gt;/>/g; s/&amp;/\&/g')
if [ -z "$report" ]; then
  echo "NO REPORT: the page failed to run. Check the content file for a syntax or import error."
  rm -rf "$profile"
  exit 1
fi
echo "$report"
height=$(printf '%s' "$report" | sed -E 's/.*"height":([0-9]+).*/\1/')
# Chrome hangs on a very short window, so an empty file still gets a real page.
[ "$height" -lt 240 ] && height=240
"$chrome" "${flags[@]}" --window-size=1600,"$height" --screenshot="$png" "$url" >/dev/null 2>&1 &
pid=$!
# Never wait for a stuck browser for more than a minute.
( sleep 60; kill -9 $pid 2>/dev/null ) &
guard=$!
disown $guard 2>/dev/null
wait $pid 2>/dev/null
kill $guard 2>/dev/null
rm -rf "$profile"
echo "PNG: $png"
