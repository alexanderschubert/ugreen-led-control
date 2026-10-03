#!/bin/bash

# ============================================================
# UGREEN LED Control
# Independent UGREEN LED kernel driver manager
# ============================================================

set -u

PLUGIN_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
KERNEL="$(uname -r)"

DRIVER_NAME="led_ugreen"
MODULE_NAME="led-ugreen"

SOURCE_MODULE="$PLUGIN_DIR/driver/packages/$KERNEL/led-ugreen.ko.xz"
TARGET_DIR="/lib/modules/$KERNEL/extra"
TARGET_MODULE="$TARGET_DIR/led-ugreen.ko.xz"

log() {
    echo "[UGREEN LED Control] $1"
}

error() {
    echo "[UGREEN LED Control] ERROR: $1" >&2
}

is_loaded() {
    lsmod | grep -q "^${DRIVER_NAME} "
}

is_ugreen_hardware_present() {
    [ -d "/sys/bus/i2c/devices/0-003a" ]
}

has_led_devices() {
    [ -d "/sys/class/leds/power" ]
}

get_source_hash() {
    if [ -f "$SOURCE_MODULE" ]; then
        sha256sum "$SOURCE_MODULE" | awk '{print $1}'
    fi
}

get_target_hash() {
    if [ -f "$TARGET_MODULE" ]; then
        sha256sum "$TARGET_MODULE" | awk '{print $1}'
    fi
}

show_status() {

    echo
    echo "===== UGREEN LED DRIVER STATUS ====="
    echo "Kernel: $KERNEL"
    echo "Plugin directory: $PLUGIN_DIR"
    echo

    echo "Hardware:"
    if is_ugreen_hardware_present; then
        echo "  I2C 0x3a: FOUND"
    else
        echo "  I2C 0x3a: NOT FOUND"
    fi

    echo
    echo "Plugin driver:"
    if [ -f "$SOURCE_MODULE" ]; then
        echo "  FOUND"
        echo "  $SOURCE_MODULE"
        echo "  SHA256: $(get_source_hash)"
    else
        echo "  NOT FOUND"
    fi

    echo
    echo "System driver:"
    if [ -f "$TARGET_MODULE" ]; then
        echo "  FOUND"
        echo "  $TARGET_MODULE"
        echo "  SHA256: $(get_target_hash)"
    else
        echo "  NOT FOUND"
    fi

    echo
    echo "Module:"
    if is_loaded; then
        echo "  led_ugreen: LOADED"
    else
        echo "  led_ugreen: NOT LOADED"
    fi

    echo
    echo "LED subsystem:"
    if has_led_devices; then
        echo "  AVAILABLE"
    else
        echo "  NOT AVAILABLE"
    fi
}

install_driver() {

    log "Starting driver installation..."
    log "Kernel: $KERNEL"

    if ! is_ugreen_hardware_present; then
        error "UGREEN I2C device 0x3a was not detected."
        error "No compatible UGREEN LED hardware found."
        return 1
    fi

    log "UGREEN I2C hardware detected."

    if [ ! -f "$SOURCE_MODULE" ]; then
        error "No driver package for kernel $KERNEL."
        error "Expected:"
        error "$SOURCE_MODULE"
        return 1
    fi

    mkdir -p "$TARGET_DIR"

    SOURCE_HASH="$(get_source_hash)"
    TARGET_HASH="$(get_target_hash)"

    if [ -f "$TARGET_MODULE" ] && [ "$SOURCE_HASH" = "$TARGET_HASH" ]; then

        log "Installed driver matches plugin driver."

    else

        if [ -f "$TARGET_MODULE" ]; then
            log "Installed driver differs from plugin driver."
            log "Updating driver..."
        else
            log "Installing driver..."
        fi

        cp "$SOURCE_MODULE" "$TARGET_MODULE"
        chmod 644 "$TARGET_MODULE"

        log "Driver installed."
    fi

    log "Updating module dependencies..."

    depmod -a "$KERNEL"

    if is_loaded; then
        log "led_ugreen is already loaded."
    else
        log "Loading led_ugreen..."

        if ! modprobe "$DRIVER_NAME"; then
            error "Failed to load $DRIVER_NAME."
            return 1
        fi
    fi

    sleep 1

    if ! is_loaded; then
        error "led_ugreen is not loaded."
        return 1
    fi

    log "led_ugreen loaded successfully."

    if ! has_led_devices; then
        error "Kernel driver loaded but LED devices were not created."
        return 1
    fi

    LED_COUNT="$(find /sys/class/leds \
        -maxdepth 1 \
        -mindepth 1 \
        -type l 2>/dev/null | wc -l)"

    log "Detected LED devices: $LED_COUNT"

    if [ "$LED_COUNT" -lt 1 ]; then
        error "No LED devices detected."
        return 1
    fi

    log "UGREEN LED driver is READY."

    return 0
}

case "${1:-status}" in

    status)
        show_status
        ;;

    install)
        install_driver
        ;;

    *)
        echo
        echo "UGREEN LED Control driver manager"
        echo
        echo "Usage:"
        echo "  $0 status"
        echo "  $0 install"
        echo
        exit 1
        ;;

esac
