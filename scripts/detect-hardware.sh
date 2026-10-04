#!/bin/bash
#
# UGREEN LED Control – read-only hardware check.
# Usage: bash scripts/detect-hardware.sh [path/to/ugreen-led-i2c]
#

set -u

TOOL="${1:-/usr/local/emhttp/plugins/ugreen-led-control/backend/ugreen-led-i2c}"

echo "Model:   $(cat /sys/class/dmi/id/product_name 2>/dev/null || echo unknown)"
echo "Kernel:  $(uname -r)"
echo "SMBus:   $(grep -H . /sys/bus/i2c/devices/i2c-*/name 2>/dev/null | grep -i 'SMBus I801' || echo 'no SMBus I801 adapter')"
echo "i2c-dev: $(lsmod | grep -q '^i2c_dev ' && echo loaded || echo 'not loaded (modprobe i2c-dev)')"

if lsmod | grep -q '^led_ugreen '; then
    echo "Note:    led_ugreen is loaded and holds 0x3a; the probe below uses --force."
    "$TOOL" --force probe
else
    "$TOOL" probe
fi
