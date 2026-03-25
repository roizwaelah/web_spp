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
    $proofId = query('id', '');
    if (!$proofId) response(['message' => 'ID bukti pembayaran wajib diisi'], 422);
    $stmt = $pdo->prepare("SELECT proof_file_name, proof_path, mime_type FROM payment_proofs WHERE id = ? LIMIT 1");
    $stmt->execute([$proofId]);
    $proof = $stmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if (!$proof['proof_path'] || !file_exists($proof['proof_path'])) response(['message' => 'File bukti tidak ditemukan'], 404);

    header('Content-Type: ' . ($proof['mime_type'] ?: 'application/octet-stream'));
    header('Content-Length: ' . filesize($proof['proof_path']));
    header('Content-Disposition: inline; filename="' . basename((string) $proof['proof_file_name']) . '"');
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
            create_transaction_and_mark_paid((int) $proof['bill_id'], (int) $proof['student_id'], 'Upload Bukti / Transfer Manual', (float) $proof['amount'], 'Verifikasi manual bukti pembayaran', 'paid');
            queue_whatsapp_notification((int) $proof['student_id'], 'Bukti Pembayaran Disetujui', "Pembayaran {$proof['bill_name']} untuk {$proof['student_name']} telah diverifikasi.");
        }

        if ($input['status'] === 'rejected') {
            queue_whatsapp_notification((int) $proof['student_id'], 'Bukti Pembayaran Ditolak', "Mohon unggah ulang bukti pembayaran {$proof['bill_name']} dengan data yang lebih jelas.");
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
    if (!empty($proof['proof_path']) && file_exists($proof['proof_path'])) {
        @unlink($proof['proof_path']);
    }
    log_activity((int) $user['id'], 'delete', 'payment_proof', (int) $input['id'], 'Menghapus bukti pembayaran');
    response(['message' => 'Bukti pembayaran berhasil dihapus']);
}
