<?php

function doku_config(): array
{
    $environmentRaw = strtolower(trim((string) setting_value('doku_environment', 'production')));
    $environment = $environmentRaw === 'sandbox' ? 'sandbox' : 'production';
    $clientIdSetting = trim((string) setting_value('doku_client_id', ''));
    $secretKeySetting = trim((string) setting_value('doku_secret_key', ''));
    $clientIdEnv = trim((string) env_value('DOKU_CLIENT_ID', ''));
    $secretKeyEnv = trim((string) env_value('DOKU_SECRET_KEY', ''));

    return [
        'environment' => $environment,
        'client_id' => $clientIdSetting !== '' ? $clientIdSetting : $clientIdEnv,
        'secret_key' => $secretKeySetting !== '' ? $secretKeySetting : $secretKeyEnv,
        'base_url' => $environment === 'sandbox'
            ? 'https://api-sandbox.doku.com'
            : 'https://api.doku.com',
    ];
}

function doku_is_config_valid(array $cfg): bool
{
    return trim((string) ($cfg['client_id'] ?? '')) !== '' && trim((string) ($cfg['secret_key'] ?? '')) !== '';
}

function doku_minify_json_body(string $rawBody): string
{
    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        return trim($rawBody);
    }
    $encoded = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return $encoded === false ? trim($rawBody) : $encoded;
}

function doku_digest(string $body): string
{
    return base64_encode(hash('sha256', $body, true));
}

function doku_signature(string $clientId, string $requestId, string $timestamp, string $requestTarget, string $digest, string $secretKey): string
{
    $raw = "Client-Id:{$clientId}\nRequest-Id:{$requestId}\nRequest-Timestamp:{$timestamp}\nRequest-Target:{$requestTarget}\nDigest:{$digest}";
    return 'HMACSHA256=' . base64_encode(hash_hmac('sha256', $raw, $secretKey, true));
}

function doku_signature_without_digest(string $clientId, string $requestId, string $timestamp, string $requestTarget, string $secretKey): string
{
    $raw = "Client-Id:{$clientId}\nRequest-Id:{$requestId}\nRequest-Timestamp:{$timestamp}\nRequest-Target:{$requestTarget}";
    return 'HMACSHA256=' . base64_encode(hash_hmac('sha256', $raw, $secretKey, true));
}

function doku_request_headers(string $requestTarget, string $body, array $cfg): array
{
    $clientId = trim((string) ($cfg['client_id'] ?? ''));
    $secretKey = trim((string) ($cfg['secret_key'] ?? ''));
    $requestId = bin2hex(random_bytes(16));
    $timestamp = gmdate('Y-m-d\TH:i:s\Z');
    $minifiedBody = doku_minify_json_body($body);
    $digest = doku_digest($minifiedBody);
    $signature = doku_signature($clientId, $requestId, $timestamp, $requestTarget, $digest, $secretKey);

    return [
        'Client-Id: ' . $clientId,
        'Request-Id: ' . $requestId,
        'Request-Timestamp: ' . $timestamp,
        'Digest: ' . $digest,
        'Signature: ' . $signature,
        'Content-Type: application/json',
        'Accept: application/json',
    ];
}

function doku_post(string $path, array $payload, array $cfg): array
{
    $url = rtrim((string) ($cfg['base_url'] ?? ''), '/') . $path;
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        throw new RuntimeException('Payload DOKU tidak valid');
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => doku_request_headers($path, $body, $cfg),
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HEADER => false,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('DOKU request gagal: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Respons DOKU tidak valid');
    }
    if ($status >= 400) {
        $message = '';
        if (isset($decoded['message']) && is_array($decoded['message']) && !empty($decoded['message'][0])) {
            $message = trim((string) $decoded['message'][0]);
        }
        if ($message === '') {
            $message = trim((string) ($decoded['error']['message'] ?? $decoded['response']['message'] ?? ''));
        }
        if ($message === '') $message = 'HTTP ' . $status;
        throw new RuntimeException($message);
    }

    return $decoded;
}

function doku_get(string $path, array $cfg): array
{
    $url = rtrim((string) ($cfg['base_url'] ?? ''), '/') . $path;
    $clientId = trim((string) ($cfg['client_id'] ?? ''));
    $secretKey = trim((string) ($cfg['secret_key'] ?? ''));
    $requestId = bin2hex(random_bytes(16));
    $timestamp = gmdate('Y-m-d\TH:i:s\Z');
    $signature = doku_signature_without_digest($clientId, $requestId, $timestamp, $path, $secretKey);

    $headers = [
        'Client-Id: ' . $clientId,
        'Request-Id: ' . $requestId,
        'Request-Timestamp: ' . $timestamp,
        'Signature: ' . $signature,
        'Accept: application/json',
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADER => false,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('DOKU request gagal: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Respons DOKU tidak valid');
    }
    if ($status >= 400) {
        $message = trim((string) ($decoded['message'][0] ?? $decoded['message'] ?? $decoded['error']['message'] ?? ''));
        if ($message === '') $message = 'HTTP ' . $status;
        throw new RuntimeException($message);
    }

    return $decoded;
}

