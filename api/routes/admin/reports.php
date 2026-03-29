<?php
// Route laporan transaksi dan export CSV.

if (!function_exists('calculate_reports_opening_balance')) {
    function calculate_reports_opening_balance(PDO $pdo, string $type, string $start, string $status, string $classId, string $studentId): float
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
            if ($studentId) {
                $conditions[] = 't.student_id = ?';
                $params[] = $studentId;
            }
            $where = implode(' AND ', $conditions);
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(t.amount_paid), 0) AS total
                FROM transactions t
                JOIN students s ON s.id=t.student_id
                WHERE {$where}");
            $stmt->execute($params);
            $incomeBefore = (float) ($stmt->fetchColumn() ?: 0);
        }

        if ($type !== 'income' && $studentId === '' && $classId === '') {
            $stmt = $pdo->prepare("SELECT COALESCE(SUM(e.amount), 0) AS total
                FROM expenses e
                WHERE DATE(e.expense_date) < ?");
            $stmt->execute([$start]);
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

if (!function_exists('build_reports_header')) {
    function build_reports_header(string $startDate): array
    {
        $schoolName = trim(setting_value('school_name', 'MADRASAH'));
        if ($schoolName === '') $schoolName = 'MADRASAH';
        $activeYear = trim((string) scalar("SELECT name FROM academic_years WHERE is_active = 1 ORDER BY id DESC LIMIT 1"));
        if ($activeYear === '') $activeYear = '-';

        return [
            'title' => 'LAPORAN KAS ' . mb_strtoupper($schoolName),
            'periodLabel' => reports_month_label_id($startDate),
            'academicYear' => $activeYear,
        ];
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
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $rows = [];

    if ($type !== 'expense') {
        $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
        $params = [$start, $end];
        if ($status) {
            $conditions[] = 't.status = ?';
            $params[] = $status;
        } elseif ($type === 'all') {
            // Mode bulanan = mutasi kas, default hanya transaksi lunas.
            $conditions[] = 't.status = ?';
            $params[] = 'paid';
        }
        if ($classId) {
            $conditions[] = 's.class_id = ?';
            $params[] = $classId;
        }
        if ($studentId) {
            $conditions[] = 't.student_id = ?';
            $params[] = $studentId;
        }
        $where = implode(' AND ', $conditions);

        if ($type === 'income') {
            $stmt = $pdo->prepare("SELECT
                    'income' report_type,
                    t.id,
                    t.student_id,
                    t.payment_date report_date,
                    s.name student_name,
                    c.name class_name,
                    b.bill_name item_name,
                    '' category,
                    t.payment_channel payment_channel,
                    t.amount_paid amount,
                    t.reference_no,
                    t.status
                FROM transactions t
                JOIN bills b ON b.id=t.bill_id
                JOIN students s ON s.id=t.student_id
                LEFT JOIN classes c ON c.id=s.class_id
                WHERE {$where}");
            $stmt->execute($params);
            $rows = array_merge($rows, $stmt->fetchAll());
        } else {
            $stmt = $pdo->prepare("SELECT
                    'income' report_type,
                    MIN(t.id) id,
                    NULL student_id,
                    DATE(t.payment_date) report_date,
                    '' student_name,
                    '' class_name,
                    COALESCE(fp.name, b.bill_name) item_name,
                    '' category,
                    t.payment_channel payment_channel,
                    SUM(t.amount_paid) amount,
                    '' reference_no,
                    t.status
                FROM transactions t
                JOIN bills b ON b.id=t.bill_id
                LEFT JOIN finance_posts fp ON fp.id=b.finance_post_id
                JOIN students s ON s.id=t.student_id
                LEFT JOIN classes c ON c.id=s.class_id
                WHERE {$where}
                GROUP BY DATE(t.payment_date), COALESCE(fp.name, b.bill_name), t.payment_channel, t.status");
            $stmt->execute($params);
            $rows = array_merge($rows, $stmt->fetchAll());
        }
    }

    if ($type !== 'income' && $studentId === '' && $classId === '') {
        $expenseStmt = $pdo->prepare("SELECT
                'expense' report_type,
                e.id,
                NULL student_id,
                e.expense_date report_date,
                '' student_name,
                '' class_name,
                e.title item_name,
                COALESCE(e.category, '') category,
                '' payment_channel,
                e.amount amount,
                '' reference_no,
                'recorded' status
            FROM expenses e
            WHERE DATE(e.expense_date) BETWEEN ? AND ?");
        $expenseStmt->execute([$start, $end]);
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
    $summary['openingBalance'] = calculate_reports_opening_balance($pdo, (string) $type, (string) $start, (string) $status, (string) $classId, (string) $studentId);
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
    if ($end < $start) response(['message' => 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai'], 422);
    $rows = [];
    $openingBalance = calculate_reports_opening_balance($pdo, (string) $type, (string) $start, (string) $status, (string) $classId, (string) $studentId);
    $reportHeader = build_reports_header((string) $start);

    if ($type !== 'expense') {
        $conditions = ['DATE(t.payment_date) BETWEEN ? AND ?'];
        $params = [$start, $end];
        if ($status) {
            $conditions[] = 't.status = ?';
            $params[] = $status;
        } elseif ($type === 'all') {
            // Mode bulanan = mutasi kas, default hanya transaksi lunas.
            $conditions[] = 't.status = ?';
            $params[] = 'paid';
        }
        if ($classId) {
            $conditions[] = 's.class_id = ?';
            $params[] = $classId;
        }
        if ($studentId) {
            $conditions[] = 't.student_id = ?';
            $params[] = $studentId;
        }
        $where = implode(' AND ', $conditions);

        if ($type === 'income') {
            $stmt = $pdo->prepare("SELECT
                    'Pemasukan' tipe,
                    t.payment_date tanggal,
                    s.name student_name,
                    c.name class_name,
                    b.bill_name item_name,
                    '' category,
                    t.payment_channel payment_channel,
                    t.amount_paid amount,
                    t.reference_no,
                    t.status
                FROM transactions t
                JOIN bills b ON b.id=t.bill_id
                JOIN students s ON s.id=t.student_id
                LEFT JOIN classes c ON c.id=s.class_id
                WHERE {$where}");
            $stmt->execute($params);
            $rows = array_merge($rows, $stmt->fetchAll());
        } else {
            $stmt = $pdo->prepare("SELECT
                    'Pemasukan' tipe,
                    DATE(t.payment_date) tanggal,
                    '' student_name,
                    '' class_name,
                    COALESCE(fp.name, b.bill_name) item_name,
                    '' category,
                    t.payment_channel payment_channel,
                    SUM(t.amount_paid) amount,
                    '' reference_no,
                    t.status
                FROM transactions t
                JOIN bills b ON b.id=t.bill_id
                LEFT JOIN finance_posts fp ON fp.id=b.finance_post_id
                JOIN students s ON s.id=t.student_id
                LEFT JOIN classes c ON c.id=s.class_id
                WHERE {$where}
                GROUP BY DATE(t.payment_date), COALESCE(fp.name, b.bill_name), t.payment_channel, t.status");
            $stmt->execute($params);
            $rows = array_merge($rows, $stmt->fetchAll());
        }
    }

    if ($type !== 'income' && $studentId === '' && $classId === '') {
        $expenseStmt = $pdo->prepare("SELECT
                'Pengeluaran' tipe,
                e.expense_date tanggal,
                '' student_name,
                '' class_name,
                e.title item_name,
                COALESCE(e.category, '') category,
                '' payment_channel,
                e.amount amount,
                '' reference_no,
                'recorded' status
            FROM expenses e
            WHERE DATE(e.expense_date) BETWEEN ? AND ?");
        $expenseStmt->execute([$start, $end]);
        $rows = array_merge($rows, $expenseStmt->fetchAll());
    }

    usort($rows, fn($a, $b) => strcmp((string) $b['tanggal'], (string) $a['tanggal']));
    if ($format === 'xls') {
        header('Content-Type: application/vnd.ms-excel; charset=utf-8');
        header('Content-Disposition: attachment; filename=laporan-keuangan.xls');

        $escape = function ($value) {
            return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
        };

        echo "<h3 style=\"margin:0 0 4px 0; text-align:center;\">" . $escape($reportHeader['title']) . "</h3>";
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
            exit;
        }

        echo "<table border=\"1\"><thead><tr>";
        foreach (['Tipe', 'Tanggal', 'Siswa', 'Kelas', 'Item', 'Kategori', 'Kanal', 'Nominal', 'Referensi', 'Status'] as $head) {
            echo "<th style=\"text-align:center;\">{$escape($head)}</th>";
        }
        echo "</tr></thead><tbody>";
        foreach ($rows as $row) {
            $statusLabel = $row['status'] === 'paid' ? 'Lunas' : ($row['status'] === 'pending' ? 'Menunggu' : ($row['status'] === 'recorded' ? 'Tercatat' : 'Gagal'));
            echo "<tr>";
            echo "<td style=\"text-align:left;\">{$escape($row['tipe'])}</td>";
            echo "<td style=\"text-align:center;\">{$escape($row['tanggal'])}</td>";
            echo "<td style=\"text-align:left;\">{$escape($row['student_name'])}</td>";
            echo "<td style=\"text-align:left;\">{$escape($row['class_name'])}</td>";
            echo "<td style=\"text-align:left;\">{$escape($row['item_name'])}</td>";
            echo "<td style=\"text-align:left;\">{$escape($row['category'])}</td>";
            echo "<td style=\"text-align:left;\">{$escape($row['payment_channel'])}</td>";
            echo "<td style=\"text-align:right;\">{$escape($row['amount'])}</td>";
            echo "<td style=\"text-align:center;\">{$escape($row['reference_no'])}</td>";
            echo "<td style=\"text-align:left;\">{$escape($statusLabel)}</td>";
            echo "</tr>";
        }
        echo "</tbody></table>";
        exit;
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=laporan-keuangan.csv');
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
        fputcsv($out, ['Tipe', 'Tanggal', 'Siswa', 'Kelas', 'Item', 'Kategori', 'Kanal', 'Nominal', 'Referensi', 'Status']);
        foreach ($rows as $row) {
            $statusLabel = $row['status'] === 'paid' ? 'Lunas' : ($row['status'] === 'pending' ? 'Menunggu' : ($row['status'] === 'recorded' ? 'Tercatat' : 'Gagal'));
            fputcsv($out, [$row['tipe'], $row['tanggal'], $row['student_name'], $row['class_name'], $row['item_name'], $row['category'], $row['payment_channel'], $row['amount'], $row['reference_no'], $statusLabel]);
        }
    }
    fclose($out);
    exit;
}
