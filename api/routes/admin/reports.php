<?php
// Route laporan transaksi dan export CSV.

if (!function_exists('calculate_reports_opening_balance')) {
    function calculate_reports_opening_balance(PDO $pdo, string $type, string $start, string $status, string $classId, string $studentId, string $academicYearId): float
    {
        $incomeBefore = 0.0;
        $expenseBefore = 0.0;

        if ($type !== 'expense') {
            $conditions = ['DATE(t.payment_date) < ?'];
            $params = [$start];
            if ($status) {
                $conditions[] = 't.status = ?';
                $params[] = $status;
            } elseif ($type === 'all') {
                // Untuk mutasi bulanan, saldo hanya menghitung transaksi pemasukan yang benar-benar masuk kas.
                $conditions[] = 't.status = ?';
                $params[] = 'paid';
            }
            if ($classId) {
                $conditions[] = 's.class_id = ?';
                $params[] = $classId;
            }
            if ($academicYearId) {
                $conditions[] = '(b.academic_year_id = ? OR (b.academic_year_id IS NULL AND s.academic_year_id = ?))';
                $params[] = $academicYearId;
                $params[] = $academicYearId;
            }
            if ($studentId) {
                $conditions[] = 't.student_id = ?';
                $params[] = $studentId;
            }
            $where = implode(' AND ', $conditions);
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(t.amount_paid), 0) AS total
                FROM transactions t
                JOIN bills b ON b.id=t.bill_id
                JOIN students s ON s.id=t.student_id
                WHERE {$where}");
            $stmt->execute($params);
            $incomeBefore = (float) ($stmt->fetchColumn() ?: 0);
        }

        if ($type !== 'income' && $studentId === '' && $classId === '') {
            $expenseConditions = ['DATE(e.expense_date) < ?'];
            $expenseParams = [$start];
            if ($academicYearId !== '') {
                $bounds = reports_academic_year_bounds($pdo, $academicYearId);
                if ($bounds) {
                    $expenseConditions[] = 'DATE(e.expense_date) BETWEEN ? AND ?';
                    $expenseParams[] = $bounds['start'];
                    $expenseParams[] = $bounds['end'];
                }
            }
            $expenseWhere = implode(' AND ', $expenseConditions);
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(e.amount), 0) AS total
                FROM expenses e
                WHERE {$expenseWhere}");
            $stmt->execute($expenseParams);
            $expenseBefore = (float) ($stmt->fetchColumn() ?: 0);
        }

        return $incomeBefore - $expenseBefore;
    }
}

if (!function_exists('reports_month_label_id')) {
    function reports_month_label_id(string $date): string
    {
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
            7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];
        $ts = strtotime($date);
        if (!$ts) return '-';
        $m = (int) date('n', $ts);
        $y = (int) date('Y', $ts);
        return (($months[$m] ?? date('F', $ts)) . ' ' . $y);
    }
}

if (!function_exists('reports_date_label_id')) {
    function reports_date_label_id(string $date): string
    {
        $months = [
            1 => 'Januari', 2 => 'Februari', 3 => 'Maret', 4 => 'April', 5 => 'Mei', 6 => 'Juni',
            7 => 'Juli', 8 => 'Agustus', 9 => 'September', 10 => 'Oktober', 11 => 'November', 12 => 'Desember',
        ];
        $ts = strtotime($date);
        if (!$ts) return '-';
        $d = (int) date('d', $ts);
        $m = (int) date('n', $ts);
        $y = (int) date('Y', $ts);
        return $d . ' ' . ($months[$m] ?? date('F', $ts)) . ' ' . $y;
    }
}

if (!function_exists('reports_type_label_id')) {
    function reports_type_label_id(string $type): string
    {
        if ($type === 'all') return 'Bulanan';
        if ($type === 'income') return 'Pemasukan';
        if ($type === 'expense') return 'Pengeluaran';
        return 'Keuangan';
    }
}

if (!function_exists('build_export_report_title')) {
    function build_export_report_title(string $type, string $start, string $end): string
    {
        $typeLabel = reports_type_label_id($type);
        $periodLabel = reports_date_label_id($start) . ' s.d. ' . reports_date_label_id($end);
        if ($type === 'all') {
            $startTs = strtotime($start);
            $endTs = strtotime($end);
            if ($startTs && $endTs) {
                $isStartMonthFirstDay = date('Y-m-d', $startTs) === date('Y-m-01', $startTs);
                $isEndMonthLastDay = date('Y-m-d', $endTs) === date('Y-m-t', $startTs);
                $isSameMonth = date('Y-m', $startTs) === date('Y-m', $endTs);
                if ($isStartMonthFirstDay && $isEndMonthLastDay && $isSameMonth) {
                    $periodLabel = reports_month_label_id($start);
                }
            }
        }
        return 'Laporan ' . $typeLabel . ' ' . $periodLabel;
    }
}

