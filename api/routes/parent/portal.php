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
    queue_whatsapp_notification((int) $student['id'], 'Pembayaran Berhasil', "Pembayaran {$billSummary} sebesar " . idr($totalAmount) . " berhasil diterima. Ref: " . implode(', ', $references));
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

    $billSummary = count($bills) === 1 ? $bills[0]['bill_name'] : count($bills) . ' tagihan';
    queue_whatsapp_notification((int) $student['id'], 'Bukti Pembayaran Diterima', "Bukti pembayaran untuk {$billSummary} berhasil diunggah dan menunggu verifikasi admin.");
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
    if (!$transactionId && !$billId) response(['message' => 'ID transaksi atau tagihan wajib diisi'], 422);
    if ($transactionId) {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE t.id=? AND t.student_id=? LIMIT 1");
        $stmt->execute([$transactionId, $student['id']]);
        $row = $stmt->fetch();
    } else {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE b.id=? AND t.student_id=? ORDER BY t.id DESC LIMIT 1");
        $stmt->execute([$billId, $student['id']]);
        $row = $stmt->fetch();
    }
    if (!$row) response(['message' => 'Bukti pembayaran tidak ditemukan'], 404);
    $settings = list_settings();
    $receiptTitle = trim((string) ($settings['school_name'] ?? 'SPP Madrasah'));
    $receiptFooter = trim((string) ($settings['receipt_footer'] ?? ''));
    $statusLabel = $row['status'] === 'paid' ? 'LUNAS' : strtoupper((string) $row['status']);

    header('Content-Type: text/html; charset=utf-8');
    header('Content-Disposition: attachment; filename="bukti-pembayaran-' . ($row['reference_no'] ?: $row['id']) . '.html"');
    echo "<html><head><title>Bukti Pembayaran</title><style>body{font-family:Arial,sans-serif;padding:30px;background:#f8fafc}.card{max-width:650px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px}.title{color:#047857;font-size:28px;font-weight:700}.row{margin:10px 0;color:#334155}.label{font-weight:700;display:inline-block;width:170px}</style></head><body>";
    echo "<div class='card'><div class='title'>Bukti Pembayaran " . htmlspecialchars($receiptTitle) . "</div>";
    echo "<div class='row'><span class='label'>Nama Siswa</span>" . htmlspecialchars($student['name']) . "</div>";
    echo "<div class='row'><span class='label'>Tagihan</span>" . htmlspecialchars($row['bill_name']) . "</div>";
    echo "<div class='row'><span class='label'>Periode</span>" . htmlspecialchars($row['period']) . "</div>";
    echo "<div class='row'><span class='label'>Kanal</span>" . htmlspecialchars($row['payment_channel']) . "</div>";
    echo "<div class='row'><span class='label'>Nominal</span>" . idr($row['amount_paid']) . "</div>";
    echo "<div class='row'><span class='label'>Referensi</span>" . htmlspecialchars($row['reference_no']) . "</div>";
    echo "<div class='row'><span class='label'>Tanggal</span>" . htmlspecialchars($row['payment_date']) . "</div>";
    echo "<div class='row'><span class='label'>Status</span>" . htmlspecialchars($statusLabel) . "</div>";
    echo "<div class='row' style='margin-top:24px'>Dokumen ini dicetak otomatis oleh sistem " . htmlspecialchars($receiptTitle) . ".</div>";
    if ($receiptFooter !== '') {
        echo "<div class='row'>" . nl2br(htmlspecialchars($receiptFooter)) . "</div>";
    }
    echo "</div></body></html>";
    exit;
}
