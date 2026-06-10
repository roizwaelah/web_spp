<?php

function midtrans_config(): array
{
    $environmentRaw = strtolower(trim((string) setting_value('midtrans_environment', 'production')));
    $environment = $environmentRaw === 'sandbox' ? 'sandbox' : 'production';
    $serverKeySetting = trim((string) setting_value('midtrans_server_key', ''));
    $clientKeySetting = trim((string) setting_value('midtrans_client_key', ''));
    $serverKeyEnv = trim((string) env_value('MIDTRANS_SERVER_KEY', ''));
    $clientKeyEnv = trim((string) env_value('MIDTRANS_CLIENT_KEY', ''));

    return [
        'environment' => $environment,
        'server_key' => $serverKeySetting !== '' ? $serverKeySetting : $serverKeyEnv,
        'client_key' => $clientKeySetting !== '' ? $clientKeySetting : $clientKeyEnv,
        'base_url' => $environment === 'sandbox'
            ? 'https://app.sandbox.midtrans.com'
            : 'https://app.midtrans.com',
        'api_url' => $environment === 'sandbox'
            ? 'https://api.sandbox.midtrans.com'
            : 'https://api.midtrans.com',
    ];
}

function midtrans_is_config_valid(array $cfg): bool
{
    return trim((string) ($cfg['server_key'] ?? '')) !== '';
}

function midtrans_basic_auth(string $serverKey): string
{
    return 'Basic ' . base64_encode($serverKey . ':');
}

function midtrans_post(string $path, array $payload, array $cfg): array
{
    $url = rtrim((string) ($cfg['base_url'] ?? ''), '/') . $path;
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        throw new RuntimeException('Payload Midtrans tidak valid');
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: ' . midtrans_basic_auth((string) ($cfg['server_key'] ?? '')),
        ],
        CURLOPT_POSTFIELDS => $body,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Midtrans request gagal: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Respons Midtrans tidak valid');
    }
    if ($status >= 400) {
        $message = trim((string) ($decoded['error_messages'][0] ?? $decoded['status_message'] ?? ''));
        if ($message === '') $message = 'HTTP ' . $status;
        throw new RuntimeException($message);
    }

    return $decoded;
}

function midtrans_get_status(string $orderId, array $cfg): array
{
    $url = rtrim((string) ($cfg['api_url'] ?? ''), '/') . '/v2/' . rawurlencode($orderId) . '/status';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'Authorization: ' . midtrans_basic_auth((string) ($cfg['server_key'] ?? '')),
        ],
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $error = curl_error($ch);
        curl_close($ch);
        throw new RuntimeException('Midtrans status gagal: ' . $error);
    }
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Respons status Midtrans tidak valid');
    }
    if ($status >= 400) {
        $message = trim((string) ($decoded['error_messages'][0] ?? $decoded['status_message'] ?? ''));
        if ($message === '') $message = 'HTTP ' . $status;
        throw new RuntimeException($message);
    }
    return $decoded;
}

function midtrans_extract_redirect_url(array $response): string
{
    return trim((string) ($response['redirect_url'] ?? ''));
}

function midtrans_extract_reference_id(array $payload): string
{
    return trim((string) ($payload['order_id'] ?? ''));
}

function midtrans_verify_notification_signature(array $payload, array $cfg): bool
{
    $orderId = trim((string) ($payload['order_id'] ?? ''));
    $statusCode = trim((string) ($payload['status_code'] ?? ''));
    $grossAmount = trim((string) ($payload['gross_amount'] ?? ''));
    $signature = trim((string) ($payload['signature_key'] ?? ''));
    $serverKey = trim((string) ($cfg['server_key'] ?? ''));
    if ($orderId === '' || $statusCode === '' || $grossAmount === '' || $signature === '' || $serverKey === '') {
        return false;
    }

    $expected = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);
    return hash_equals(strtolower($expected), strtolower($signature));
}

function midtrans_is_paid_payload(array $payload): bool
{
    $status = strtolower(trim((string) ($payload['transaction_status'] ?? '')));
    $fraud = strtolower(trim((string) ($payload['fraud_status'] ?? '')));
    if ($status === 'settlement') return true;
    if ($status === 'capture') {
        return $fraud === '' || $fraud === 'accept';
    }
    return false;
}

function midtrans_is_failed_payload(array $payload): bool
{
    $status = strtolower(trim((string) ($payload['transaction_status'] ?? '')));
    return in_array($status, ['deny', 'cancel', 'expire', 'failure'], true);
}

function midtrans_enabled_payments_for_channel(string $channel): array
{
    $value = strtolower(trim($channel));
    if ($value === '') return [];
    if (str_contains($value, 'qris')) return ['qris'];
    if (str_contains($value, 'e-wallet') || str_contains($value, 'ewallet')) return ['gopay', 'shopeepay'];
    if (str_contains($value, 'virtual')) return ['bank_transfer'];
    if (str_contains($value, 'transfer')) return ['bank_transfer'];
    return [];
}
