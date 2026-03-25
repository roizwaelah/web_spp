<?php
// Route laporan transaksi dan export CSV.

if ($route === 'admin/reports' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['reports']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
    $params = [$start, $end];
    if ($status) { $conditions[] = 't.status = ?'; $params[] = $status; }
    if ($classId) { $conditions[] = 's.class_id = ?'; $params[] = $classId; }
    if ($studentId) { $conditions[] = 't.student_id = ?'; $params[] = $studentId; }
    $where = implode(' AND ', $conditions);
    $stmt = $pdo->prepare("SELECT t.*, b.bill_name, s.name student_name, c.name class_name
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE {$where}
        ORDER BY t.payment_date DESC");
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $summary = [
        'count' => count($rows),
        'total' => array_reduce($rows, fn($carry, $item) => $carry + (float) $item['amount_paid'], 0),
        'successful' => count(array_filter($rows, fn($r) => $r['status'] === 'paid')),
        'pending' => count(array_filter($rows, fn($r) => $r['status'] === 'pending')),
    ];

    $byChannel = [];
    foreach ($rows as $row) {
        $channel = $row['payment_channel'];
        $byChannel[$channel] = ($byChannel[$channel] ?? 0) + (float) $row['amount_paid'];
    }

    response(['rows' => $rows, 'summary' => $summary, 'byChannel' => $byChannel]);
}

if ($route === 'admin/reports/export' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['reports']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
    $params = [$start, $end];
    if ($status) { $conditions[] = 't.status = ?'; $params[] = $status; }
    if ($classId) { $conditions[] = 's.class_id = ?'; $params[] = $classId; }
    if ($studentId) { $conditions[] = 't.student_id = ?'; $params[] = $studentId; }
    $where = implode(' AND ', $conditions);
    $stmt = $pdo->prepare("SELECT t.payment_date, s.name student_name, c.name class_name, b.bill_name, t.payment_channel, t.amount_paid, t.reference_no, t.status
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE {$where}
        ORDER BY t.payment_date DESC");
    $stmt->execute($params);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=laporan-keuangan.csv');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Tanggal', 'Siswa', 'Kelas', 'Tagihan', 'Kanal', 'Nominal', 'Referensi', 'Status']);
    foreach ($stmt->fetchAll() as $row) {
        $statusLabel = $row['status'] === 'paid' ? 'Lunas' : ($row['status'] === 'pending' ? 'Menunggu' : 'Gagal');
        fputcsv($out, [$row['payment_date'], $row['student_name'], $row['class_name'], $row['bill_name'], $row['payment_channel'], $row['amount_paid'], $row['reference_no'], $statusLabel]);
    }
    fclose($out);
    exit;
}
