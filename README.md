# UGREEN LED Control for Unraid

LED control for UGREEN NAS devices on Unraid 7, developed on a DXP6800 Pro.

## Install

Unraid → Plugins → Install Plugin:

```
https://raw.githubusercontent.com/alexanderschubert/ugreen-led-control/main/plugin/ugreen-led-control.plg
```

The settings page is at Settings → UGREEN LED Control.

## How it works

- `led_ugreen` (see [driver/](driver/README.md)) exposes the LEDs as `/sys/class/leds/{power,netdev,disk1..8}`.
- `src/backend/ugreen-led-ctl` reads and writes those sysfs files.
- `src/web/api.php` is the JSON API for the settings page; writes need the WebGUI `csrf_token`.

## Development

Copy the working tree onto the running system without a release:

```
bash scripts/install-dev.sh
```

## Release

1. Bump `version` and `CHANGES` in `plugin/ugreen-led-control.plg`.
2. Merge to `main`. The `Tag release` workflow creates the tag `v<version>`.

The plugin downloads its files from that tag. Wait for the workflow to finish (about a minute) before updating in Unraid; an update attempted earlier can leave GitHub caching a 404 for up to five minutes.

## License

MIT, except the kernel module in `driver/` (GPL-2.0).
