<?php

function ipaymu_channel_registry(): array
{
    return [
        'ipaymu-va-bca' => ['payment_method' => 'va', 'payment_channels' => ['bca'], 'label' => 'VA BCA', 'min_amount' => 10000],
        'ipaymu-va-bni' => ['payment_method' => 'va', 'payment_channels' => ['bni'], 'label' => 'VA BNI', 'min_amount' => 10000],
        'ipaymu-va-bri' => ['payment_method' => 'va', 'payment_channels' => ['bri'], 'label' => 'VA BRI', 'min_amount' => 10000],
        'ipaymu-va-mandiri' => ['payment_method' => 'va', 'payment_channels' => ['mandiri'], 'label' => 'VA Mandiri', 'min_amount' => 10000],
        'ipaymu-va-permata' => ['payment_method' => 'va', 'payment_channels' => ['permata'], 'label' => 'VA Permata', 'min_amount' => 10000],
        'ipaymu-va-bsi' => ['payment_method' => 'va', 'payment_channels' => ['bsi'], 'label' => 'VA BSI', 'min_amount' => 10000],
        'ipaymu-va-bmi' => ['payment_method' => 'va', 'payment_channels' => ['bmi'], 'label' => 'VA Muamalat', 'min_amount' => 10000],
        'ipaymu-qris' => ['payment_method' => 'qris', 'payment_channels' => ['qris', 'mpm'], 'label' => 'QRIS', 'min_amount' => 10000],
        'ipaymu-ewallet-gopay' => ['payment_method' => 'ewallet', 'payment_channels' => ['gopay'], 'label' => 'GoPay', 'min_amount' => 10000],
        'ipaymu-ewallet-shopeepay' => ['payment_method' => 'ewallet', 'payment_channels' => ['shopeepay'], 'label' => 'ShopeePay', 'min_amount' => 10000],
        'ipaymu-cstore-alfamart' => ['payment_method' => 'cstore', 'payment_channels' => ['alfamart'], 'label' => 'Alfamart', 'min_amount' => 10000],
        'ipaymu-cstore-indomaret' => ['payment_method' => 'cstore', 'payment_channels' => ['indomaret'], 'label' => 'Indomaret', 'min_amount' => 15000],
    ];
}

function ipaymu_direct_channel_spec(string $channel): array
{
    $item = ipaymu_channel_registry()[strtolower(trim($channel))] ?? null;
    if (!$item) return [];
    return [
        'payment_method' => $item['payment_method'],
        'payment_channels' => $item['payment_channels'],
    ];
}

function ipaymu_channel_minimum_amount(string $channel): int
{
    return (int) (ipaymu_channel_registry()[strtolower(trim($channel))]['min_amount'] ?? 0);
}

function ipaymu_channel_label(string $channel): string
{
    return (string) (ipaymu_channel_registry()[strtolower(trim($channel))]['label'] ?? 'kanal iPaymu');
}
function ipaymu_is_provider_enabled(): bool
{
    if (!setting_is_enabled('payment_gateway_enabled')) return false;
    $provider = strtolower(trim((string) setting_value('payment_gateway_provider', '')));
    return str_contains($provider, 'ipaymu');
}

function ipaymu_config(): array
{
    $environmentRaw = strtolower(trim((string) setting_value('ipaymu_environment', env_value('IPAYMU_ENVIRONMENT', 'production'))));
    $isSandbox = in_array($environmentRaw, ['sandbox', 'test', 'development', 'dev'], true);
    $vaSetting = trim((string) setting_value('ipaymu_va', ''));
    $apiKeySetting = trim((string) setting_value('payment_gateway_key', ''));
    $vaEnvPrimary = trim((string) env_value($isSandbox ? 'IPAYMU_VA_SANDBOX' : 'IPAYMU_VA', ''));
    $apiKeyEnvPrimary = trim((string) env_value($isSandbox ? 'IPAYMU_API_KEY_SANDBOX' : 'IPAYMU_API_KEY', ''));
    $vaEnvFallback = trim((string) env_value('IPAYMU_VA', ''));
    $apiKeyEnvFallback = trim((string) env_value('IPAYMU_API_KEY', ''));
    $va = $vaSetting !== '' ? $vaSetting : ($vaEnvPrimary !== '' ? $vaEnvPrimary : $vaEnvFallback);
    $apiKey = $apiKeySetting !== '' ? $apiKeySetting : ($apiKeyEnvPrimary !== '' ? $apiKeyEnvPrimary : $apiKeyEnvFallback);

    return [
        'va' => $va,
        'api_key' => $apiKey,
        'environment' => $isSandbox ? 'sandbox' : 'production',
        'base_url' => $isSandbox ? 'https://sandbox.ipaymu.com/api/v2' : 'https://my.ipaymu.com/api/v2',
    ];
}

