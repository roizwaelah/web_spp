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

function auth_user(): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/Bearer\s+(.*)$/i', $header, $matches)) return null;
    $payload = decode_token($matches[1]);
    if (!$payload) return null;
    $stmt = db()->prepare('SELECT id, name, email, role, student_id FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$payload['id']]);
    return $stmt->fetch() ?: null;
}

function require_auth($role = null): array {
    $user = auth_user();
    if (!$user) response(['message' => 'Unauthorized'], 401);
    if (is_string($role) && $user['role'] !== $role) response(['message' => 'Forbidden'], 403);
    if (is_array($role) && !in_array($user['role'], $role, true)) response(['message' => 'Forbidden'], 403);
    return $user;
}
