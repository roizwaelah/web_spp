<?php
// Route CRUD data kelas.

if ($route === 'admin/classes' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['classes']);
    $rows = $pdo->query("SELECT c.*, COUNT(s.id) total_students
        FROM classes c
        LEFT JOIN students s ON s.class_id = c.id
        GROUP BY c.id
        ORDER BY c.name")->fetchAll();
    response($rows);
}

if ($route === 'admin/classes' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['classes']);
    $input = json_input();
    ensure_required($input, ['name']);
    if (scalar('SELECT id FROM classes WHERE name = ? LIMIT 1', [$input['name']])) {
        response(['message' => 'Nama kelas sudah digunakan'], 422);
    }
    $stmt = $pdo->prepare("INSERT INTO classes (name, grade_level, is_active) VALUES (?, ?, ?)");
    $stmt->execute([$input['name'], $input['grade_level'] ?? null, isset($input['is_active']) ? (int) !!$input['is_active'] : 1]);
    log_activity((int) $user['id'], 'create', 'class', (int) $pdo->lastInsertId(), 'Menambah kelas ' . $input['name']);
    response(['message' => 'Kelas berhasil ditambahkan']);
}

if ($route === 'admin/classes' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['classes']);
    $input = json_input();
    ensure_required($input, ['id', 'name']);
    if (!scalar('SELECT id FROM classes WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data kelas tidak ditemukan'], 404);
    }
    if (scalar('SELECT id FROM classes WHERE name = ? AND id <> ? LIMIT 1', [$input['name'], $input['id']])) {
        response(['message' => 'Nama kelas sudah digunakan'], 422);
    }
    $stmt = $pdo->prepare("UPDATE classes SET name=?, grade_level=?, is_active=? WHERE id=?");
    $stmt->execute([$input['name'], $input['grade_level'] ?? null, isset($input['is_active']) ? (int) !!$input['is_active'] : 1, $input['id']]);
    log_activity((int) $user['id'], 'update', 'class', (int) $input['id'], 'Memperbarui kelas ' . $input['name']);
    response(['message' => 'Kelas berhasil diperbarui']);
}

if ($route === 'admin/classes' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['classes'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    if (!scalar('SELECT id FROM classes WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data kelas tidak ditemukan'], 404);
    }
    $totalStudents = (int) scalar('SELECT COUNT(*) FROM students WHERE class_id = ?', [$input['id']]);
    if ($totalStudents > 0) {
        response(['message' => 'Kelas tidak bisa dihapus karena masih dipakai oleh data siswa'], 422);
    }
    $totalFinancePosts = (int) scalar('SELECT COUNT(*) FROM finance_posts WHERE class_id = ?', [$input['id']]);
    if ($totalFinancePosts > 0) {
        response(['message' => 'Kelas tidak bisa dihapus karena masih dipakai oleh pos keuangan'], 422);
    }
    $stmt = $pdo->prepare("DELETE FROM classes WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'class', (int) $input['id'], 'Menghapus kelas');
    response(['message' => 'Kelas berhasil dihapus']);
}
