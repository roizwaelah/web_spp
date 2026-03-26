<?php
// Route daftar dan hapus transaksi pembayaran admin.

if ($route === 'admin/transactions' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $classId = query('class_id', '');
    $studentId = query('student_id', '');

    $conditions = [];
    $params = [];

    if ($classId) {
        $conditions[] = 's.class_id = ?';
        $params[] = $classId;
    }
    if ($studentId) {
        $conditions[] = 't.student_id = ?';
        $params[] = $studentId;
    }

    $where = $conditions ? ('WHERE ' . implode(' AND ', $conditions)) : '';
    $stmt = $pdo->prepare("SELECT t.id, t.bill_id, t.student_id, t.payment_channel, t.amount_paid, t.payment_date, t.reference_no, t.status, t.notes,
            b.bill_name, b.period,
            s.name student_name, s.nis,
            c.name class_name
        FROM transactions t
        JOIN bills b ON b.id = t.bill_id
        JOIN students s ON s.id = t.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        {$where}
        ORDER BY t.payment_date DESC, t.id DESC");
    $stmt->execute($params);
    response($stmt->fetchAll());
}

if ($route === 'admin/transactions' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $input = json_input();
    ensure_required($input, ['id']);

    $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.status bill_status
        FROM transactions t
        JOIN bills b ON b.id = t.bill_id
        WHERE t.id = ? LIMIT 1");
    $stmt->execute([$input['id']]);
    $transaction = $stmt->fetch();
    if (!$transaction) {
        response(['message' => 'Transaksi tidak ditemukan'], 404);
    }

    $approvedProofCount = (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE bill_id = ? AND status = 'approved'", [$transaction['bill_id']]);
    if ($approvedProofCount > 0) {
        response(['message' => 'Transaksi untuk tagihan dengan bukti pembayaran yang sudah disetujui tidak bisa dihapus'], 422);
    }

    $pdo->beginTransaction();
    try {
        $delete = $pdo->prepare("DELETE FROM transactions WHERE id = ?");
        $delete->execute([$transaction['id']]);
        sync_bill_payment_status((int) $transaction['bill_id']);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        response(['message' => 'Gagal menghapus transaksi: ' . $e->getMessage()], 422);
    }

    log_activity((int) $user['id'], 'delete', 'transaction', (int) $transaction['id'], 'Menghapus transaksi ' . ($transaction['reference_no'] ?: $transaction['bill_name']));
    response(['message' => 'Transaksi berhasil dihapus']);
}
