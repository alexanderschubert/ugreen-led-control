#!/bin/bash

# UGREEN LED Control
# Hardware and driver detection

set -u

KERNEL="$(uname -r)"

echo "=================================================="
echo "UGREEN LED CONTROL – HARDWARE DETECTION"
echo "=================================================="

echo
echo "===== SYSTEM ====="
echo "Kernel: $KERNEL"

echo
echo "===== I2C DEVICE ====="

I2C_DEVICE="/sys/bus/i2c/devices/0-003a"

if [ -d "$I2C_DEVICE" ]; then
    echo "I2C device: FOUND"
    echo "Address: 0x3a"
else
    echo "I2C device: NOT FOUND"
fi

echo
echo "===== DRIVER ====="

if lsmod | grep -q '^led_ugreen '; then
    echo "led_ugreen: LOADED"
else
    echo "led_ugreen: NOT LOADED"
fi

DRIVER_PATH="$(modinfo -n led_ugreen 2>/dev/null || true)"

if [ -n "$DRIVER_PATH" ]; then
    echo "Driver: $DRIVER_PATH"
else
    echo "Driver: NOT INSTALLED"
fi

echo
echo "===== LED DEVICES ====="

LED_COUNT=0

for LED in /sys/class/leds/*; do
    if [ -d "$LED" ]; then
        NAME="$(basename "$LED")"

        case "$NAME" in
            power|netdev|disk[1-8])
                echo "FOUND: $NAME"
                LED_COUNT=$((LED_COUNT + 1))
                ;;
        esac
    fi
done

echo
echo "LED count: $LED_COUNT"

echo
echo "===== HARDWARE RESULT ====="

if [ "$LED_COUNT" -gt 0 ]; then
    echo "UGREEN LED hardware: DETECTED"
    echo "Status: READY"
else
    echo "UGREEN LED hardware: NOT DETECTED"
    echo "Status: NOT READY"
fi

echo
echo "=================================================="
