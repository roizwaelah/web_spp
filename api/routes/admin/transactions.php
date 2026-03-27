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

    $settings = list_settings();
    $schoolName = trim((string) ($settings['school_name'] ?? 'PP. DARUSSALAM'));
    $schoolAddress = trim((string) ($settings['school_address'] ?? ''));
    $receiptFooter = trim((string) ($settings['receipt_footer'] ?? ''));
    // Bersihkan kalimat penutup lama yang diminta tidak ditampilkan lagi.
    $receiptFooter = trim((string) preg_replace('/Terima kasih telah melakukan pembayaran tepat waktu\.?/i', '', $receiptFooter));

    $paidDate = date('d-m-Y', strtotime((string) $row['payment_date']));
    $referenceNo = (string) ($row['reference_no'] ?: ('TRX' . str_pad((string) $row['id'], 10, '0', STR_PAD_LEFT)));
    $studentName = (string) ($row['student_name'] ?: '-');
    $studentNis = (string) ($row['nis'] ?: '-');
    $className = (string) ($row['class_name'] ?: '-');
    $billName = trim((string) ($row['bill_name'] ?: '-'));
    $period = trim((string) ($row['period'] ?: '-'));
    $itemTitle = $period !== '-' ? ($billName . ' (' . $period . ')') : $billName;
    $channel = strtoupper((string) ($row['payment_channel'] ?: '-'));
    $officer = strtoupper((string) ($user['name'] ?: 'ADMIN'));
    $amount = (float) $row['amount_paid'];
    $amountText = number_format($amount, 0, ',', '.');

    header('Content-Type: text/html; charset=utf-8');
    echo "<!doctype html>
<html>
<head>
  <meta charset='utf-8'>
  <title>Bukti Pembayaran</title>
  <style>
    * { box-sizing: border-box; font-family: Arial, sans-serif; color: #111; }
    @page { size: A4 portrait; margin: 12mm; }
    body { margin: 0; background: #fff; font-size: 11px; }
    .receipt { max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; }
    .school h1 { margin: 0; font-size: 18px; letter-spacing: 0.4px; }
    .school p { margin: 2px 0 0 0; line-height: 1.35; }
    .tag { border: 1px solid #111; padding: 6px 14px; font-weight: 700; font-size: 12px; letter-spacing: 0.3px; }
    .line { border-top: 1px dashed #111; margin: 10px 0 8px; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 26px; margin-bottom: 8px; }
    .meta-row { display: grid; grid-template-columns: 92px 10px 1fr; align-items: start; gap: 3px; line-height: 1.25; }
    .meta-row .label { font-weight: 700; }
    .section-title { margin: 8px 0 4px; font-weight: 700; }
    .items { width: 100%; border-collapse: collapse; font-size: 11px; }
    .items th, .items td { padding: 2px 4px; vertical-align: top; }
    .items thead th { text-align: left; border-bottom: 1px solid #111; }
    .items td:last-child, .items th:last-child { text-align: right; width: 150px; }
    .items tbody tr td { border-bottom: 1px solid #ddd; }
    .summary-wrap { display: flex; justify-content: space-between; gap: 20px; margin-top: 8px; }
    .sign { flex: 1; text-align: center; }
    .sign .line-space { height: 38px; }
    .totals { width: 240px; margin-left: auto; }
    .totals .row { display: flex; justify-content: space-between; border-bottom: 1px solid #111; padding: 2px 0; font-weight: 700; }
    .footer { margin-top: 8px; line-height: 1.35; }
    .cut-guide { margin-top: 2em; border-top: 1px dashed rgba(15, 23, 42, 0.28); }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class='receipt'>
    <div class='header'>
      <div class='school'>
        <h1>" . htmlspecialchars($schoolName) . "</h1>
        <p>" . nl2br(htmlspecialchars($schoolAddress !== '' ? $schoolAddress : '-')) . "</p>
      </div>
      <div class='tag'>BUKTI PEMBAYARAN</div>
    </div>
    <div class='line'></div>

    <div class='two-col'>
      <div>
        <div class='meta-row'><span class='label'>Diterima dari</span><span>:</span><span>" . htmlspecialchars($studentName) . "</span></div>
        <div class='meta-row'><span class='label'>Nomor Induk</span><span>:</span><span>" . htmlspecialchars($studentNis) . "</span></div>
        <div class='meta-row'><span class='label'>Kelas</span><span>:</span><span>" . htmlspecialchars($className) . "</span></div>
        <div class='meta-row'><span class='label'>Status Siswa</span><span>:</span><span>Aktif</span></div>
      </div>
      <div>
        <div class='meta-row'><span class='label'>Tgl. Bayar</span><span>:</span><span>" . htmlspecialchars($paidDate) . "</span></div>
        <div class='meta-row'><span class='label'>No. Bukti</span><span>:</span><span>" . htmlspecialchars($referenceNo) . "</span></div>
        <div class='meta-row'><span class='label'>Metode</span><span>:</span><span>" . htmlspecialchars($channel) . "</span></div>
        <div class='meta-row'><span class='label'>Petugas</span><span>:</span><span>" . htmlspecialchars($officer) . "</span></div>
      </div>
    </div>

    <div class='line'></div>
    <div class='section-title'>Dengan rincian pembayaran sebagai berikut :</div>
    <table class='items'>
      <thead>
        <tr>
          <th>Item Ratus Ribu Rupiah</th>
          <th>Rp.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1. " . htmlspecialchars($itemTitle) . "</td>
          <td>" . htmlspecialchars($amountText) . "</td>
        </tr>
      </tbody>
    </table>

    <div class='summary-wrap'>
      <div class='sign'>
        <div>Penerima,</div>
        <div class='line-space'></div>
        <div>(" . htmlspecialchars($officer) . ")</div>
      </div>
      <div class='totals'>
        <div class='row'><span>Jumlah Rp.</span><span>" . htmlspecialchars($amountText) . "</span></div>
        <div class='row'><span>Pembayaran Rp.</span><span>" . htmlspecialchars($amountText) . "</span></div>
        <div class='row'><span>Kembali Rp.</span><span>0</span></div>
      </div>
    </div>";
    if ($receiptFooter !== '') {
        echo "<div class='footer'>" . nl2br(htmlspecialchars($receiptFooter)) . "</div>";
    }
    echo "<div class='cut-guide'></div>";
    echo "
  </div>
</body>
</html>";
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
