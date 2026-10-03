# Hardware

Verified on a DXP6800 Pro with Unraid 7.3.2 (kernel `6.18.38-Unraid`):

- LED controller on SMBus `i2c-0` (`i2c_i801`), address `0x3a` (`/sys/bus/i2c/devices/0-003a`).
- `led_ugreen` creates `power`, `netdev` and `disk1`–`disk8`; the DXP6800 Pro only has bays 1–6.
- `disk1` is the leftmost bay.
- Per LED: `color` ("R G B", 0–255), `brightness` (0–255), `blink_type` and `trigger`.
  `blink_type` and `trigger` list all options and mark the active one: `[none] blink breath`.
  Write `blink <on_ms> <off_ms>` or `breath <on_ms> <off_ms>` to `blink_type`.
- `i2c_dev` is part of stock Unraid, so a userspace controller without a kernel module is possible.

Run `scripts/detect-hardware.sh` for a read-only check.
