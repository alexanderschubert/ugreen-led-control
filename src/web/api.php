<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$backend = '/usr/local/emhttp/plugins/ugreen-led-control/backend/ugreen-led-ctl';

if (!is_file($backend) || !is_executable($backend)) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'UGREEN LED backend not installed'
    ]);
    exit;
}

function respond(array $data, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function run_backend(array $args): array
{
    global $backend;

    $escaped = array_map('escapeshellarg', $args);

    $command = escapeshellarg($backend) . ' ' . implode(' ', $escaped);

    $output = [];
    $returnCode = 0;

    exec($command . ' 2>&1', $output, $returnCode);

    return [
        'code' => $returnCode,
        'output' => implode("\n", $output)
    ];
}

// Saved per-LED settings, restored at boot by `ugreen-led-ctl apply`.
const CONFIG_FILE = '/boot/config/plugins/ugreen-led-control/leds.cfg';

// What a backend command changes in the saved settings of one LED.
function config_changes(array $args): array
{
    switch ($args[0]) {
        case 'color':
            return ['color' => "{$args[2]} {$args[3]} {$args[4]}"];
        case 'brightness':
            return ['brightness' => $args[2]];
        case 'on':
            return ['brightness' => '255'];
        case 'off':
            return ['brightness' => '0'];
        case 'blink':
        case 'breath':
            return ['effect' => $args[0], 'on' => $args[2], 'off' => $args[3]];
        case 'stop':
            return ['effect' => 'none'];
    }

    return [];
}

function save_config(array $leds, array $changes): bool
{
    // Values are always quoted, so parse_ini_file keeps "none" and "0" as they are.
    $config = is_file(CONFIG_FILE) ? (parse_ini_file(CONFIG_FILE) ?: []) : [];

    foreach ($leds as $led) {
        foreach ($changes as $key => $value) {
            $config["{$led}_{$key}"] = (string)$value;
        }
    }

    ksort($config);

    $content = '';
    foreach ($config as $key => $value) {
        $content .= "{$key}=\"{$value}\"\n";
    }

    if (!is_dir(dirname(CONFIG_FILE))) {
        @mkdir(dirname(CONFIG_FILE), 0777, true);
    }

    $tmp = CONFIG_FILE . '.tmp';

    return file_put_contents($tmp, $content) !== false && rename($tmp, CONFIG_FILE);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {

    $action = $_GET['action'] ?? 'status';

    switch ($action) {

        case 'status':
            $result = run_backend(['status']);

            if ($result['code'] !== 0) {
                respond([
                    'ok' => false,
                    'error' => $result['output']
                ], 500);
            }

            $data = json_decode($result['output'], true);

            if (!is_array($data)) {
                respond([
                    'ok' => false,
                    'error' => 'Invalid backend response',
                    'raw' => $result['output']
                ], 500);
            }

            $data['settings_saved'] = is_file(CONFIG_FILE);

            respond($data);

        case 'list':
            $result = run_backend(['list']);

            $data = json_decode($result['output'], true);

            respond([
                'ok' => $result['code'] === 0,
                'leds' => is_array($data) ? $data : []
            ]);

        case 'all':
            $result = run_backend(['all']);
            $data = json_decode($result['output'], true);

            if ($result['code'] !== 0 || !is_array($data)) {
                respond([
                    'ok' => false,
                    'error' => $result['output']
                ], 500);
            }

            respond([
                'ok' => true,
                'leds' => $data
            ]);

        case 'led':
            $led = $_GET['led'] ?? '';

            if (!preg_match('/^(power|netdev|disk[1-8])$/', $led)) {
                respond([
                    'ok' => false,
                    'error' => 'Invalid LED'
                ], 400);
            }

            $result = run_backend(['get', $led]);
            $data = json_decode($result['output'], true);

            if ($result['code'] !== 0 || !is_array($data)) {
                respond([
                    'ok' => false,
                    'error' => $result['output']
                ], 500);
            }

            respond($data);

        default:
            respond([
                'ok' => false,
                'error' => 'Unknown action'
            ], 400);
    }
}

if ($method === 'POST') {

    // Unraid's local_prepend.php has already rejected POSTs without a valid csrf_token.
    $input = $_POST;

    $action = $input['action'] ?? '';

    // One LED or a comma-separated list, e.g. "disk1,disk2,disk3".
    $leds = explode(',', (string)($input['led'] ?? ''));

    foreach ($leds as $led) {
        if (!preg_match('/^(power|netdev|disk[1-8])$/', $led)) {
            respond([
                'ok' => false,
                'error' => 'Invalid LED'
            ], 400);
        }
    }

    $led = '%LED%';

    switch ($action) {

        case 'on':
            $args = ['on', $led];
            break;

        case 'off':
            $args = ['off', $led];
            break;

        case 'brightness':

            $value = filter_var(
                $input['value'] ?? null,
                FILTER_VALIDATE_INT
            );

            if ($value === false || $value < 0 || $value > 255) {
                respond([
                    'ok' => false,
                    'error' => 'Brightness must be 0-255'
                ], 400);
            }

            $args = [
                'brightness',
                $led,
                (string)$value
            ];

            break;

        case 'color':

            $r = filter_var(
                $input['r'] ?? null,
                FILTER_VALIDATE_INT
            );

            $g = filter_var(
                $input['g'] ?? null,
                FILTER_VALIDATE_INT
            );

            $b = filter_var(
                $input['b'] ?? null,
                FILTER_VALIDATE_INT
            );

            if (
                $r === false || $r < 0 || $r > 255 ||
                $g === false || $g < 0 || $g > 255 ||
                $b === false || $b < 0 || $b > 255
            ) {
                respond([
                    'ok' => false,
                    'error' => 'RGB values must be 0-255'
                ], 400);
            }

            $args = [
                'color',
                $led,
                (string)$r,
                (string)$g,
                (string)$b
            ];

            break;

        case 'blink':

            $on = filter_var(
                $input['on'] ?? null,
                FILTER_VALIDATE_INT
            );

            $off = filter_var(
                $input['off'] ?? null,
                FILTER_VALIDATE_INT
            );

            if (
                $on === false || $on < 50 || $on > 10000 ||
                $off === false || $off < 50 || $off > 10000
            ) {
                respond([
                    'ok' => false,
                    'error' => 'Blink values must be 50-10000 ms'
                ], 400);
            }

            $args = [
                'blink',
                $led,
                (string)$on,
                (string)$off
            ];

            break;

        case 'breath':

            $on = filter_var(
                $input['on'] ?? null,
                FILTER_VALIDATE_INT
            );

            $off = filter_var(
                $input['off'] ?? null,
                FILTER_VALIDATE_INT
            );

            if (
                $on === false || $on < 100 || $on > 10000 ||
                $off === false || $off < 100 || $off > 10000
            ) {
                respond([
                    'ok' => false,
                    'error' => 'Breath values must be 100-10000 ms'
                ], 400);
            }

            $args = [
                'breath',
                $led,
                (string)$on,
                (string)$off
            ];

            break;

        case 'stop':
            $args = ['stop', $led];
            break;

        default:
            respond([
                'ok' => false,
                'error' => 'Unknown command'
            ], 400);
    }

    foreach ($leds as $target) {
        $result = run_backend(
            array_map(fn ($arg) => $arg === '%LED%' ? $target : $arg, $args)
        );

        if ($result['code'] !== 0) {
            respond([
                'ok' => false,
                'error' => "{$target}: {$result['output']}"
            ], 500);
        }
    }

    if (!save_config($leds, config_changes($args))) {
        respond([
            'ok' => false,
            'error' => 'Auf die LEDs geschrieben, aber nicht gespeichert: ' . CONFIG_FILE . ' ist nicht beschreibbar'
        ], 500);
    }

    respond([
        'ok' => true,
        'leds' => $leds
    ]);
}

respond([
    'ok' => false,
    'error' => 'Method not allowed'
], 405);
