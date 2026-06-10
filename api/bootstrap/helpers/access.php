<?php
// Helper kontrol akses role dan menu untuk user staff.

function validate_role_access(array $user, array $roles): void {
    if (!in_array($user['role'], $roles, true)) response(['message' => 'Forbidden'], 403);
}

function validate_menu_access(array $user, array $menuKeys, ?array $roles = ['admin', 'bendahara', 'verifikator']): void {
    if ($roles) validate_role_access($user, $roles);
    if ($user['role'] === 'parent') response(['message' => 'Forbidden'], 403);
    $currentAccess = $user['menu_access'] ?? [];
    foreach ($menuKeys as $menuKey) {
        if (in_array($menuKey, $currentAccess, true)) return;
    }
    response(['message' => 'Anda tidak punya akses ke menu ini'], 403);
}

function save_user_menu_access(int $userId, string $role, array $menuKeys): array {
    $normalized = normalize_menu_access($menuKeys);
    if (!in_array($role, ['admin', 'bendahara', 'verifikator'], true)) $normalized = [];
    if ($role === 'bendahara') {
        $normalized = array_values(array_diff($normalized, ['settings', ...admin_only_menu_keys()]));
    } elseif ($role === 'verifikator') {
        $normalized = array_values(array_diff($normalized, admin_only_menu_keys()));
    } elseif ($role !== 'admin') {
        $normalized = array_values(array_diff($normalized, ['settings', ...admin_only_menu_keys()]));
    }
    if ($role === 'admin' && !in_array('dashboard', $normalized, true)) $normalized[] = 'dashboard';
    if (in_array($role, ['bendahara', 'verifikator'], true) && !in_array('dashboard', $normalized, true)) $normalized[] = 'dashboard';
    sort($normalized);

    $delete = db()->prepare('DELETE FROM user_menu_access WHERE user_id = ?');
    $delete->execute([$userId]);

    if ($normalized) {
        $insert = db()->prepare('INSERT INTO user_menu_access (user_id, menu_key, created_at) VALUES (?, ?, NOW())');
        foreach ($normalized as $menuKey) {
            $insert->execute([$userId, $menuKey]);
        }
    }

    return $normalized;
}

function build_user_payload(array $user): array {
    return hydrate_auth_user($user);
}
