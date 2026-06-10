<?php

function tripay_config(): array
{
    $environmentRaw = strtolower(trim((string) setting_value('tripay_environment', 'production')));
    $environment = $environmentRaw === 'sandbox' ? 'sandbox' : 'production';
    $apiKeySetting = trim((string) setting_value('tripay_api_key', ''));
    $privateKeySetting = trim((string) setting_value('tripay_private_key', ''));
    $merchantCodeSetting = trim((string) setting_value('tripay_merchant_code', ''));

    $apiKeyEnv = trim((string) env_value($environment === 'sandbox' ? 'TRIPAY_API_KEY_SANDBOX' : 'TRIPAY_API_KEY', ''));
    $privateKeyEnv = trim((string) env_value($environment === 'sandbox' ? 'TRIPAY_PRIVATE_KEY_SANDBOX' : 'TRIPAY_PRIVATE_KEY', ''));
    $merchantCodeEnv = trim((string) env_value($environment === 'sandbox' ? 'TRIPAY_MERCHANT_CODE_SANDBOX' : 'TRIPAY_MERCHANT_CODE', ''));

    return [
        'environment' => $environment,
        'api_key' => $apiKeySetting !== '' ? $apiKeySetting : $apiKeyEnv,
        'private_key' => $privateKeySetting !== '' ? $privateKeySetting : $privateKeyEnv,
        'merchant_code' => $merchantCodeSetting !== '' ? $merchantCodeSetting : $merchantCodeEnv,
        'base_url' => $environment === 'sandbox'
            ? 'https://tripay.co.id/api-sandbox'
            : 'https://tripay.co.id/api',
    ];
}

function tripay_is_config_valid(array $cfg): bool
{
    return trim((string) ($cfg['api_key'] ?? '')) !== ''
        && trim((string) ($cfg['private_key'] ?? '')) !== ''
        && trim((string) ($cfg['merchant_code'] ?? '')) !== '';
}

function tripay_auth_headers(array $cfg): array
{
    return [
        'Accept: application/json',
        'Authorization: Bearer ' . trim((string) ($cfg['api_key'] ?? '')),
    ];
}

function tripay_signature(string $merchantCode, string $merchantRef, int $amount, string $privateKey): string
{
    return hash_hmac('sha256', $merchantCode . $merchantRef . $amount, $privateKey);
}

function tripay_parse_response(string $raw, int $httpCode, string $context): array
{
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException("Respons {$context} tidak valid");
    }

    $success = (bool) ($decoded['success'] ?? false);
    if ($httpCode >= 400 || !$success) {
        $message = trim((string) ($decoded['message'] ?? ''));
        if ($message === '') $message = 'HTTP ' . $httpCode;
        throw new RuntimeException('Tripay: ' . $message);
    }

    return $decoded;
}

function tripay_post(string $path, array $payload, array $cfg): array
{
    $url = rtrim((string) ($cfg['base_url'] ?? ''), '/') . $path;
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        throw new RuntimeException('Payload Tripay tidak valid');
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => array_merge(tripay_auth_headers($cfg), [
            'Content-Type: application/json',
        ]),
        CURLOPT_POSTFIELDS => $body,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Tripay request gagal: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return tripay_parse_response($raw, $status, 'Tripay');
}

function tripay_get(string $path, array $params, array $cfg): array
{
    $query = $params ? ('?' . http_build_query($params)) : '';
    $url = rtrim((string) ($cfg['base_url'] ?? ''), '/') . $path . $query;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => tripay_auth_headers($cfg),
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Tripay request gagal: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return tripay_parse_response($raw, $status, 'Tripay');
}

function tripay_get_payment_channels(array $cfg): array
{
    return tripay_get('/merchant/payment-channel', [], $cfg);
}

function tripay_get_transaction_detail(string $reference, array $cfg): array
{
    if (trim($reference) === '') {
        throw new RuntimeException('Reference Tripay wajib diisi');
    }
    return tripay_get('/transaction/detail', ['reference' => trim($reference)], $cfg);
}

