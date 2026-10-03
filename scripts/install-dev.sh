#!/bin/bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/usr/local/emhttp/plugins/ugreen-led-control"

echo "Installing UGREEN LED Control development build..."
echo "Source: $ROOT"
echo "Target: $DEST"

rm -rf "$DEST"

mkdir -p "$DEST/backend"
mkdir -p "$DEST/css"
mkdir -p "$DEST/js"

cp "$ROOT/src/backend/ugreen-leds" \
   "$DEST/backend/ugreen-leds"

cp "$ROOT/src/web/api.php" \
   "$DEST/api.php"

cp "$ROOT/src/web/UGREENLEDControl.page" \
   "$DEST/UGREENLEDControl.page"

cp "$ROOT/src/web/css/app.css" \
   "$DEST/css/app.css"

cp "$ROOT/src/web/js/app.js" \
   "$DEST/js/app.js"

chmod 755 "$DEST/backend/ugreen-leds"
chmod 644 "$DEST/api.php"
chmod 644 "$DEST/UGREENLEDControl.page"
chmod 644 "$DEST/css/app.css"
chmod 644 "$DEST/js/app.js"

echo
echo "Installation complete."
echo
echo "Installed files:"
find "$DEST" -maxdepth 3 -type f | sort
