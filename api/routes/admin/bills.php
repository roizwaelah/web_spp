<?php
// Route daftar, generate, dan hapus tagihan.

if ($route === 'admin/bills' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $status = query('status', '');
    $studentId = query('student_id', '');
    $classId = query('class_id', '');
    $conditions = [];
    $params = [];
    if ($status) { $conditions[] = 'b.status = ?'; $params[] = $status; }
    if ($studentId) { $conditions[] = 'b.student_id = ?'; $params[] = $studentId; }
    if ($classId) { $conditions[] = 's.class_id = ?'; $params[] = $classId; }
    $where = $conditions ? ('WHERE ' . implode(' AND ', $conditions)) : '';
    $stmt = $pdo->prepare("SELECT b.*, s.name student_name, s.nis, c.name class_name,
            (SELECT status FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1) proof_status
        FROM bills b
        JOIN students s ON s.id=b.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        {$where}
        ORDER BY b.id DESC");
    $stmt->execute($params);
    response($stmt->fetchAll());
}

if ($route === 'admin/bills/manual-payment' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $input = json_input();
    ensure_required($input, ['bill_id', 'payment_channel', 'payment_date']);

    $allowedChannels = ['Tunai', 'Transfer Bank', 'QRIS', 'Virtual Account', 'E-Wallet'];
    if (!in_array($input['payment_channel'], $allowedChannels, true)) {
        response(['message' => 'Kanal pembayaran tidak valid'], 422);
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $input['payment_date'])) {
        response(['message' => 'Tanggal pembayaran harus berformat YYYY-MM-DD'], 422);
    }

    $billStmt = $pdo->prepare("SELECT b.*, s.name student_name, s.id student_id
        FROM bills b
        JOIN students s ON s.id = b.student_id
        WHERE b.id = ? LIMIT 1");
    $billStmt->execute([$input['bill_id']]);
    $bill = $billStmt->fetch();
    if (!$bill) response(['message' => 'Tagihan tidak ditemukan'], 404);
    if ($bill['status'] === 'paid') response(['message' => 'Tagihan ini sudah lunas'], 422);

    $pendingProof = (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE bill_id = ? AND status = 'pending'", [$bill['id']]);
    if ($pendingProof > 0) {
        response(['message' => 'Tagihan ini masih memiliki bukti pembayaran yang menunggu review admin'], 422);
    }

    $notes = trim((string) ($input['notes'] ?? ''));
    if ($notes !== '' && mb_strlen($notes) > 500) {
        response(['message' => 'Catatan pembayaran maksimal 500 karakter'], 422);
    }

    $referenceNo = create_manual_payment_reference((string) $input['payment_date']);
    $tx = record_bill_payment((int) $bill['id'], (int) $bill['student_id'], (string) $input['payment_channel'], (float) $bill['amount'], [
        'payment_date' => (string) $input['payment_date'],
        'reference_no' => $referenceNo,
        'notes' => $notes !== '' ? $notes : 'Input pembayaran manual oleh bendahara',
        'status' => 'paid',
    ]);

    queue_whatsapp_notification((int) $bill['student_id'], 'Pembayaran Diterima', "Pembayaran {$bill['bill_name']} untuk {$bill['student_name']} telah diterima dengan referensi {$tx['reference_no']}.");
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'pay', 'bill', (int) $bill['id'], 'Input pembayaran manual via ' . $input['payment_channel']);

    response([
        'message' => 'Pembayaran manual berhasil disimpan',
        'reference_no' => $tx['reference_no'],
        'transaction_id' => $tx['transaction_id'],
    ]);
}

if ($route === 'admin/bills' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['bills'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $bill = $pdo->prepare("SELECT * FROM bills WHERE id = ? LIMIT 1");
    $bill->execute([$input['id']]);
    $row = $bill->fetch();
    if (!$row) {
        response(['message' => 'Data tagihan tidak ditemukan'], 404);
    }
    $txCount = (int) scalar('SELECT COUNT(*) FROM transactions WHERE bill_id = ?', [$input['id']]);
    if ($txCount > 0) {
        response(['message' => 'Tagihan tidak bisa dihapus karena sudah memiliki transaksi'], 422);
    }
    $proofCount = (int) scalar('SELECT COUNT(*) FROM payment_proofs WHERE bill_id = ?', [$input['id']]);
    if ($proofCount > 0) {
        response(['message' => 'Tagihan tidak bisa dihapus karena sudah memiliki bukti pembayaran'], 422);
    }
    $stmt = $pdo->prepare("DELETE FROM bills WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'bill', (int) $input['id'], 'Menghapus tagihan ' . $row['bill_name']);
    response(['message' => 'Tagihan berhasil dihapus']);
}

if ($route === 'admin/bills/generate' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $input = json_input();
    $period = $input['period'] ?? date('Y-m');
    if (!preg_match('/^\d{4}-\d{2}$/', (string) $period)) {
        response(['message' => 'Format periode harus YYYY-MM'], 422);
    }
    if (!empty($input['due_date']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $input['due_date'])) {
        response(['message' => 'Format jatuh tempo harus YYYY-MM-DD'], 422);
    }
    $studentFilter = $input['student_id'] ?? null;
    if ($studentFilter && !scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$studentFilter])) {
        response(['message' => 'Siswa tidak ditemukan'], 404);
    }
    $sql = $studentFilter ? 'SELECT id FROM students WHERE id=?' : 'SELECT id FROM students';
    $stmtStudents = $pdo->prepare($sql);
    $stmtStudents->execute($studentFilter ? [$studentFilter] : []);
    $students = $stmtStudents->fetchAll();
    if (!$students) {
        response(['message' => 'Tidak ada siswa yang bisa diproses'], 422);
    }
    $created = 0;

    foreach ($students as $student) {
        foreach (finance_posts_for_student((int) $student['id']) as $post) {
            if ($post['billing_type'] === 'one_time') {
                $existsPaid = scalar('SELECT COUNT(*) FROM bills WHERE student_id = ? AND finance_post_id = ?', [$student['id'], $post['id']]);
                if ($existsPaid) continue;
            }
            $exists = scalar('SELECT COUNT(*) FROM bills WHERE student_id = ? AND finance_post_id = ? AND period = ?', [$student['id'], $post['id'], $period]);
            if ($exists) continue;
            $stmt = $pdo->prepare("INSERT INTO bills (student_id, finance_post_id, bill_name, period, due_date, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', NOW())");
            $dueDate = !empty($input['due_date']) ? $input['due_date'] : ($period . '-10');
            $stmt->execute([$student['id'], $post['id'], $post['name'], $period, $dueDate, $post['amount']]);
            $created++;

            $studentDetail = student_row((int) $student['id']);
            $message = "Assalamu'alaikum, tagihan {$post['name']} periode {$period} untuk {$studentDetail['name']} sebesar " . idr($post['amount']) . " jatuh tempo {$dueDate}.";
            queue_whatsapp_notification((int) $student['id'], 'Pengingat Tagihan', $message);
        }
    }

    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'generate', 'bill', null, 'Generate tagihan periode ' . $period . ' sebanyak ' . $created);
    response(['message' => "Generate selesai. {$created} tagihan dibuat."]);
}
