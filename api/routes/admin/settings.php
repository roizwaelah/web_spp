<?php
// Route baca dan simpan pengaturan sistem.

if (!function_exists('cleanup_payment_proof_files_by_retention')) {
    function cleanup_payment_proof_files_by_retention(PDO $pdo, int $retentionDays): array
    {
        if ($retentionDays < 30) {
            return [
                'checked' => 0,
                'deleted_files' => 0,
                'cleared_rows' => 0,
                'missing_files' => 0,
                'skipped_invalid_path' => 0,
                'failed_delete' => 0,
            ];
        }

        $cutoff = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));
        $stmt = $pdo->prepare("SELECT id, proof_path
            FROM payment_proofs
            WHERE status = 'approved'
              AND COALESCE(reviewed_at, created_at) < ?
              AND proof_path IS NOT NULL
              AND proof_path <> ''");
        $stmt->execute([$cutoff]);
        $rows = $stmt->fetchAll();

        $proofDir = API_ROOT . '/storage/payment-proofs';
        $deleteStmt = $pdo->prepare("UPDATE payment_proofs
            SET proof_path = NULL, mime_type = '', size_bytes = 0
            WHERE id = ?");

        $result = [
            'checked' => count($rows),
            'deleted_files' => 0,
            'cleared_rows' => 0,
            'missing_files' => 0,
            'skipped_invalid_path' => 0,
            'failed_delete' => 0,
        ];

        foreach ($rows as $row) {
            $proofPath = trim((string) ($row['proof_path'] ?? ''));
            if ($proofPath === '') continue;

            if (!is_path_inside_dir($proofPath, $proofDir)) {
                $result['skipped_invalid_path']++;
                continue;
            }

            $canClearRow = true;
            if (file_exists($proofPath)) {
                if (@unlink($proofPath)) {
                    $result['deleted_files']++;
                } else {
                    $result['failed_delete']++;
                    $canClearRow = false;
                }
            } else {
                $result['missing_files']++;
            }

            if ($canClearRow) {
                $deleteStmt->execute([(int) $row['id']]);
                $result['cleared_rows']++;
            }
        }

        return $result;
    }
}

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

if ($route === 'admin/settings/payment-proof-cleanup' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['settings'], ['admin']);
    rate_limit_or_fail('proof-cleanup:user:' . (int) ($user['id'] ?? 0), 5, 300, 'Terlalu sering menjalankan cleanup. Coba lagi beberapa menit lagi.');

    $retentionDays = (int) setting_value('payment_proof_retention_days', '730');
    if ($retentionDays < 30 || $retentionDays > 3650) {
        response(['message' => 'Pengaturan retensi bukti pembayaran tidak valid. Simpan ulang pengaturan terlebih dahulu.'], 422);
    }

    $result = cleanup_payment_proof_files_by_retention($pdo, $retentionDays);
    log_activity((int) $user['id'], 'cleanup', 'payment_proof', null, "Cleanup bukti pembayaran approved > {$retentionDays} hari");

    response([
        'message' => "Cleanup selesai. File dihapus: {$result['deleted_files']}, metadata dibersihkan: {$result['cleared_rows']}.",
        'result' => $result,
    ]);
}
