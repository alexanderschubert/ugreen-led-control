# Icon

- `icon.svg` – the plugin icon (Plugins page, settings panel, dashboard tile, sidebar)
- `icon-small.svg` – one light strip instead of six LEDs, for the 18 px tab icon

The PNGs in `src/web/images/` (256 px) and `src/web/icons/` (64 px) are made on macOS with QuickLook,
which renders onto white; `round_alpha.py` then makes everything outside the rounded square transparent:

```
qlmanage -t -s 256 -o /tmp assets/icon.svg && cp /tmp/icon.svg.png src/web/images/ugreen-led-control.png
qlmanage -t -s 64 -o /tmp assets/icon-small.svg && cp /tmp/icon-small.svg.png src/web/icons/ugreen-led-control.png
python3 assets/round_alpha.py src/web/images/ugreen-led-control.png src/web/icons/ugreen-led-control.png
```
