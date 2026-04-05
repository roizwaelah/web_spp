<?php
// Route daftar, generate, dan hapus tagihan.

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

function bill_payment_portal_url(): string {
    $fromEnv = trim((string) env_value('PAYMENT_PORTAL_URL', ''));
    if ($fromEnv !== '') return rtrim($fromEnv, '/');
    return 'https://spp.madarussalamcilongok.sch.id';
}

function build_bill_reminder_message(array $bill, array $student): string {
    $schoolName = trim(setting_value('school_name', 'Madrasah'));
    if ($schoolName === '') $schoolName = 'Madrasah';

    $period = trim((string) ($bill['period'] ?? '-'));
    $studentName = trim((string) ($student['name'] ?? $bill['student_name'] ?? '-'));
    $className = trim((string) ($student['class_name'] ?? $bill['class_name'] ?? '-'));
    $billName = trim((string) ($bill['bill_name'] ?? '-'));
    $amountText = idr((float) ($bill['amount'] ?? 0));
    $portalUrl = bill_payment_portal_url();

    return implode("\n", [
        "_Assalamu'alaikum wr.wb._",
        "Kepada Bapak/Ibu/Wali siswa {$schoolName}, mohon ijin kami kirimkan tagihan periode {$period} sebagai berikut:",
        "- Nama        : {$studentName}",
        "- Kelas       : {$className}",
        "- Jenis       : {$billName}",
        "- Nominal     : {$amountText}",
        "Silahkan bisa dibayarkan secara offline dengan datang langsung ke petugas kami atau bisa dibayarkan secara online melalui kanal {$portalUrl}",
        "Atas perhatiannya kami ucapkan terima kasih.",
        "_Wassalamu'alaikum wr.wb_",
        "",
        "PESAN OTOMATIS DARI SISTEM, TIDAK UNTUK DIBALAS*",
    ]);
}

function build_bill_reminder_summary_message(array $student, array $bills): string {
    $schoolName = trim(setting_value('school_name', 'Madrasah'));
    if ($schoolName === '') $schoolName = 'Madrasah';

    $studentName = trim((string) ($student['name'] ?? '-'));
    $className = trim((string) ($student['class_name'] ?? '-'));
    $portalUrl = bill_payment_portal_url();
    $lines = [
        "_Assalamu'alaikum wr.wb._",
        "Kepada Bapak/Ibu/Wali siswa {$schoolName}, mohon ijin kami kirimkan ringkasan tagihan sebagai berikut:",
        "- Nama        : {$studentName}",
        "- Kelas       : {$className}",
        "- Rincian:",
    ];

    $total = 0.0;
    foreach ($bills as $idx => $bill) {
        $billName = trim((string) ($bill['bill_name'] ?? '-'));
        $period = trim((string) ($bill['period'] ?? '-'));
        $amount = (float) ($bill['amount'] ?? 0);
        $total += $amount;
        $lines[] = sprintf("%d. %s (%s) - %s", $idx + 1, $billName, $period, idr($amount));
    }

    $lines[] = "- Total       : " . idr($total);
    $lines[] = "Silahkan bisa dibayarkan secara offline dengan datang langsung ke petugas kami atau bisa dibayarkan secara online melalui kanal {$portalUrl}";
    $lines[] = "Atas perhatiannya kami ucapkan terima kasih.";
    $lines[] = "_Wassalamu'alaikum wr.wb_";
    $lines[] = "";
    $lines[] = "*PESAN OTOMATIS DARI SISTEM, TIDAK UNTUK DIBALAS*";

    return implode("\n", $lines);
}

