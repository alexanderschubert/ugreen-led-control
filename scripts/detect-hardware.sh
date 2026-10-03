#!/bin/bash
set -u
echo '=== UGREEN LED Control hardware diagnostics ==='
echo "Kernel: $(uname -r)"
echo '--- I2C adapters ---'
ls -l /dev/i2c-* 2>/dev/null || echo 'No /dev/i2c-* devices found.'
echo '--- DMI ---'
dmidecode -s system-product-name 2>/dev/null || true
echo '--- USB ---'
lsusb 2>/dev/null | grep -iE 'ugreen|nas|i2c' || true
