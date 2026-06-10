<?php
// Helper pengaturan sistem: default value, sanitasi payload, dan pembacaan settings.

function qris_crc16_ccitt_false(string $value): string
{
    $crc = 0xFFFF;
    $length = strlen($value);

    for ($i = 0; $i < $length; $i++) {
        $crc ^= ord($value[$i]) << 8;
        for ($bit = 0; $bit < 8; $bit++) {
            if (($crc & 0x8000) !== 0) {
                $crc = (($crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                $crc = ($crc << 1) & 0xFFFF;
            }
        }
    }

    return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
}

function sanitize_qris_mpm_payload_input(string $payload): string
{
    $payload = str_replace(["\r", "\n", "\t"], '', $payload);

    return trim($payload);
}

function normalize_qris_mpm_payload(string $payload): array
{
    if ($payload === '') {
        return ['payload' => '', 'error' => null];
    }

    if (strlen($payload) > 2048) {
        return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis maksimal 2048 karakter'];
    }

    if (!preg_match('/^[\x20-\x7E]+$/', $payload)) {
        return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis mengandung karakter yang tidak valid'];
    }

    if (!str_starts_with($payload, '000201')) {
        return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (harus diawali 000201)'];
    }

    if (strlen($payload) < 50) {
        return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis terlalu pendek'];
    }

    if (!preg_match('/6304([0-9A-Fa-f]{4})$/', $payload, $matches)) {
        return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (CRC tidak ditemukan)'];
    }

    $cursor = 0;
    $totalLength = strlen($payload);
    while ($cursor < $totalLength) {
        if ($cursor + 4 > $totalLength) {
            return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (struktur tag terpotong)'];
        }

        $tag = substr($payload, $cursor, 2);
        $lengthText = substr($payload, $cursor + 2, 2);
        if (!ctype_digit($lengthText)) {
            return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (panjang tag tidak valid)'];
        }

        $valueLength = (int) $lengthText;
        $cursor += 4;
        if ($cursor + $valueLength > $totalLength) {
            return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (nilai tag melebihi panjang payload)'];
        }

        $cursor += $valueLength;

        if ($tag === '63') {
            if ($cursor !== $totalLength) {
                return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (CRC harus berada di akhir payload)'];
            }
            break;
        }
    }

    if ($cursor !== $totalLength) {
        return ['payload' => $payload, 'error' => 'Payload QRIS MPM statis tidak valid (panjang payload tidak konsisten)'];
    }

    $withoutChecksum = substr($payload, 0, -4);
    $normalizedPayload = $withoutChecksum . qris_crc16_ccitt_false($withoutChecksum);

    return ['payload' => $normalizedPayload, 'error' => null];
}

function validate_qris_mpm_payload(string $payload): ?string
{
    return normalize_qris_mpm_payload($payload)['error'];
}

function payment_gateway_provider_key(string $provider): string
{
    $value = strtolower(trim($provider));
    if ($value === '') return '';
    if (str_contains($value, 'ipaymu')) return 'ipaymu';
    if (str_contains($value, 'midtrans')) return 'midtrans';
    if (str_contains($value, 'doku')) return 'doku';
    if (str_contains($value, 'tripay')) return 'tripay';
    return $value;
}

function raw_settings_map(bool $refresh = false): array
{
    static $cache = null;

    if ($refresh || $cache === null) {
        $rows = db()->query("SELECT setting_key, setting_value FROM settings ORDER BY setting_key ASC")->fetchAll();
        $cache = [];
        foreach ($rows as $row) {
            $cache[(string) $row['setting_key']] = (string) $row['setting_value'];
        }
    }

    return $cache;
}

function refresh_settings_cache(): void
{
    raw_settings_map(true);
}

function setting_value(string $key, string $default = ''): string
{
    $value = raw_settings_map()[$key] ?? null;
    return $value ?: $default;
}

function settings_defaults(): array
{
    return [
        'school_name' => '',
        'school_address' => '',
        'principal_name' => '',
        'treasurer_name' => '',
        'bank_account' => '',
        'qris_text' => '',
        'qris_mpm_statis_payload' => '',
        'payment_gateway_enabled' => '0',
        'payment_gateway_provider' => '',
        'payment_gateway_mode' => 'redirect',
        'payment_gateway_key' => '',
        'ipaymu_va' => '',
        'ipaymu_environment' => 'production',
        'midtrans_server_key' => '',
        'midtrans_client_key' => '',
        'midtrans_environment' => 'production',
        'doku_client_id' => '',
        'doku_secret_key' => '',
        'doku_environment' => 'production',
        'tripay_api_key' => '',
        'tripay_private_key' => '',
        'tripay_merchant_code' => '',
        'tripay_environment' => 'production',
        'whatsapp_gateway_enabled' => '0',
        'whatsapp_gateway_url' => '',
        'whatsapp_gateway_token' => '',
        'whatsapp_test_target' => '',
        'payment_proof_retention_days' => '730',
        'receipt_footer' => '',
        'support_whatsapp' => '',
        'support_email' => '',
        'support_hours' => '',
    ];
}

function sanitize_settings_payload(array $input): array
{
    $allowed = array_keys(settings_defaults());
    $clean = [];

    foreach ($input as $key => $value) {
        if (!in_array($key, $allowed, true)) continue;
        if (in_array($key, ['payment_gateway_enabled', 'whatsapp_gateway_enabled'], true)) {
            $clean[$key] = in_array($value, [true, 1, '1', 'true', 'on'], true) ? '1' : '0';
            continue;
        }
        if ($key === 'payment_proof_retention_days') {
            $days = (int) $value;
            $clean[$key] = (string) $days;
            continue;
        }
        $clean[$key] = trim((string) ($value ?? ''));
    }

    if (!$clean) response(['message' => 'Tidak ada pengaturan yang dapat disimpan'], 422);

    if (array_key_exists('school_name', $clean) && $clean['school_name'] === '') {
        response(['message' => 'Nama Lembaga wajib diisi'], 422);
    }

    if (isset($clean['school_name']) && mb_strlen($clean['school_name']) > 120) {
        response(['message' => 'Nama Lembaga maksimal 120 karakter'], 422);
    }

    if (isset($clean['school_address']) && mb_strlen($clean['school_address']) > 500) {
        response(['message' => 'Alamat lembaga maksimal 500 karakter'], 422);
    }

    if (isset($clean['principal_name']) && mb_strlen($clean['principal_name']) > 120) {
        response(['message' => 'Nama Pengasuh maksimal 120 karakter'], 422);
    }

    if (isset($clean['treasurer_name']) && mb_strlen($clean['treasurer_name']) > 120) {
        response(['message' => 'Nama Bendahara maksimal 120 karakter'], 422);
    }

    if (isset($clean['bank_account']) && mb_strlen($clean['bank_account']) > 500) {
        response(['message' => 'Rekening bank maksimal 500 karakter'], 422);
    }

    if (isset($clean['qris_text']) && mb_strlen($clean['qris_text']) > 500) {
        response(['message' => 'Teks QRIS maksimal 500 karakter'], 422);
    }

    if (isset($clean['qris_mpm_statis_payload'])) {
        $payload = sanitize_qris_mpm_payload_input((string) $clean['qris_mpm_statis_payload']);
        if ($payload !== '') {
            $normalizedPayload = normalize_qris_mpm_payload($payload);
            if ($normalizedPayload['error'] !== null) {
                response(['message' => $normalizedPayload['error']], 422);
            }
            $clean['qris_mpm_statis_payload'] = $normalizedPayload['payload'];
        }
    }

    if (isset($clean['payment_gateway_provider']) && mb_strlen($clean['payment_gateway_provider']) > 120) {
        response(['message' => 'Provider payment gateway maksimal 120 karakter'], 422);
    }

    if (isset($clean['payment_gateway_mode'])) {
        $mode = strtolower(trim((string) $clean['payment_gateway_mode']));
        if (!in_array($mode, ['redirect', 'popup'], true)) {
            response(['message' => 'Mode payment gateway harus redirect atau popup'], 422);
        }
        $clean['payment_gateway_mode'] = $mode;
    }

    if (isset($clean['payment_gateway_key']) && mb_strlen($clean['payment_gateway_key']) > 255) {
        response(['message' => 'API key iPaymu maksimal 255 karakter'], 422);
    }

    if (isset($clean['ipaymu_va']) && mb_strlen($clean['ipaymu_va']) > 30) {
        response(['message' => 'VA iPaymu maksimal 30 karakter'], 422);
    }

    if (isset($clean['ipaymu_environment'])) {
        $env = strtolower(trim((string) $clean['ipaymu_environment']));
        if (!in_array($env, ['sandbox', 'production'], true)) {
            response(['message' => 'Mode iPaymu harus sandbox atau production'], 422);
        }
        $clean['ipaymu_environment'] = $env;
    }

    if (isset($clean['midtrans_server_key']) && mb_strlen($clean['midtrans_server_key']) > 255) {
        response(['message' => 'Server Key Midtrans maksimal 255 karakter'], 422);
    }

    if (isset($clean['midtrans_client_key']) && mb_strlen($clean['midtrans_client_key']) > 255) {
        response(['message' => 'Client Key Midtrans maksimal 255 karakter'], 422);
    }

    if (isset($clean['midtrans_environment'])) {
        $env = strtolower(trim((string) $clean['midtrans_environment']));
        if (!in_array($env, ['sandbox', 'production'], true)) {
            response(['message' => 'Mode Midtrans harus sandbox atau production'], 422);
        }
        $clean['midtrans_environment'] = $env;
    }

    if (isset($clean['doku_client_id']) && mb_strlen($clean['doku_client_id']) > 255) {
        response(['message' => 'Client ID DOKU maksimal 255 karakter'], 422);
    }

    if (isset($clean['doku_secret_key']) && mb_strlen($clean['doku_secret_key']) > 255) {
        response(['message' => 'Secret Key DOKU maksimal 255 karakter'], 422);
    }

    if (isset($clean['doku_environment'])) {
        $env = strtolower(trim((string) $clean['doku_environment']));
        if (!in_array($env, ['sandbox', 'production'], true)) {
            response(['message' => 'Mode DOKU harus sandbox atau production'], 422);
        }
        $clean['doku_environment'] = $env;
    }

    if (isset($clean['tripay_api_key']) && mb_strlen($clean['tripay_api_key']) > 255) {
        response(['message' => 'API Key Tripay maksimal 255 karakter'], 422);
    }

    if (isset($clean['tripay_private_key']) && mb_strlen($clean['tripay_private_key']) > 255) {
        response(['message' => 'Private Key Tripay maksimal 255 karakter'], 422);
    }

    if (isset($clean['tripay_merchant_code']) && mb_strlen($clean['tripay_merchant_code']) > 100) {
        response(['message' => 'Merchant Code Tripay maksimal 100 karakter'], 422);
    }

    if (isset($clean['tripay_environment'])) {
        $env = strtolower(trim((string) $clean['tripay_environment']));
        if (!in_array($env, ['sandbox', 'production'], true)) {
            response(['message' => 'Mode Tripay harus sandbox atau production'], 422);
        }
        $clean['tripay_environment'] = $env;
    }

    $gatewayEnabled = ($clean['payment_gateway_enabled'] ?? setting_value('payment_gateway_enabled', '0')) === '1';
    $gatewayProviderRaw = $clean['payment_gateway_provider'] ?? setting_value('payment_gateway_provider');
    $gatewayProviderKey = payment_gateway_provider_key((string) $gatewayProviderRaw);
    $gatewayMode = strtolower(trim((string) ($clean['payment_gateway_mode'] ?? setting_value('payment_gateway_mode', 'redirect'))));
    if ($gatewayMode === '') $gatewayMode = 'redirect';
    if ($gatewayEnabled && trim((string) $gatewayProviderRaw) === '') {
        response(['message' => 'Provider payment gateway wajib dipilih saat gateway diaktifkan'], 422);
    }

    if ($gatewayEnabled) {
        if (!in_array($gatewayProviderKey, ['ipaymu', 'midtrans', 'doku', 'tripay'], true)) {
            response(['message' => 'Provider payment gateway belum didukung'], 422);
        }

        if ($gatewayProviderKey === 'ipaymu') {
            $ipaymuKey = trim((string) ($clean['payment_gateway_key'] ?? setting_value('payment_gateway_key', '')));
            $ipaymuVa = trim((string) ($clean['ipaymu_va'] ?? setting_value('ipaymu_va', '')));
            if ($ipaymuKey === '') {
                response(['message' => 'API key iPaymu wajib diisi saat provider iPaymu diaktifkan'], 422);
            }
            if ($ipaymuVa === '') {
                response(['message' => 'VA iPaymu wajib diisi saat provider iPaymu diaktifkan'], 422);
            }
        }

        if ($gatewayProviderKey === 'midtrans') {
            $midtransServerKey = trim((string) ($clean['midtrans_server_key'] ?? setting_value('midtrans_server_key', '')));
            if ($midtransServerKey === '') {
                response(['message' => 'Server Key Midtrans wajib diisi saat provider Midtrans diaktifkan'], 422);
            }
            if ($gatewayMode === 'popup') {
                $midtransClientKey = trim((string) ($clean['midtrans_client_key'] ?? setting_value('midtrans_client_key', '')));
                if ($midtransClientKey === '') {
                    response(['message' => 'Client Key Midtrans wajib diisi saat mode popup diaktifkan'], 422);
                }
            }
        }

        if ($gatewayProviderKey === 'doku') {
            $dokuClientId = trim((string) ($clean['doku_client_id'] ?? setting_value('doku_client_id', '')));
            $dokuSecretKey = trim((string) ($clean['doku_secret_key'] ?? setting_value('doku_secret_key', '')));
            if ($dokuClientId === '') {
                response(['message' => 'Client ID DOKU wajib diisi saat provider DOKU diaktifkan'], 422);
            }
            if ($dokuSecretKey === '') {
                response(['message' => 'Secret Key DOKU wajib diisi saat provider DOKU diaktifkan'], 422);
            }
        }

        if ($gatewayProviderKey === 'tripay') {
            $tripayApiKey = trim((string) ($clean['tripay_api_key'] ?? setting_value('tripay_api_key', '')));
            $tripayPrivateKey = trim((string) ($clean['tripay_private_key'] ?? setting_value('tripay_private_key', '')));
            $tripayMerchantCode = trim((string) ($clean['tripay_merchant_code'] ?? setting_value('tripay_merchant_code', '')));
            if ($tripayApiKey === '') {
                response(['message' => 'API Key Tripay wajib diisi saat provider Tripay diaktifkan'], 422);
            }
            if ($tripayPrivateKey === '') {
                response(['message' => 'Private Key Tripay wajib diisi saat provider Tripay diaktifkan'], 422);
            }
            if ($tripayMerchantCode === '') {
                response(['message' => 'Merchant Code Tripay wajib diisi saat provider Tripay diaktifkan'], 422);
            }
        }
    }

    if (isset($clean['whatsapp_gateway_url']) && $clean['whatsapp_gateway_url'] !== '' && filter_var($clean['whatsapp_gateway_url'], FILTER_VALIDATE_URL) === false) {
        response(['message' => 'URL WhatsApp gateway tidak valid'], 422);
    }

    if (isset($clean['whatsapp_gateway_url']) && mb_strlen($clean['whatsapp_gateway_url']) > 255) {
        response(['message' => 'URL WhatsApp gateway maksimal 255 karakter'], 422);
    }

    if (isset($clean['whatsapp_gateway_token']) && mb_strlen($clean['whatsapp_gateway_token']) > 255) {
        response(['message' => 'Token WhatsApp maksimal 255 karakter'], 422);
    }

    if (isset($clean['whatsapp_test_target']) && $clean['whatsapp_test_target'] !== '') {
        $testTargetDigits = preg_replace('/\D+/', '', $clean['whatsapp_test_target']) ?? '';
        if (strlen($testTargetDigits) < 10 || strlen($testTargetDigits) > 16) {
            response(['message' => 'Nomor WhatsApp tujuan tes tidak valid'], 422);
        }
    }

    if (isset($clean['payment_proof_retention_days'])) {
        $days = (int) $clean['payment_proof_retention_days'];
        if ($days < 30 || $days > 3650) {
            response(['message' => 'Retensi bukti pembayaran harus antara 30 sampai 3650 hari'], 422);
        }
        $clean['payment_proof_retention_days'] = (string) $days;
    }

    $whatsappEnabled = ($clean['whatsapp_gateway_enabled'] ?? setting_value('whatsapp_gateway_enabled', '0')) === '1';
    $whatsappUrl = $clean['whatsapp_gateway_url'] ?? setting_value('whatsapp_gateway_url');
    $whatsappToken = $clean['whatsapp_gateway_token'] ?? setting_value('whatsapp_gateway_token');
    if ($whatsappEnabled && trim((string) $whatsappUrl) === '') {
        response(['message' => 'URL WhatsApp gateway wajib diisi saat gateway diaktifkan'], 422);
    }
    if ($whatsappEnabled && trim((string) $whatsappToken) === '') {
        response(['message' => 'Token WhatsApp gateway wajib diisi saat gateway diaktifkan'], 422);
    }

    if (isset($clean['receipt_footer']) && mb_strlen($clean['receipt_footer']) > 500) {
        response(['message' => 'Footer kuitansi maksimal 500 karakter'], 422);
    }
    if (isset($clean['support_whatsapp']) && mb_strlen($clean['support_whatsapp']) > 30) {
        response(['message' => 'Kontak WhatsApp maksimal 30 karakter'], 422);
    }
    if (isset($clean['support_email']) && $clean['support_email'] !== '' && filter_var($clean['support_email'], FILTER_VALIDATE_EMAIL) === false) {
        response(['message' => 'Format email bantuan tidak valid'], 422);
    }
    if (isset($clean['support_email']) && mb_strlen($clean['support_email']) > 120) {
        response(['message' => 'Email bantuan maksimal 120 karakter'], 422);
    }
    if (isset($clean['support_hours']) && mb_strlen($clean['support_hours']) > 120) {
        response(['message' => 'Jam layanan maksimal 120 karakter'], 422);
    }

    return $clean;
}

function list_settings(): array
{
    $result = settings_defaults();
    foreach (raw_settings_map() as $key => $value) $result[$key] = $value;
    return $result;
}

function setting_is_enabled(string $key): bool
{
    return setting_value($key, '0') === '1';
}
