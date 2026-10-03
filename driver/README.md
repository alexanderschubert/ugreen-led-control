# led_ugreen kernel module

`packages/<kernel>/led-ugreen.ko.xz` is a build of the `led-ugreen` kernel module from
[miskcoo/ugreen_leds_controller](https://github.com/miskcoo/ugreen_leds_controller).

The module is licensed under **GPL-2.0**, not under the MIT license of the rest of this
repository. Its source is in the upstream repository linked above.

One build per Unraid kernel. The plugin downloads the build for `uname -r`; without a
matching build the plugin installs but cannot control the LEDs.
