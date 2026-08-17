#!/usr/bin/env bash
# Builds the release zip that gets attached to a GitHub Release.
# The zip is deliberately gitignored: it goes stale the moment a source file changes,
# so it is built on demand rather than committed.
set -euo pipefail

cd "$(dirname "$0")"
SRC="netsuite-dark"
VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SRC/manifest.json")
OUT="netsuite-dark-mode-${VERSION}.zip"

# Refuse to ship a manifest that Chrome would reject at load.
python3 -c "import json,sys; json.load(open('$SRC/manifest.json'))" \
  || { echo "manifest.json is not valid JSON"; exit 1; }
for f in "$SRC"/*.js; do
  node --check "$f" >/dev/null || { echo "syntax error in $f"; exit 1; }
done

find . -name ".DS_Store" -delete
rm -f "$OUT"
zip -r -X "$OUT" "$SRC" -x "*.DS_Store" "__MACOSX/*" >/dev/null

echo "built $OUT ($(du -h "$OUT" | cut -f1))"
echo "attach it to a GitHub Release; do not commit it"
