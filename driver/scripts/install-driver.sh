#!/bin/bash

set -e

PLUGIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
KERNEL="$(uname -r)"

PACKAGE="$PLUGIN_DIR/driver/packages/$KERNEL/led-ugreen.ko.xz"
TARGET="/lib/modules/$KERNEL/extra/led-ugreen.ko.xz"

echo "[UGREEN LED Control] Kernel: $KERNEL"

if [ ! -f "$PACKAGE" ]; then
    echo "[UGREEN LED Control] ERROR: No driver for kernel $KERNEL"
    exit 1
fi

echo "[UGREEN LED Control] Installing led_ugreen..."

mkdir -p "/lib/modules/$KERNEL/extra"

cp "$PACKAGE" "$TARGET"
chmod 644 "$TARGET"

depmod -a "$KERNEL"

if lsmod | grep -q '^led_ugreen '; then
    echo "[UGREEN LED Control] led_ugreen already loaded."
else
    modprobe led_ugreen
fi

echo "[UGREEN LED Control] Driver loaded."

if [ -d /sys/class/leds/power ]; then
    echo "[UGREEN LED Control] LED subsystem detected."
else
    echo "[UGREEN LED Control] ERROR: LED subsystem not detected."
    exit 1
fi

echo "[UGREEN LED Control] Driver installation successful."
