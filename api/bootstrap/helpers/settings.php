<?php
// Helper pengaturan sistem: default value, sanitasi payload, dan pembacaan settings.

function setting_value(string $key, string $default = ''): string {
    return scalar('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [$key]) ?: $default;
}

function settings_defaults(): array {
    return [
        'school_name' => '',
        'school_address' => '',
        'bank_account' => '',
        'qris_text' => '',
        'payment_gateway_enabled' => '0',
        'payment_gateway_provider' => '',
        'payment_gateway_key' => '',
        'whatsapp_gateway_enabled' => '0',
        'whatsapp_gateway_url' => '',
        'whatsapp_gateway_token' => '',
        'receipt_footer' => '',
    ];
}

function sanitize_settings_payload(array $input): array {
    $allowed = array_keys(settings_defaults());
    $clean = [];

    foreach ($input as $key => $value) {
        if (!in_array($key, $allowed, true)) continue;
        if (in_array($key, ['payment_gateway_enabled', 'whatsapp_gateway_enabled'], true)) {
            $clean[$key] = in_array($value, [true, 1, '1', 'true', 'on'], true) ? '1' : '0';
            continue;
        }
        $clean[$key] = trim((string) ($value ?? ''));
    }

    if (!$clean) response(['message' => 'Tidak ada pengaturan yang dapat disimpan'], 422);

    if (array_key_exists('school_name', $clean) && $clean['school_name'] === '') {
        response(['message' => 'Nama madrasah wajib diisi'], 422);
    }

    if (isset($clean['school_name']) && mb_strlen($clean['school_name']) > 120) {
        response(['message' => 'Nama madrasah maksimal 120 karakter'], 422);
    }

    if (isset($clean['school_address']) && mb_strlen($clean['school_address']) > 500) {
        response(['message' => 'Alamat madrasah maksimal 500 karakter'], 422);
    }

    if (isset($clean['bank_account']) && mb_strlen($clean['bank_account']) > 500) {
        response(['message' => 'Rekening bank maksimal 500 karakter'], 422);
    }

    if (isset($clean['qris_text']) && mb_strlen($clean['qris_text']) > 500) {
        response(['message' => 'Teks QRIS maksimal 500 karakter'], 422);
    }

    if (isset($clean['payment_gateway_provider']) && mb_strlen($clean['payment_gateway_provider']) > 120) {
        response(['message' => 'Provider payment gateway maksimal 120 karakter'], 422);
    }

    if (isset($clean['payment_gateway_key']) && mb_strlen($clean['payment_gateway_key']) > 255) {
        response(['message' => 'API key gateway maksimal 255 karakter'], 422);
    }

    $gatewayEnabled = ($clean['payment_gateway_enabled'] ?? setting_value('payment_gateway_enabled', '0')) === '1';
    $gatewayProvider = $clean['payment_gateway_provider'] ?? setting_value('payment_gateway_provider');
    $gatewayKey = $clean['payment_gateway_key'] ?? setting_value('payment_gateway_key');
    if ($gatewayEnabled && trim((string) $gatewayProvider) === '') {
        response(['message' => 'Provider payment gateway wajib diisi saat gateway diaktifkan'], 422);
    }
    if ($gatewayEnabled && trim((string) $gatewayKey) === '') {
        response(['message' => 'API key payment gateway wajib diisi saat gateway diaktifkan'], 422);
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

    return $clean;
}

function list_settings(): array {
    $rows = db()->query("SELECT setting_key, setting_value FROM settings ORDER BY setting_key ASC")->fetchAll();
    $result = settings_defaults();
    foreach ($rows as $row) $result[$row['setting_key']] = $row['setting_value'];
    return $result;
}

function setting_is_enabled(string $key): bool {
    return setting_value($key, '0') === '1';
}
