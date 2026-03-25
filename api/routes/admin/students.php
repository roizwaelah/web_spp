<?php
// Route CRUD data siswa dan impor siswa.

if ($route === 'admin/students' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    $rows = $pdo->query("SELECT s.*, c.name class_name, ay.name academic_year,
            (SELECT COUNT(*) FROM bills b WHERE b.student_id=s.id AND b.status='unpaid') active_bills
        FROM students s
        LEFT JOIN classes c ON c.id=s.class_id
        LEFT JOIN academic_years ay ON ay.id=s.academic_year_id
        ORDER BY s.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/students' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    $input = json_input();
    ensure_required($input, ['nis', 'name', 'class_id', 'academic_year_id', 'parent_name', 'parent_phone', 'user_email']);

    if (scalar('SELECT id FROM students WHERE nis = ? LIMIT 1', [$input['nis']])) {
        response(['message' => 'NIS sudah digunakan siswa lain'], 422);
    }
    if (scalar("SELECT id FROM users WHERE email = ? LIMIT 1", [$input['user_email']])) {
        response(['message' => 'Email akun orang tua sudah digunakan'], 422);
    }

    $stmt = $pdo->prepare("INSERT INTO students (nis, name, class_id, academic_year_id, parent_name, parent_phone, user_email, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        $input['nis'], $input['name'], $input['class_id'], $input['academic_year_id'],
        $input['parent_name'], $input['parent_phone'], $input['user_email'],
        $input['address'] ?? null, $input['status'] ?? 'active'
    ]);
    $studentId = (int) $pdo->lastInsertId();

    $userStmt = $pdo->prepare("INSERT INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
    $userStmt->execute([$input['parent_name'], $input['user_email'], password_hash($input['parent_password'] ?: 'password', PASSWORD_DEFAULT), $studentId]);

    log_activity((int) $user['id'], 'create', 'student', $studentId, 'Menambah siswa ' . $input['name']);
    response(['message' => 'Siswa berhasil ditambahkan']);
}

if ($route === 'admin/students' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    $input = json_input();
    ensure_required($input, ['id', 'nis', 'name', 'class_id', 'academic_year_id', 'parent_name', 'parent_phone', 'user_email']);

    if (!scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data siswa tidak ditemukan'], 404);
    }
    if (scalar('SELECT id FROM students WHERE nis = ? AND id <> ? LIMIT 1', [$input['nis'], $input['id']])) {
        response(['message' => 'NIS sudah digunakan siswa lain'], 422);
    }
    if (scalar("SELECT id FROM users WHERE email = ? AND role = 'parent' AND student_id <> ? LIMIT 1", [$input['user_email'], $input['id']])) {
        response(['message' => 'Email akun orang tua sudah digunakan'], 422);
    }

    $stmt = $pdo->prepare("UPDATE students SET nis=?, name=?, class_id=?, academic_year_id=?, parent_name=?, parent_phone=?, user_email=?, address=?, status=? WHERE id=?");
    $stmt->execute([
        $input['nis'], $input['name'], $input['class_id'], $input['academic_year_id'],
        $input['parent_name'], $input['parent_phone'], $input['user_email'],
        $input['address'] ?? null, $input['status'] ?? 'active', $input['id']
    ]);
    $parentUser = parent_user_by_student_id((int) $input['id']);
    if ($parentUser) {
        $u = $pdo->prepare("UPDATE users SET name=?, email=? WHERE id=?");
        $u->execute([$input['parent_name'], $input['user_email'], $parentUser['id']]);
    } else {
        $u = $pdo->prepare("INSERT INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
        $u->execute([$input['parent_name'], $input['user_email'], password_hash('password', PASSWORD_DEFAULT), $input['id']]);
    }
    log_activity((int) $user['id'], 'update', 'student', (int) $input['id'], 'Memperbarui siswa ' . $input['name']);
    response(['message' => 'Siswa berhasil diperbarui']);
}

if ($route === 'admin/students' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['students'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    if (!scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data siswa tidak ditemukan'], 404);
    }
    $pdo->prepare("DELETE FROM users WHERE student_id=? AND role='parent'")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM payment_proofs WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM notifications WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM transactions WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM bills WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM students WHERE id=?")->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'student', (int) $input['id'], 'Menghapus siswa');
    response(['message' => 'Siswa berhasil dihapus']);
}

if ($route === 'admin/students/import' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['students'], ['admin']);
    if (empty($_FILES['file']['tmp_name'])) response(['message' => 'File tidak ditemukan'], 422);
    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    $rows = [];
    if ($ext === 'csv') {
        $handle = fopen($_FILES['file']['tmp_name'], 'r');
        $headers = fgetcsv($handle);
        while (($line = fgetcsv($handle)) !== false) $rows[] = array_combine($headers, $line);
        fclose($handle);
    } else {
        if (!class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) response(['message' => 'Jalankan composer install untuk impor Excel'], 422);
        $sheet = PhpOffice\PhpSpreadsheet\IOFactory::load($_FILES['file']['tmp_name'])->getActiveSheet()->toArray(null, true, true, false);
        $headers = $sheet[0];
        unset($sheet[0]);
        foreach ($sheet as $line) $rows[] = array_combine($headers, $line);
    }

    $imported = 0;
    foreach ($rows as $row) {
        if (empty($row['nis']) || empty($row['name'])) continue;
        $className = $row['class_name'] ?? 'Kelas Baru';
        $yearName = $row['academic_year'] ?? date('Y') . '/' . (date('Y') + 1);

        $classId = scalar('SELECT id FROM classes WHERE name = ? LIMIT 1', [$className]);
        if (!$classId) {
            $stmt = $pdo->prepare('INSERT INTO classes (name, is_active) VALUES (?, 1)');
            $stmt->execute([$className]);
            $classId = (int) $pdo->lastInsertId();
        }

        $yearId = scalar('SELECT id FROM academic_years WHERE name = ? LIMIT 1', [$yearName]);
        if (!$yearId) {
            $stmt = $pdo->prepare('INSERT INTO academic_years (name, is_active, created_at) VALUES (?, 0, NOW())');
            $stmt->execute([$yearName]);
            $yearId = (int) $pdo->lastInsertId();
        }

        $exists = scalar('SELECT id FROM students WHERE nis = ? LIMIT 1', [$row['nis']]);
        if ($exists) continue;

        $stmt = $pdo->prepare("INSERT INTO students (nis, name, class_id, academic_year_id, parent_name, parent_phone, user_email, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            $row['nis'], $row['name'], $classId, $yearId, $row['parent_name'] ?? '-',
            $row['parent_phone'] ?? '-', $row['user_email'] ?? ('wali.' . $row['nis'] . '@madrasah.id'),
            $row['address'] ?? null, $row['status'] ?? 'active'
        ]);
        $studentId = (int) $pdo->lastInsertId();
        $userStmt = $pdo->prepare("INSERT IGNORE INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
        $userStmt->execute([$row['parent_name'] ?? 'Orang Tua', $row['user_email'] ?? ('wali.' . $row['nis'] . '@madrasah.id'), password_hash('password', PASSWORD_DEFAULT), $studentId]);
        $imported++;
    }
    log_activity((int) $user['id'], 'import', 'student', null, 'Impor siswa sebanyak ' . $imported);
    response(['message' => "Impor berhasil. {$imported} siswa ditambahkan."]);
}
