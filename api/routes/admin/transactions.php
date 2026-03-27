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

if ($route === 'admin/transactions/receipt' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $transactionId = query('transaction_id');
    if (!$transactionId) response(['message' => 'ID transaksi wajib diisi'], 422);

    $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period, s.name student_name, s.nis, c.name class_name
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE t.id=? LIMIT 1");
    $stmt->execute([$transactionId]);
    $row = $stmt->fetch();
    if (!$row) response(['message' => 'Transaksi tidak ditemukan'], 404);

    $settings = app_settings();
    $receiptTitle = trim((string) ($settings['school_name'] ?? 'SPP Madrasah'));
    $receiptFooter = trim((string) ($settings['receipt_footer'] ?? ''));

    header('Content-Type: text/html; charset=utf-8');
    echo "<!doctype html><html><head><meta charset='utf-8'><title>Cetak Bukti Pembayaran</title>";
    echo "<style>
        *{box-sizing:border-box;font-family:Arial,sans-serif}
        body{margin:0;background:#f3f4f6;padding:32px;color:#0f172a}
        .card{max-width:720px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px}
        .title{font-size:22px;font-weight:700;margin-bottom:6px}
        .subtitle{color:#475569;margin-bottom:18px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 20px}
        .row{padding:10px 0;border-bottom:1px solid #e2e8f0}
        .label{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#64748b;margin-bottom:4px}
        .value{font-size:15px;font-weight:600;color:#0f172a}
        .total{margin-top:22px;padding:16px 18px;border-radius:16px;background:#eff6ff;border:1px solid #bfdbfe}
        .total .value{font-size:24px;color:#1d4ed8}
        .footer{margin-top:24px;font-size:13px;color:#475569;line-height:1.6}
        @media print{body{background:#fff;padding:0}.card{border:none;max-width:none;margin:0;padding:0}}
    </style></head><body>";
    echo "<div class='card'>";
    echo "<div class='title'>Bukti Pembayaran " . htmlspecialchars($receiptTitle) . "</div>";
    echo "<div class='subtitle'>Dokumen transaksi pembayaran siswa</div>";
    echo "<div class='grid'>";
    echo "<div class='row'><span class='label'>Nomor Referensi</span><div class='value'>" . htmlspecialchars($row['reference_no'] ?: ('TRX-' . $row['id'])) . "</div></div>";
    echo "<div class='row'><span class='label'>Tanggal</span><div class='value'>" . htmlspecialchars($row['payment_date']) . "</div></div>";
    echo "<div class='row'><span class='label'>Siswa</span><div class='value'>" . htmlspecialchars($row['student_name']) . "</div></div>";
    echo "<div class='row'><span class='label'>NIS / Kelas</span><div class='value'>" . htmlspecialchars(($row['nis'] ?: '-') . ' / ' . ($row['class_name'] ?: '-')) . "</div></div>";
    echo "<div class='row'><span class='label'>Tagihan</span><div class='value'>" . htmlspecialchars($row['bill_name']) . "</div></div>";
    echo "<div class='row'><span class='label'>Periode</span><div class='value'>" . htmlspecialchars($row['period'] ?: '-') . "</div></div>";
    echo "<div class='row'><span class='label'>Kanal Pembayaran</span><div class='value'>" . htmlspecialchars($row['payment_channel']) . "</div></div>";
    echo "<div class='row'><span class='label'>Status</span><div class='value'>" . htmlspecialchars($row['status']) . "</div></div>";
    echo "</div>";
    echo "<div class='total'><span class='label'>Total Dibayar</span><div class='value'>Rp" . number_format((float) $row['amount_paid'], 0, ',', '.') . "</div></div>";
    echo "<div class='footer'>Dokumen ini dicetak otomatis oleh sistem " . htmlspecialchars($receiptTitle) . ".</div>";
    if ($receiptFooter !== '') {
        echo "<div class='footer'>" . nl2br(htmlspecialchars($receiptFooter)) . "</div>";
    }
    echo "</div></body></html>";
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
