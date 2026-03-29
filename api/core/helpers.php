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

function client_ip(): string {
    $forwardedFor = trim((string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($forwardedFor !== '') {
        $parts = explode(',', $forwardedFor);
        $ip = trim((string) ($parts[0] ?? ''));
        if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
    }

    $realIp = trim((string) ($_SERVER['HTTP_X_REAL_IP'] ?? ''));
    if ($realIp !== '' && filter_var($realIp, FILTER_VALIDATE_IP)) return $realIp;

    $remoteAddr = trim((string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'));
    return filter_var($remoteAddr, FILTER_VALIDATE_IP) ? $remoteAddr : '0.0.0.0';
}

function rate_limit_or_fail(string $bucket, int $maxRequests, int $windowSeconds, string $message = 'Terlalu banyak permintaan, coba lagi nanti.'): void {
    if ($maxRequests <= 0 || $windowSeconds <= 0) return;

    $safeBucket = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $bucket);
    $dir = __DIR__ . '/../storage/ratelimits';
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    $file = $dir . '/' . $safeBucket . '.json';

    $now = time();
    $windowStart = $now - $windowSeconds;
    $hits = [];

    $fh = @fopen($file, 'c+');
    if (!$fh) return;

    try {
        if (!flock($fh, LOCK_EX)) return;
        $raw = stream_get_contents($fh);
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) $hits = $decoded;
        }

        $hits = array_values(array_filter($hits, static fn($ts) => is_numeric($ts) && (int) $ts >= $windowStart));
        if (count($hits) >= $maxRequests) {
            response(['message' => $message], 429);
        }

        $hits[] = $now;
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($hits));
        fflush($fh);
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}
