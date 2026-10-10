#!/usr/bin/env bash
# Build the downloadable press kit zip from a folder of press material.
# Usage: KIT_DIR=/path/to/kit npm run presskit
# Writes <content>/press/<NAME>-press-kit.zip (NAME defaults to the band name).
set -euo pipefail

: "${KIT_DIR:?Set KIT_DIR to the folder with your press material}"
CONTENT_DIR="${CONTENT_DIR:-$( [ -d content ] && echo content || echo example )}"
NAME="${NAME:-$(node -p "require('./$CONTENT_DIR/band.json').name.replace(/\\W+/g, '')")}"
OUT="$(pwd)/$CONTENT_DIR/press/$NAME-press-kit.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Copy into a nicely named top-level folder so the zip unpacks tidily.
cp -r "$KIT_DIR" "$TMP/$NAME-press-kit"

# Shrink photos to a press-friendly size (longest side 2400px, never enlarged).
find "$TMP/$NAME-press-kit" -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) \
  -exec mogrify -resize '2400x2400>' -quality 85 -strip {} +

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
(cd "$TMP" && zip -r -X -q "$OUT" "$NAME-press-kit")
echo "Wrote $OUT ($(du -h "$OUT" | cut -f1))"
