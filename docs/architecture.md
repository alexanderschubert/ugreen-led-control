# Architecture

- `plugin/ugreen-led-control.plg` – Unraid plugin: downloads the files of its tag and the `ugreen-led-i2c` release binary, loads `i2c-dev`, restores the saved settings and starts the status daemon in status mode.
- `i2c/` – `ugreen-led-i2c`: probe/get/set over `/dev/i2c-N`, serialised with a lock file.
- `src/backend/ugreen-led-ctl` – LED commands for the API, `apply`, `bays` and the status daemon (disk activity from `/sys/block/*/stat`, disk errors from `disks.ini`, network traffic from `/sys/class/net/*/statistics`).
- `src/web/api.php` – JSON API used by the settings page; saves every change to `leds.cfg`.
- `src/web/UGREENLEDControl.page`, `js/`, `css/` – the settings page.
