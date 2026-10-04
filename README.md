# UGREEN LED Control for Unraid

LED control for UGREEN NAS devices on Unraid 7, developed on a DXP6800 Pro.

## Support

Questions and problems: the [support thread in the Unraid forum](https://forums.unraid.net/topic/200791-plugin-ugreen-led-control-led-control-for-ugreen-dxdxp-nas/). Bug reports and feature requests are also welcome as [GitHub issues](https://github.com/alexanderschubert/ugreen-led-control/issues).

## Supported models

The LED controller (I2C address 0x3a on the SMBus I801 adapter) is the same across UGREEN's DX/DXP series. Bays are matched to disks by SATA port, after [miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller):

| Model | Bays → SATA ports | Assignment |
|---|---|---|
| DXP6800 Pro | ata3, ata4, ata5, ata6, ata1, ata2 | verified (developed on it) |
| DXP8800 Plus | ata1 … ata8 | verified by miskcoo |
| DX4600 Pro | ata1 … ata4 | verified by miskcoo |
| DXP4800 / Plus / Pro, DX4700, DXP2800 | ata1 … ataN | reported by users |
| other models | ata1 … ataN | guessed |

The System page shows which applies; "Identifizieren / Identify" on the Laufwerke page checks it. Not supported: DXP2800 V1.2 and the GT models, which miskcoo lists as experimental.

## Install

Unraid → Plugins → Install Plugin:

```
https://raw.githubusercontent.com/alexanderschubert/ugreen-led-control/main/plugin/ugreen-led-control.plg
```

The settings page is at Settings → UGREEN LED Control.

## How it works

- `i2c/` – `ugreen-led-i2c`, a static Go tool that talks to the LED controller (address 0x3a on the "SMBus I801 adapter") through `/dev/i2c-N`. No kernel module, so new Unraid kernels keep working. Protocol after [miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller).
- `src/backend/ugreen-led-ctl` – settings (`apply`), bay mapping (`bays`) and the status daemon, on top of `ugreen-led-i2c`.
- `src/web/api.php` is the JSON API for the settings page; writes need the WebGUI `csrf_token`.

## Development

Copy the working tree onto the running system without a release. It needs `build/ugreen-led-i2c` (the CI artifact of the "I2C tool" workflow, e.g. `gh run download <id> -n ugreen-led-i2c -D build`):

```
bash scripts/install-dev.sh
```

## Release

1. Bump `version` and `CHANGES` in `plugin/ugreen-led-control.plg`.
2. Merge to `main`. The `Tag release` workflow creates the tag `v<version>` and a release with the `ugreen-led-i2c` binary.

The plugin downloads its files from that tag and the binary from the release. Wait for the workflow to finish (about a minute) before updating in Unraid; an update attempted earlier can leave GitHub caching a 404 for up to five minutes.

## License

MIT.
