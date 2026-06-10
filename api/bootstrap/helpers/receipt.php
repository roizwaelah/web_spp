<?php
// Helper renderer kuitansi pembayaran agar template admin dan orang tua konsisten.

function receipt_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function receipt_base64url_decode(string $data): string
{
    return base64_decode(strtr($data, '-_', '+/'));
}

function receipt_period_sort_key(string $periodRaw): string
{
    $period = trim($periodRaw);
    if (preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
        return $m[1] . '-' . $m[2];
    }

    return '9999-99';
}

function sort_receipt_items_oldest_first(array $items): array
{
    usort($items, static function (array $left, array $right): int {
        $leftName = trim((string) ($left['bill_name'] ?? ''));
        $rightName = trim((string) ($right['bill_name'] ?? ''));
        $nameCompare = strcasecmp($leftName, $rightName);
        if ($nameCompare !== 0) {
            return $nameCompare;
        }

        $leftKey = receipt_period_sort_key((string) ($left['period'] ?? ''));
        $rightKey = receipt_period_sort_key((string) ($right['period'] ?? ''));
        if ($leftKey !== $rightKey) {
            return $leftKey <=> $rightKey;
        }

        return ((int) ($left['transaction_id'] ?? 0)) <=> ((int) ($right['transaction_id'] ?? 0));
    });

    return $items;
}

function receipt_resolve_officer_name(array $row, string $fallbackOfficerName = 'ADMIN'): string
{
    $storedOfficer = trim((string) ($row['officer_name'] ?? ''));
    if ($storedOfficer !== '') {
        return strtoupper($storedOfficer);
    }

    $fallbackOfficer = trim($fallbackOfficerName);
    return strtoupper($fallbackOfficer !== '' ? $fallbackOfficer : 'ADMIN');
}

function render_payment_receipt_html(array $row, array $settings, string $officerName = 'ADMIN'): string
{
    $schoolName = trim((string) ($settings['school_name'] ?? 'DARUSSALAM'));
    $schoolAddress = trim((string) ($settings['school_address'] ?? ''));
    $receiptFooter = trim((string) ($settings['receipt_footer'] ?? ''));
    $receiptFooter = trim((string) preg_replace('/Terima kasih telah melakukan pembayaran tepat waktu\.?/i', '', $receiptFooter));

    $months = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
        7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];
    $paidTs = strtotime((string) $row['payment_date']);
    $paidDate = (int) date('j', $paidTs) . ' ' . ($months[(int) date('n', $paidTs)] ?? date('M', $paidTs)) . ' ' . date('Y', $paidTs);
    $referenceNo = (string) ($row['reference_no'] ?: ('TRX' . str_pad((string) $row['id'], 10, '0', STR_PAD_LEFT)));
    $studentName = (string) ($row['student_name'] ?: '-');
    $studentNis = (string) (($row['nisn'] ?? '') ?: ($row['nis'] ?: '-'));
    $className = (string) ($row['class_name'] ?: '-');
    $formatPeriod = static function (string $periodRaw) use ($months): string {
        $period = trim($periodRaw);
        if ($period === '') return '-';
        if (preg_match('/^(\d{4})-(\d{2})$/', $period, $m)) {
            $monthNum = (int) $m[2];
            if ($monthNum >= 1 && $monthNum <= 12) {
                return ($months[$monthNum] ?? $period) . ' ' . $m[1];
            }
        }
        return $period;
    };

    $items = [];
    if (isset($row['items']) && is_array($row['items']) && count($row['items']) > 0) {
        foreach ($row['items'] as $item) {
            $billName = trim((string) ($item['bill_name'] ?? '-'));
            $periodDisplay = $formatPeriod((string) ($item['period'] ?? '-'));
            $title = $periodDisplay !== '-' ? ($billName . ' (' . $periodDisplay . ')') : $billName;
            $items[] = [
                'title' => $title,
                'amount' => (float) ($item['amount'] ?? 0),
            ];
        }
    } else {
        $billName = trim((string) ($row['bill_name'] ?: '-'));
        $periodDisplay = $formatPeriod((string) ($row['period'] ?? '-'));
        $itemTitle = $periodDisplay !== '-' ? ($billName . ' (' . $periodDisplay . ')') : $billName;
        $items[] = [
            'title' => $itemTitle,
            'amount' => (float) ($row['amount_paid'] ?? 0),
        ];
    }
    $channel = (string) ($row['payment_channel'] ?: '-');
    $officer = receipt_resolve_officer_name($row, $officerName);
    $amount = 0.0;
    foreach ($items as $item) $amount += (float) ($item['amount'] ?? 0);
    $amountText = number_format($amount, 0, ',', '.');
    $academicYear = trim((string) ($row['academic_year'] ?? '-'));
    if ($academicYear === '') $academicYear = '-';

    $itemsHtml = '';
    foreach ($items as $index => $item) {
        $itemAmountText = number_format((float) ($item['amount'] ?? 0), 0, ',', '.');
        $itemsHtml .= "<tr>
                <td class='item-name'>" . ($index + 1) . ". " . htmlspecialchars((string) ($item['title'] ?? '-')) . "</td>
                <td class='amount'>Rp " . htmlspecialchars($itemAmountText) . "</td>
              </tr>";
    }

    $html = "<!doctype html>
