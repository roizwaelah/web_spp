<?php
// Route laporan transaksi dan export CSV.

if ($route === 'admin/reports' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['reports']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $type = query('type', '');
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $rows = [];

    if ($type !== 'expense') {
        $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
        $params = [$start, $end];
        if ($status) { $conditions[] = 't.status = ?'; $params[] = $status; }
        if ($classId) { $conditions[] = 's.class_id = ?'; $params[] = $classId; }
        if ($studentId) { $conditions[] = 't.student_id = ?'; $params[] = $studentId; }
        $where = implode(' AND ', $conditions);
        $stmt = $pdo->prepare("SELECT
                'income' report_type,
                t.id,
                t.student_id,
                t.payment_date report_date,
                s.name student_name,
                c.name class_name,
                b.bill_name item_name,
                '' category,
                t.payment_channel payment_channel,
                t.amount_paid amount,
                t.reference_no,
                t.status
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            WHERE {$where}");
        $stmt->execute($params);
        $rows = array_merge($rows, $stmt->fetchAll());
    }

    if ($type !== 'income' && $studentId === '' && $classId === '') {
        $expenseStmt = $pdo->prepare("SELECT
                'expense' report_type,
                e.id,
                NULL student_id,
                e.expense_date report_date,
                '' student_name,
                '' class_name,
                e.title item_name,
                COALESCE(e.category, '') category,
                '' payment_channel,
                e.amount amount,
                '' reference_no,
                'recorded' status
            FROM expenses e
            WHERE DATE(e.expense_date) BETWEEN ? AND ?");
        $expenseStmt->execute([$start, $end]);
        $rows = array_merge($rows, $expenseStmt->fetchAll());
    }

    usort($rows, fn($a, $b) => strcmp((string) $b['report_date'], (string) $a['report_date']));

    $summary = [
        'count' => count($rows),
        'totalIncome' => array_reduce($rows, fn($carry, $item) => $carry + ($item['report_type'] === 'income' ? (float) $item['amount'] : 0), 0),
        'totalExpense' => array_reduce($rows, fn($carry, $item) => $carry + ($item['report_type'] === 'expense' ? (float) $item['amount'] : 0), 0),
        'successful' => count(array_filter($rows, fn($r) => $r['report_type'] === 'income' && $r['status'] === 'paid')),
        'pending' => count(array_filter($rows, fn($r) => $r['report_type'] === 'income' && $r['status'] === 'pending')),
    ];
    $summary['net'] = (float) $summary['totalIncome'] - (float) $summary['totalExpense'];

    $byChannel = [];
    foreach ($rows as $row) {
        if ($row['report_type'] !== 'income') continue;
        $channel = $row['payment_channel'];
        $byChannel[$channel] = ($byChannel[$channel] ?? 0) + (float) $row['amount'];
    }

    response(['rows' => $rows, 'summary' => $summary, 'byChannel' => $byChannel]);
}

if ($route === 'admin/reports/export' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['reports']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $type = query('type', '');
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $rows = [];

    if ($type !== 'expense') {
        $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
        $params = [$start, $end];
        if ($status) { $conditions[] = 't.status = ?'; $params[] = $status; }
        if ($classId) { $conditions[] = 's.class_id = ?'; $params[] = $classId; }
        if ($studentId) { $conditions[] = 't.student_id = ?'; $params[] = $studentId; }
        $where = implode(' AND ', $conditions);
        $stmt = $pdo->prepare("SELECT
                'Pemasukan' tipe,
                t.payment_date tanggal,
                s.name student_name,
                c.name class_name,
                b.bill_name item_name,
                '' category,
                t.payment_channel payment_channel,
                t.amount_paid amount,
                t.reference_no,
                t.status
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            WHERE {$where}");
        $stmt->execute($params);
        $rows = array_merge($rows, $stmt->fetchAll());
    }

    if ($type !== 'income' && $studentId === '' && $classId === '') {
        $expenseStmt = $pdo->prepare("SELECT
                'Pengeluaran' tipe,
                e.expense_date tanggal,
                '' student_name,
                '' class_name,
                e.title item_name,
                COALESCE(e.category, '') category,
                '' payment_channel,
                e.amount amount,
                '' reference_no,
                'recorded' status
            FROM expenses e
            WHERE DATE(e.expense_date) BETWEEN ? AND ?");
        $expenseStmt->execute([$start, $end]);
        $rows = array_merge($rows, $expenseStmt->fetchAll());
    }

    usort($rows, fn($a, $b) => strcmp((string) $b['tanggal'], (string) $a['tanggal']));
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=laporan-keuangan.csv');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Tipe', 'Tanggal', 'Siswa', 'Kelas', 'Item', 'Kategori', 'Kanal', 'Nominal', 'Referensi', 'Status']);
    foreach ($rows as $row) {
        $statusLabel = $row['status'] === 'paid' ? 'Lunas' : ($row['status'] === 'pending' ? 'Menunggu' : ($row['status'] === 'recorded' ? 'Tercatat' : 'Gagal'));
        fputcsv($out, [$row['tipe'], $row['tanggal'], $row['student_name'], $row['class_name'], $row['item_name'], $row['category'], $row['payment_channel'], $row['amount'], $row['reference_no'], $statusLabel]);
    }
    fclose($out);
    exit;
}
