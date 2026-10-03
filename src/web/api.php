<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$backend = '/usr/local/emhttp/plugins/ugreen-led-control/backend/ugreen-leds';

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

            respond($data);

        case 'list':
            $result = run_backend(['list']);

            $data = json_decode($result['output'], true);

            respond([
                'ok' => $result['code'] === 0,
                'leds' => is_array($data) ? $data : []
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
    $led = $input['led'] ?? '';

    if (!preg_match('/^(power|netdev|disk[1-8])$/', $led)) {
        respond([
            'ok' => false,
            'error' => 'Invalid LED'
        ], 400);
    }

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

    $result = run_backend($args);

    if ($result['code'] !== 0) {
        respond([
            'ok' => false,
            'error' => $result['output']
        ], 500);
    }

    respond([
        'ok' => true,
        'command' => $args
    ]);
}

respond([
    'ok' => false,
    'error' => 'Method not allowed'
], 405);