function ipaymu_is_config_valid(array $config): bool
{
    return trim((string) ($config['va'] ?? '')) !== '' && trim((string) ($config['api_key'] ?? '')) !== '';
}

function ipaymu_signature(string $httpMethod, string $va, string $apiKey, string $jsonBody): string
{
    $requestBodyHash = strtolower(hash('sha256', $jsonBody));
    $stringToSign = strtoupper($httpMethod) . ':' . $va . ':' . $requestBodyHash . ':' . $apiKey;
    return hash_hmac('sha256', $stringToSign, $apiKey);
}

function ipaymu_post(string $path, array $payload, array $config): array
{
    $url = rtrim((string) ($config['base_url'] ?? ''), '/') . '/' . ltrim($path, '/');
    $jsonBody = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if ($jsonBody === false) {
        throw new RuntimeException('Payload iPaymu tidak valid');
    }

    $va = trim((string) ($config['va'] ?? ''));
    $apiKey = trim((string) ($config['api_key'] ?? ''));
    if ($va === '' || $apiKey === '') {
        throw new RuntimeException('Konfigurasi iPaymu belum lengkap');
    }

    $timestamp = date('YmdHis');
    $signature = ipaymu_signature('POST', $va, $apiKey, $jsonBody);

    $headers = [
        'Content-Type: application/json',
        'va: ' . $va,
        'signature: ' . $signature,
        'timestamp: ' . $timestamp,
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $jsonBody,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $rawResponse = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($rawResponse === false) {
        throw new RuntimeException('Gagal terhubung ke iPaymu: ' . $curlError);
    }

    $decoded = json_decode($rawResponse, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Respons iPaymu tidak valid');
    }

    $status = (int) ($decoded['Status'] ?? $decoded['status'] ?? $httpCode);
    if ($status >= 400) {
        $message = (string) ($decoded['Message'] ?? $decoded['message'] ?? ('HTTP ' . $status));
        $normalizedMessage = strtolower(trim($message));
        if ($status === 401 || str_contains($normalizedMessage, 'unauthorized credential')) {
            $env = (string) ($config['environment'] ?? 'production');
            $va = trim((string) ($config['va'] ?? ''));
            $maskedVa = $va === '' ? '-' : substr($va, 0, 3) . str_repeat('*', max(strlen($va) - 6, 0)) . substr($va, -3);
            $message .= " (mode={$env}, va={$maskedVa}). Pastikan VA/API key {$env} berasal dari dashboard {$env}.ipaymu.com.";
        }
        throw new RuntimeException('iPaymu: ' . $message);
    }

    return $decoded;
}

function ipaymu_extract_redirect_url(array $response): string
{
    $candidates = [
        $response['Data']['Url'] ?? null,
        $response['Data']['url'] ?? null,
        $response['Data']['RedirectUrl'] ?? null,
        $response['Data']['redirectUrl'] ?? null,
        $response['Data']['PaymentUrl'] ?? null,
        $response['Data']['paymentUrl'] ?? null,
        $response['Url'] ?? null,
        $response['url'] ?? null,
        $response['RedirectUrl'] ?? null,
        $response['redirectUrl'] ?? null,
        $response['PaymentUrl'] ?? null,
        $response['paymentUrl'] ?? null,
    ];

    foreach ($candidates as $url) {
        $url = trim((string) $url);
        if ($url !== '' && preg_match('/^https?:\/\//i', $url)) {
            return $url;
        }
    }

    return '';
}

function ipaymu_extract_transaction_id(array $payload): string
{
    $keys = [
        'TransactionId',
        'transactionId',
        'id',
        'Id',
        'trx_id',
        'trxId',
        'sessionId',
        'SessionID',
    ];

    foreach ($keys as $key) {
        if (array_key_exists($key, $payload)) {
            $value = trim((string) $payload[$key]);
            if ($value !== '') return $value;
        }
    }

    if (isset($payload['Data']) && is_array($payload['Data'])) {
        return ipaymu_extract_transaction_id($payload['Data']);
    }

    return '';
}

function ipaymu_extract_reference_id(array $payload): string
{
    $keys = ['referenceId', 'ReferenceId', 'reference_id', 'ReferenceID'];
    foreach ($keys as $key) {
        if (array_key_exists($key, $payload)) {
            $value = trim((string) $payload[$key]);
            if ($value !== '') return $value;
        }
    }

    if (isset($payload['Data']) && is_array($payload['Data'])) {
        return ipaymu_extract_reference_id($payload['Data']);
    }

    return '';
}

function ipaymu_is_paid_payload(array $payload): bool
{
    $collectStatusStrings = static function (array $source): array {
        $values = [];
        foreach ([
            'paymentStatus',
            'PaymentStatus',
            'transactionStatus',
            'TransactionStatus',
            'statusDesc',
            'StatusDesc',
            'statusDescription',
            'StatusDescription',
            'status',
            'Status',
        ] as $key) {
            if (!array_key_exists($key, $source)) continue;
            $values[] = strtolower(trim((string) $source[$key]));
        }
        return array_values(array_filter($values, static fn ($v) => $v !== ''));
    };

    $isPaidStatus = static function (string $status): bool {
        return in_array($status, ['paid', 'berhasil', 'sukses', 'settlement', 'completed', 'capture'], true);
    };

    $data = $payload['Data'] ?? null;
    if (is_array($data) && array_is_list($data) && isset($data[0]) && is_array($data[0])) {
        $data = $data[0];
    }

    if (is_array($data)) {
        foreach ($collectStatusStrings($data) as $status) {
            if ($isPaidStatus($status)) return true;
        }
        return false;
    }

    foreach ($collectStatusStrings($payload) as $status) {
        if ($isPaidStatus($status)) return true;
    }

    return false;
}


function ipaymu_is_failed_payload(array $payload): bool
{
    $statusStrings = [
        (string) ($payload['StatusDesc'] ?? ''),
        (string) ($payload['statusDesc'] ?? ''),
        (string) ($payload['StatusDescription'] ?? ''),
        (string) ($payload['statusDescription'] ?? ''),
        (string) ($payload['status'] ?? ''),
        (string) ($payload['Status'] ?? ''),
    ];

    foreach ($statusStrings as $statusText) {
        $normalized = strtolower(trim($statusText));
        if ($normalized === '') continue;
        if (in_array($normalized, ['failed', 'expire', 'expired', 'cancel', 'cancelled', 'canceled', 'denied', 'gagal'], true)) {
            return true;
        }
    }

    return false;
}

function ipaymu_extract_payment_info(array $response): array
{
    $data = $response['Data'] ?? $response;
    if (is_array($data) && array_is_list($data) && isset($data[0]) && is_array($data[0])) {
        $data = $data[0];
    }
    if (!is_array($data)) $data = [];

    $pick = static function (array $source, array $keys): string {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $source)) continue;
            $value = trim((string) $source[$key]);
            if ($value !== '') return $value;
        }
        return '';
    };

    $paymentNumber = $pick($data, [
        'PaymentNo',
        'paymentNo',
        'va',
        'vaNumber',
        'virtualAccount',
        'accountNo',
        'account_number',
        'qrString',
        'qrContent',
    ]);

    $paymentName = $pick($data, [
        'PaymentName',
        'paymentName',
        'bank',
        'issuer',
        'channel',
    ]);

    $paymentMethod = $pick($data, ['paymentMethod', 'PaymentMethod', 'method']);
    $paymentChannel = $pick($data, ['paymentChannel', 'PaymentChannel', 'channelCode', 'channel']);
    $expiredAt = $pick($data, ['Expired', 'expired', 'expiredAt', 'ExpiredAt', 'expired_time']);
    $statusText = $pick($data, ['StatusDesc', 'statusDesc', 'statusDescription', 'StatusDescription']);
    if ($statusText === '') {
        $statusText = $pick($response, ['StatusDesc', 'statusDesc', 'statusDescription', 'StatusDescription']);
    }

    $amountValue = 0.0;
    foreach (['Amount', 'amount', 'Total', 'total', 'Nominal', 'nominal'] as $amountKey) {
        if (!array_key_exists($amountKey, $data)) continue;
        $amountValue = (float) $data[$amountKey];
        if ($amountValue > 0) break;
    }

    $result = [
        'payment_number' => $paymentNumber,
        'payment_name' => $paymentName,
        'payment_method' => $paymentMethod,
        'payment_channel' => $paymentChannel,
        'amount' => $amountValue,
        'expired_at' => $expiredAt,
        'status' => $statusText,
    ];

    return array_filter($result, static fn ($value) => !($value === '' || $value === null || $value === 0.0));
}



