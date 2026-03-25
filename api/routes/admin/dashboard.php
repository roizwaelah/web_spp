<?php
// Route dashboard admin.

if ($route === 'admin/dashboard' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['dashboard']);

    $summary = [
        'students' => (int) scalar('SELECT COUNT(*) FROM students'),
        'classes' => (int) scalar('SELECT COUNT(*) FROM classes WHERE is_active=1'),
        'activeBills' => (int) scalar("SELECT COUNT(*) FROM bills WHERE status <> 'paid'"),
        'pendingProofs' => (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE status='pending'"),
        'monthIncome' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE status='paid' AND DATE_FORMAT(payment_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')"),
        'yearIncome' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE status='paid' AND YEAR(payment_date) = YEAR(CURDATE())"),
        'lastBackup' => scalar("SELECT DATE_FORMAT(MAX(created_at), '%d-%m-%Y %H:%i') FROM backups") ?: 'Belum ada',
    ];

    $integrations = [
        'paymentGatewayEnabled' => setting_is_enabled('payment_gateway_enabled'),
        'paymentGatewayProvider' => setting_value('payment_gateway_provider'),
        'whatsappGatewayEnabled' => setting_is_enabled('whatsapp_gateway_enabled'),
    ];

    $monthly = $pdo->query("SELECT DATE_FORMAT(payment_date, '%b') month, SUM(amount_paid) total
        FROM transactions
        WHERE status='paid' AND YEAR(payment_date)=YEAR(CURDATE())
        GROUP BY DATE_FORMAT(payment_date, '%Y-%m'), DATE_FORMAT(payment_date, '%b')
        ORDER BY MIN(payment_date)")->fetchAll();

    $channelBreakdown = $pdo->query("SELECT payment_channel, SUM(amount_paid) total
        FROM transactions WHERE status='paid' GROUP BY payment_channel ORDER BY total DESC")->fetchAll();

    $dueSoon = $pdo->query("SELECT b.id, b.bill_name, b.period, b.due_date, b.amount, s.name student_name
        FROM bills b
        JOIN students s ON s.id=b.student_id
        WHERE b.status<>'paid' AND b.due_date IS NOT NULL
        ORDER BY b.due_date ASC LIMIT 6")->fetchAll();

    $latestTransactions = $pdo->query("SELECT t.id, s.name student_name, b.bill_name, b.period, t.amount_paid amount, t.payment_channel, t.status
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        ORDER BY t.id DESC LIMIT 6")->fetchAll();

    response(compact('summary', 'monthly', 'channelBreakdown', 'dueSoon', 'latestTransactions', 'integrations'));
}
