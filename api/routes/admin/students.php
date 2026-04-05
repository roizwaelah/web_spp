<?php
// Route CRUD data siswa dan impor siswa.

if ($route === 'admin/students' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    $rows = $pdo->query("SELECT s.*, c.name class_name, ay.name academic_year,
            (SELECT COUNT(*) FROM bills b WHERE b.student_id=s.id AND b.status='unpaid') active_bills
        FROM students s
        LEFT JOIN classes c ON c.id=s.class_id
        LEFT JOIN academic_years ay ON ay.id=s.academic_year_id
        ORDER BY c.name ASC, s.name ASC, s.id ASC")->fetchAll();
    foreach ($rows as &$row) {
        $rawPhone = trim((string) ($row['parent_phone'] ?? ''));
        $normalizedPhone = normalize_wa_target($rawPhone);
        if ($normalizedPhone !== '') $row['parent_phone'] = $normalizedPhone;
    }
    unset($row);
    response($rows);
}

if ($route === 'admin/students' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    $input = json_input();
    ensure_required($input, ['nis', 'nisn', 'name', 'class_id', 'academic_year_id', 'parent_name', 'parent_phone']);

    if (scalar('SELECT id FROM students WHERE nis = ? LIMIT 1', [$input['nis']])) {
        response(['message' => 'NIS sudah digunakan siswa lain'], 422);
    }
    if (scalar('SELECT id FROM students WHERE nisn = ? LIMIT 1', [$input['nisn']])) {
        response(['message' => 'NISN sudah digunakan siswa lain'], 422);
    }

    $parentPhoneInput = trim((string) ($input['parent_phone'] ?? ''));
    $parentPhoneClean = preg_replace('/[\s\-().]+/', '', $parentPhoneInput) ?? '';
    $parentPhone = normalize_wa_target($parentPhoneClean);
    $isValidParentPhone = $parentPhone !== ''
        && preg_match('/^\d+$/', $parentPhone)
        && strlen($parentPhone) >= 10
        && strlen($parentPhone) <= 16
        && (str_starts_with($parentPhoneClean, '0')
            || str_starts_with($parentPhoneClean, '+62')
            || str_starts_with($parentPhoneClean, '62'));
    if (!$isValidParentPhone) {
        response(['message' => 'Nomor HP orang tua tidak valid. Gunakan awalan 0 atau +62.'], 422);
    }

    $stmt = $pdo->prepare("INSERT INTO students (nis, nisn, name, class_id, academic_year_id, parent_name, parent_phone, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        $input['nis'], $input['nisn'], $input['name'], $input['class_id'], $input['academic_year_id'],
        $input['parent_name'], $parentPhone,
        $input['address'] ?? null, $input['status'] ?? 'active'
    ]);
    $studentId = (int) $pdo->lastInsertId();

    $userStmt = $pdo->prepare("INSERT INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
    $userStmt->execute([
        $input['parent_name'],
        parent_login_email_for_student(['id' => $studentId, 'nis' => $input['nis'], 'nisn' => $input['nisn']]),
        password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
        $studentId
    ]);

    log_activity((int) $user['id'], 'create', 'student', $studentId, 'Menambah siswa ' . $input['name']);
    response(['message' => 'Siswa berhasil ditambahkan']);
}

if ($route === 'admin/students' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    $input = json_input();
    ensure_required($input, ['id', 'nis', 'nisn', 'name', 'class_id', 'academic_year_id', 'parent_name', 'parent_phone']);

    if (!scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data siswa tidak ditemukan'], 404);
    }
    if (scalar('SELECT id FROM students WHERE nis = ? AND id <> ? LIMIT 1', [$input['nis'], $input['id']])) {
        response(['message' => 'NIS sudah digunakan siswa lain'], 422);
    }
    if (scalar('SELECT id FROM students WHERE nisn = ? AND id <> ? LIMIT 1', [$input['nisn'], $input['id']])) {
        response(['message' => 'NISN sudah digunakan siswa lain'], 422);
    }

    $parentPhoneInput = trim((string) ($input['parent_phone'] ?? ''));
    $parentPhoneClean = preg_replace('/[\s\-().]+/', '', $parentPhoneInput) ?? '';
    $parentPhone = normalize_wa_target($parentPhoneClean);
    $isValidParentPhone = $parentPhone !== ''
        && preg_match('/^\d+$/', $parentPhone)
        && strlen($parentPhone) >= 10
        && strlen($parentPhone) <= 16
        && (str_starts_with($parentPhoneClean, '0')
            || str_starts_with($parentPhoneClean, '+62')
            || str_starts_with($parentPhoneClean, '62'));
    if (!$isValidParentPhone) {
        response(['message' => 'Nomor HP orang tua tidak valid. Gunakan awalan 0 atau +62.'], 422);
    }

    $stmt = $pdo->prepare("UPDATE students SET nis=?, nisn=?, name=?, class_id=?, academic_year_id=?, parent_name=?, parent_phone=?, address=?, status=? WHERE id=?");
    $stmt->execute([
        $input['nis'], $input['nisn'], $input['name'], $input['class_id'], $input['academic_year_id'],
        $input['parent_name'], $parentPhone,
        $input['address'] ?? null, $input['status'] ?? 'active', $input['id']
    ]);
    $parentUser = parent_user_by_student_id((int) $input['id']);
    if ($parentUser) {
        $u = $pdo->prepare("UPDATE users SET name=?, email=? WHERE id=?");
        $u->execute([
            $input['parent_name'],
            parent_login_email_for_student(['id' => $input['id'], 'nis' => $input['nis'], 'nisn' => $input['nisn']]),
            $parentUser['id']
        ]);
    } else {
        $u = $pdo->prepare("INSERT INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
        $u->execute([
            $input['parent_name'],
            parent_login_email_for_student(['id' => $input['id'], 'nis' => $input['nis'], 'nisn' => $input['nisn']]),
            password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
            $input['id']
        ]);
    }
    log_activity((int) $user['id'], 'update', 'student', (int) $input['id'], 'Memperbarui siswa ' . $input['name']);
    response(['message' => 'Siswa berhasil diperbarui']);
}

if ($route === 'admin/students' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['students'], ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    if (!scalar('SELECT id FROM students WHERE id = ? LIMIT 1', [$input['id']])) {
        response(['message' => 'Data siswa tidak ditemukan'], 404);
    }
    $pdo->prepare("DELETE FROM users WHERE student_id=? AND role='parent'")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM payment_proofs WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM notifications WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM transactions WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM bills WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM students WHERE id=?")->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'student', (int) $input['id'], 'Menghapus siswa');
    response(['message' => 'Siswa berhasil dihapus']);
}

if ($route === 'admin/students/template' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    if (!class_exists('PhpOffice\PhpSpreadsheet\Spreadsheet')) {
        response(['message' => 'Library Excel belum tersedia'], 422);
    }

    $spreadsheet = new PhpOffice\PhpSpreadsheet\Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Template Siswa');

    $headers = ['nis', 'nisn', 'nama_siswa', 'kelas', 'tahun_ajaran', 'nama_orang_tua', 'no_hp_orang_tua', 'alamat', 'status'];
    $sheet->fromArray($headers, null, 'A1');
    $sheet->fromArray(['', '0087654321', 'Ahmad Fauzi', 'Kelas 10 A', '2026/2027', 'Bapak Fauzi', '081234567890', 'Jl. Contoh No. 1', 'active'], null, 'A2');

    foreach (range('A', 'I') as $column) {
        $sheet->getColumnDimension($column)->setAutoSize(true);
    }

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename=template-import-siswa.xlsx');
    header('Cache-Control: max-age=0');

    $writer = new PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;
}

if ($route === 'admin/students/import' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['students']);
    if (empty($_FILES['file']['tmp_name'])) {
        response([
            'message' => 'File tidak ditemukan',
            'validation_errors' => [[
                'row' => '-',
                'column' => 'file',
                'message' => 'File import belum dipilih.',
                'value' => '',
            ]],
        ], 422);
    }
    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));

    $normalizeHeader = static function ($value): string {
        $key = trim((string) $value);
        $key = preg_replace('/^\xEF\xBB\xBF/u', '', $key);
        $key = strtolower($key);
        $key = str_replace([' ', '-', '/'], '_', $key);
        return trim($key, "_ \t\n\r\0\x0B");
    };

    $combineRow = static function (array $headers, array $line): array {
        $headerCount = count($headers);
        $lineCount = count($line);
        if ($lineCount < $headerCount) {
            $line = array_pad($line, $headerCount, null);
        } elseif ($lineCount > $headerCount) {
            $line = array_slice($line, 0, $headerCount);
        }
        $mapped = array_combine($headers, $line);
        return is_array($mapped) ? $mapped : [];
    };

    $rows = [];
    if (in_array($ext, ['xlsx', 'xls'], true)) {
        if (!class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) {
            response([
                'message' => 'Jalankan composer install untuk impor Excel',
                'validation_errors' => [[
                    'row' => '-',
                    'column' => 'system',
                    'message' => 'Library PhpSpreadsheet belum terpasang.',
                    'value' => '',
                ]],
            ], 422);
        }
        try {
            set_error_handler(static function ($severity, $errorMessage, $errorFile, $errorLine) {
                throw new RuntimeException("{$errorMessage} ({$errorFile}:{$errorLine})");
            });
            try {
                $spreadsheet = PhpOffice\PhpSpreadsheet\IOFactory::load($_FILES['file']['tmp_name']);
            } finally {
                restore_error_handler();
            }
        } catch (Throwable $e) {
            response([
                'message' => 'File Excel tidak valid/korup atau formatnya tidak sesuai. Gunakan file Template resmi.',
                'detail' => $e->getMessage(),
                'validation_errors' => [[
                    'row' => '-',
                    'column' => 'file',
                    'message' => 'File tidak bisa dibaca sebagai Excel valid.',
                    'value' => $_FILES['file']['name'] ?? '',
                ]],
            ], 422);
        }

        $sheet = $spreadsheet->getActiveSheet()->toArray(null, true, true, false);
        $headersRaw = $sheet[0] ?? [];
        if (!is_array($headersRaw) || count($headersRaw) === 0) {
            response([
                'message' => 'Header file Excel tidak valid',
                'validation_errors' => [[
                    'row' => 1,
                    'column' => 'header',
                    'message' => 'Baris header kosong atau tidak terbaca.',
                    'value' => '',
                ]],
            ], 422);
        }
        $headers = array_map($normalizeHeader, $headersRaw);
        unset($sheet[0]);
        foreach ($sheet as $line) {
            if (!is_array($line)) continue;
            $rows[] = $combineRow($headers, $line);
        }
    } else {
        response([
            'message' => 'Format file tidak didukung. Gunakan XLSX/XLS',
            'validation_errors' => [[
                'row' => '-',
                'column' => 'file',
                'message' => 'Ekstensi file tidak didukung.',
                'value' => $_FILES['file']['name'] ?? '',
            ]],
        ], 422);
    }

    $classRows = $pdo->query('SELECT id, name FROM classes')->fetchAll();
    $academicYearRows = $pdo->query('SELECT id, name FROM academic_years')->fetchAll();
    $normalizeText = static function (string $value): string {
        $value = strtolower(trim($value));
        $value = preg_replace('/[^a-z0-9]+/i', ' ', $value);
        return trim(preg_replace('/\s+/', ' ', (string) $value));
    };
    $romanToInt = static function (string $roman): ?int {
        $roman = strtoupper(trim($roman));
        if ($roman === '' || !preg_match('/^[IVXLCDM]+$/', $roman)) return null;
        $map = ['I' => 1, 'V' => 5, 'X' => 10, 'L' => 50, 'C' => 100, 'D' => 500, 'M' => 1000];
        $sum = 0;
        $prev = 0;
        for ($i = strlen($roman) - 1; $i >= 0; $i--) {
            $val = $map[$roman[$i]] ?? 0;
            if ($val < $prev) $sum -= $val;
            else $sum += $val;
            $prev = $val;
        }
        return $sum > 0 ? $sum : null;
    };
    $normalizeClassForCompare = static function (string $value) use ($romanToInt): string {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace_callback('/\b([ivxlcdm]+)\b/i', static function ($matches) use ($romanToInt) {
            $n = $romanToInt($matches[1]);
            return $n !== null ? (string) $n : $matches[1];
        }, $normalized);
        $normalized = preg_replace('/[^a-z0-9]+/i', ' ', (string) $normalized);
        return trim(preg_replace('/\s+/', ' ', (string) $normalized));
    };
    $tokenizeText = static function (string $value): array {
        $normalized = preg_replace('/[^a-z0-9]+/i', ' ', strtolower($value));
        $parts = preg_split('/\s+/', trim((string) $normalized)) ?: [];
        return array_values(array_filter($parts, static fn($token) => $token !== ''));
    };
    $resolveClassId = static function (string $rawClassName, array $classes) use ($normalizeClassForCompare, $tokenizeText): ?int {
        $input = $normalizeClassForCompare($rawClassName);
        if ($input === '') return null;

        $inputTokens = $tokenizeText($rawClassName);
        $genericTokens = ['kelas', 'class'];
        $filteredInputTokens = array_values(array_filter($inputTokens, static fn($t) => !in_array($t, $genericTokens, true)));

        $bestId = null;
        $bestScore = 0;
        $isTie = false;
        foreach ($classes as $class) {
            $className = (string) ($class['name'] ?? '');
            $classNorm = $normalizeClassForCompare($className);
            if ($classNorm === '') continue;

            $score = 0;
            if ($classNorm === $input) {
                $score += 100;
            } elseif (str_contains($input, $classNorm) || str_contains($classNorm, $input)) {
                $score += 60;
            }

            $classTokens = $tokenizeText($classNorm);
            $filteredClassTokens = array_values(array_filter($classTokens, static fn($t) => !in_array($t, $genericTokens, true)));
            $tokenHits = array_values(array_intersect($filteredInputTokens, $filteredClassTokens));
            if (!empty($tokenHits)) {
                $score += count($tokenHits) * 12;
                foreach ($tokenHits as $hit) {
                    if (preg_match('/\d/', $hit)) {
                        $score += 10;
                        break;
                    }
                }
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestId = (int) $class['id'];
                $isTie = false;
            } elseif ($score > 0 && $score === $bestScore) {
                $isTie = true;
            }
        }

        if ($bestScore <= 0 || $isTie) return null;
        return $bestId;
    };
    $normalizeYearText = static function (string $value): string {
        $value = strtolower(trim($value));
        $value = str_replace(['tahun ajaran', 'ta', 't.a', 'tahun'], '', $value);
        $value = preg_replace('/[^0-9]+/i', '', $value);
        return (string) $value;
    };
    $parseAcademicYear = static function (string $value): ?array {
        preg_match_all('/\d{4}/', $value, $matches);
        $years = $matches[0] ?? [];
        if (count($years) < 2) return null;
        $start = (int) $years[0];
        $end = (int) $years[1];
        if ($start < 1900 || $end < 1900) return null;
        if ($end !== $start + 1) return null;
        return [$start, $end];
    };
    $resolveAcademicYearId = static function (string $rawYear, array $years) use ($normalizeText, $tokenizeText, $normalizeYearText): ?int {
        $inputNorm = $normalizeText($rawYear);
        if ($inputNorm === '') return null;
        $inputCompactYear = $normalizeYearText($rawYear);
        $inputTokens = $tokenizeText($rawYear);

        $bestId = null;
        $bestScore = 0;
        $isTie = false;
        foreach ($years as $year) {
            $yearName = (string) ($year['name'] ?? '');
            $yearNorm = $normalizeText($yearName);
            if ($yearNorm === '') continue;

            $score = 0;
            if ($yearNorm === $inputNorm) {
                $score += 100;
            } elseif (str_contains($inputNorm, $yearNorm) || str_contains($yearNorm, $inputNorm)) {
                $score += 60;
            }

            $yearCompact = $normalizeYearText($yearName);
            if ($inputCompactYear !== '' && $yearCompact !== '') {
                if ($inputCompactYear === $yearCompact) {
                    $score += 90;
                } elseif (str_contains($inputCompactYear, $yearCompact) || str_contains($yearCompact, $inputCompactYear)) {
                    $score += 50;
                }
            }

            $yearTokens = $tokenizeText($yearName);
            $tokenHits = array_values(array_intersect($inputTokens, $yearTokens));
            if (!empty($tokenHits)) {
                $score += count($tokenHits) * 12;
                foreach ($tokenHits as $hit) {
                    if (preg_match('/^\d+$/', $hit)) {
                        $score += 10;
                        break;
                    }
                }
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestId = (int) $year['id'];
                $isTie = false;
            } elseif ($score > 0 && $score === $bestScore) {
                $isTie = true;
            }
        }

        if ($bestScore <= 0 || $isTie) return null;
        return $bestId;
    };

    $imported = 0;
    $skippedEmptyName = 0;
    $skippedDuplicateNis = 0;
    $skippedInvalidNisn = 0;
    $skippedEmptyClass = 0;
    $skippedInvalidYear = 0;
    $skippedInvalidParentName = 0;
    $skippedInvalidParentPhone = 0;
    $skippedInvalidStatus = 0;
    $validationErrors = [];
    foreach ($rows as $index => $row) {
        $excelRow = $index + 2;
        $name = trim((string) ($row['name'] ?? $row['nama_siswa'] ?? $row['nama'] ?? ''));
        if ($name === '') {
            $skippedEmptyName++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'nama_siswa',
                    'message' => 'Kolom nama siswa kosong atau tidak ditemukan.',
                    'value' => '',
                ];
            }
            continue;
        }

        $nis = trim((string) ($row['nis'] ?? $row['NIS'] ?? ''));
        if ($nis === '') $nis = '-';

        $className = trim((string) ($row['class_name'] ?? $row['kelas'] ?? 'Kelas Baru'));
        if ($className === '') {
            $skippedEmptyClass++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'kelas',
                    'message' => 'Kolom kelas wajib diisi.',
                    'value' => '',
                ];
            }
            continue;
        }

        $rawYearName = trim((string) ($row['academic_year'] ?? $row['tahun_ajaran'] ?? ''));
        if ($rawYearName === '') {
            $skippedInvalidYear++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'tahun_ajaran',
                    'message' => 'Kolom tahun ajaran wajib diisi.',
                    'value' => '',
                ];
            }
            continue;
        } else {
            $parsedYear = $parseAcademicYear($rawYearName);
            if (!$parsedYear) {
                $skippedInvalidYear++;
                if (count($validationErrors) < 200) {
                    $validationErrors[] = [
                        'row' => $excelRow,
                        'column' => 'tahun_ajaran',
                        'message' => 'Format Tahun Ajaran tidak valid. Gunakan format seperti 2026/2027.',
                        'value' => $rawYearName,
                    ];
                }
                continue;
            }
            $yearName = $parsedYear[0] . '/' . $parsedYear[1];
        }

        $classId = $resolveClassId($className, $classRows);
        if (!$classId) {
            $classId = scalar('SELECT id FROM classes WHERE name = ? LIMIT 1', [$className]);
        }
        if (!$classId) {
            $stmt = $pdo->prepare('INSERT INTO classes (name, is_active) VALUES (?, 1)');
            $stmt->execute([$className]);
            $classId = (int) $pdo->lastInsertId();
            $classRows[] = ['id' => $classId, 'name' => $className];
        }

        $yearId = $resolveAcademicYearId($yearName, $academicYearRows);
        if (!$yearId) {
            $yearId = scalar('SELECT id FROM academic_years WHERE name = ? LIMIT 1', [$yearName]);
        }
        if (!$yearId) {
            $stmt = $pdo->prepare('INSERT INTO academic_years (name, is_active, created_at) VALUES (?, 0, NOW())');
            $stmt->execute([$yearName]);
            $yearId = (int) $pdo->lastInsertId();
            $academicYearRows[] = ['id' => $yearId, 'name' => $yearName];
        }

        $exists = scalar('SELECT id FROM students WHERE nis = ? LIMIT 1', [$nis]);
        if ($exists && $nis !== '-') {
            $skippedDuplicateNis++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'nis',
                    'message' => 'NIS sudah terdaftar di database.',
                    'value' => $nis,
                ];
            }
            continue;
        }

        $rawNisn = trim((string) ($row['nisn'] ?? $row['NISN'] ?? ''));
        if ($rawNisn === '') {
            $skippedInvalidNisn++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'nisn',
                    'message' => 'Kolom NISN wajib diisi.',
                    'value' => '',
                ];
            }
            continue;
        }
        $nisn = $rawNisn;
        if (!preg_match('/^\d{10}$/', $nisn)) {
            $skippedInvalidNisn++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'nisn',
                    'message' => 'Format NISN tidak valid (harus 10 digit angka).',
                    'value' => $nisn,
                ];
            }
            continue;
        }
        if (scalar('SELECT id FROM students WHERE nisn = ? LIMIT 1', [$nisn])) {
            $skippedInvalidNisn++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'nisn',
                    'message' => 'NISN sudah terdaftar di database.',
                    'value' => $nisn,
                ];
            }
            continue;
        }

        $parentName = trim((string) ($row['parent_name'] ?? $row['nama_orang_tua'] ?? ''));
        if ($parentName === '' || !preg_match("/^[\p{L} .'-]+$/u", $parentName)) {
            $skippedInvalidParentName++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'nama_orang_tua',
                    'message' => 'Nama orang tua wajib huruf (boleh spasi/titik/petik).',
                    'value' => $parentName,
                ];
            }
            continue;
        }

        $parentPhoneRaw = trim((string) ($row['parent_phone'] ?? $row['no_hp_orang_tua'] ?? ''));
        $parentPhoneNormalizedInput = preg_replace('/[\s\-().]+/', '', $parentPhoneRaw) ?? '';
        $parentPhone = normalize_wa_target($parentPhoneNormalizedInput);
        $isValidParentPhone = $parentPhone !== ''
            && preg_match('/^\d+$/', $parentPhone)
            && strlen($parentPhone) >= 10
            && strlen($parentPhone) <= 16
            && (str_starts_with($parentPhoneNormalizedInput, '0')
                || str_starts_with($parentPhoneNormalizedInput, '+62')
                || str_starts_with($parentPhoneNormalizedInput, '62'));
        if (!$isValidParentPhone) {
            $skippedInvalidParentPhone++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'no_hp_orang_tua',
                    'message' => 'Nomor HP orang tua tidak valid. Gunakan awalan 0 atau +62 (contoh: 081234567890 / +6281234567890).',
                    'value' => $parentPhoneRaw,
                ];
            }
            continue;
        }

        $address = trim((string) ($row['address'] ?? $row['alamat'] ?? ''));
        if ($address === '') $address = null;

        $rawStatus = strtolower(trim((string) ($row['status'] ?? 'active')));
        if (in_array($rawStatus, ['active', 'aktif'], true)) {
            $status = 'active';
        } elseif (in_array($rawStatus, ['inactive', 'nonaktif'], true)) {
            $status = 'inactive';
        } else {
            $skippedInvalidStatus++;
            if (count($validationErrors) < 200) {
                $validationErrors[] = [
                    'row' => $excelRow,
                    'column' => 'status',
                    'message' => 'Status tidak valid. Gunakan active/aktif atau inactive/nonaktif.',
                    'value' => $rawStatus,
                ];
            }
            continue;
        }

        $stmt = $pdo->prepare("INSERT INTO students (nis, nisn, name, class_id, academic_year_id, parent_name, parent_phone, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            $nis, $nisn, $name, $classId, $yearId, $parentName,
            $parentPhone,
            $address, $status
        ]);
        $studentId = (int) $pdo->lastInsertId();
        $userStmt = $pdo->prepare("INSERT IGNORE INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
        $userStmt->execute([
            $parentName !== '-' ? $parentName : 'Orang Tua',
            parent_login_email_for_student(['id' => $studentId, 'nis' => $nis, 'nisn' => $nisn]),
            password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
            $studentId
        ]);
        $imported++;
    }

    $totalRows = count($rows);
    $skippedTotal = $totalRows - $imported;
    if ($imported <= 0) {
        response([
            'message' => "Impor gagal. Tidak ada data yang tersimpan. Total baris: {$totalRows}, dilewati: {$skippedTotal} (nama kosong: {$skippedEmptyName}, NIS duplikat: {$skippedDuplicateNis}).",
            'summary' => [
                'total' => $totalRows,
                'imported' => $imported,
                'skipped' => $skippedTotal,
                'skipped_empty_name' => $skippedEmptyName,
                'skipped_duplicate_nis' => $skippedDuplicateNis,
                'skipped_invalid_nisn' => $skippedInvalidNisn,
                'skipped_empty_class' => $skippedEmptyClass,
                'skipped_invalid_year' => $skippedInvalidYear,
                'skipped_invalid_parent_name' => $skippedInvalidParentName,
                'skipped_invalid_parent_phone' => $skippedInvalidParentPhone,
                'skipped_invalid_status' => $skippedInvalidStatus,
            ],
            'validation_errors' => $validationErrors,
        ], 422);
    }

    log_activity((int) $user['id'], 'import', 'student', null, 'Impor siswa sebanyak ' . $imported);
    response([
        'message' => "Impor berhasil. {$imported} siswa ditambahkan, {$skippedTotal} baris dilewati.",
        'summary' => [
            'total' => $totalRows,
            'imported' => $imported,
            'skipped' => $skippedTotal,
            'skipped_empty_name' => $skippedEmptyName,
            'skipped_duplicate_nis' => $skippedDuplicateNis,
            'skipped_invalid_nisn' => $skippedInvalidNisn,
            'skipped_empty_class' => $skippedEmptyClass,
            'skipped_invalid_year' => $skippedInvalidYear,
            'skipped_invalid_parent_name' => $skippedInvalidParentName,
            'skipped_invalid_parent_phone' => $skippedInvalidParentPhone,
            'skipped_invalid_status' => $skippedInvalidStatus,
        ],
        'validation_errors' => $validationErrors,
    ]);
}
