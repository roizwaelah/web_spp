<?php
// Helper penyimpanan file dan audit log aktivitas.

function log_activity(?int $userId, string $action, string $entityType, ?int $entityId = null, ?string $description = null): void {
    try {
        $stmt = db()->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
        $stmt->execute([$userId, $action, $entityType, $entityId, $description]);
    } catch (Throwable $e) {
        error_log('Failed to write audit log: ' . $e->getMessage());
    }
}

function save_uploaded_file(string $field, string $folder, array $allowedExt = ['jpg', 'jpeg', 'png', 'pdf']): ?array {
    if (empty($_FILES[$field]['tmp_name'])) return null;
    $ext = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) response(['message' => 'Format file tidak didukung'], 422);
    $safeName = uniqid($folder . '-', true) . '.' . $ext;
    $targetDir = API_ROOT . '/storage/' . $folder;
    if (!is_dir($targetDir)) @mkdir($targetDir, 0777, true);
    $targetPath = $targetDir . '/' . $safeName;
    if (!move_uploaded_file($_FILES[$field]['tmp_name'], $targetPath)) response(['message' => 'Gagal menyimpan file'], 422);
    return [
        'filename' => $_FILES[$field]['name'],
        'path' => $targetPath,
        'public_url' => query('base_url', '') . 'storage/' . $folder . '/' . $safeName,
        'mime_type' => $_FILES[$field]['type'] ?? '',
        'size_bytes' => filesize($targetPath) ?: 0,
    ];
}
