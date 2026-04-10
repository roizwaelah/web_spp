<?php
// Route portal orang tua: dashboard, tagihan, pembayaran, notifikasi, dan receipt.

if ($route === 'parent/dashboard' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $summary = [
        'activeBills' => (int) scalar("SELECT COUNT(*) FROM bills WHERE student_id=? AND status='unpaid'", [$student['id']]),
        'outstanding' => (float) scalar("SELECT COALESCE(SUM(amount),0) FROM bills WHERE student_id=? AND status='unpaid'", [$student['id']]),
        'paidThisYear' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE student_id=? AND status='paid' AND YEAR(payment_date)=YEAR(CURDATE())", [$student['id']]),
        'pendingProofs' => (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE student_id=? AND status='pending'", [$student['id']]),
    ];
    response(['summary' => $summary, 'student' => $student, 'settings' => list_settings()]);
}

if ($route === 'parent/bills' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT b.*,
            (SELECT status FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1) proof_status,
            (SELECT proof_file_name FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1) proof_file_name
        FROM bills b WHERE b.student_id=? ORDER BY b.id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/payments' && $method === 'POST') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $input = json_input();
    ensure_required($input, ['payment_channel']);
    if (!setting_is_enabled('payment_gateway_enabled')) {
        response(['message' => 'Payment gateway sedang dinonaktifkan oleh admin'], 422);
    }
    $allowedChannels = ['Transfer Bank', 'QRIS', 'Virtual Account', 'E-Wallet'];
    if (!in_array($input['payment_channel'], $allowedChannels, true)) response(['message' => 'Kanal pembayaran tidak valid'], 422);
    $rawBillIds = $input['bill_ids'] ?? ($input['bill_id'] ?? null);
    if ($rawBillIds === null) response(['message' => 'Tagihan yang akan dibayar wajib dipilih'], 422);
    if (!is_array($rawBillIds)) $rawBillIds = [$rawBillIds];

    $billIds = [];
    foreach ($rawBillIds as $billId) {
        $billId = (int) $billId;
        if ($billId > 0) $billIds[] = $billId;
    }
    $billIds = array_values(array_unique($billIds));
    if (!$billIds) response(['message' => 'Tagihan yang akan dibayar wajib dipilih'], 422);

    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $params = array_merge($billIds, [$student['id']]);
    $stmt = $pdo->prepare("SELECT * FROM bills WHERE id IN ($placeholders) AND student_id=? ORDER BY due_date IS NULL, due_date ASC, id ASC");
    $stmt->execute($params);
    $bills = $stmt->fetchAll();
    if (count($bills) !== count($billIds)) response(['message' => 'Sebagian tagihan tidak ditemukan'], 404);

    foreach ($bills as $bill) {
        if ($bill['status'] === 'paid') response(['message' => "Tagihan {$bill['bill_name']} sudah lunas"], 422);
        $pendingProof = scalar("SELECT id FROM payment_proofs WHERE bill_id = ? AND student_id = ? AND status = 'pending' LIMIT 1", [$bill['id'], $student['id']]);
        if ($pendingProof) response(['message' => "Bukti pembayaran untuk tagihan {$bill['bill_name']} masih menunggu review admin"], 422);
    }

    $instruction = payment_instruction($input['payment_channel']);
    $references = [];
    $totalAmount = 0;

    try {
        $pdo->beginTransaction();
        foreach ($bills as $bill) {
            $tx = create_transaction_and_mark_paid((int) $bill['id'], (int) $student['id'], $input['payment_channel'], (float) $bill['amount'], $instruction, 'paid');
            $references[] = $tx['reference_no'];
            $totalAmount += (float) $bill['amount'];
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        response(['message' => 'Pembayaran gagal diproses'], 500);
    }

    $billNames = array_map(static fn ($bill) => $bill['bill_name'], $bills);
    $billSummary = count($billNames) === 1 ? $billNames[0] : count($billNames) . ' tagihan';
    $receiptLinks = generate_receipt_links_for_student((int) $student['id'], $references, 'ADMIN');
    $receiptMessage = build_receipt_notification_message($billSummary, (float) $totalAmount, $references, $receiptLinks);
    queue_whatsapp_notification((int) $student['id'], 'Kuitansi Pembayaran', $receiptMessage);
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'pay', 'bill', (int) $billIds[0], 'Pembayaran orang tua via ' . $input['payment_channel'] . ' untuk ' . count($billIds) . ' tagihan');
    response([
        'message' => count($billIds) > 1 ? count($billIds) . ' tagihan berhasil diproses' : 'Pembayaran berhasil diproses',
        'reference_no' => $references[0] ?? null,
        'reference_numbers' => $references,
        'instruction' => $instruction,
        'processed_bills' => count($billIds),
        'total_amount' => $totalAmount,
    ]);
}

if ($route === 'parent/payment-proofs' && $method === 'POST') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $rawBillIds = $_POST['bill_ids'] ?? ($_POST['bill_id'] ?? null);
    if ($rawBillIds === null) response(['message' => 'Tagihan yang akan dibuktikan wajib dipilih'], 422);
    if (!is_array($rawBillIds)) $rawBillIds = [$rawBillIds];

    $billIds = [];
    foreach ($rawBillIds as $billId) {
        $billId = (int) $billId;
        if ($billId > 0) $billIds[] = $billId;
    }
    $billIds = array_values(array_unique($billIds));
    if (!$billIds) response(['message' => 'Tagihan yang akan dibuktikan wajib dipilih'], 422);

    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $params = array_merge($billIds, [$student['id']]);
    $stmt = $pdo->prepare("SELECT * FROM bills WHERE id IN ($placeholders) AND student_id=? ORDER BY due_date IS NULL, due_date ASC, id ASC");
    $stmt->execute($params);
    $bills = $stmt->fetchAll();
    if (count($bills) !== count($billIds)) response(['message' => 'Sebagian tagihan tidak ditemukan'], 404);

    foreach ($bills as $bill) {
        if ($bill['status'] === 'paid') response(['message' => "Tagihan {$bill['bill_name']} sudah lunas, bukti pembayaran tidak perlu diunggah lagi"], 422);
        $pendingProof = scalar("SELECT id FROM payment_proofs WHERE bill_id = ? AND student_id = ? AND status = 'pending' LIMIT 1", [$bill['id'], $student['id']]);
        if ($pendingProof) response(['message' => "Bukti pembayaran untuk {$bill['bill_name']} masih menunggu review admin"], 422);
    }

    $notes = trim((string) ($_POST['notes'] ?? ''));
    if ($notes !== '' && mb_strlen($notes) > 500) {
        response(['message' => 'Catatan maksimal 500 karakter'], 422);
    }

    $file = save_uploaded_file('file', 'payment-proofs');
    if (!$file) response(['message' => 'File bukti pembayaran wajib diunggah'], 422);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("INSERT INTO payment_proofs (bill_id, student_id, proof_file_name, proof_path, mime_type, size_bytes, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())");
        foreach ($bills as $bill) {
            $stmt->execute([$bill['id'], $student['id'], $file['filename'], $file['path'], $file['mime_type'], $file['size_bytes'], $notes !== '' ? $notes : null]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        response(['message' => 'Gagal menyimpan bukti pembayaran'], 500);
    }

    $totalAmount = 0.0;
    foreach ($bills as $bill) {
        $totalAmount += (float) ($bill['amount'] ?? 0);
    }

    $billSummary = count($bills) === 1 ? $bills[0]['bill_name'] : count($bills) . ' tagihan';
    queue_whatsapp_notification((int) $student['id'], 'Bukti Pembayaran Diterima', "Bukti pembayaran untuk {$billSummary} berhasil diunggah dan menunggu verifikasi admin.");
    $adminNotes = $notes !== '' ? $notes : '-';
    $adminMessage = "Orang tua baru saja mengunggah bukti transfer.\n"
        . "Siswa: {$student['name']}\n"
        . "Kelas: " . ($student['class_name'] ?: '-') . "\n"
        . "Tagihan: {$billSummary}\n"
        . "Total: " . idr($totalAmount) . "\n"
        . "Catatan: {$adminNotes}\n"
        . "Waktu: " . date('Y-m-d H:i:s');
    send_admin_whatsapp_notification('Bukti Transfer Baru', $adminMessage);
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'upload', 'payment_proof', (int) $billIds[0], 'Unggah bukti pembayaran untuk ' . count($billIds) . ' tagihan');
    response(['message' => count($billIds) > 1 ? 'Bukti pembayaran berhasil diunggah untuk beberapa tagihan dan menunggu verifikasi' : 'Bukti pembayaran berhasil diunggah dan menunggu verifikasi']);
}

