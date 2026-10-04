# Hardware

Verified on a DXP6800 Pro with Unraid 7.3.2 (kernel `6.18.38-Unraid`):

- LED controller on the "SMBus I801 adapter" (`i2c-0`), address `0x3a`. Reached through `/dev/i2c-0`, which needs the stock `i2c-dev` module.
- LED IDs: power 0, netdev 1, disk1–disk8 2–9; the DXP6800 Pro only has bays 1–6. `disk1` is the leftmost bay.
- Commands (12-byte I2C block write to register `<id>`): `0x01` brightness, `0x02` colour, `0x03` on/off, `0x04` blink, `0x05` breath; checksum `0xa1 + command + params`. Register `0x80` reads `1` once a command was accepted. Status: 11 bytes at `0x81 + id`.
- Blink/breath times: 100–32767 ms (cycle first, then the on time).
- Bays 1–6 are on SATA ports ata3, ata4, ata5, ata6, ata1, ata2.

Run `scripts/detect-hardware.sh` for a read-only check.
