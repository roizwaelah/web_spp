<?php
// Route verifikasi bukti pembayaran dan file proof.

if ($route === 'admin/payment-proofs' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    $conditions = [];
    $params = [];
    if ($status) { $conditions[] = 'pp.status = ?'; $params[] = $status; }
    if ($classId) { $conditions[] = 's.class_id = ?'; $params[] = $classId; }
    if ($studentId) { $conditions[] = 'pp.student_id = ?'; $params[] = $studentId; }
    $where = $conditions ? ('WHERE ' . implode(' AND ', $conditions)) : '';
    $stmt = $pdo->prepare("SELECT pp.*, s.name student_name, s.nis, c.name class_name, b.bill_name, b.period, b.amount, b.status bill_status
        FROM payment_proofs pp
        JOIN students s ON s.id = pp.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        JOIN bills b ON b.id = pp.bill_id
        {$where}
        ORDER BY pp.id DESC");
    $stmt->execute($params);
    response($stmt->fetchAll());
}

if ($route === 'admin/payment-proofs/file' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    $proofId = (int) query('id', 0);
    if ($proofId <= 0) response(['message' => 'ID bukti pembayaran wajib diisi'], 422);
    $stmt = $pdo->prepare("SELECT proof_file_name, proof_path, mime_type FROM payment_proofs WHERE id = ? LIMIT 1");
    $stmt->execute([$proofId]);
    $proof = $stmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if (!$proof['proof_path'] || !file_exists($proof['proof_path'])) response(['message' => 'File bukti tidak ditemukan'], 404);

    $proofDir = API_ROOT . '/storage/payment-proofs';
    if (!is_path_inside_dir((string) $proof['proof_path'], $proofDir)) {
        response(['message' => 'Akses file tidak valid'], 403);
    }

    $mimeType = (string) ($proof['mime_type'] ?: 'application/octet-stream');
    $safeFileName = sanitize_filename((string) ($proof['proof_file_name'] ?: 'proof-file'));
    $isInlineAllowed = in_array($mimeType, ['application/pdf', 'image/jpeg', 'image/png'], true);
    $disposition = $isInlineAllowed ? 'inline' : 'attachment';

    header('Content-Type: ' . $mimeType);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Length: ' . filesize($proof['proof_path']));
    header('Content-Disposition: ' . $disposition . '; filename="' . basename($safeFileName) . '"');
    readfile($proof['proof_path']);
    exit;
}

if ($route === 'admin/payment-proofs/review' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    $input = json_input();
    ensure_required($input, ['proof_id', 'status']);
    $proofStmt = $pdo->prepare("SELECT pp.*, b.status bill_status, b.amount, b.bill_name, s.parent_phone, s.name student_name
        FROM payment_proofs pp
        JOIN bills b ON b.id=pp.bill_id
        JOIN students s ON s.id=pp.student_id
        WHERE pp.id=? LIMIT 1");
    $proofStmt->execute([$input['proof_id']]);
    $proof = $proofStmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if (!in_array($input['status'], ['approved', 'rejected'], true)) response(['message' => 'Status review tidak valid'], 422);
    if ($proof['status'] !== 'pending') response(['message' => 'Bukti pembayaran ini sudah direview'], 422);
    if ($input['status'] === 'rejected' && trim((string) ($input['notes'] ?? '')) === '') {
        response(['message' => 'Alasan penolakan wajib diisi'], 422);
    }

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE payment_proofs SET status=?, reviewed_by=?, reviewed_at=NOW(), notes=? WHERE id=?");
        $stmt->execute([$input['status'], $user['id'], $input['notes'] ?? null, $input['proof_id']]);

        if ($input['status'] === 'approved' && $proof['bill_status'] !== 'paid') {
            $tx = create_transaction_and_mark_paid((int) $proof['bill_id'], (int) $proof['student_id'], 'Transfer Manual', (float) $proof['amount'], 'Verifikasi manual bukti pembayaran', 'paid');
            $officerName = strtoupper(trim((string) ($user['name'] ?? 'ADMIN')));
            if ($officerName === '') $officerName = 'ADMIN';
            $receiptLinks = generate_receipt_links_for_student((int) $proof['student_id'], [(string) ($tx['reference_no'] ?? '')], $officerName);
            $receiptMessage = build_receipt_notification_message(
                (string) ($proof['bill_name'] ?? 'tagihan'),
                (float) ($proof['amount'] ?? 0),
                [(string) ($tx['reference_no'] ?? '')],
                $receiptLinks
            );
            queue_whatsapp_notification((int) $proof['student_id'], 'Kuitansi Pembayaran', $receiptMessage);
        }

        if ($input['status'] === 'rejected') {
            $rejectionReason = trim((string) ($input['notes'] ?? ''));
            queue_whatsapp_notification(
                (int) $proof['student_id'],
                'Bukti Pembayaran Ditolak',
                "Bukti pembayaran {$proof['bill_name']} ditolak admin.\nAlasan: {$rejectionReason}\nMohon unggah ulang bukti pembayaran dengan data yang lebih jelas."
            );
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        response(['message' => 'Gagal memproses review: ' . $e->getMessage()], 422);
    }

    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'review', 'payment_proof', (int) $input['proof_id'], 'Review bukti pembayaran: ' . $input['status']);
    response(['message' => 'Review bukti pembayaran berhasil disimpan']);
}

if ($route === 'admin/payment-proofs' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $stmt = $pdo->prepare("SELECT * FROM payment_proofs WHERE id = ? LIMIT 1");
    $stmt->execute([$input['id']]);
    $proof = $stmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if ($proof['status'] === 'approved') response(['message' => 'Bukti yang sudah disetujui tidak bisa dihapus'], 422);

    $delete = $pdo->prepare("DELETE FROM payment_proofs WHERE id = ?");
    $delete->execute([$input['id']]);
    $remainingPathUsage = (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE proof_path = ?", [$proof['proof_path']]);
    if (!empty($proof['proof_path']) && $remainingPathUsage === 0 && file_exists($proof['proof_path'])) {
        @unlink($proof['proof_path']);
    }
    log_activity((int) $user['id'], 'delete', 'payment_proof', (int) $input['id'], 'Menghapus bukti pembayaran');
    response(['message' => 'Bukti pembayaran berhasil dihapus']);
}