function tripay_extract_redirect_url(array $response): string
{
    $data = $response['data'] ?? [];
    $url = trim((string) ($data['checkout_url'] ?? $response['checkout_url'] ?? ''));
    return $url;
}

function tripay_extract_gateway_reference(array $response): string
{
    $data = $response['data'] ?? [];
    return trim((string) ($data['reference'] ?? $response['reference'] ?? ''));
}

function tripay_extract_reference_id(array $payload): string
{
    return trim((string) ($payload['merchant_ref'] ?? ''));
}

function tripay_is_paid_payload(array $payload): bool
{
    $status = strtoupper(trim((string) ($payload['status'] ?? ($payload['data']['status'] ?? ''))));
    return $status === 'PAID';
}

function tripay_is_failed_payload(array $payload): bool
{
    $status = strtoupper(trim((string) ($payload['status'] ?? ($payload['data']['status'] ?? ''))));
    return in_array($status, ['FAILED', 'EXPIRED', 'REFUND'], true);
}

function tripay_notification_headers(): array
{
    $headers = [];
    if (function_exists('getallheaders')) {
        foreach (getallheaders() as $name => $value) {
            $headers[strtolower($name)] = trim((string) $value);
        }
    }
    foreach ($_SERVER as $key => $value) {
        if (str_starts_with($key, 'HTTP_')) {
            $headers[strtolower(str_replace('_', '-', substr($key, 5)))] = trim((string) $value);
        }
    }
    return $headers;
}

function tripay_verify_callback_signature(string $rawBody, array $headers, array $cfg): bool
{
    $signature = trim((string) ($headers['x-callback-signature'] ?? ''));
    $event = trim((string) ($headers['x-callback-event'] ?? ''));
    $privateKey = trim((string) ($cfg['private_key'] ?? ''));
    if ($signature === '' || $event !== 'payment_status' || $privateKey === '') {
        return false;
    }

    $expected = hash_hmac('sha256', $rawBody, $privateKey);
    return hash_equals(strtolower($expected), strtolower($signature));
}

function tripay_extract_payment_info(array $response): array
{
    $data = is_array($response['data'] ?? null) ? $response['data'] : $response;
    $instructions = [];
    foreach ((array) ($data['instructions'] ?? []) as $instruction) {
        if (!is_array($instruction)) continue;
        $steps = [];
        foreach ((array) ($instruction['steps'] ?? []) as $step) {
            $stepText = trim(strip_tags((string) $step));
            if ($stepText !== '') {
                $steps[] = $stepText;
            }
        }
        $title = trim((string) ($instruction['title'] ?? ''));
        if ($title !== '' || $steps) {
            $instructions[] = [
                'title' => $title,
                'steps' => $steps,
            ];
        }
    }

    return [
        'payment_name' => trim((string) ($data['payment_name'] ?? 'Tripay')),
        'payment_method' => trim((string) ($data['payment_method'] ?? '')),
        'payment_number' => trim((string) ($data['pay_code'] ?? '')),
        'qr_string' => trim((string) ($data['qr_string'] ?? '')),
        'qr_image' => trim((string) ($data['qr_url'] ?? '')),
        'checkout_url' => trim((string) ($data['checkout_url'] ?? '')),
        'expired_at' => !empty($data['expired_time']) ? date('Y-m-d H:i:s', (int) $data['expired_time']) : '',
        'subtotal' => (float) ($data['amount'] ?? 0),
        'fee' => (float) ($data['total_fee'] ?? 0),
        'total' => (float) (($data['amount'] ?? 0) + ($data['total_fee'] ?? 0)),
        'instructions' => $instructions,
        'pay_code' => trim((string) ($data['pay_code'] ?? '')),
        'status' => trim((string) ($data['status'] ?? '')),
    ];
}