if (!function_exists('build_reports_header')) {
    function build_reports_header(string $startDate): array
    {
        $schoolName = trim(setting_value('school_name', 'MADRASAH'));
        if ($schoolName === '') $schoolName = 'MADRASAH';
        $activeYear = trim((string) scalar("SELECT name FROM academic_years WHERE is_active = 1 ORDER BY id DESC LIMIT 1"));
        if ($activeYear === '') $activeYear = '-';
        $principalName = trim(setting_value('principal_name', ''));
        $treasurerName = trim(setting_value('treasurer_name', ''));

        $schoolUpper = function_exists('mb_strtoupper') ? mb_strtoupper($schoolName) : strtoupper($schoolName);

        return [
            'title' => 'LAPORAN KAS ' . $schoolUpper,
            'periodLabel' => reports_month_label_id($startDate),
            'academicYear' => $activeYear,
            'principalName' => $principalName,
            'treasurerName' => $treasurerName,
        ];
    }
}

if (!function_exists('reports_academic_year_bounds')) {
    function reports_academic_year_bounds(PDO $pdo, string $academicYearId): ?array
    {
        if ($academicYearId === '') return null;
        $stmt = $pdo->prepare("SELECT start_date, end_date FROM academic_years WHERE id = ? LIMIT 1");
        $stmt->execute([$academicYearId]);
        $row = $stmt->fetch();
        if (!$row) return null;
        $start = trim((string) ($row['start_date'] ?? ''));
        $end = trim((string) ($row['end_date'] ?? ''));
        if ($start === '' || $end === '') return null;
        return ['start' => $start, 'end' => $end];
    }
}
if ($route === 'admin/reports' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['reports']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $type = query('type', '');
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    $academicYearId = query('academic_year_id', '');
    $financePostId = query('finance_post_id', '');
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $rows = [];

    if ($type !== 'expense') {
        $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
        $params = [$start, $end];
        if ($status) {
            $conditions[] = 't.status = ?';
            $params[] = $status;
        } elseif ($type === 'all') {
            // Untuk mutasi bulanan, saldo hanya menghitung transaksi pemasukan yang benar-benar masuk kas.
            $conditions[] = 't.status = ?';
            $params[] = 'paid';
        }
        if ($classId) {
            $conditions[] = 's.class_id = ?';
            $params[] = $classId;
        }
        if ($academicYearId) {
            $conditions[] = '(b.academic_year_id = ? OR (b.academic_year_id IS NULL AND s.academic_year_id = ?))';
            $params[] = $academicYearId;
            $params[] = $academicYearId;
        }
        if ($studentId) {
            $conditions[] = 't.student_id = ?';
            $params[] = $studentId;
        }
        if ($financePostId) {
            $conditions[] = 'b.finance_post_id = ?';
            $params[] = $financePostId;
        }
        $where = implode(' AND ', $conditions);
        $stmt = $pdo->prepare("SELECT
                'income' report_type,
                DATE(t.payment_date) report_date,
                s.name student_name,
                c.name class_name,
                COALESCE(fp.name, b.bill_name, 'Tagihan') item_name,
                'Pemasukan' category,
                COALESCE(t.payment_channel, '') payment_channel,
                t.amount_paid amount,
                COALESCE(t.reference_no, '') reference_no,
                COALESCE(t.status, '') status
            FROM transactions t
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN bills b ON b.id=t.bill_id
            LEFT JOIN finance_posts fp ON fp.id=b.finance_post_id
            WHERE {$where}");
        $stmt->execute($params);
        $rows = array_merge($rows, $stmt->fetchAll());
    }

    if ($type !== 'income' && $studentId === '' && $classId === '') {
        $expenseConditions = ['DATE(e.expense_date) BETWEEN ? AND ?'];
        $expenseParams = [$start, $end];
        if ($academicYearId !== '') {
            $bounds = reports_academic_year_bounds($pdo, $academicYearId);
            if ($bounds) {
                $expenseConditions[] = 'DATE(e.expense_date) BETWEEN ? AND ?';
                $expenseParams[] = $bounds['start'];
                $expenseParams[] = $bounds['end'];
            }
        }
        $expenseWhere = implode(' AND ', $expenseConditions);
        $expenseStmt = $pdo->prepare("SELECT
                'expense' report_type,
                e.id,
                NULL student_id,
                DATE(e.expense_date) report_date,
                '' student_name,
                '' class_name,
                e.title item_name,
                COALESCE(e.category, '') category,
                '' payment_channel,
                e.amount amount,
                '' reference_no,
                'recorded' status
            FROM expenses e
            WHERE {$expenseWhere}");
        $expenseStmt->execute($expenseParams);
        $rows = array_merge($rows, $expenseStmt->fetchAll());
    }

    usort($rows, fn($a, $b) => strcmp((string) $b['report_date'], (string) $a['report_date']));

    $summary = [
        'count' => count($rows),
        'totalIncome' => array_reduce($rows, fn($carry, $item) => $carry + ($item['report_type'] === 'income' ? (float) $item['amount'] : 0), 0),
        'totalExpense' => array_reduce($rows, fn($carry, $item) => $carry + ($item['report_type'] === 'expense' ? (float) $item['amount'] : 0), 0),
        'successful' => count(array_filter($rows, fn($r) => $r['report_type'] === 'income' && $r['status'] === 'paid')),
        'pending' => count(array_filter($rows, fn($r) => $r['report_type'] === 'income' && $r['status'] === 'pending')),
    ];
    $summary['net'] = (float) $summary['totalIncome'] - (float) $summary['totalExpense'];
    $summary['openingBalance'] = calculate_reports_opening_balance($pdo, (string) $type, (string) $start, (string) $status, (string) $classId, (string) $studentId, (string) $academicYearId);
    $summary['closingBalance'] = (float) $summary['openingBalance'] + (float) $summary['net'];
    $reportHeader = build_reports_header((string) $start);

    $byChannel = [];
    foreach ($rows as $row) {
        if ($row['report_type'] !== 'income') continue;
        $channel = $row['payment_channel'];
        $byChannel[$channel] = ($byChannel[$channel] ?? 0) + (float) $row['amount'];
    }

    response(['rows' => $rows, 'summary' => $summary, 'byChannel' => $byChannel, 'header' => $reportHeader]);
}

if ($route === 'admin/reports/export' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['reports']);
    $format = query('format', 'csv');
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $type = query('type', '');
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    $academicYearId = query('academic_year_id', '');
    $financePostId = query('finance_post_id', '');
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $rows = [];
    $openingBalance = calculate_reports_opening_balance($pdo, (string) $type, (string) $start, (string) $status, (string) $classId, (string) $studentId, (string) $academicYearId);
    $reportHeader = build_reports_header((string) $start);
    $exportTitle = build_export_report_title((string) $type, (string) $start, (string) $end);
    $exportFileBase = preg_replace('/[\\\/:*?"<>|]+/', '-', $exportTitle);
    if (!is_string($exportFileBase) || trim($exportFileBase) === '') {
        $exportFileBase = 'Laporan-Keuangan';
    }

    if ($type !== 'expense') {
        $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
        $params = [$start, $end];
        if ($status) {
            $conditions[] = 't.status = ?';
            $params[] = $status;
        } elseif ($type === 'all') {
            // Untuk mutasi bulanan, saldo hanya menghitung transaksi pemasukan yang benar-benar masuk kas.
            $conditions[] = 't.status = ?';
            $params[] = 'paid';
        }
        if ($classId) {
            $conditions[] = 's.class_id = ?';
            $params[] = $classId;
        }
        if ($academicYearId) {
            $conditions[] = '(b.academic_year_id = ? OR (b.academic_year_id IS NULL AND s.academic_year_id = ?))';
            $params[] = $academicYearId;
            $params[] = $academicYearId;
        }
        if ($studentId) {
            $conditions[] = 't.student_id = ?';
            $params[] = $studentId;
        }
        if ($financePostId) {
            $conditions[] = 'b.finance_post_id = ?';
            $params[] = $financePostId;
        }
        $where = implode(' AND ', $conditions);
        $stmt = $pdo->prepare("SELECT
                'Pemasukan' tipe,
                DATE(t.payment_date) tanggal,
                s.name student_name,
                c.name class_name,
                COALESCE(fp.name, b.bill_name, 'Tagihan') item_name,
                'Pemasukan' category,
                COALESCE(t.payment_channel, '') payment_channel,
                t.amount_paid amount,
                COALESCE(t.reference_no, '') reference_no,
                COALESCE(t.status, '') status
            FROM transactions t
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN bills b ON b.id=t.bill_id
            LEFT JOIN finance_posts fp ON fp.id=b.finance_post_id
            WHERE {$where}");
        $stmt->execute($params);
        $rows = array_merge($rows, $stmt->fetchAll());
    }

    if ($type !== 'income' && $studentId === '' && $classId === '') {
        $expenseConditions = ['DATE(e.expense_date) BETWEEN ? AND ?'];
        $expenseParams = [$start, $end];
        if ($academicYearId !== '') {
            $bounds = reports_academic_year_bounds($pdo, $academicYearId);
            if ($bounds) {
                $expenseConditions[] = 'DATE(e.expense_date) BETWEEN ? AND ?';
                $expenseParams[] = $bounds['start'];
                $expenseParams[] = $bounds['end'];
            }
        }
        $expenseWhere = implode(' AND ', $expenseConditions);
        $expenseStmt = $pdo->prepare("SELECT
                'Pengeluaran' tipe,
                DATE(e.expense_date) tanggal,
                '' student_name,
                '' class_name,
                e.title item_name,
                COALESCE(e.category, '') category,
                '' payment_channel,
                e.amount amount,
                '' reference_no,
                'recorded' status
            FROM expenses e
            WHERE {$expenseWhere}");
        $expenseStmt->execute($expenseParams);
        $rows = array_merge($rows, $expenseStmt->fetchAll());
    }

    usort($rows, fn($a, $b) => strcmp((string) $b['tanggal'], (string) $a['tanggal']));
    if ($format === 'xlsx') {
        if (!class_exists('\PhpOffice\PhpSpreadsheet\Spreadsheet')) {
            response(['message' => 'Fitur export XLSX belum tersedia di server (PhpSpreadsheet belum terpasang)'], 500);
        }

        $sheetRows = $rows;
        if ($type === 'all') {
            $ascending = $sheetRows;
            usort($ascending, function ($a, $b) {
                if ((string) $a['tanggal'] === (string) $b['tanggal']) return 0;
                return strcmp((string) $a['tanggal'], (string) $b['tanggal']);
            });

            $runningBalance = (float) $openingBalance;
            $withBalance = [];
            foreach ($ascending as $row) {
                $income = $row['tipe'] === 'Pemasukan' ? (float) $row['amount'] : 0.0;
                $expense = $row['tipe'] === 'Pengeluaran' ? (float) $row['amount'] : 0.0;
                $runningBalance += $income - $expense;
                $row['mutation_income'] = $income;
                $row['mutation_expense'] = $expense;
                $row['mutation_balance'] = $runningBalance;
                $withBalance[] = $row;
            }
            $sheetRows = $withBalance;
        }

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Laporan');

        $lastColumn = ($type === 'expense') ? 'G' : 'H';
        $sheet->mergeCells('A1:' . $lastColumn . '1');
        $sheet->mergeCells('A2:' . $lastColumn . '2');
        $sheet->setCellValue('A1', $exportTitle);
        $sheet->setCellValue('A2', 'Periode ' . $reportHeader['periodLabel'] . ' T.A ' . $reportHeader['academicYear']);
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 14],
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
        ]);
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['bold' => true, 'size' => 11],
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
        ]);

        $headerRow = 4;
        $rowNo = $headerRow;

        if ($type === 'all') {
            $headers = ['No', 'Tanggal', 'Uraian', 'Kategori', 'Kanal', 'Pemasukan', 'Pengeluaran', 'Saldo'];
            foreach ($headers as $idx => $head) {
                $sheet->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($idx + 1) . $rowNo, $head);
            }
            $rowNo++;

            $sheet->setCellValue('C' . $rowNo, 'Saldo akhir bulan lalu');
            $sheet->setCellValue('H' . $rowNo, (float) $openingBalance);
            $sheet->getStyle('C' . $rowNo . ':H' . $rowNo)->getFont()->setBold(true);
            $rowNo++;

            $no = 1;
            foreach ($sheetRows as $row) {
                $sheet->setCellValue('A' . $rowNo, $no++);
                $sheet->setCellValue('B' . $rowNo, (string) ($row['tanggal'] ?? ''));
                $sheet->setCellValue('C' . $rowNo, (string) ($row['item_name'] ?? ''));
                $sheet->setCellValue('D' . $rowNo, (string) ($row['category'] ?? ''));
                $sheet->setCellValue('E' . $rowNo, (string) ($row['payment_channel'] ?? ''));
                $sheet->setCellValue('F' . $rowNo, (float) ($row['mutation_income'] ?? 0));
                $sheet->setCellValue('G' . $rowNo, (float) ($row['mutation_expense'] ?? 0));
                $sheet->setCellValue('H' . $rowNo, (float) ($row['mutation_balance'] ?? 0));
                $rowNo++;
            }

            $closingBalance = count($sheetRows) > 0
                ? (float) $sheetRows[count($sheetRows) - 1]['mutation_balance']
                : (float) $openingBalance;
            $sheet->setCellValue('C' . $rowNo, 'Saldo akhir bulan ini');
            $sheet->setCellValue('H' . $rowNo, $closingBalance);
            $sheet->getStyle('C' . $rowNo . ':H' . $rowNo)->getFont()->setBold(true);

            $dataStartRow = $headerRow + 1;
            $dataEndRow = $rowNo;
            $sheet->getStyle('F' . $dataStartRow . ':H' . $dataEndRow)
                ->getNumberFormat()
                ->setFormatCode('[$-421]Rp #,##0');
            $sheet->getStyle('A' . $dataStartRow . ':B' . $dataEndRow)
                ->getAlignment()
                ->setHorizontal('center');
            $sheet->getStyle('F' . $dataStartRow . ':H' . $dataEndRow)
                ->getAlignment()
                ->setHorizontal('right');
            $sheet->getStyle('C' . $dataStartRow . ':E' . $dataEndRow)
                ->getAlignment()
                ->setHorizontal('left');

            $sheet->getColumnDimension('A')->setWidth(6);
            $sheet->getColumnDimension('B')->setWidth(14);
            $sheet->getColumnDimension('C')->setWidth(38);
            $sheet->getColumnDimension('D')->setWidth(20);
            $sheet->getColumnDimension('E')->setWidth(20);
            $sheet->getColumnDimension('F')->setWidth(16);
            $sheet->getColumnDimension('G')->setWidth(16);
            $sheet->getColumnDimension('H')->setWidth(16);
        } else {
            if ($type === 'income') {
                $headers = ['No', 'Tanggal', 'Referensi', 'Siswa', 'Kelas', 'Pos', 'Kanal', 'Nominal'];
                foreach ($headers as $idx => $head) {
                    $sheet->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($idx + 1) . $rowNo, $head);
                }
                $rowNo++;

                $no = 1;
                foreach ($sheetRows as $row) {
                    $sheet->setCellValue('A' . $rowNo, $no++);
                    $sheet->setCellValue('B' . $rowNo, (string) ($row['tanggal'] ?? ''));
                    $sheet->setCellValue('C' . $rowNo, (string) ($row['reference_no'] ?? ''));
                    $sheet->setCellValue('D' . $rowNo, (string) ($row['student_name'] ?? ''));
                    $sheet->setCellValue('E' . $rowNo, (string) ($row['class_name'] ?? ''));
                    $sheet->setCellValue('F' . $rowNo, (string) ($row['item_name'] ?? ''));
                    $sheet->setCellValue('G' . $rowNo, (string) ($row['payment_channel'] ?? ''));
                    $sheet->setCellValue('H' . $rowNo, (float) ($row['amount'] ?? 0));
                    $rowNo++;
                }

                // Satu baris kosong, lalu baris total.
                $rowNo++;
                $totalNominal = array_reduce($sheetRows, fn($carry, $item) => $carry + (float) ($item['amount'] ?? 0), 0.0);
                $sheet->mergeCells('A' . $rowNo . ':G' . $rowNo);
                $sheet->setCellValue('A' . $rowNo, 'TOTAL');
                $sheet->setCellValue('H' . $rowNo, $totalNominal);
                $sheet->getStyle('A' . $rowNo . ':H' . $rowNo)->getFont()->setBold(true);
                $sheet->getStyle('A' . $rowNo . ':G' . $rowNo)->getAlignment()->setHorizontal('center');

                $dataStartRow = $headerRow + 1;
                $dataEndRow = max($dataStartRow, $rowNo);
                $sheet->getStyle('H' . $dataStartRow . ':H' . $dataEndRow)
                    ->getNumberFormat()
                    ->setFormatCode('[$-421]Rp #,##0');
                $sheet->getStyle('A' . $dataStartRow . ':C' . $dataEndRow)
                    ->getAlignment()
                    ->setHorizontal('center');
                $sheet->getStyle('H' . $dataStartRow . ':H' . $dataEndRow)
                    ->getAlignment()
                    ->setHorizontal('right');

                $sheet->getColumnDimension('A')->setWidth(8);
                $sheet->getColumnDimension('B')->setWidth(14);
                $sheet->getColumnDimension('C')->setWidth(24);
                $sheet->getColumnDimension('D')->setWidth(28);
                $sheet->getColumnDimension('E')->setWidth(14);
                $sheet->getColumnDimension('F')->setWidth(28);
                $sheet->getColumnDimension('G')->setWidth(16);
                $sheet->getColumnDimension('H')->setWidth(16);
            } else {
                $headers = ['No', 'Tanggal', 'Referensi', 'Item', 'Kategori', 'Kanal', 'Nominal'];
                foreach ($headers as $idx => $head) {
                    $sheet->setCellValue(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($idx + 1) . $rowNo, $head);
                }
                $rowNo++;

                $no = 1;
                foreach ($sheetRows as $row) {
                    $sheet->setCellValue('A' . $rowNo, $no++);
                    $sheet->setCellValue('B' . $rowNo, (string) ($row['tanggal'] ?? ''));
                    $sheet->setCellValue('C' . $rowNo, (string) ($row['reference_no'] ?? ''));
                    $sheet->setCellValue('D' . $rowNo, (string) ($row['item_name'] ?? ''));
                    $sheet->setCellValue('E' . $rowNo, (string) ($row['category'] ?? ''));
                    $sheet->setCellValue('F' . $rowNo, (string) ($row['payment_channel'] ?? ''));
                    $sheet->setCellValue('G' . $rowNo, (float) ($row['amount'] ?? 0));
                    $rowNo++;
                }

                // Satu baris kosong, lalu baris total.
                $rowNo++;
                $totalNominal = array_reduce($sheetRows, fn($carry, $item) => $carry + (float) ($item['amount'] ?? 0), 0.0);
                $sheet->mergeCells('A' . $rowNo . ':F' . $rowNo);
                $sheet->setCellValue('A' . $rowNo, 'TOTAL');
                $sheet->setCellValue('G' . $rowNo, $totalNominal);
                $sheet->getStyle('A' . $rowNo . ':G' . $rowNo)->getFont()->setBold(true);
                $sheet->getStyle('A' . $rowNo . ':F' . $rowNo)->getAlignment()->setHorizontal('center');

                $dataStartRow = $headerRow + 1;
                $dataEndRow = max($dataStartRow, $rowNo);
                $sheet->getStyle('G' . $dataStartRow . ':G' . $dataEndRow)
                    ->getNumberFormat()
                    ->setFormatCode('[$-421]Rp #,##0');
                $sheet->getStyle('A' . $dataStartRow . ':C' . $dataEndRow)
                    ->getAlignment()
                    ->setHorizontal('center');
                $sheet->getStyle('G' . $dataStartRow . ':G' . $dataEndRow)
                    ->getAlignment()
                    ->setHorizontal('right');

                $sheet->getColumnDimension('A')->setWidth(8);
                $sheet->getColumnDimension('B')->setWidth(14);
                $sheet->getColumnDimension('C')->setWidth(24);
                $sheet->getColumnDimension('D')->setWidth(34);
                $sheet->getColumnDimension('E')->setWidth(20);
                $sheet->getColumnDimension('F')->setWidth(18);
                $sheet->getColumnDimension('G')->setWidth(16);
            }
        }

        $sheet->getStyle('A' . $headerRow . ':' . $lastColumn . $headerRow)->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => ['fillType' => 'solid', 'startColor' => ['rgb' => '1F4E78']],
            'alignment' => ['horizontal' => 'center', 'vertical' => 'center'],
        ]);

        $finalRow = $rowNo;
        $sheet->getStyle('A' . $headerRow . ':' . $lastColumn . $finalRow)
            ->getBorders()
            ->getAllBorders()
            ->setBorderStyle('thin');
        $sheet->getStyle(($type === 'all' ? 'C' : 'D') . ($headerRow + 1) . ':' . ($type === 'all' ? 'E' : 'F') . $finalRow)
            ->getAlignment()
            ->setWrapText(true);

        $sheet->freezePane('A5');
        $sheet->setAutoFilter('A' . $headerRow . ':' . $lastColumn . $headerRow);

        while (ob_get_level() > 0) {
            ob_end_clean();
        }
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="' . $exportFileBase . '.xlsx"');
        header('Cache-Control: max-age=0');
        header('Pragma: public');

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $writer->save('php://output');
        exit;
    }

    if ($format === 'xls') {
        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename=' . $exportFileBase . '.xls');

        $escape = function ($value) {
            return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
        };

        echo "<h3 style=\"margin:0 0 4px 0; text-align:center;\">" . $escape($exportTitle) . "</h3>";
        echo "<p style=\"margin:0 0 8px 0; text-align:center; font-weight:bold;\">Periode " . $escape($reportHeader['periodLabel']) . " T.A " . $escape($reportHeader['academicYear']) . "</p>";

        if ($type === 'all') {
            $ascending = $rows;
            usort($ascending, function ($a, $b) {
                if ((string) $a['tanggal'] === (string) $b['tanggal']) return 0;
                return strcmp((string) $a['tanggal'], (string) $b['tanggal']);
            });

            $runningBalance = (float) $openingBalance;
            $withBalance = [];
            foreach ($ascending as $row) {
                $income = $row['tipe'] === 'Pemasukan' ? (float) $row['amount'] : 0.0;
                $expense = $row['tipe'] === 'Pengeluaran' ? (float) $row['amount'] : 0.0;
                $runningBalance += $income - $expense;
                $row['mutation_income'] = $income;
                $row['mutation_expense'] = $expense;
                $row['mutation_balance'] = $runningBalance;
                $withBalance[] = $row;
            }
            $rows = $withBalance;

            echo "<table border=\"1\"><thead><tr>";
            foreach (['No', 'Tanggal', 'Uraian', 'Kategori', 'Kanal', 'Pemasukan', 'Pengeluaran', 'Saldo'] as $head) {
                echo "<th style=\"text-align:center;\">{$escape($head)}</th>";
            }
            echo "</tr></thead><tbody>";
            echo "<tr>";
            echo "<td style=\"text-align:center;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:center;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:left;font-weight:bold;\">Saldo akhir bulan lalu</td>";
            echo "<td style=\"text-align:left;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:left;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:right;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:right;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:right;font-weight:bold;\">{$escape($openingBalance)}</td>";
            echo "</tr>";
            $no = 1;
            foreach ($rows as $row) {
                echo "<tr>";
                echo "<td style=\"text-align:center;\">{$escape($no++)}</td>";
                echo "<td style=\"text-align:center;\">{$escape($row['tanggal'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['item_name'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['category'] ?? '')}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['payment_channel'] ?? '')}</td>";
                echo "<td style=\"text-align:right;\">{$escape($row['mutation_income'] > 0 ?$row['mutation_income'] : '')}</td>";
                echo "<td style=\"text-align:right;\">{$escape($row['mutation_expense'] > 0 ?$row['mutation_expense'] : '')}</td>";
                echo "<td style=\"text-align:right;\">{$escape($row['mutation_balance'])}</td>";
                echo "</tr>";
            }
            $closingBalance = count($rows) > 0 ? (float) $rows[count($rows) - 1]['mutation_balance'] : (float) $openingBalance;
            echo "<tr>";
            echo "<td style=\"text-align:center;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:center;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:left;font-weight:bold;\">Saldo akhir bulan ini</td>";
            echo "<td style=\"text-align:left;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:left;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:right;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:right;font-weight:bold;\"></td>";
            echo "<td style=\"text-align:right;font-weight:bold;\">{$escape($closingBalance)}</td>";
            echo "</tr>";
            echo "</tbody></table>";
            echo "<br/>";
            echo "<table border=\"0\" style=\"width:100%; border-collapse:collapse;\">";
            echo "<tr>";
            echo "<td style=\"width:50%; text-align:center;\">Mengetahui,<br/>Pengasuh</td>";
            echo "<td style=\"width:50%; text-align:center;\">&nbsp;<br/>Bendahara</td>";
            echo "</tr>";
            echo "<tr>";
            echo "<td style=\"height:64px;\"></td>";
            echo "<td style=\"height:64px;\"></td>";
            echo "</tr>";
            echo "<tr>";
            echo "<td style=\"width:50%; text-align:center; font-weight:bold;\">(" . $escape($reportHeader['principalName'] !== '' ? $reportHeader['principalName'] : '.................................') . ")</td>";
            echo "<td style=\"width:50%; text-align:center; font-weight:bold;\">(" . $escape($reportHeader['treasurerName'] !== '' ? $reportHeader['treasurerName'] : '.................................') . ")</td>";
            echo "</tr>";
            echo "</table>";
            exit;
        }

        if ($type === 'income') {
            echo "<table border=\"1\"><thead><tr>";
            foreach (['No', 'Tanggal', 'Referensi', 'Siswa', 'Kelas', 'Pos', 'Kanal', 'Nominal'] as $head) {
                echo "<th style=\"text-align:center;\">{$escape($head)}</th>";
            }
            echo "</tr></thead><tbody>";
            $no = 1;
            foreach ($rows as $row) {
                echo "<tr>";
                echo "<td style=\"text-align:center;\">{$escape($no++)}</td>";
                echo "<td style=\"text-align:center;\">{$escape($row['tanggal'])}</td>";
                echo "<td style=\"text-align:center;\">{$escape($row['reference_no'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['student_name'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['class_name'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['item_name'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['payment_channel'])}</td>";
                echo "<td style=\"text-align:right;\">{$escape($row['amount'])}</td>";
                echo "</tr>";
            }
            echo "<tr><td colspan=\"8\" style=\"border:none;height:12px;\"></td></tr>";
            $totalNominal = array_reduce($rows, fn($carry, $item) => $carry + (float) ($item['amount'] ?? 0), 0.0);
            echo "<tr>";
            echo "<td colspan=\"7\" style=\"text-align:center;font-weight:bold;\">TOTAL</td>";
            echo "<td style=\"text-align:right;font-weight:bold;\">{$escape($totalNominal)}</td>";
            echo "</tr>";
            echo "</tbody></table>";
        } else {
            echo "<table border=\"1\"><thead><tr>";
            foreach (['No', 'Tanggal', 'Referensi', 'Item', 'Kategori', 'Kanal', 'Nominal'] as $head) {
                echo "<th style=\"text-align:center;\">{$escape($head)}</th>";
            }
            echo "</tr></thead><tbody>";
            $no = 1;
            foreach ($rows as $row) {
                echo "<tr>";
                echo "<td style=\"text-align:center;\">{$escape($no++)}</td>";
                echo "<td style=\"text-align:center;\">{$escape($row['tanggal'])}</td>";
                echo "<td style=\"text-align:center;\">{$escape($row['reference_no'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['item_name'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['category'])}</td>";
                echo "<td style=\"text-align:left;\">{$escape($row['payment_channel'])}</td>";
                echo "<td style=\"text-align:right;\">{$escape($row['amount'])}</td>";
                echo "</tr>";
            }
            echo "<tr><td colspan=\"7\" style=\"border:none;height:12px;\"></td></tr>";
            $totalNominal = array_reduce($rows, fn($carry, $item) => $carry + (float) ($item['amount'] ?? 0), 0.0);
            echo "<tr>";
            echo "<td colspan=\"6\" style=\"text-align:center;font-weight:bold;\">TOTAL</td>";
            echo "<td style=\"text-align:right;font-weight:bold;\">{$escape($totalNominal)}</td>";
            echo "</tr>";
            echo "</tbody></table>";
        }
        echo "<br/>";
        echo "<table border=\"0\" style=\"width:100%; border-collapse:collapse;\">";
        echo "<tr>";
        echo "<td style=\"width:50%; text-align:center;\">Mengetahui,<br/>Pengasuh</td>";
        echo "<td style=\"width:50%; text-align:center;\">&nbsp;<br/>Bendahara</td>";
        echo "</tr>";
        echo "<tr>";
        echo "<td style=\"height:64px;\"></td>";
        echo "<td style=\"height:64px;\"></td>";
        echo "</tr>";
        echo "<tr>";
        echo "<td style=\"width:50%; text-align:center; font-weight:bold;\">(" . $escape($reportHeader['principalName'] !== '' ? $reportHeader['principalName'] : '.................................') . ")</td>";
        echo "<td style=\"width:50%; text-align:center; font-weight:bold;\">(" . $escape($reportHeader['treasurerName'] !== '' ? $reportHeader['treasurerName'] : '.................................') . ")</td>";
        echo "</tr>";
        echo "</table>";
        exit;
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=' . $exportFileBase . '.csv');
    $out = fopen('php://output', 'w');
    if ($type === 'all') {
        $ascending = $rows;
        usort($ascending, function ($a, $b) {
            if ((string) $a['tanggal'] === (string) $b['tanggal']) return 0;
            return strcmp((string) $a['tanggal'], (string) $b['tanggal']);
        });

        $runningBalance = (float) $openingBalance;
        $withBalance = [];
        foreach ($ascending as $row) {
            $income = $row['tipe'] === 'Pemasukan' ? (float) $row['amount'] : 0.0;
            $expense = $row['tipe'] === 'Pengeluaran' ? (float) $row['amount'] : 0.0;
            $runningBalance += $income - $expense;
            $row['mutation_income'] = $income;
            $row['mutation_expense'] = $expense;
            $row['mutation_balance'] = $runningBalance;
            $withBalance[] = $row;
        }

        $rows = $withBalance;
        fputcsv($out, ['No', 'Tanggal', 'Uraian', 'Kategori', 'Kanal', 'Pemasukan', 'Pengeluaran', 'Saldo']);
        fputcsv($out, ['', '', 'Saldo akhir bulan lalu', '', '', '', '', $openingBalance]);
        $no = 1;
        foreach ($rows as $row) {
            fputcsv($out, [
                $no++,
                $row['tanggal'],
                $row['item_name'],
                $row['category'] ?? '',
                $row['payment_channel'] ?? '',
                $row['mutation_income'] > 0 ? $row['mutation_income'] : '',
                $row['mutation_expense'] > 0 ? $row['mutation_expense'] : '',
                $row['mutation_balance'],
            ]);
        }
        $closingBalance = count($rows) > 0 ? (float) $rows[count($rows) - 1]['mutation_balance'] : (float) $openingBalance;
        fputcsv($out, ['', '', 'Saldo akhir bulan ini', '', '', '', '', $closingBalance]);
    } else {
        if ($type === 'income') {
            fputcsv($out, ['No', 'Tanggal', 'Referensi', 'Siswa', 'Kelas', 'Pos', 'Kanal', 'Nominal']);
            $no = 1;
            foreach ($rows as $row) {
                fputcsv($out, [$no++, $row['tanggal'], $row['reference_no'], $row['student_name'], $row['class_name'], $row['item_name'], $row['payment_channel'], $row['amount']]);
            }
            fputcsv($out, []);
            $totalNominal = array_reduce($rows, fn($carry, $item) => $carry + (float) ($item['amount'] ?? 0), 0.0);
            fputcsv($out, ['TOTAL', '', '', '', '', '', '', $totalNominal]);
        } else {
            fputcsv($out, ['No', 'Tanggal', 'Referensi', 'Item', 'Kategori', 'Kanal', 'Nominal']);
            $no = 1;
            foreach ($rows as $row) {
                fputcsv($out, [$no++, $row['tanggal'], $row['reference_no'], $row['item_name'], $row['category'], $row['payment_channel'], $row['amount']]);
            }
            fputcsv($out, []);
            $totalNominal = array_reduce($rows, fn($carry, $item) => $carry + (float) ($item['amount'] ?? 0), 0.0);
            fputcsv($out, ['TOTAL', '', '', '', '', '', $totalNominal]);
        }
    }
    fclose($out);
    exit;
}





















