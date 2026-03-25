<?php
function env_value(string $key, ?string $default = null): ?string {
    static $env = null;
    if ($env === null) {
        $env = [];
        $envFiles = [
            __DIR__ . '/../.env',
            __DIR__ . '/../.env.local',
            __DIR__ . '/../.env.development',
        ];

        foreach ($envFiles as $envFile) {
            if (!file_exists($envFile)) continue;

            foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
                if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
                [$k, $v] = explode('=', $line, 2);
                $env[trim($k)] = trim($v);
            }
        }
    }
    return $_ENV[$key] ?? $_SERVER[$key] ?? $env[$key] ?? $default;
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?: []) : [];
}

function response($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function request_method(): string {
    return $_SERVER['REQUEST_METHOD'] ?? 'GET';
}

function query(string $key, $default = null) {
    return $_GET[$key] ?? $default;
}

function idr($value): string {
    return 'Rp ' . number_format((float) $value, 0, ',', '.');
}