function dispatch_scheduled_bill_reminders(PDO $pdo, int $day, ?string $period = null): array {
    if (!in_array($day, [5, 15], true)) {
        return [
            'processed_students' => 0,
            'queued' => 0,
            'skipped_already_sent_today' => 0,
            'period' => $period ?? date('Y-m'),
            'day' => $day,
        ];
    }

    $period = $period !== null && preg_match('/^\d{4}-\d{2}$/', $period) ? $period : date('Y-m');
    $title = $day === 5 ? 'Pengingat Tagihan Otomatis (Tgl 5)' : 'Pengingat Tagihan Otomatis (Tgl 15)';

    $stmtStudents = $pdo->prepare("SELECT DISTINCT b.student_id, s.name AS student_name
        FROM bills b
        JOIN students s ON s.id = b.student_id
        WHERE b.status = 'unpaid' AND b.period = ?
        ORDER BY s.name ASC");
    $stmtStudents->execute([$period]);
    $studentRows = $stmtStudents->fetchAll();

    $stmtBills = $pdo->prepare("SELECT id, bill_name, period, amount
        FROM bills
        WHERE student_id = ? AND status = 'unpaid' AND period = ?
        ORDER BY due_date ASC, id ASC");
    $alreadySentTodayStmt = $pdo->prepare("SELECT COUNT(*) FROM notifications WHERE student_id = ? AND title = ? AND DATE(created_at) = CURDATE()");

    $processedStudents = 0;
    $queued = 0;
    $skippedAlreadySentToday = 0;

    foreach ($studentRows as $studentRow) {
        $studentId = (int) ($studentRow['student_id'] ?? 0);
        if ($studentId <= 0) continue;

        $stmtBills->execute([$studentId, $period]);
        $bills = $stmtBills->fetchAll();
        if (!$bills) continue;

        $processedStudents++;
        $student = student_row($studentId);
        if (!$student) {
            $student = [
                'name' => (string) ($studentRow['student_name'] ?? '-'),
                'class_name' => '-',
            ];
        }

        $alreadySentTodayStmt->execute([$studentId, $title]);
        $alreadySentToday = (int) $alreadySentTodayStmt->fetchColumn();
        if ($alreadySentToday > 0) {
            $skippedAlreadySentToday++;
            continue;
        }

        $message = build_bill_reminder_summary_message($student, $bills);
        queue_whatsapp_notification($studentId, $title, $message);
        $queued++;
    }

    if ($queued > 0) {
        try_dispatch_whatsapp_queue();
    }

    return [
        'processed_students' => $processedStudents,
        'queued' => $queued,
        'skipped_already_sent_today' => $skippedAlreadySentToday,
        'period' => $period,
        'day' => $day,
    ];
}

if ($route === 'cron/bills/dispatch-scheduled-reminders' && in_array($method, ['GET', 'POST'], true)) {
    $input = $method === 'POST' ? json_input() : [];
    $cronKey = trim((string) env_value('BILL_REMINDER_CRON_KEY', ''));
    $providedKey = trim((string) (($input['key'] ?? '') ?: query('key', '')));

    if ($cronKey === '') {
        response(['message' => 'BILL_REMINDER_CRON_KEY belum dikonfigurasi'], 500);
    }
    if (!hash_equals($cronKey, $providedKey)) {
        response(['message' => 'Akses cron ditolak (key tidak valid)'], 403);
    }

    $day = isset($input['day']) ? (int) $input['day'] : (int) query('day', (int) date('j'));
    $period = isset($input['period']) ? trim((string) $input['period']) : trim((string) query('period', date('Y-m')));
    if (!preg_match('/^\d{4}-\d{2}$/', $period)) {
        response(['message' => 'Format period harus YYYY-MM'], 422);
    }

    if (!in_array($day, [5, 15], true)) {
        response([
            'message' => 'Hari ini bukan jadwal kirim otomatis (hanya tanggal 5 atau 15)',
            'day' => $day,
            'period' => $period,
            'result' => [
                'processed_students' => 0,
                'queued' => 0,
                'skipped_already_sent_today' => 0,
                'period' => $period,
                'day' => $day,
            ],
        ]);
    }

    $result = dispatch_scheduled_bill_reminders($pdo, $day, $period);
    response([
        'message' => "Dispatch cron pengingat otomatis selesai. {$result['queued']} notifikasi diantrekan.",
        'result' => $result,
    ]);
}

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

if ($route === 'admin/bills/dispatch-scheduled-reminders' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);

    $input = json_input();
    $day = isset($input['day']) ? (int) $input['day'] : (int) date('j');
    $period = isset($input['period']) ? trim((string) $input['period']) : date('Y-m');

    if (!in_array($day, [5, 15], true)) {
        response(['message' => 'Dispatcher hanya berjalan untuk tanggal 5 atau 15', 'day' => $day], 422);
    }
    if (!preg_match('/^\d{4}-\d{2}$/', $period)) {
        response(['message' => 'Format period harus YYYY-MM'], 422);
    }

    $result = dispatch_scheduled_bill_reminders($pdo, $day, $period);
    log_activity((int) $user['id'], 'notify', 'bill', null, "Dispatch pengingat otomatis tagihan tgl {$day} periode {$period}: {$result['queued']} antre");
    response([
        'message' => "Dispatch pengingat otomatis selesai. {$result['queued']} notifikasi diantrekan.",
        'result' => $result,
    ]);
}

if ($route === 'admin/bills/export-tunggakan' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);

    $month = trim((string) query('month', date('Y-m')));
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        response(['message' => 'Bulan wajib berformat YYYY-MM'], 422);
    }
    $monthStart = date('Y-m-01', strtotime($month . '-01'));
    $monthEnd = date('Y-m-t', strtotime($month . '-01'));

    $financePostIdsRaw = trim((string) query('finance_post_ids', ''));
    $financePostIds = [];
    if ($financePostIdsRaw !== '') {
        foreach (explode(',', $financePostIdsRaw) as $rawId) {
            $id = (int) trim($rawId);
            if ($id > 0) $financePostIds[$id] = $id;
        }
        $financePostIds = array_values($financePostIds);
        if (!$financePostIds) {
            response(['message' => 'Daftar pos untuk export tidak valid'], 422);
        }
    }

    $postConditions = ['is_active = 1'];
    $postParams = [];
    if ($financePostIds) {
        $postPlaceholders = implode(',', array_fill(0, count($financePostIds), '?'));
        $postConditions[] = "id IN ({$postPlaceholders})";
        foreach ($financePostIds as $id) $postParams[] = $id;
    }
    $postWhere = implode(' AND ', $postConditions);
    $stmtPosts = $pdo->prepare("SELECT id, name FROM finance_posts WHERE {$postWhere} ORDER BY name ASC");
    $stmtPosts->execute($postParams);
    $postRows = $stmtPosts->fetchAll();
    if (!$postRows) {
        response(['message' => 'Pos tagihan tidak ditemukan untuk export'], 422);
    }

    $abbreviatePostName = static function (string $name): string {
        $normalized = strtoupper(trim($name));
        $normalized = preg_replace('/[^A-Z0-9 ]+/', ' ', $normalized) ?? '';
        $parts = preg_split('/\s+/', $normalized, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (!$parts) return 'POS';

        if (count($parts) === 1) {
            return substr($parts[0], 0, 8);
        }

        $abbr = '';
        foreach ($parts as $part) {
            if ($part === '') continue;
            $abbr .= substr($part, 0, 1);
        }

        if ($abbr === '') {
            $flat = str_replace(' ', '', $normalized);
            return $flat !== '' ? substr($flat, 0, 8) : 'POS';
        }

        return substr($abbr, 0, 8);
    };

    $selectedPostIds = [];
    $selectedPostNames = [];
    foreach ($postRows as $post) {
        $postId = (int) ($post['id'] ?? 0);
        if ($postId <= 0) continue;
        $selectedPostIds[] = $postId;
        $selectedPostNames[$postId] = $abbreviatePostName((string) ($post['name'] ?? ('Pos ' . $postId)));
    }

    $conditions = [
        "b.status = 'unpaid'",
        'DATE(b.due_date) BETWEEN ? AND ?',
    ];
    $params = [$monthStart, $monthEnd];
    if ($selectedPostIds) {
        $placeholders = implode(',', array_fill(0, count($selectedPostIds), '?'));
        $conditions[] = "b.finance_post_id IN ({$placeholders})";
        foreach ($selectedPostIds as $id) $params[] = $id;
    }
    $where = implode(' AND ', $conditions);

    $stmt = $pdo->prepare("SELECT
            b.id,
            b.bill_name,
            b.period,
            b.due_date,
            b.amount,
            b.status,
            b.finance_post_id,
            s.id AS student_id,
            s.name AS student_name,
            s.nis,
            c.name AS class_name
        FROM bills b
        JOIN students s ON s.id = b.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        WHERE {$where}
        ORDER BY c.name ASC, s.name ASC, b.due_date ASC, b.id ASC");
    $stmt->execute($params);
    $rawRows = $stmt->fetchAll();
    $rowsByStudent = [];
    foreach ($rawRows as $row) {
        $studentId = (int) ($row['student_id'] ?? 0);
        if ($studentId <= 0) continue;

        if (!isset($rowsByStudent[$studentId])) {
            $amountsByPost = [];
            foreach ($selectedPostIds as $postId) $amountsByPost[$postId] = 0.0;
            $rowsByStudent[$studentId] = [
                'student_name' => (string) ($row['student_name'] ?? '-'),
                'class_name' => (string) ($row['class_name'] ?? '-'),
                'periods' => [],
                'amounts_by_post' => $amountsByPost,
                'amount_total' => 0.0,
            ];
        }

        $period = trim((string) ($row['period'] ?? ''));
        if ($period !== '') $rowsByStudent[$studentId]['periods'][$period] = $period;
        $rowsByStudent[$studentId]['amount_total'] += (float) ($row['amount'] ?? 0);
        $rowPostId = (int) ($row['finance_post_id'] ?? 0);
        if (isset($rowsByStudent[$studentId]['amounts_by_post'][$rowPostId])) {
            $rowsByStudent[$studentId]['amounts_by_post'][$rowPostId] += (float) ($row['amount'] ?? 0);
        }
    }
    $rows = array_values($rowsByStudent);

    $schoolName = trim(setting_value('school_name', 'PP. DARUSSALAM'));
    if ($schoolName === '') $schoolName = 'PP. DARUSSALAM';
    $schoolAddress = trim(setting_value('school_address', 'Kandang Aur 04/02 Desa Panusupan, Kecamatan Cilongok'));
    if ($schoolAddress === '') $schoolAddress = 'Kandang Aur 04/02 Desa Panusupan, Kecamatan Cilongok';
    $schoolCity = trim(setting_value('school_city', 'Kabupaten Banyumas - Jawa Tengah 53162'));
    if ($schoolCity === '') $schoolCity = 'Kabupaten Banyumas - Jawa Tengah 53162';
    $schoolPhone = trim(setting_value('school_phone', '085743487277'));
    $schoolEmail = trim(setting_value('school_email', 'ppdarsalcilongok@gmail.com'));

    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Laporan Tunggakan');

    $baseCols = 4; // NO, NAMA SISWA, KELAS, PERIODE
    $postCount = count($selectedPostIds);
    $firstPostCol = $baseCols + 1;
    $lastPostCol = $firstPostCol + $postCount - 1;
    $totalCol = $lastPostCol + 1;
    $lastColLetter = Coordinate::stringFromColumnIndex($totalCol);
    $firstPostColLetter = Coordinate::stringFromColumnIndex($firstPostCol);
    $lastPostColLetter = Coordinate::stringFromColumnIndex($lastPostCol);
    $totalColLetter = Coordinate::stringFromColumnIndex($totalCol);

    $sheet->getColumnDimension('A')->setWidth(6);
    $sheet->getColumnDimension('B')->setWidth(30);
    $sheet->getColumnDimension('C')->setWidth(16);
    $sheet->getColumnDimension('D')->setWidth(16);
    for ($col = $firstPostCol; $col <= $lastPostCol; $col++) {
        $sheet->getColumnDimension(Coordinate::stringFromColumnIndex($col))->setWidth(16);
    }
    $sheet->getColumnDimension($totalColLetter)->setWidth(16);

    $sheet->mergeCells("A2:{$lastColLetter}2")->setCellValue('A2', strtoupper($schoolName));
    $sheet->mergeCells("A3:{$lastColLetter}3")->setCellValue('A3', $schoolAddress);
    $sheet->mergeCells("A4:{$lastColLetter}4")->setCellValue('A4', $schoolCity . ($schoolPhone !== '' ? ' WA : ' . $schoolPhone : ''));
    $sheet->mergeCells("A5:{$lastColLetter}5")->setCellValue('A5', 'Email : ' . ($schoolEmail !== '' ? $schoolEmail : '-'));
    $sheet->mergeCells("A7:{$lastColLetter}7")->setCellValue('A7', 'LAPORAN TUNGGAKAN ADMINISTRASI');
    $monthNames = [
        1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April',
        5 => 'Mei', 6 => 'Juni', 7 => 'Juli', 8 => 'Agustus',
        9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
    ];
    $monthNumber = (int) date('n', strtotime($monthStart));
    $monthLabel = strtoupper(($monthNames[$monthNumber] ?? date('F', strtotime($monthStart))) . ' ' . date('Y', strtotime($monthStart)));
    $sheet->mergeCells("A8:{$lastColLetter}8")->setCellValue('A8', 'BULAN ' . $monthLabel);

    $sheet->mergeCells('A10:A11')->setCellValue('A10', 'NO');
    $sheet->mergeCells('B10:B11')->setCellValue('B10', 'NAMA SISWA');
    $sheet->mergeCells('C10:C11')->setCellValue('C10', 'KELAS');
    $sheet->mergeCells('D10:D11')->setCellValue('D10', 'PERIODE');
    $sheet->mergeCells("{$firstPostColLetter}10:{$lastPostColLetter}10")->setCellValue("{$firstPostColLetter}10", 'TAGIHAN');
    $sheet->mergeCells("{$totalColLetter}10:{$totalColLetter}11")->setCellValue("{$totalColLetter}10", 'JUMLAH');
    foreach ($selectedPostIds as $index => $postId) {
        $col = $firstPostCol + $index;
        $colLetter = Coordinate::stringFromColumnIndex($col);
        $sheet->setCellValue($colLetter . '11', $selectedPostNames[$postId] ?? ('Pos ' . $postId));
    }

    $headerRange = "A10:{$lastColLetter}11";
    $sheet->getStyle($headerRange)->applyFromArray([
        'font' => ['bold' => true, 'size' => 10],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFE9E1C7']],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
    ]);
    $sheet->getRowDimension(10)->setRowHeight(24);
    $sheet->getRowDimension(11)->setRowHeight(26);

    $startRow = 12;
    $currentRow = $startRow;
    $totalAll = 0.0;
    $totalByPost = [];
    foreach ($selectedPostIds as $postId) $totalByPost[$postId] = 0.0;

    foreach ($rows as $index => $row) {
        $amount = (float) ($row['amount_total'] ?? 0);
        $totalAll += $amount;
        $periods = array_values($row['periods'] ?? []);
        sort($periods, SORT_STRING);
        $periodLabel = '-';
        if (count($periods) === 1) {
            $periodLabel = $periods[0];
        } elseif (count($periods) > 1) {
            $periodLabel = $periods[0] . ' s/d ' . $periods[count($periods) - 1];
        }
        $sheet->setCellValue('A' . $currentRow, $index + 1);
        $sheet->setCellValue('B' . $currentRow, (string) ($row['student_name'] ?? '-'));
        $sheet->setCellValue('C' . $currentRow, (string) ($row['class_name'] ?? '-'));
        $sheet->setCellValue('D' . $currentRow, $periodLabel);
        foreach ($selectedPostIds as $indexPost => $postId) {
            $col = $firstPostCol + $indexPost;
            $colLetter = Coordinate::stringFromColumnIndex($col);
            $postAmount = (float) ($row['amounts_by_post'][$postId] ?? 0);
            $sheet->setCellValue($colLetter . $currentRow, $postAmount);
            $totalByPost[$postId] += $postAmount;
        }
        $sheet->setCellValue($totalColLetter . $currentRow, $amount);
        $currentRow++;
    }

    if (count($rows) === 0) {
        $sheet->mergeCells("A12:{$lastColLetter}12")->setCellValue('A12', 'Tidak ada data tunggakan pada bulan ini.');
        $sheet->getStyle('A12')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $currentRow = 13;
    }

    $totalRow = $currentRow;
    $beforeTotalColLetter = Coordinate::stringFromColumnIndex($totalCol - 1);
    $sheet->mergeCells("A{$totalRow}:{$beforeTotalColLetter}{$totalRow}")->setCellValue('A' . $totalRow, 'TOTAL');
    foreach ($selectedPostIds as $indexPost => $postId) {
        $col = $firstPostCol + $indexPost;
        $colLetter = Coordinate::stringFromColumnIndex($col);
        $sheet->setCellValue($colLetter . $totalRow, (float) ($totalByPost[$postId] ?? 0));
    }
    $sheet->setCellValue($totalColLetter . $totalRow, $totalAll);

    $tableStart = 'A10';
    $tableEnd = $lastColLetter . $totalRow;
    $sheet->getStyle($tableStart . ':' . $tableEnd)->applyFromArray([
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF000000']]],
    ]);

    if ($totalRow > 10) {
        $sheet->getStyle('A12:A' . $totalRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('C12:C' . $totalRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $sheet->getStyle('D12:D' . $totalRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        for ($col = $firstPostCol; $col <= $totalCol; $col++) {
            $colLetter = Coordinate::stringFromColumnIndex($col);
            $sheet->getStyle($colLetter . '12:' . $colLetter . $totalRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
        }
    }

    for ($col = $firstPostCol; $col <= $totalCol; $col++) {
        $colLetter = Coordinate::stringFromColumnIndex($col);
        $sheet->getStyle($colLetter . '12:' . $colLetter . $totalRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1);
    }
    $sheet->getStyle('A' . $totalRow . ':' . $lastColLetter . $totalRow)->applyFromArray([
        'font' => ['bold' => true],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD9D6C5']],
    ]);
    $sheet->getStyle('A2:A8')->getFont()->setBold(true);
    $sheet->getStyle('A7:A8')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('A2:' . $lastColLetter . '8')->getAlignment()->setVertical(Alignment::VERTICAL_CENTER);
    $sheet->getStyle('A7')->getFont()->setSize(14);
    $sheet->getStyle('A8')->getFont()->setSize(11);

    $sheet->getPageSetup()->setOrientation(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::ORIENTATION_LANDSCAPE);
    $sheet->getPageSetup()->setPaperSize(\PhpOffice\PhpSpreadsheet\Worksheet\PageSetup::PAPERSIZE_A4);
    $sheet->getPageSetup()->setFitToWidth(1);
    $sheet->getPageSetup()->setFitToHeight(1);
    $sheet->getPageMargins()->setTop(0.4)->setBottom(0.4)->setLeft(0.3)->setRight(0.3);
    $sheet->getPageSetup()->setPrintArea('A2:' . $lastColLetter . $totalRow);

    $filename = 'laporan-tunggakan-' . $month . '.xlsx';
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;
}

if ($route === 'admin/bills/manual-payment' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    $input = json_input();
    ensure_required($input, ['payment_channel', 'payment_date']);

    $allowedChannels = ['Tunai', 'Transfer Bank', 'QRIS', 'Virtual Account', 'E-Wallet'];
    if (!in_array($input['payment_channel'], $allowedChannels, true)) {
        response(['message' => 'Kanal pembayaran tidak valid'], 422);
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $input['payment_date'])) {
        response(['message' => 'Tanggal pembayaran harus berformat YYYY-MM-DD'], 422);
    }

    $billIds = [];
    if (isset($input['bill_ids']) && is_array($input['bill_ids'])) {
        foreach ($input['bill_ids'] as $billId) {
            $billId = (int) $billId;
            if ($billId > 0) $billIds[] = $billId;
        }
    }
    if (!$billIds && isset($input['bill_id'])) {
        $singleBillId = (int) $input['bill_id'];
        if ($singleBillId > 0) $billIds[] = $singleBillId;
    }
    $billIds = array_values(array_unique($billIds));
    if (!$billIds) response(['message' => 'Tagihan yang dibayar wajib dipilih'], 422);

    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $billStmt = $pdo->prepare("SELECT b.*, s.name student_name, s.id student_id
        FROM bills b
        JOIN students s ON s.id = b.student_id
        WHERE b.id IN ($placeholders)");
    $billStmt->execute($billIds);
    $bills = $billStmt->fetchAll();
    if (count($bills) !== count($billIds)) response(['message' => 'Sebagian tagihan tidak ditemukan'], 404);

    foreach ($bills as $bill) {
        if ($bill['status'] === 'paid') response(['message' => "Tagihan {$bill['bill_name']} sudah lunas"], 422);
        $pendingProof = (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE bill_id = ? AND status = 'pending'", [$bill['id']]);
        if ($pendingProof > 0) {
            response(['message' => "Tagihan {$bill['bill_name']} masih memiliki bukti pembayaran yang menunggu review admin"], 422);
        }
    }

    $notes = trim((string) ($input['notes'] ?? ''));
    if ($notes !== '' && mb_strlen($notes) > 500) {
        response(['message' => 'Catatan pembayaran maksimal 500 karakter'], 422);
    }

    $referenceNo = create_manual_payment_reference((string) $input['payment_date']);
    $transactions = [];
    $totalAmount = 0.0;
    $studentBuckets = [];

    $pdo->beginTransaction();
    try {
        foreach ($bills as $bill) {
            $tx = record_bill_payment((int) $bill['id'], (int) $bill['student_id'], (string) $input['payment_channel'], (float) $bill['amount'], [
                'payment_date' => (string) $input['payment_date'],
                'reference_no' => $referenceNo,
                'notes' => $notes !== '' ? $notes : 'Input pembayaran manual oleh bendahara',
                'status' => 'paid',
            ]);
            $transactions[] = $tx;
            $totalAmount += (float) $bill['amount'];

            $studentId = (int) $bill['student_id'];
            if (!isset($studentBuckets[$studentId])) {
                $studentBuckets[$studentId] = [
                    'student_name' => (string) $bill['student_name'],
                    'bill_count' => 0,
                    'total' => 0.0,
                    'first_bill_name' => (string) ($bill['bill_name'] ?? 'tagihan'),
                ];
            }
            $studentBuckets[$studentId]['bill_count']++;
            $studentBuckets[$studentId]['total'] += (float) $bill['amount'];
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        response(['message' => 'Gagal menyimpan pembayaran manual: ' . $e->getMessage()], 422);
    }

    foreach ($studentBuckets as $studentId => $bucket) {
        $billSummary = $bucket['bill_count'] <= 1
            ? ((string) ($bucket['first_bill_name'] ?? 'tagihan'))
            : ($bucket['bill_count'] . ' tagihan');
        $officerName = strtoupper(trim((string) ($user['name'] ?? 'ADMIN')));
        if ($officerName === '') $officerName = 'ADMIN';
        $receiptLinks = generate_receipt_links_for_student((int) $studentId, [$referenceNo], $officerName);
        $receiptMessage = build_receipt_notification_message($billSummary, (float) $bucket['total'], [$referenceNo], $receiptLinks);
        queue_whatsapp_notification((int) $studentId, 'Kuitansi Pembayaran', $receiptMessage);
    }
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'pay', 'bill', (int) $billIds[0], 'Input pembayaran manual via ' . $input['payment_channel'] . ' untuk ' . count($billIds) . ' tagihan');

    response([
        'message' => count($billIds) > 1 ? count($billIds) . ' pembayaran manual berhasil disimpan' : 'Pembayaran manual berhasil disimpan',
        'reference_no' => $referenceNo,
        'transaction_id' => (int) ($transactions[0]['transaction_id'] ?? 0),
        'transaction_ids' => array_values(array_map(static fn($tx) => (int) ($tx['transaction_id'] ?? 0), $transactions)),
        'processed_bills' => count($billIds),
        'total_amount' => $totalAmount,
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

    $studentDetail = student_row((int) $bill['student_id']) ?? ['name' => $bill['student_name'], 'class_name' => '-'];
    $message = build_bill_reminder_message($bill, $studentDetail);
    queue_whatsapp_notification((int) $bill['student_id'], 'Pengingat Tagihan', $message);
    try_dispatch_whatsapp_queue();

    log_activity((int) $user['id'], 'notify', 'bill', (int) $bill['id'], 'Kirim pengingat tagihan ke siswa ' . $bill['student_name']);
    response(['message' => 'Pengingat WhatsApp berhasil dikirim']);
}

if ($route === 'admin/bills/remind-student' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    rate_limit_or_fail('bill-remind:user:' . (int) ($user['id'] ?? 0), 30, 300, 'Terlalu sering kirim pengingat. Coba lagi beberapa menit lagi.');

    $input = json_input();
    $studentId = (int) ($input['student_id'] ?? 0);
    if ($studentId <= 0) {
        response(['message' => 'ID siswa wajib diisi'], 422);
    }

    $student = student_row($studentId);
    if (!$student) {
        response(['message' => 'Siswa tidak ditemukan'], 404);
    }

    $stmt = $pdo->prepare("SELECT id, bill_name, period, amount
        FROM bills
        WHERE student_id = ? AND status = 'unpaid'
        ORDER BY due_date ASC, id ASC");
    $stmt->execute([$studentId]);
    $bills = $stmt->fetchAll();
    if (!$bills) {
        response(['message' => 'Tidak ada tagihan belum lunas untuk siswa ini'], 422);
    }

    $message = build_bill_reminder_summary_message($student, $bills);
    queue_whatsapp_notification($studentId, 'Pengingat Tagihan', $message);
    try_dispatch_whatsapp_queue();

    log_activity((int) $user['id'], 'notify', 'bill', null, 'Kirim pengingat gabungan tagihan ke siswa ' . ($student['name'] ?? '-'));
    response(['message' => 'Pengingat gabungan tagihan berhasil dikirim']);
}

if ($route === 'admin/bills/remind-selected' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['bills']);
    rate_limit_or_fail('bill-remind:user:' . (int) ($user['id'] ?? 0), 30, 300, 'Terlalu sering kirim pengingat. Coba lagi beberapa menit lagi.');

    $input = json_input();
    $studentId = (int) ($input['student_id'] ?? 0);
    $billIdsRaw = isset($input['bill_ids']) && is_array($input['bill_ids']) ? $input['bill_ids'] : [];
    if ($studentId <= 0) response(['message' => 'ID siswa wajib diisi'], 422);
    if (!$billIdsRaw) response(['message' => 'Pilih minimal satu tagihan'], 422);

    $student = student_row($studentId);
    if (!$student) response(['message' => 'Siswa tidak ditemukan'], 404);

    $billIds = [];
    foreach ($billIdsRaw as $rawId) {
        $id = (int) $rawId;
        if ($id > 0) $billIds[$id] = $id;
    }
    $billIds = array_values($billIds);
    if (!$billIds) response(['message' => 'Daftar tagihan tidak valid'], 422);

    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $params = array_merge([$studentId], $billIds);
    $stmt = $pdo->prepare("SELECT id, bill_name, period, amount
        FROM bills
        WHERE student_id = ?
          AND status = 'unpaid'
          AND id IN ({$placeholders})
        ORDER BY due_date ASC, id ASC");
    $stmt->execute($params);
    $bills = $stmt->fetchAll();
    if (!$bills) {
        response(['message' => 'Tagihan terpilih tidak ditemukan atau sudah lunas'], 422);
    }

    $message = build_bill_reminder_summary_message($student, $bills);
    queue_whatsapp_notification($studentId, 'Pengingat Tagihan', $message);
    try_dispatch_whatsapp_queue();

    log_activity((int) $user['id'], 'notify', 'bill', null, 'Kirim pengingat tagihan terpilih ke siswa ' . ($student['name'] ?? '-'));
    response(['message' => 'Pengingat tagihan terpilih berhasil dikirim']);
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
    $proofRowsStmt = $pdo->prepare("SELECT id, proof_path FROM payment_proofs WHERE bill_id = ?");
    $deleteTxStmt = $pdo->prepare("DELETE FROM transactions WHERE bill_id = ?");
    $deleteProofStmt = $pdo->prepare("DELETE FROM payment_proofs WHERE bill_id = ?");
    $deleteStmt = $pdo->prepare("DELETE FROM bills WHERE id = ?");
    $remainingProofPathUsageStmt = $pdo->prepare("SELECT COUNT(*) FROM payment_proofs WHERE proof_path = ?");
    $proofStorageDir = API_ROOT . '/storage/payment-proofs';

    foreach ($ids as $billId) {
        $proofPathsToCleanup = [];
        try {
            $pdo->beginTransaction();

            $billStmt->execute([$billId]);
            $row = $billStmt->fetch();
            if (!$row) {
                $pdo->rollBack();
                $failed[] = ['id' => $billId, 'reason' => 'Data tagihan tidak ditemukan'];
                continue;
            }

            $proofRowsStmt->execute([$billId]);
            $proofRows = $proofRowsStmt->fetchAll();
            foreach ($proofRows as $proofRow) {
                $path = trim((string) ($proofRow['proof_path'] ?? ''));
                if ($path === '') continue;
                $proofPathsToCleanup[$path] = $path;
            }

            $deleteTxStmt->execute([$billId]);
            $deletedTx = (int) $deleteTxStmt->rowCount();
            $deleteProofStmt->execute([$billId]);
            $deletedProof = (int) $deleteProofStmt->rowCount();
            $deleteStmt->execute([$billId]);

            if ((int) $deleteStmt->rowCount() <= 0) {
                throw new RuntimeException('Tagihan gagal dihapus');
            }

            $pdo->commit();
            $deleted++;

            foreach ($proofPathsToCleanup as $proofPath) {
                if (!is_path_inside_dir($proofPath, $proofStorageDir)) continue;
                $remainingProofPathUsageStmt->execute([$proofPath]);
                $remainingPathUsage = (int) $remainingProofPathUsageStmt->fetchColumn();
                if ($remainingPathUsage === 0 && file_exists($proofPath)) {
                    @unlink($proofPath);
                }
            }

            log_activity(
                (int) $user['id'],
                'delete',
                'bill',
                $billId,
                'Menghapus tagihan ' . $row['bill_name'] . " (transaksi: {$deletedTx}, bukti: {$deletedProof})"
            );
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            $failed[] = ['id' => $billId, 'reason' => 'Gagal menghapus tagihan: ' . $e->getMessage()];
        }
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
        }
    }

    log_activity((int) $user['id'], 'generate', 'bill', null, 'Generate tagihan periode ' . $period . ' sebanyak ' . $created);
    response(['message' => "Generate selesai. {$created} tagihan dibuat. Notifikasi otomatis akan dikirim pada tanggal 5 dan 15 jika masih belum dibayar."]);
}