function doku_extract_redirect_url(array $response): string
{
    $candidates = [
        $response['response']['payment']['url'] ?? null,
        $response['payment']['url'] ?? null,
        $response['url'] ?? null,
        $response['payment_url'] ?? null,
        $response['checkout_url'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        $url = trim((string) $candidate);
        if ($url !== '') {
            return $url;
        }
    }

    return '';
}

function doku_extract_reference_id(array $payload): string
{
    return trim((string) ($payload['order']['invoice_number'] ?? ''));
}

function doku_is_paid_payload(array $payload): bool
{
    $status = strtoupper(trim((string) ($payload['transaction']['status'] ?? '')));
    return $status === 'SUCCESS';
}

function doku_is_failed_payload(array $payload): bool
{
    $status = strtoupper(trim((string) ($payload['transaction']['status'] ?? '')));
    return in_array($status, ['FAILED', 'EXPIRED', 'CANCELLED', 'DENIED', 'TIMEOUT'], true);
}

function doku_get_status(string $invoiceNumber, array $cfg): array
{
    $invoiceNumber = trim($invoiceNumber);
    if ($invoiceNumber === '') {
        throw new RuntimeException('Invoice DOKU wajib diisi');
    }
    return doku_get('/orders/v1/status/' . rawurlencode($invoiceNumber), $cfg);
}

function doku_notification_headers(): array
{
    $headers = [];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            $headers[strtolower($name)] = trim((string) $value);
        }
    }
    foreach ($_SERVER as $key => $value) {
        if (str_starts_with($key, 'HTTP_')) {
            $name = strtolower(str_replace('_', '-', substr($key, 5)));
            $headers[$name] = trim((string) $value);
        }
    }
    return $headers;
}

function doku_verify_notification_signature(string $rawBody, array $headers, array $cfg, array $requestTargets): bool
{
    $clientId = trim((string) ($headers['client-id'] ?? ''));
    $requestId = trim((string) ($headers['request-id'] ?? ''));
    $timestamp = trim((string) ($headers['request-timestamp'] ?? ''));
    $signature = trim((string) ($headers['signature'] ?? ''));
    $secretKey = trim((string) ($cfg['secret_key'] ?? ''));
    if ($clientId === '' || $requestId === '' || $timestamp === '' || $signature === '' || $secretKey === '') {
        return false;
    }

    $bodyCandidates = array_values(array_unique(array_filter([
        $rawBody,
        trim($rawBody),
        doku_minify_json_body($rawBody),
    ], static fn($value) => (string) $value !== '')));

    foreach ($requestTargets as $requestTarget) {
        $requestTarget = trim((string) $requestTarget);
        if ($requestTarget === '') continue;
        foreach ($bodyCandidates as $bodyCandidate) {
            $expected = doku_signature($clientId, $requestId, $timestamp, $requestTarget, doku_digest((string) $bodyCandidate), $secretKey);
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        $expectedWithoutDigest = doku_signature_without_digest($clientId, $requestId, $timestamp, $requestTarget, $secretKey);
        if (hash_equals($expectedWithoutDigest, $signature)) {
            return true;
        }
    }

    return false;
}

function doku_payment_methods_for_channel(string $channel): array
{
    $value = strtolower(trim($channel));
    if ($value === '') return [];
    if (str_contains($value, 'qris')) return ['QRIS'];
    if (str_contains($value, 'e-wallet') || str_contains($value, 'ewallet')) return ['EMONEY_OVO', 'EMONEY_DANA', 'EMONEY_SHOPEE_PAY'];
    if (str_contains($value, 'virtual') || str_contains($value, 'transfer')) {
        return [
            'VIRTUAL_ACCOUNT_BCA',
            'VIRTUAL_ACCOUNT_BANK_MANDIRI',
            'VIRTUAL_ACCOUNT_BRI',
            'VIRTUAL_ACCOUNT_BNI',
            'VIRTUAL_ACCOUNT_BANK_PERMATA',
            'VIRTUAL_ACCOUNT_BANK_CIMB',
            'VIRTUAL_ACCOUNT_DOKU',
        ];
    }
    return [];
}
