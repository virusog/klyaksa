#!/bin/bash
# Publishes the committed app to GitHub Pages (branch gh-pages).
# Each release gets its own offline cache name, so installed apps pick it up.
set -euo pipefail
cd "$(dirname "$0")"

if ! git diff --quiet HEAD; then
  echo "Commit your changes first." >&2
  exit 1
fi

sha=$(git rev-parse --short=10 HEAD)
remote=$(git remote get-url origin)
name=$(git config user.name)
email=$(git config user.email)
out=$(mktemp -d)

cp -R index.html manifest.webmanifest sw.js css js icons "$out"/
sed -i '' "s/klyaksa-dev/klyaksa-$sha/" "$out/sw.js"
touch "$out/.nojekyll"

cd "$out"
git init -q -b gh-pages
git add -A
git -c user.name="$name" -c user.email="$email" commit -q -m "Release $sha

Co-Authored-By: Claude <noreply@anthropic.com>"
git push -q -f "$remote" gh-pages
rm -rf "$out"
echo "Published $sha"
