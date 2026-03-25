<?php
// Route baca dan simpan pengaturan sistem.

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
