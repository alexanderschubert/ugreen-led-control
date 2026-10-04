#!/bin/bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="/usr/local/emhttp/plugins/ugreen-led-control"

echo "Installing UGREEN LED Control development build..."
echo "Source: $ROOT"
echo "Target: $DEST"

# The running daemon belongs to the old files.
if [ -x "$DEST/backend/ugreen-led-ctl" ]; then
    "$DEST/backend/ugreen-led-ctl" fx stop >/dev/null 2>&1 || true
    "$DEST/backend/ugreen-led-ctl" daemon stop >/dev/null 2>&1 || true
fi

# Hardware access goes through /dev/i2c-N; led_ugreen (up to 0.5.1) would hold 0x3a.
modprobe i2c-dev
if grep -q '^led_ugreen ' /proc/modules; then
    for device in /sys/bus/i2c/devices/*-003a; do
        if [ -e "$device" ]; then
            echo 0x3a > "$(dirname "$(readlink -f "$device")")/delete_device"
        fi
    done
    rmmod led_ugreen
fi

rm -rf "$DEST"

mkdir -p "$DEST/backend"
mkdir -p "$DEST/css"
mkdir -p "$DEST/js"

cp "$ROOT/src/backend/ugreen-led-ctl" \
   "$DEST/backend/ugreen-led-ctl"

cp "$ROOT/src/web/api.php" \
   "$DEST/api.php"

cp "$ROOT/src/web/UGREENLEDControl.page" \
   "$DEST/UGREENLEDControl.page"

cp "$ROOT/src/web/css/app.css" \
   "$DEST/css/app.css"

cp "$ROOT/src/web/js/app.js" \
   "$DEST/js/app.js"

# The binary comes from CI (build/ugreen-led-i2c, ignored by git) or a release.
if [ -f "$ROOT/build/ugreen-led-i2c" ]; then
    cp "$ROOT/build/ugreen-led-i2c" "$DEST/backend/ugreen-led-i2c"
else
    echo "build/ugreen-led-i2c missing – download the CI artifact or a release binary first." >&2
    exit 1
fi

chmod 755 "$DEST/backend/ugreen-led-ctl" "$DEST/backend/ugreen-led-i2c"
chmod 644 "$DEST/api.php"
chmod 644 "$DEST/UGREENLEDControl.page"
chmod 644 "$DEST/css/app.css"
chmod 644 "$DEST/js/app.js"

"$DEST/backend/ugreen-led-ctl" apply
if grep -qx 'mode="status"' /boot/config/plugins/ugreen-led-control/leds.cfg 2>/dev/null; then
    "$DEST/backend/ugreen-led-ctl" daemon start
fi
"$DEST/backend/ugreen-led-ctl" schedule --force
if grep -q '^fx_name="[a-z]' /boot/config/plugins/ugreen-led-control/leds.cfg 2>/dev/null; then
    "$DEST/backend/ugreen-led-ctl" fx start
fi

echo "* * * * * $DEST/backend/ugreen-led-ctl schedule >/dev/null 2>&1" > /boot/config/plugins/ugreen-led-control/ugreen-led-control.cron
/usr/local/sbin/update_cron

echo
echo "Installation complete."
echo
echo "Installed files:"
find "$DEST" -maxdepth 3 -type f | sort
