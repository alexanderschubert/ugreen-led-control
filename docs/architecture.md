# Architecture

- `plugin/ugreen-led-control.plg` – Unraid plugin: loads `led_ugreen` if no other plugin did, installs the web files.
- `src/backend/ugreen-led-ctl` – CLI over `/sys/class/leds`, prints JSON for reads.
- `src/web/api.php` – JSON API used by the settings page.
- `src/web/UGREENLEDControl.page`, `js/`, `css/` – the settings page.

Planned: a userspace daemon talking to the controller through `i2c-dev`, so Unraid kernel updates no longer need a new driver build. It also runs software effects (rainbow, temperature, schedules).
