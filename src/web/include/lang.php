<?php
// Interface language of the settings page and the dashboard tile: the saved
// choice (ui_lang in leds.cfg), or Unraid's own language for "auto".
function ulc_language(): array
{
    $settings = is_file('/boot/config/plugins/ugreen-led-control/leds.cfg')
        ? (parse_ini_file('/boot/config/plugins/ugreen-led-control/leds.cfg') ?: [])
        : [];
    $dynamix = is_file('/boot/config/plugins/dynamix/dynamix.cfg')
        ? (parse_ini_file('/boot/config/plugins/dynamix/dynamix.cfg', true) ?: [])
        : [];

    $unraid = str_starts_with((string)($dynamix['display']['locale'] ?? ''), 'de') ? 'de' : 'en';
    $setting = in_array($settings['ui_lang'] ?? '', ['de', 'en'], true) ? $settings['ui_lang'] : 'auto';

    return [$setting === 'auto' ? $unraid : $setting, $setting];
}
