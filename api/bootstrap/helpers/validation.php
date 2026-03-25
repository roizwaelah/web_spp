<?php
// Helper validasi payload umum yang dipakai lintas route.

function validate_user_payload(array $input, bool $isUpdate = false): array {
    $clean = [
        'name' => trim((string) ($input['name'] ?? '')),
        'email' => trim((string) ($input['email'] ?? '')),
        'password' => (string) ($input['password'] ?? ''),
        'role' => trim((string) ($input['role'] ?? '')),
        'student_id' => $input['student_id'] ?? null,
        'menu_access' => is_array($input['menu_access'] ?? null) ? $input['menu_access'] : [],
    ];

    if ($clean['name'] === '') response(['message' => 'Nama user wajib diisi'], 422);
    if (mb_strlen($clean['name']) > 120) response(['message' => 'Nama user maksimal 120 karakter'], 422);

    if ($clean['email'] === '') response(['message' => 'Email wajib diisi'], 422);
    if (!filter_var($clean['email'], FILTER_VALIDATE_EMAIL)) response(['message' => 'Format email tidak valid'], 422);
    if (mb_strlen($clean['email']) > 120) response(['message' => 'Email maksimal 120 karakter'], 422);

    if (!in_array($clean['role'], ['admin', 'bendahara', 'parent'], true)) {
        response(['message' => 'Role user tidak valid'], 422);
    }

    if (!$isUpdate && trim($clean['password']) === '') {
        response(['message' => 'Password wajib diisi'], 422);
    }

    if ($clean['password'] !== '' && mb_strlen($clean['password']) < 6) {
        response(['message' => 'Password minimal 6 karakter'], 422);
    }

    if ($clean['password'] !== '' && mb_strlen($clean['password']) > 255) {
        response(['message' => 'Password maksimal 255 karakter'], 422);
    }

    if ($clean['role'] !== 'parent') {
        $clean['student_id'] = null;
    }

    return $clean;
}

function ensure_required(array $input, array $required): void {
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim((string) $input[$field]) === '') response(['message' => 'Field wajib: ' . $field], 422);
    }
}
