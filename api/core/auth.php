<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';

function base64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode(string $data): string {
    return base64_decode(strtr($data, '-_', '+/'));
}

function generate_token(array $payload): string {
    $secret = env_value('JWT_SECRET', 'secret');
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $body = base64url_encode(json_encode($payload));
    $signature = hash_hmac('sha256', $header . '.' . $body, $secret, true);
    return $header . '.' . $body . '.' . base64url_encode($signature);
}

function decode_token(string $token): ?array {
    $secret = env_value('JWT_SECRET', 'secret');
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    [$header, $body, $signature] = $parts;
    $expected = base64url_encode(hash_hmac('sha256', $header . '.' . $body, $secret, true));
    if (!hash_equals($expected, $signature)) return null;
    $payload = json_decode(base64url_decode($body), true);
    if (!$payload || (($payload['exp'] ?? 0) < time())) return null;
    return $payload;
}

function staff_menu_definitions(): array {
    return [
        ['key' => 'dashboard', 'label' => 'Dashboard'],
        ['key' => 'students', 'label' => 'Data Siswa'],
        ['key' => 'classes', 'label' => 'Data Kelas'],
        ['key' => 'academic_years', 'label' => 'Tahun Ajaran'],
        ['key' => 'finance_posts', 'label' => 'Pos Keuangan'],
        ['key' => 'bills', 'label' => 'Tagihan'],
        ['key' => 'payment_proofs', 'label' => 'Bukti Pembayaran'],
        ['key' => 'reports', 'label' => 'Laporan'],
        ['key' => 'backups', 'label' => 'Backup'],
        ['key' => 'settings', 'label' => 'Pengaturan'],
        ['key' => 'users', 'label' => 'Users'],
    ];
}

function default_menu_access_for_role(string $role): array {
    return match ($role) {
        'admin' => array_column(staff_menu_definitions(), 'key'),
        'bendahara' => ['dashboard', 'students', 'classes', 'academic_years', 'finance_posts', 'bills', 'payment_proofs', 'reports'],
        default => [],
    };
}

function admin_only_menu_keys(): array {
    return ['backups', 'settings', 'users'];
}

function normalize_menu_access(array $menuKeys): array {
    $allowedKeys = array_column(staff_menu_definitions(), 'key');
    $normalized = [];
    foreach ($menuKeys as $menuKey) {
        $menuKey = trim((string) $menuKey);
        if ($menuKey === '' || !in_array($menuKey, $allowedKeys, true)) continue;
        $normalized[$menuKey] = true;
    }
    return array_keys($normalized);
}

function user_menu_access(int $userId, string $role): array {
    if (!in_array($role, ['admin', 'bendahara'], true)) return [];
    try {
        $stmt = db()->prepare('SELECT menu_key FROM user_menu_access WHERE user_id = ? ORDER BY menu_key ASC');
        $stmt->execute([$userId]);
        $rows = $stmt->fetchAll();
        if (!$rows) return default_menu_access_for_role($role);
        return normalize_menu_access(array_column($rows, 'menu_key'));
    } catch (Throwable $e) {
        return default_menu_access_for_role($role);
    }
}

function hydrate_auth_user(array $user): array {
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'student_id' => $user['student_id'] ? (int) $user['student_id'] : null,
        'menu_access' => user_menu_access((int) $user['id'], (string) $user['role']),
    ];
}

function auth_user(): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.*)$/i', $header, $matches)) return null;
    $payload = decode_token($matches[1]);
    if (!$payload) return null;
    $stmt = db()->prepare('SELECT id, name, email, role, student_id FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$payload['id']]);
    $user = $stmt->fetch();
    if (!$user) return null;
    return hydrate_auth_user($user);
}

function require_auth($role = null): array {
    $user = auth_user();
    if (!$user) response(['message' => 'Unauthorized'], 401);
    if (is_string($role) && $user['role'] !== $role) response(['message' => 'Forbidden'], 403);
    if (is_array($role) && !in_array($user['role'], $role, true)) response(['message' => 'Forbidden'], 403);
    return $user;
}