if ($route === 'parent/transactions' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT t.*, b.bill_name FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE t.student_id=? ORDER BY t.id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/notifications' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE student_id=? ORDER BY id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/receipt' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);

    $transactionId = query('transaction_id');
    $billId = query('bill_id');
    $referenceNo = trim((string) query('reference_no', ''));
    if (!$transactionId && !$billId && $referenceNo === '') {
        response(['message' => 'ID transaksi, tagihan, atau nomor referensi wajib diisi'], 422);
    }

    $fetchByReference = static function (PDO $pdo, string $refNo, int $studentId): array {
        $stmtRows = $pdo->prepare("SELECT t.*, b.bill_name, b.period, s.name AS student_name, s.nis, c.name AS class_name, ay.name AS academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE t.reference_no = ? AND t.student_id = ?
            ORDER BY t.id ASC");
        $stmtRows->execute([$refNo, $studentId]);
        $rows = $stmtRows->fetchAll();
        if (!$rows) return [];

        $first = $rows[0];
        $items = [];
        $total = 0.0;
        foreach ($rows as $txRow) {
            $amount = (float) ($txRow['amount_paid'] ?? 0);
            $total += $amount;
            $items[] = [
                'bill_name' => (string) ($txRow['bill_name'] ?? '-'),
                'period' => (string) ($txRow['period'] ?? '-'),
                'amount' => $amount,
            ];
        }
        $first['items'] = $items;
        $first['amount_paid'] = $total;
        return $first;
    };

    $row = null;
    if ($referenceNo !== '') {
        $row = $fetchByReference($pdo, $referenceNo, (int) $student['id']);
    } elseif ($transactionId) {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period, s.name AS student_name, s.nis, c.name AS class_name, ay.name AS academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE t.id=? AND t.student_id=? LIMIT 1");
        $stmt->execute([$transactionId, $student['id']]);
        $baseRow = $stmt->fetch();
        if ($baseRow) {
            $baseReference = trim((string) ($baseRow['reference_no'] ?? ''));
            if ($baseReference !== '') {
                $row = $fetchByReference($pdo, $baseReference, (int) $student['id']);
            }
            if (!$row) $row = $baseRow;
        }
    } else {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period, s.name AS student_name, s.nis, c.name AS class_name, ay.name AS academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE b.id=? AND t.student_id=? ORDER BY t.id DESC LIMIT 1");
        $stmt->execute([$billId, $student['id']]);
        $row = $stmt->fetch();
        if ($row) {
            $baseReference = trim((string) ($row['reference_no'] ?? ''));
            if ($baseReference !== '') {
                $groupedRow = $fetchByReference($pdo, $baseReference, (int) $student['id']);
                if ($groupedRow) $row = $groupedRow;
            }
        }
    }
    if (!$row) response(['message' => 'Bukti pembayaran tidak ditemukan'], 404);
    $settings = list_settings();

    $receiptHtml = render_payment_receipt_html($row, $settings, 'ADMIN');
    $receiptPdf = render_pdf_from_html($receiptHtml);
    $referenceNo = (string) ($row['reference_no'] ?: ('TRX' . str_pad((string) ($row['id'] ?? 0), 10, '0', STR_PAD_LEFT)));
    $receiptRef = preg_replace('/[^a-zA-Z0-9._-]/', '-', $referenceNo);
    $receiptRef = trim((string) $receiptRef, '-') ?: 'TRX0000000000';
    try {
        upload_receipt_pdf_to_supabase($receiptPdf, $referenceNo, (int) ($student['id'] ?? 0));
    } catch (Throwable $e) {
        error_log('[SUPABASE_RECEIPT_UPLOAD][parent] ' . $e->getMessage());
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $receiptRef . '.pdf"');
    echo $receiptPdf;
    exit;
}
