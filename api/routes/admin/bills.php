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

if ($route === 'admin/bills/remind' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    rate_limit_or_fail('bill-remind:user:' . (int) ($user['id'] ?? 0), 30, 300, 'Terlalu sering kirim pengingat. Coba lagi beberapa menit lagi.');

    $input = json_input();
    $billId = (int) ($input['bill_id'] ?? 0);
    if ($billId <= 0) {
        response(['message' => 'ID tagihan wajib diisi'], 422);
    }

    $stmt = $pdo->prepare("SELECT b.*, s.name student_name, s.id student_id
        FROM bills b
        JOIN students s ON s.id = b.student_id
        WHERE b.id = ? LIMIT 1");
    $stmt->execute([$billId]);
    $bill = $stmt->fetch();
    if (!$bill) response(['message' => 'Tagihan tidak ditemukan'], 404);
    if ($bill['status'] === 'paid') response(['message' => 'Tagihan sudah lunas, pengingat tidak perlu dikirim'], 422);

    $message = "Assalamu'alaikum, tagihan {$bill['bill_name']} periode {$bill['period']} untuk {$bill['student_name']} sebesar " . idr($bill['amount']) . " jatuh tempo {$bill['due_date']}.";
    queue_whatsapp_notification((int) $bill['student_id'], 'Pengingat Tagihan', $message);
    try_dispatch_whatsapp_queue();

    log_activity((int) $user['id'], 'notify', 'bill', (int) $bill['id'], 'Kirim pengingat tagihan ke siswa ' . $bill['student_name']);
    response(['message' => 'Pengingat WhatsApp berhasil dikirim']);
}

if ($route === 'admin/bills' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['bills'], ['admin']);
    $input = json_input();
    $ids = [];
    if (isset($input['ids']) && is_array($input['ids'])) {
        foreach ($input['ids'] as $rawId) {
            $id = (int) $rawId;
            if ($id > 0) $ids[$id] = $id;
        }
    } elseif (!empty($input['id'])) {
        $id = (int) $input['id'];
        if ($id > 0) $ids[$id] = $id;
    }
    $ids = array_values($ids);
    if (!$ids) response(['message' => 'Pilih minimal satu tagihan untuk dihapus'], 422);

    $deleted = 0;
    $failed = [];
    $billStmt = $pdo->prepare("SELECT * FROM bills WHERE id = ? LIMIT 1");
    $deleteStmt = $pdo->prepare("DELETE FROM bills WHERE id = ?");

    foreach ($ids as $billId) {
        $billStmt->execute([$billId]);
        $row = $billStmt->fetch();
        if (!$row) {
            $failed[] = ['id' => $billId, 'reason' => 'Data tagihan tidak ditemukan'];
            continue;
        }

        $txCount = (int) scalar('SELECT COUNT(*) FROM transactions WHERE bill_id = ?', [$billId]);
        if ($txCount > 0) {
            $failed[] = ['id' => $billId, 'reason' => 'Sudah memiliki transaksi'];
            continue;
        }

        $proofCount = (int) scalar('SELECT COUNT(*) FROM payment_proofs WHERE bill_id = ?', [$billId]);
        if ($proofCount > 0) {
            $failed[] = ['id' => $billId, 'reason' => 'Sudah memiliki bukti pembayaran'];
            continue;
        }

        $deleteStmt->execute([$billId]);
        $deleted++;
        log_activity((int) $user['id'], 'delete', 'bill', $billId, 'Menghapus tagihan ' . $row['bill_name']);
    }

    if ($deleted === 0 && $failed) {
        $firstReason = (string) ($failed[0]['reason'] ?? 'Gagal menghapus tagihan');
        response(['message' => 'Tidak ada tagihan yang bisa dihapus. ' . $firstReason, 'failed' => $failed], 422);
    }

    if ($failed) {
        response([
            'message' => "{$deleted} tagihan berhasil dihapus, " . count($failed) . " gagal dihapus",
            'deleted' => $deleted,
            'failed' => $failed,
        ]);
    }

    response([
        'message' => $deleted === 1 ? 'Tagihan berhasil dihapus' : "{$deleted} tagihan berhasil dihapus",
        'deleted' => $deleted,
    ]);
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
    $financePostId = isset($input['finance_post_id']) ? (int) $input['finance_post_id'] : 0;
    if ($financePostId > 0 && !scalar('SELECT id FROM finance_posts WHERE id = ? LIMIT 1', [$financePostId])) {
        response(['message' => 'Pos keuangan tidak ditemukan'], 404);
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
        $posts = finance_posts_for_student((int) $student['id']);
        if ($financePostId > 0) {
            $posts = array_values(array_filter($posts, static fn($post) => (int) ($post['id'] ?? 0) === $financePostId));
        }

        foreach ($posts as $post) {
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
