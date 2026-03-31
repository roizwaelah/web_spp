<?php
// Route baca dan simpan pengaturan sistem.

if ($route === 'admin/settings/profile' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $settings = list_settings();
    response([
        'school_name' => (string) ($settings['school_name'] ?? 'MADSC PAYMENT'),
        'school_address' => (string) ($settings['school_address'] ?? 'Dokumen detail transaksi pembayaran siswa'),
    ]);
}

if ($route === 'admin/settings' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['settings'], ['admin']);
    response(list_settings());
}

if ($route === 'admin/settings' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['settings'], ['admin']);
    $input = sanitize_settings_payload(json_input());
    foreach ($input as $key => $value) {
        $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_at=NOW()");
        $stmt->execute([$key, $value]);
    }
    log_activity((int) $user['id'], 'update', 'setting', null, 'Memperbarui pengaturan sistem');
    response(['message' => 'Pengaturan berhasil diperbarui']);
}

if ($route === 'admin/settings/whatsapp-test' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['settings'], ['admin']);
    rate_limit_or_fail('wa-test:user:' . (int) ($user['id'] ?? 0), 5, 300, 'Terlalu sering kirim tes WhatsApp. Coba lagi beberapa menit lagi.');

    $input = json_input();
    $targetRaw = trim((string) ($input['target'] ?? setting_value('whatsapp_test_target', '')));
    if ($targetRaw === '') {
        response(['message' => 'Nomor tujuan tes wajib diisi'], 422);
    }

    $target = normalize_wa_target($targetRaw);
    if ($target === '' || strlen($target) < 10 || strlen($target) > 16) {
        response(['message' => 'Nomor WhatsApp tujuan tes tidak valid'], 422);
    }

    $url = setting_value('whatsapp_gateway_url', '');
    $token = setting_value('whatsapp_gateway_token', '');
    if ($url === '' || $token === '') {
        response(['message' => 'Konfigurasi WhatsApp gateway belum lengkap'], 422);
    }

    $testMessage = 'Tes notifikasi WhatsApp SPP pada ' . date('Y-m-d H:i:s');
    $ok = dispatch_whatsapp_message($url, $token, $target, $testMessage);
    if (!$ok) {
        response(['message' => 'Tes kirim WhatsApp gagal. Periksa token, URL gateway, dan koneksi internet server.'], 502);
    }

    log_activity((int) $user['id'], 'create', 'notification', null, 'Mengirim tes WhatsApp ke ' . $target);
    response(['message' => 'Tes WhatsApp berhasil dikirim ke ' . $target]);
}