function ipaymu_extract_direct_payment_details(array $response): array
{
    $data = $response['Data'] ?? $response;
    if (is_array($data) && array_is_list($data) && isset($data[0]) && is_array($data[0])) {
        $data = $data[0];
    }
    if (!is_array($data)) $data = [];

    $pick = static function (array $source, array $keys): string {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $source)) continue;
            $value = trim((string) $source[$key]);
            if ($value !== '') return $value;
        }
        return '';
    };

    $pickFloat = static function (array $source, array $keys): ?float {
        foreach ($keys as $key) {
            if (!array_key_exists($key, $source)) continue;
            if ($source[$key] === '' || $source[$key] === null) continue;
            return (float) $source[$key];
        }
        return null;
    };

    $result = ipaymu_extract_payment_info($response);
    $result['qr_string'] = $pick($data, ['QrString', 'qrString', 'qrContent']);
    $result['qr_image'] = $pick($data, ['QrImage', 'qrImage', 'qr_url', 'qrUrl']);
    $result['qr_template'] = $pick($data, ['QrTemplate', 'qrTemplate']);
    $result['via'] = $pick($data, ['Via', 'via']);
    $result['channel'] = $pick($data, ['Channel', 'channel', 'PaymentChannel', 'paymentChannel']);
    $result['subtotal'] = $pickFloat($data, ['SubTotal', 'subtotal', 'Amount', 'amount']);
    $result['fee'] = $pickFloat($data, ['Fee', 'fee']);
    $result['total'] = $pickFloat($data, ['Total', 'total', 'Amount', 'amount']);
    $result['expired_at'] = $pick($data, ['Expired', 'expired', 'expiredAt', 'ExpiredAt', 'expired_time']);
    $result['terminal'] = $pick($data, ['Terminal', 'terminal']);
    $result['nns_code'] = $pick($data, ['NNSCode', 'nnsCode']);

    return array_filter($result, static fn ($value) => $value !== '' && $value !== null);
}

