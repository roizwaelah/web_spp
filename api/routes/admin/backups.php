<?php
// Route list, create, download, dan delete backup database.

if ($route === 'admin/backups' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['backups'], ['admin']);
    $rows = $pdo->query("SELECT id, filename, ROUND(size_bytes/1024,2) size_kb, DATE_FORMAT(created_at, '%d-%m-%Y %H:%i') created_at FROM backups ORDER BY id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/backups' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['backups'], ['admin']);
    $tables = ['academic_years','classes','students','users','user_menu_access','finance_posts','expenses','bills','transactions','notifications','payment_proofs','settings','audit_logs'];
    $content = "-- Backup SPP Madrasah Enterprise
-- Generated at: " . date('Y-m-d H:i:s') . "

";
    foreach ($tables as $table) {
        $rows = $pdo->query("SELECT * FROM {$table}")->fetchAll();
        foreach ($rows as $row) {
            $values = array_map(function ($value) use ($pdo) {
                return $value === null ? 'NULL' : $pdo->quote((string) $value);
            }, array_values($row));
            $content .= "INSERT INTO {$table} VALUES (" . implode(', ', $values) . ");
";
        }
        $content .= "
";
    }
    $filename = 'backup-' . date('Ymd-His') . '.sql';
    $path = API_ROOT . '/storage/backups/' . $filename;
    if (file_put_contents($path, $content) === false) {
        response(['message' => 'Gagal menyimpan file backup'], 422);
    }
    $stmt = $pdo->prepare('INSERT INTO backups (filename, path, size_bytes, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$filename, $path, filesize($path)]);
    log_activity((int) $user['id'], 'backup', 'system', null, 'Membuat backup database');
    response(['message' => 'Backup berhasil dibuat']);
}

if ($route === 'admin/backups/download' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['backups'], ['admin']);
    $id = query('id');
    ensure_required(['id' => $id], ['id']);
    $stmt = $pdo->prepare("SELECT * FROM backups WHERE id=? LIMIT 1");
    $stmt->execute([$id]);
    $file = $stmt->fetch();
    if (!$file || !file_exists($file['path'])) response(['message' => 'File backup tidak ditemukan'], 404);
    header('Content-Type: application/sql');
    header('Content-Disposition: attachment; filename="' . basename($file['filename']) . '"');
    readfile($file['path']);
    exit;
}

if ($route === 'admin/backups' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['backups'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $stmt = $pdo->prepare("SELECT * FROM backups WHERE id=? LIMIT 1");
    $stmt->execute([$input['id']]);
    $backup = $stmt->fetch();
    if (!$backup) response(['message' => 'Data backup tidak ditemukan'], 404);

    $delete = $pdo->prepare("DELETE FROM backups WHERE id=?");
    $delete->execute([$input['id']]);
    if (!empty($backup['path']) && file_exists($backup['path'])) {
        @unlink($backup['path']);
    }
    log_activity((int) $user['id'], 'delete', 'backup', (int) $input['id'], 'Menghapus file backup');
    response(['message' => 'Backup berhasil dihapus']);
}
