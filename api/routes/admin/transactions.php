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
            s.name student_name, s.nis, s.nisn,
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

if ($route === 'admin/transactions/receipt' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $transactionId = query('transaction_id');
    $referenceNo = trim((string) query('reference_no', ''));
    $studentId = (int) query('student_id', 0);
    if (!$transactionId && $referenceNo === '') {
        response(['message' => 'ID transaksi atau nomor referensi wajib diisi'], 422);
    }

    $fetchByReference = static function (PDO $pdo, string $refNo, int $sid): array {
        $stmtRows = $pdo->prepare("SELECT t.*, b.bill_name, b.period, s.name student_name, s.nis, s.nisn, c.name class_name, ay.name academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE t.reference_no = ? AND t.student_id = ?
            ORDER BY t.id ASC");
        $stmtRows->execute([$refNo, $sid]);
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
    if ($transactionId) {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period, s.name student_name, s.nis, s.nisn, c.name class_name, ay.name academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE t.id=? LIMIT 1");
        $stmt->execute([$transactionId]);
        $baseRow = $stmt->fetch();
        if (!$baseRow) response(['message' => 'Transaksi tidak ditemukan'], 404);

        $baseReference = trim((string) ($baseRow['reference_no'] ?? ''));
        $baseStudentId = (int) ($baseRow['student_id'] ?? 0);
        if ($baseReference !== '' && $baseStudentId > 0) {
            $row = $fetchByReference($pdo, $baseReference, $baseStudentId);
        }
        if (!$row) $row = $baseRow;
    } else {
        if ($referenceNo === '' || $studentId <= 0) {
            response(['message' => 'Nomor referensi dan ID siswa wajib diisi'], 422);
        }
        $row = $fetchByReference($pdo, $referenceNo, $studentId);
        if (!$row) response(['message' => 'Transaksi tidak ditemukan'], 404);
    }

    $settings = list_settings();
    $receiptHtml = render_payment_receipt_html($row, $settings, (string) ($user['name'] ?? 'ADMIN'));
    $receiptPdf = render_pdf_from_html($receiptHtml);
    $receiptRefNo = (string) ($row['reference_no'] ?: ('TRX' . str_pad((string) ($row['id'] ?? 0), 10, '0', STR_PAD_LEFT)));
    $receiptRef = preg_replace('/[^a-zA-Z0-9._-]/', '-', $receiptRefNo);
    $receiptRef = trim((string) $receiptRef, '-') ?: 'TRX0000000000';
    try {
        upload_receipt_pdf_to_supabase($receiptPdf, $receiptRefNo, (int) ($row['student_id'] ?? 0));
    } catch (Throwable $e) {
        error_log('[SUPABASE_RECEIPT_UPLOAD][admin] ' . $e->getMessage());
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="' . $receiptRef . '.pdf"');
    echo $receiptPdf;
    exit;
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
