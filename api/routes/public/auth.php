<?php
// Route publik: login, profil akun sendiri, dan metadata form admin/staff.

if ($route === 'login' && $method === 'POST') {
    $input = json_input();
    $role = trim((string) ($input['role'] ?? ''));
    $ip = client_ip();
    rate_limit_or_fail('login:ip:' . $ip, 30, 300, 'Terlalu banyak percobaan login dari IP ini. Coba lagi 5 menit.');

    if ($role === 'parent' || !empty($input['nisn'])) {
        ensure_required($input, ['nisn']);
        rate_limit_or_fail('login:parent:' . $ip . ':' . sha1((string) $input['nisn']), 10, 300, 'Terlalu banyak percobaan login orang tua. Coba lagi 5 menit.');
        $stmt = $pdo->prepare("SELECT u.* FROM users u
            JOIN students s ON s.id = u.student_id
            WHERE u.role = 'parent' AND s.nisn = ? LIMIT 1");
        $stmt->execute([trim((string) $input['nisn'])]);
        $user = $stmt->fetch();
        if (!$user) response(['message' => 'NISN orang tua tidak ditemukan'], 422);
    } else {
        ensure_required($input, ['email', 'password']);
        rate_limit_or_fail('login:staff:' . $ip . ':' . sha1(strtolower(trim((string) $input['email']))), 10, 300, 'Terlalu banyak percobaan login staff. Coba lagi 5 menit.');
        $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
        $stmt->execute([trim((string) $input['email'])]);
        $user = $stmt->fetch();
        if (!$user || !password_verify((string) $input['password'], $user['password'])) {
            response(['message' => 'Email atau password salah'], 422);
        }
    }

    $payload = [
        'id' => $user['id'],
        'role' => $user['role'],
        'iat' => time(),
        'exp' => time() + (86400 * 7),
        'iss' => env_value('APP_NAME', 'web_spp_api'),
        'aud' => 'web_spp_client',
        'jti' => bin2hex(random_bytes(16)),
    ];
    log_activity((int) $user['id'], 'login', 'auth', (int) $user['id'], 'Pengguna login ke sistem');
    response([
        'token' => generate_token($payload),
        'user' => build_user_payload($user)
    ]);
}

if ($route === 'me' && $method === 'GET') {
    response(['user' => require_auth()]);
}

if ($route === 'me' && $method === 'PUT') {
    $user = require_auth();
    $input = json_input();
    $name = trim((string) ($input['name'] ?? ''));
    $email = trim((string) ($input['email'] ?? ''));
    $password = (string) ($input['password'] ?? '');

    if ($name === '') response(['message' => 'Nama user wajib diisi'], 422);
    if (mb_strlen($name) > 120) response(['message' => 'Nama user maksimal 120 karakter'], 422);

    if ($email === '') response(['message' => 'Email wajib diisi'], 422);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) response(['message' => 'Format email tidak valid'], 422);
    if (mb_strlen($email) > 120) response(['message' => 'Email maksimal 120 karakter'], 422);

    if ($password !== '' && mb_strlen($password) < 6) {
        response(['message' => 'Password minimal 6 karakter'], 422);
    }

    if ($password !== '' && mb_strlen($password) > 255) {
        response(['message' => 'Password maksimal 255 karakter'], 422);
    }

    if (scalar('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [$email, $user['id']])) {
        response(['message' => 'Email user sudah digunakan'], 422);
    }

    $passwordSql = '';
    $params = [$name, $email];
    if ($password !== '') {
        $passwordSql = ', password = ?';
        $params[] = password_hash($password, PASSWORD_DEFAULT);
    }
    $params[] = $user['id'];

    $stmt = $pdo->prepare("UPDATE users SET name = ?, email = ?{$passwordSql} WHERE id = ?");
    $stmt->execute($params);

    $stmtUser = $pdo->prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    $stmtUser->execute([$user['id']]);
    $updated = $stmtUser->fetch();

    log_activity((int) $user['id'], 'update', 'profile', (int) $user['id'], 'Memperbarui akun sendiri');
    response([
        'message' => 'Akun berhasil diperbarui',
        'user' => build_user_payload($updated),
    ]);
}

if ($route === 'admin/meta' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    response([
        'classes' => $pdo->query('SELECT id, name FROM classes WHERE is_active=1 ORDER BY name')->fetchAll(),
        'years' => $pdo->query('SELECT id, name FROM academic_years ORDER BY id DESC')->fetchAll(),
        'students' => $pdo->query('SELECT id, name, nis, nisn FROM students ORDER BY name')->fetchAll(),
        'roles' => [
            ['value' => 'admin', 'label' => 'Admin'],
            ['value' => 'bendahara', 'label' => 'Bendahara'],
        ],
        'menuOptions' => staff_menu_definitions(),
    ]);
}