function ipaymu_legacy_transaction_status(string $transactionId, array $config): array
{
    $transactionId = trim($transactionId);
    if ($transactionId === '') {
        throw new RuntimeException('Transaction ID iPaymu kosong');
    }

    $apiKey = trim((string) ($config['api_key'] ?? ''));
    if ($apiKey === '') {
        throw new RuntimeException('Konfigurasi iPaymu belum lengkap');
    }

    $isSandbox = strtolower(trim((string) ($config['environment'] ?? 'production'))) === 'sandbox';
    $baseUrl = $isSandbox ? 'https://sandbox.ipaymu.com/api' : 'https://my.ipaymu.com/api';
    $url = $baseUrl . '/transaksi?key=' . rawurlencode($apiKey) . '&id=' . rawurlencode($transactionId) . '&format=json';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 30,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $rawResponse = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($rawResponse === false) {
        throw new RuntimeException('Gagal cek transaksi iPaymu legacy: ' . $curlError);
    }

    $decoded = json_decode($rawResponse, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Respons transaksi iPaymu legacy tidak valid');
    }

    if ($httpCode >= 400) {
        $message = (string) ($decoded['Message'] ?? $decoded['message'] ?? ('HTTP ' . $httpCode));
        throw new RuntimeException('iPaymu legacy: ' . $message);
    }

    return $decoded;
}

function ipaymu_verify_transaction_status(string $transactionId, array $config): array
{
    try {
        return ipaymu_post('/transaction', ['transactionId' => $transactionId], $config);
    } catch (Throwable $primaryError) {
        try {
            return ipaymu_legacy_transaction_status($transactionId, $config);
        } catch (Throwable $legacyError) {
            throw new RuntimeException(
                'Verifikasi transaksi iPaymu gagal. v2: ' . $primaryError->getMessage() . '; legacy: ' . $legacyError->getMessage()
            );
        }
    }
}
