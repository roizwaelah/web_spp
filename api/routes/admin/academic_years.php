<?php
// Route CRUD tahun ajaran.

if ($route === 'admin/academic-years' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['academic_years']);
    $rows = $pdo->query("SELECT ay.*, COUNT(s.id) total_students
        FROM academic_years ay
        LEFT JOIN students s ON s.academic_year_id = ay.id
        GROUP BY ay.id
        ORDER BY ay.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/academic-years' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['academic_years']);
    $input = json_input();
    ensure_required($input, ['name']);
    if (!empty($input['start_date']) && !empty($input['end_date']) && $input['end_date'] < $input['start_date']) {
        response(['message' => 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai'], 422);
    }
    if (scalar('SELECT id FROM academic_years WHERE name = ? LIMIT 1', [$input['name']])) {
        response(['message' => 'Nama tahun ajaran sudah digunakan'], 422);
    }
    if (!empty($input['is_active'])) $pdo->exec("UPDATE academic_years SET is_active=0");
    $stmt = $pdo->prepare("INSERT INTO academic_years (name, start_date, end_date, is_active, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([$input['name'], $input['start_date'] ?? null, $input['end_date'] ?? null, isset($input['is_active']) ? (int) !!$input['is_active'] : 0]);
    log_activity((int) $user['id'], 'create', 'academic_year', (int) $pdo->lastInsertId(), 'Menambah tahun ajaran ' . $input['name']);
    response(['message' => 'Tahun ajaran berhasil ditambahkan']);
}

if ($route === 'admin/academic-years' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['academic_years']);
    $input = json_input();
    ensure_required($input, ['id', 'name']);
    if (!scalar('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data tahun ajaran tidak ditemukan'], 404);
    }
    if (!empty($input['start_date']) && !empty($input['end_date']) && $input['end_date'] < $input['start_date']) {
        response(['message' => 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai'], 422);
    }
    if (scalar('SELECT id FROM academic_years WHERE name = ? AND id <> ? LIMIT 1', [$input['name'], $input['id']])) {
        response(['message' => 'Nama tahun ajaran sudah digunakan'], 422);
    }
    if (!empty($input['is_active'])) {
        $stmt = $pdo->prepare("UPDATE academic_years SET is_active=0 WHERE id <> ?");
        $stmt->execute([$input['id']]);
    }
    $stmt = $pdo->prepare("UPDATE academic_years SET name=?, start_date=?, end_date=?, is_active=? WHERE id=?");
    $stmt->execute([$input['name'], $input['start_date'] ?? null, $input['end_date'] ?? null, isset($input['is_active']) ? (int) !!$input['is_active'] : 0, $input['id']]);
    log_activity((int) $user['id'], 'update', 'academic_year', (int) $input['id'], 'Memperbarui tahun ajaran');
    response(['message' => 'Tahun ajaran berhasil diperbarui']);
}

if ($route === 'admin/academic-years' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['academic_years'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    if (!scalar('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data tahun ajaran tidak ditemukan'], 404);
    }
    $totalStudents = (int) scalar('SELECT COUNT(*) FROM students WHERE academic_year_id = ?', [$input['id']]);
    if ($totalStudents > 0) {
        response(['message' => 'Tahun ajaran tidak bisa dihapus karena masih dipakai oleh data siswa'], 422);
    }
    $stmt = $pdo->prepare("DELETE FROM academic_years WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'academic_year', (int) $input['id'], 'Menghapus tahun ajaran');
    response(['message' => 'Tahun ajaran berhasil dihapus']);
}