<html>
<head>
  <meta charset='utf-8'>
  <title>Kuitansi</title>
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; font-family: Arial, sans-serif; color: #000000; }
    body { margin: 0; background: #ffffff; font-size: 11px; }
    .sheet {
      width: 100%;
      max-width: 690px;
      margin: 0 auto;
      position: relative;
      left: 0px;
      border-radius: 10px;
      background: #fff;
      padding: 8px 16px;
    }
    .head-table { width: 100%; border-collapse: collapse; }
    .head-left-title {
      font-size: 18px;
      font-weight: 700;
      line-height: 1.2;
      margin: 0;
      color: #000000;
    }
    .head-left-sub {
      margin-top: 3px;
      font-size: 11px;
      color: #000000;
      line-height: 1.2;
    }
    .head-right { text-align: right; vertical-align: top; }
    .tag {
      display: inline-block;
      border: 1px solid #64748b;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      color: #000000;
      background: #f8fafc;
    }
    .dash { border-top: 0.9px dashed #000000; margin: 7px 0 5px; }
    .meta-wrap { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .meta-wrap td { width: 50%; vertical-align: top; }
    .meta { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .meta td { padding: 1px 0; font-size: 12px; line-height: 1.45; vertical-align: top; }
    .meta .label { font-weight: 700; color: #000000; }
    .meta-left .label { width: 118px; }
    .meta-right .label { width: 86px; }
    .meta .colon { width: 5px; text-align: center; }
    .meta .value { padding-left: 0; text-indent: -40px; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #000000;
      margin: 6px 0 4px;
    }
    .detail-line { border-top: 0.9px dashed #000000; margin: 2px 0 0; }
    .items { width: 100%; border-collapse: collapse; table-layout: fixed; border-bottom: 1px dashed #000000; }
    .items td {
      font-size: 12px;
      padding: 2px 6px;
      border-bottom: 0;
      border-left: 0;
      border-right: 0;
    }
    .items td.item-name {
      text-align: justify;
      text-justify: inter-word;
      padding-left: 20px;
    }
    .items td.amount { width: 160px; }
    .items td.amount { text-align: right; }
    .totals { width: 38.5%; margin-left: auto; border-collapse: collapse; border-bottom: 0.9px dashed #000000; margin-top: 2px; table-layout: fixed; }
    .totals td {
      font-size: 12px;
      padding: 2px 0;
      border-bottom: 0;
      border-left: 0;
      border-right: 0;
    }
    .totals .label { font-weight: 700; color: #000000; }
    .totals .value { width: 160px; text-align: right; padding-left: 0; padding-right: 6px; }
    .footer {
      margin-top: 7px;
      font-size: 10px;
      color: #000000;
      line-height: 1.35;
    }
    .cut-guide { border-top: 0.7px dashed #000000; margin-top: 25px; }
  </style>
</head>
<body>
  <div class='sheet'>
    <table class='head-table'>
      <tr>
        <td>
          <div class='head-left-title'>" . htmlspecialchars($schoolName) . "</div>
          <div class='head-left-sub'>" . nl2br(htmlspecialchars($schoolAddress !== '' ? $schoolAddress : '-')) . "</div>
        </td>
        <td class='head-right'>
          <span class='tag'>KUITANSI</span>
        </td>
      </tr>
    </table>
    <div class='dash'></div>
    <table class='meta-wrap'>
      <tr>
        <td>
          <table class='meta meta-left'>
            <tr><td class='label'>Diterima dari</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($studentName) . "</td></tr>
            <tr><td class='label'>NISN</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($studentNis) . "</td></tr>
            <tr><td class='label'>Kelas</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($className) . "</td></tr>
            <tr><td class='label'>Tahun Ajaran</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($academicYear) . "</td></tr>
          </table>
        </td>
        <td>
          <table class='meta meta-right'>
            <tr><td class='label'>Tgl. Bayar</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($paidDate) . "</td></tr>
            <tr><td class='label'>No. Bukti</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($referenceNo) . "</td></tr>
            <tr><td class='label'>Metode</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($channel) . "</td></tr>
            <tr><td class='label'>Petugas</td><td class='colon'>:</td><td class='value'>" . htmlspecialchars($officer) . "</td></tr>
          </table>
        </td>
      </tr>
    </table>
    <div class='dash'></div>
    <div class='section-title'>Dengan rincian pembayaran sebagai berikut :</div>
    <div class='detail-line'></div>
          <table class='items'>
            <tbody>
              {$itemsHtml}
            </tbody>
          </table>
    <table class='totals'>
      <tr><td class='label'>Jumlah</td><td class='value'>Rp " . htmlspecialchars($amountText) . "</td></tr>
      <tr><td class='label'>Pembayaran</td><td class='value'>Rp " . htmlspecialchars($amountText) . "</td></tr>
      <tr><td class='label'>Kembali</td><td class='value'>Rp0</td></tr>
    </table>";

    if ($receiptFooter !== '') {
        $html .= "<div class='footer'>" . nl2br(htmlspecialchars($receiptFooter)) . "</div>";
    }

    $html .= "<div class='cut-guide'></div>";

    $html .= "</div>
</body>
</html>";

    return $html;
}

function render_pdf_from_html(string $html): string
{
    if (!class_exists(\Dompdf\Dompdf::class)) {
        throw new RuntimeException('Library PDF (dompdf) belum tersedia di server');
    }

    $options = new \Dompdf\Options();
    $options->set('isRemoteEnabled', false);
    $options->set('isHtml5ParserEnabled', true);
    $options->set('defaultFont', 'DejaVu Sans');

    $dompdf = new \Dompdf\Dompdf($options);
    $dompdf->loadHtml($html, 'UTF-8');
    $dompdf->setPaper('A4', 'portrait');
    $dompdf->render();

    return (string) $dompdf->output();
}

function upload_receipt_pdf_to_supabase(string $receiptPdf, string $referenceNo, int $studentId = 0): ?array
{
    if (!function_exists('supabase_storage_upload_binary') || !supabase_storage_enabled()) return null;
    if (env_value('SUPABASE_RECEIPT_UPLOAD_ENABLED', '1') !== '1') return null;

    $bucket = trim((string) env_value('SUPABASE_BUCKET_RECEIPTS', env_value('SUPABASE_BUCKET', '')));
    if ($bucket === '') return null;

    $safeReference = preg_replace('/[^a-zA-Z0-9._-]/', '-', (string) $referenceNo) ?? '';
    $safeReference = trim($safeReference, '-') ?: ('TRX' . date('YmdHis'));
    $prefix = trim((string) env_value('SUPABASE_RECEIPT_PATH_PREFIX', 'receipts'), '/');
    $folder = $prefix !== '' ? $prefix : 'receipts';
    $studentSegment = $studentId > 0 ? ('/student-' . $studentId) : '';
    $objectPath = $folder . '/' . date('Y') . '/' . date('m') . $studentSegment . '/' . $safeReference . '.pdf';

    $uploaded = supabase_storage_upload_binary(
        $bucket,
        $objectPath,
        $receiptPdf,
        'application/pdf',
        true
    );
    if (!$uploaded) return null;

    $isPublic = env_value('SUPABASE_RECEIPT_PUBLIC', '0') === '1';
    $signedUrl = null;
    if (!$isPublic && function_exists('supabase_storage_create_signed_url')) {
        $expires = (int) env_value('SUPABASE_RECEIPT_SIGN_EXPIRES', '604800');
        $signedUrl = supabase_storage_create_signed_url($bucket, $objectPath, $expires > 0 ? $expires : 604800);
    }

    return [
        'bucket' => $bucket,
        'object_path' => $objectPath,
        'public_url' => (string) ($uploaded['public_url'] ?? ''),
        'signed_url' => $signedUrl,
    ];
}

function receipt_row_by_reference(int $studentId, string $referenceNo): ?array
{
    $studentId = (int) $studentId;
    $referenceNo = trim($referenceNo);
    if ($studentId <= 0 || $referenceNo === '') return null;

    $stmtRows = db()->prepare("SELECT t.*,
            COALESCE(t.officer_name, '') AS officer_name,
            COALESCE(b.bill_name, CONCAT('Tagihan #', t.bill_id)) AS bill_name,
            COALESCE(b.period, '-') AS period,
            s.name AS student_name, s.nis, s.nisn, c.name AS class_name, ay.name AS academic_year
        FROM transactions t
        LEFT JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
        WHERE t.reference_no = ? AND t.student_id = ?
        ORDER BY CASE WHEN b.period REGEXP '^[0-9]{4}-[0-9]{2}$' THEN b.period ELSE '9999-99' END ASC, t.id ASC");
    $stmtRows->execute([$referenceNo, $studentId]);
    $rows = $stmtRows->fetchAll();
    if (!$rows) return null;

    $first = $rows[0];
    $items = [];
    $total = 0.0;
    foreach ($rows as $txRow) {
        $amount = (float) ($txRow['amount_paid'] ?? 0);
        $total += $amount;
        $items[] = [
            'transaction_id' => (int) ($txRow['id'] ?? 0),
            'bill_name' => (string) ($txRow['bill_name'] ?? '-'),
            'period' => (string) ($txRow['period'] ?? '-'),
            'amount' => $amount,
        ];
    }
    $first['items'] = sort_receipt_items_oldest_first($items);
    $first['amount_paid'] = $total;
    return $first;
}

function save_receipt_pdf_to_local(string $receiptPdf, string $referenceNo, int $studentId = 0): ?array
{
    $safeReference = preg_replace('/[^a-zA-Z0-9._-]/', '-', (string) $referenceNo) ?? '';
    $safeReference = trim($safeReference, '-') ?: ('TRX' . date('YmdHis'));
    $studentSegment = $studentId > 0 ? ('student-' . $studentId . '/') : '';

    $relativePath = 'receipts/' . date('Y') . '/' . date('m') . '/' . $studentSegment . $safeReference . '.pdf';
    $fullPath = API_ROOT . '/storage/' . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    $dir = dirname($fullPath);
    if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) return null;
    if (@file_put_contents($fullPath, $receiptPdf) === false) return null;

    return [
        'relative_path' => str_replace('\\', '/', $relativePath),
        'full_path' => $fullPath,
    ];
}

function receipt_local_public_file_base_url(): string
{
    $base = trim((string) env_value('RECEIPT_LOCAL_PUBLIC_BASE_URL', ''));
    if ($base !== '') return normalize_receipt_base_url($base) . '/public/receipts';

    $fallback = receipt_public_base_url();
    if ($fallback === '') return '';
    return rtrim($fallback, '/') . '/public/receipts';
}

function save_receipt_pdf_to_local_public(string $receiptPdf, string $referenceNo, int $studentId = 0): ?array
{
    if (env_value('RECEIPT_LOCAL_PUBLIC_ENABLED', '0') !== '1') return null;

    $safeReference = preg_replace('/[^a-zA-Z0-9._-]/', '-', (string) $referenceNo) ?? '';
    $safeReference = trim($safeReference, '-') ?: ('TRX' . date('YmdHis'));
    $seedSecret = receipt_link_secret();
    $seed = $studentId . '|' . $safeReference . '|' . ($seedSecret !== '' ? $seedSecret : 'public-receipt');
    $suffix = substr(hash('sha256', $seed), 0, 8);

    $studentSegment = $studentId > 0 ? ('student-' . $studentId . '/') : '';
    $relativePath = date('Y') . '/' . date('m') . '/' . $studentSegment . $safeReference . '-' . $suffix . '.pdf';
    $fullPath = API_ROOT . '/public/receipts/' . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    $dir = dirname($fullPath);
    if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) return null;
    if (@file_put_contents($fullPath, $receiptPdf) === false) return null;

    $baseUrl = receipt_local_public_file_base_url();
    $url = $baseUrl !== '' ? ($baseUrl . '/' . $relativePath) : '';
    return [
        'relative_path' => str_replace('\\', '/', $relativePath),
        'full_path' => $fullPath,
        'url' => $url,
    ];
}

function receipt_link_secret(): string
{
    $secret = trim((string) env_value('RECEIPT_LINK_SECRET', ''));
    if ($secret !== '') return $secret;
    return trim((string) env_value('JWT_SECRET', ''));
}

function receipt_public_base_url(): string
{
    $base = trim((string) env_value('RECEIPT_PUBLIC_BASE_URL', ''));
    if ($base !== '') return normalize_receipt_base_url($base);

    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
    if ($host === '') return '';
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['SERVER_PORT'] ?? '') === '443');
    $scheme = $https ? 'https' : 'http';
    $script = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
    $basePath = '';
    if (preg_match('#^(.*?/api)(?:/.*)?$#i', $script, $matches)) {
        $basePath = rtrim((string) ($matches[1] ?? ''), '/');
    } else {
        $basePath = rtrim((string) dirname($script), '/');
        if ($basePath === '.') $basePath = '';
    }
    return normalize_receipt_base_url($scheme . '://' . $host . $basePath);
}

function normalize_receipt_base_url(string $base): string
{
    $base = rtrim(trim($base), '/');
    if ($base === '') return '';
    if (str_ends_with(strtolower($base), '/index.php')) {
        $base = substr($base, 0, -10);
    }
    return rtrim($base, '/');
}

function build_local_receipt_signed_url(string $relativePath, int $expiresSeconds = 604800): ?string
{
    $relativePath = str_replace('\\', '/', trim($relativePath));
    if ($relativePath === '') return null;
    if ($expiresSeconds <= 0) $expiresSeconds = 604800;

    $secret = receipt_link_secret();
    if ($secret === '') return null;
    $base = receipt_public_base_url();
    if ($base === '') return null;

    $exp = time() + $expiresSeconds;
    $sig = hash_hmac('sha256', $relativePath . '|' . $exp, $secret);
    $encodedPath = rawurlencode(receipt_base64url_encode($relativePath));
    $filename = rawurlencode(basename($relativePath));
    return $base . '/index.php?route=public/receipt-file/' . $exp . '/' . $sig . '/' . $encodedPath . '/' . $filename;
}

function is_valid_local_receipt_signature(string $relativePath, int $exp, string $sig): bool
{
    if ($exp <= time()) return false;
    $secret = receipt_link_secret();
    if ($secret === '') return false;
    $expected = hash_hmac('sha256', $relativePath . '|' . $exp, $secret);
    return hash_equals($expected, (string) $sig);
}
