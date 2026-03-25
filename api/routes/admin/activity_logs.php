<?php
// Route audit log aktivitas admin.

if ($route === 'admin/activity-logs' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $rows = $pdo->query("SELECT al.*, u.name user_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.id DESC LIMIT 100")->fetchAll();
    response($rows);
}
