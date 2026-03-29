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

function sanitize_filename(string $filename): string {
    $filename = trim((string) $filename);
    $filename = preg_replace('/[\x00-\x1F\x7F]+/u', '', $filename);
    $filename = str_replace(["\r", "\n", '"', "'", '\\', '/'], '-', $filename);
    $filename = preg_replace('/\s+/', ' ', (string) $filename);
    return mb_substr((string) $filename, 0, 180) ?: 'upload-file';
}

function storage_real_dir(string $folder): string {
    $base = realpath(API_ROOT . '/storage');
    if (!$base) {
        $base = API_ROOT . '/storage';
        if (!is_dir($base)) @mkdir($base, 0750, true);
    }
    $targetDir = $base . DIRECTORY_SEPARATOR . trim($folder, '/\\');
    if (!is_dir($targetDir)) @mkdir($targetDir, 0750, true);
    return $targetDir;
}

function is_path_inside_dir(string $path, string $dir): bool {
    $realPath = realpath($path);
    $realDir = realpath($dir);
    if ($realPath === false || $realDir === false) return false;
    $realDir = rtrim($realDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR;
    return str_starts_with($realPath, $realDir);
}

function save_uploaded_file(
    string $field,
    string $folder,
    array $allowedExt = ['jpg', 'jpeg', 'png', 'pdf'],
    int $maxBytes = 5_242_880
): ?array {
    if (empty($_FILES[$field]['tmp_name'])) return null;
    if (!is_uploaded_file($_FILES[$field]['tmp_name'])) response(['message' => 'Upload file tidak valid'], 422);

    $size = (int) ($_FILES[$field]['size'] ?? 0);
    if ($size <= 0) response(['message' => 'Ukuran file tidak valid'], 422);
    if ($size > $maxBytes) response(['message' => 'Ukuran file melebihi batas maksimum 5MB'], 422);

    $ext = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) response(['message' => 'Format file tidak didukung'], 422);

    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $detectedMime = $finfo ? (string) finfo_file($finfo, $_FILES[$field]['tmp_name']) : '';
    if ($finfo) finfo_close($finfo);
    $allowedMimeByExt = [
        'jpg' => ['image/jpeg'],
        'jpeg' => ['image/jpeg'],
        'png' => ['image/png'],
        'pdf' => ['application/pdf'],
    ];
    $allowedMimes = $allowedMimeByExt[$ext] ?? [];
    if ($allowedMimes && !in_array($detectedMime, $allowedMimes, true)) {
        response(['message' => 'Tipe konten file tidak valid'], 422);
    }

    $safeName = uniqid($folder . '-', true) . '.' . $ext;
    $targetDir = storage_real_dir($folder);
    $targetPath = $targetDir . '/' . $safeName;
    if (!move_uploaded_file($_FILES[$field]['tmp_name'], $targetPath)) response(['message' => 'Gagal menyimpan file'], 422);
    @chmod($targetPath, 0640);

    $originalName = sanitize_filename((string) ($_FILES[$field]['name'] ?? 'upload-file.' . $ext));
    $actualSize = filesize($targetPath) ?: $size;
    return [
        'filename' => $originalName,
        'path' => $targetPath,
        'public_url' => query('base_url', '') . 'storage/' . $folder . '/' . $safeName,
        'mime_type' => $detectedMime ?: ($_FILES[$field]['type'] ?? ''),
        'size_bytes' => $actualSize,
    ];
}
