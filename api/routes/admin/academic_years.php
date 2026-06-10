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


if ($route === 'admin/academic-years/transition-impact' && in_array($method, ['GET', 'POST'], true)) {
    $user = require_auth();
    validate_menu_access($user, ['academic_years']);

    $input = $method === 'POST' ? json_input() : [];
    $fromYearId = (int) (($input['from_year_id'] ?? 0) ?: query('from_year_id', 0));

    if ($fromYearId <= 0) {
        response(['message' => 'Tahun ajaran asal wajib dipilih'], 422);
    }

    if (!scalar('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [$fromYearId])) {
        response(['message' => 'Tahun ajaran asal tidak ditemukan'], 404);
    }

    $activeStudents = (int) scalar(
        "SELECT COUNT(*) FROM students WHERE academic_year_id = ? AND status = 'active'",
        [$fromYearId]
    );
    $unpaidBills = (int) scalar(
        "SELECT COUNT(*) 
         FROM bills b 
         LEFT JOIN students s ON s.id = b.student_id
         WHERE (b.academic_year_id = ? OR (b.academic_year_id IS NULL AND s.academic_year_id = ?)) AND b.status <> 'paid'",
        [$fromYearId, $fromYearId]
    );
    $unpaidStudents = (int) scalar(
        "SELECT COUNT(DISTINCT b.student_id) 
         FROM bills b
         LEFT JOIN students s ON s.id = b.student_id
         WHERE (b.academic_year_id = ? OR (b.academic_year_id IS NULL AND s.academic_year_id = ?)) AND b.status <> 'paid'",
        [$fromYearId, $fromYearId]
    );

    response([
        'from_year_id' => $fromYearId,
        'active_students' => $activeStudents,
        'unpaid_bills' => $unpaidBills,
        'unpaid_students' => $unpaidStudents,
    ]);
}
if ($route === 'admin/academic-years/transition' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['academic_years']);

    $input = json_input();
    ensure_required($input, ['from_year_id', 'to_year_id']);

    $fromYearId = (int) ($input['from_year_id'] ?? 0);
    $toYearId = (int) ($input['to_year_id'] ?? 0);
    $activateTarget = isset($input['activate_target']) ? (int) !!$input['activate_target'] : 1;

    if ($fromYearId <= 0 || $toYearId <= 0) {
        response(['message' => 'Tahun ajaran asal dan tujuan wajib dipilih'], 422);
    }
    if ($fromYearId === $toYearId) {
        response(['message' => 'Tahun ajaran asal dan tujuan tidak boleh sama'], 422);
    }

    if (!scalar('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [$fromYearId])) {
        response(['message' => 'Tahun ajaran asal tidak ditemukan'], 404);
    }
    if (!scalar('SELECT id FROM academic_years WHERE id = ? LIMIT 1', [$toYearId])) {
        response(['message' => 'Tahun ajaran tujuan tidak ditemukan'], 404);
    }

    $stmt = $pdo->prepare("UPDATE students SET academic_year_id = ? WHERE academic_year_id = ? AND status = 'active'");
    $stmt->execute([$toYearId, $fromYearId]);
    $moved = (int) $stmt->rowCount();

    if ($activateTarget === 1) {
        $pdo->exec('UPDATE academic_years SET is_active = 0');
        $stmtActivate = $pdo->prepare('UPDATE academic_years SET is_active = 1 WHERE id = ?');
        $stmtActivate->execute([$toYearId]);
    }

    log_activity((int) $user['id'], 'update', 'academic_year', $toYearId, 'Transisi tahun ajaran dari #' . $fromYearId . ' ke #' . $toYearId . ' untuk ' . $moved . ' siswa aktif');

    response([
        'message' => "Transisi tahun ajaran berhasil. {$moved} siswa aktif dipindahkan.",
        'moved' => $moved,
    ]);
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





