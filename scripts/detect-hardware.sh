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
echo "i2c-dev: $(grep -q '^i2c_dev ' /proc/modules && echo loaded || echo 'not loaded (modprobe i2c-dev)')"
echo "i801:    $(grep -q '^i2c_i801 ' /proc/modules && echo loaded || echo 'not loaded (modprobe i2c_i801)')"
dmesg | grep -iE 'i801|smbus' | tail -n 5 | sed 's/^/dmesg:   /'

if grep -q '^led_ugreen ' /proc/modules; then
    echo "Note:    led_ugreen is loaded and holds 0x3a; the probe below uses --force."
    "$TOOL" --force probe
else
    "$TOOL" probe
fi
