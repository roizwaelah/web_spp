<?php
// Route CRUD pos keuangan.

if ($route === 'admin/finance-posts' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['finance_posts']);
    $rows = $pdo->query("SELECT fp.*, c.name class_name, s.name student_name
        FROM finance_posts fp
        LEFT JOIN classes c ON c.id = fp.class_id
        LEFT JOIN students s ON s.id = fp.student_id
        ORDER BY fp.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/finance-posts' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['finance_posts']);
    $input = json_input();
    ensure_required($input, ['name', 'amount', 'applies_to', 'billing_type']);
    if (!in_array($input['applies_to'], ['class', 'student'], true)) {
        response(['message' => 'Target pos keuangan tidak valid'], 422);
    }
    if (!in_array($input['billing_type'], ['monthly', 'one_time'], true)) {
        response(['message' => 'Jenis tagihan tidak valid'], 422);
    }
    if ((float) $input['amount'] <= 0) {
        response(['message' => 'Nominal harus lebih besar dari 0'], 422);
    }
    if ($input['applies_to'] === 'class') {
        if (!empty($input['class_id']) && !scalar('SELECT id FROM classes WHERE id = ? LIMIT 1', [$input['class_id']])) {
            response(['message' => 'Kelas target tidak ditemukan'], 404);
        }
        $input['class_id'] = !empty($input['class_id']) ? $input['class_id'] : null;
        $input['student_id'] = null;
    } else {
        if (!empty($input['student_id']) && !scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$input['student_id']])) {
            response(['message' => 'Siswa target tidak ditemukan'], 404);
        }
        $input['student_id'] = !empty($input['student_id']) ? $input['student_id'] : null;
        $input['class_id'] = null;
    }
    $stmt = $pdo->prepare("INSERT INTO finance_posts (name, description, amount, applies_to, class_id, student_id, billing_type, is_flexible_installment, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        $input['name'], $input['description'] ?? null, $input['amount'], $input['applies_to'],
        $input['class_id'] ?? null, $input['student_id'] ?? null,
        $input['billing_type'], isset($input['is_flexible_installment']) ? (int) !!$input['is_flexible_installment'] : 0,
        isset($input['is_active']) ? (int) !!$input['is_active'] : 1
    ]);
    log_activity((int) $user['id'], 'create', 'finance_post', (int) $pdo->lastInsertId(), 'Menambah pos keuangan');
    response(['message' => 'Pos keuangan berhasil disimpan']);
}

if ($route === 'admin/finance-posts' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['finance_posts']);
    $input = json_input();
    ensure_required($input, ['id', 'name', 'amount', 'applies_to', 'billing_type']);
    if (!scalar('SELECT id FROM finance_posts WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data pos keuangan tidak ditemukan'], 404);
    }
    if (!in_array($input['applies_to'], ['class', 'student'], true)) {
        response(['message' => 'Target pos keuangan tidak valid'], 422);
    }
    if (!in_array($input['billing_type'], ['monthly', 'one_time'], true)) {
        response(['message' => 'Jenis tagihan tidak valid'], 422);
    }
    if ((float) $input['amount'] <= 0) {
        response(['message' => 'Nominal harus lebih besar dari 0'], 422);
    }
    if ($input['applies_to'] === 'class') {
        if (!empty($input['class_id']) && !scalar('SELECT id FROM classes WHERE id = ? LIMIT 1', [$input['class_id']])) {
            response(['message' => 'Kelas target tidak ditemukan'], 404);
        }
        $input['class_id'] = !empty($input['class_id']) ? $input['class_id'] : null;
        $input['student_id'] = null;
    } else {
        if (!empty($input['student_id']) && !scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$input['student_id']])) {
            response(['message' => 'Siswa target tidak ditemukan'], 404);
        }
        $input['student_id'] = !empty($input['student_id']) ? $input['student_id'] : null;
        $input['class_id'] = null;
    }
    $stmt = $pdo->prepare("UPDATE finance_posts SET name=?, description=?, amount=?, applies_to=?, class_id=?, student_id=?, billing_type=?, is_flexible_installment=?, is_active=? WHERE id=?");
    $stmt->execute([
        $input['name'], $input['description'] ?? null, $input['amount'], $input['applies_to'],
        $input['class_id'] ?? null, $input['student_id'] ?? null,
        $input['billing_type'], isset($input['is_flexible_installment']) ? (int) !!$input['is_flexible_installment'] : 0,
        isset($input['is_active']) ? (int) !!$input['is_active'] : 1, $input['id']
    ]);
    log_activity((int) $user['id'], 'update', 'finance_post', (int) $input['id'], 'Memperbarui pos keuangan');
    response(['message' => 'Pos keuangan berhasil diperbarui']);
}

if ($route === 'admin/finance-posts' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['finance_posts'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    if (!scalar('SELECT id FROM finance_posts WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data pos keuangan tidak ditemukan'], 404);
    }
    $totalBills = (int) scalar('SELECT COUNT(*) FROM bills WHERE finance_post_id = ?', [$input['id']]);
    if ($totalBills > 0) {
        response(['message' => 'Pos keuangan tidak bisa dihapus karena sudah dipakai oleh tagihan'], 422);
    }
    $stmt = $pdo->prepare("DELETE FROM finance_posts WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'finance_post', (int) $input['id'], 'Menghapus pos keuangan');
    response(['message' => 'Pos keuangan berhasil dihapus']);
}
