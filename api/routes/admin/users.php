<?php
// Route CRUD user dan pengaturan akses menu.

if ($route === 'admin/users' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['users'], ['admin']);
    $rows = $pdo->query("SELECT u.id, u.name, u.email, u.role, u.student_id, u.created_at, s.name student_name, s.nis student_nis
        FROM users u
        LEFT JOIN students s ON s.id = u.student_id
        WHERE u.role <> 'parent'
        ORDER BY u.id DESC")->fetchAll();

    $result = array_map(function (array $row) {
        $row['id'] = (int) $row['id'];
        $row['student_id'] = $row['student_id'] ? (int) $row['student_id'] : null;
        $row['menu_access'] = user_menu_access((int) $row['id'], (string) $row['role']);
        return $row;
    }, $rows);

    response($result);
}

if ($route === 'admin/users' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['users'], ['admin']);
    $input = validate_user_payload(json_input());

    $role = (string) $input['role'];
    if ($role === 'parent') {
        response(['message' => 'Akun orang tua dibuat otomatis dari menu Data Siswa'], 422);
    }
    if (scalar('SELECT id FROM users WHERE email = ? LIMIT 1', [$input['email']])) {
        response(['message' => 'Email user sudah digunakan'], 422);
    }

    $studentId = null;
    if ($role === 'parent') {
        if (empty($input['student_id'])) response(['message' => 'Akun orang tua wajib dihubungkan ke siswa'], 422);
        $studentId = (int) $input['student_id'];
        if (!scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$studentId])) {
            response(['message' => 'Data siswa untuk akun orang tua tidak ditemukan'], 404);
        }
        if (scalar("SELECT id FROM users WHERE role = 'parent' AND student_id = ? LIMIT 1", [$studentId])) {
            response(['message' => 'Siswa tersebut sudah memiliki akun orang tua'], 422);
        }
    }

    $stmt = $pdo->prepare("INSERT INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        trim((string) $input['name']),
        trim((string) $input['email']),
        password_hash((string) $input['password'], PASSWORD_DEFAULT),
        $role,
        $studentId,
    ]);
    $userId = (int) $pdo->lastInsertId();
    save_user_menu_access($userId, $role, $input['menu_access'] ?? []);

    log_activity((int) $user['id'], 'create', 'user', $userId, 'Menambah user ' . $input['email']);
    response(['message' => 'User berhasil ditambahkan']);
}

if ($route === 'admin/users' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['users'], ['admin']);
    $rawInput = json_input();
    ensure_required($rawInput, ['id']);
    $input = validate_user_payload($rawInput, true);
    $input['id'] = $rawInput['id'];

    $targetId = (int) $input['id'];
    $role = (string) $input['role'];
    if ($role === 'parent') {
        response(['message' => 'Akun orang tua dikelola otomatis dari menu Data Siswa'], 422);
    }

    $stmtCurrent = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmtCurrent->execute([$targetId]);
    $current = $stmtCurrent->fetch();
    if (!$current) response(['message' => 'Data user tidak ditemukan'], 404);

    if (scalar('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [$input['email'], $targetId])) {
        response(['message' => 'Email user sudah digunakan'], 422);
    }

    if ((int) $user['id'] === $targetId && $role !== 'admin') {
        response(['message' => 'Akun Anda sendiri tidak boleh diubah menjadi non-admin'], 422);
    }

    $studentId = null;
    if ($role === 'parent') {
        if (empty($input['student_id'])) response(['message' => 'Akun orang tua wajib dihubungkan ke siswa'], 422);
        $studentId = (int) $input['student_id'];
        if (!scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$studentId])) {
            response(['message' => 'Data siswa untuk akun orang tua tidak ditemukan'], 404);
        }
        if (scalar("SELECT id FROM users WHERE role = 'parent' AND student_id = ? AND id <> ? LIMIT 1", [$studentId, $targetId])) {
            response(['message' => 'Siswa tersebut sudah memiliki akun orang tua'], 422);
        }
    }

    $menuAccess = $input['menu_access'] ?? [];
    if ((int) $user['id'] === $targetId && $role === 'admin' && !in_array('users', normalize_menu_access($menuAccess), true)) {
        response(['message' => 'Akun Anda sendiri harus tetap memiliki akses menu Users'], 422);
    }

    $passwordSql = '';
    $params = [
        trim((string) $input['name']),
        trim((string) $input['email']),
        $role,
        $studentId,
    ];
    if (!empty($input['password'])) {
        $passwordSql = ', password = ?';
        $params[] = password_hash((string) $input['password'], PASSWORD_DEFAULT);
    }
    $params[] = $targetId;

    $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?, role = ?, student_id = ?{$passwordSql} WHERE id = ?");
    $stmt->execute($params);
    save_user_menu_access($targetId, $role, $menuAccess);

    log_activity((int) $user['id'], 'update', 'user', $targetId, 'Memperbarui user ' . $input['email']);
    response(['message' => 'User berhasil diperbarui']);
}

if ($route === 'admin/users' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['users'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);

    $targetId = (int) $input['id'];
    if ((int) $user['id'] === $targetId) {
        response(['message' => 'Akun Anda sendiri tidak bisa dihapus'], 422);
    }

    $stmtTarget = $pdo->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
    $stmtTarget->execute([$targetId]);
    $target = $stmtTarget->fetch();
    if (!$target) response(['message' => 'Data user tidak ditemukan'], 404);

    if ($target['role'] === 'admin') {
        $totalAdmin = (int) scalar("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        if ($totalAdmin <= 1) response(['message' => 'Admin terakhir tidak boleh dihapus'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $stmt->execute([$targetId]);

    log_activity((int) $user['id'], 'delete', 'user', $targetId, 'Menghapus user');
    response(['message' => 'User berhasil dihapus']);
}
