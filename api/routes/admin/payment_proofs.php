<?php
// Route verifikasi bukti pembayaran dan file proof.

if (!function_exists('payment_proof_requested_scope')) {
    function payment_proof_requested_scope(array $input): string
    {
        $scope = strtolower(trim((string) ($input['proof_scope'] ?? $input['scope'] ?? '')));
        if (in_array($scope, ['group', 'groups', 'payment_proof_group', 'payment_proof_groups'], true)) return 'group';
        if (in_array($scope, ['legacy', 'payment_proof', 'payment_proofs'], true)) return 'legacy';

        if (array_key_exists('is_group', $input)) {
            $isGroup = strtolower(trim((string) $input['is_group']));
            if (in_array($isGroup, ['1', 'true', 'yes', 'group'], true)) return 'group';
        }

        return 'legacy';
    }
}

if (!function_exists('payment_proof_groups_available')) {
    function payment_proof_groups_available(PDO $pdo): bool
    {
        static $available = null;
        if ($available !== null) return $available;

        try {
            $groupTable = $pdo->query("SHOW TABLES LIKE 'payment_proof_groups'")->fetchColumn();
            $itemTable = $pdo->query("SHOW TABLES LIKE 'payment_proof_group_items'")->fetchColumn();
            if (!$groupTable || !$itemTable) return $available = false;

            $required = [
                'payment_proof_groups' => ['id', 'student_id', 'reference_no', 'proof_file_name', 'proof_path', 'mime_type', 'size_bytes', 'status', 'notes', 'reviewed_by', 'reviewed_at', 'created_at'],
                'payment_proof_group_items' => ['id', 'group_id', 'bill_id', 'amount', 'created_at'],
            ];
            foreach ($required as $table => $columns) {
                $rows = $pdo->query("SHOW COLUMNS FROM {$table}")->fetchAll(PDO::FETCH_COLUMN);
                foreach ($columns as $column) {
                    if (!in_array($column, $rows, true)) return $available = false;
                }
            }
            return $available = true;
        } catch (Throwable $e) {
            return $available = false;
        }
    }
}

if (!function_exists('payment_proof_path_usage_count')) {
    function payment_proof_path_usage_count(PDO $pdo, string $proofPath): int
    {
        if ($proofPath === '') return 0;
        $legacyCount = (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE proof_path = ?", [$proofPath]);
        $groupCount = payment_proof_groups_available($pdo)
            ? (int) scalar("SELECT COUNT(*) FROM payment_proof_groups WHERE proof_path = ?", [$proofPath])
            : 0;
        return $legacyCount + $groupCount;
    }
}

if ($route === 'admin/payment-proofs' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    $status = query('status', '');
    $classId = query('class_id', '');
    $studentId = query('student_id', '');
    $groupConditions = [];
    $legacyConditions = [];
    $groupParams = [];
    $legacyParams = [];
    if ($status) {
        $groupConditions[] = 'ppg.status = ?';
        $legacyConditions[] = 'pp.status = ?';
        $groupParams[] = $status;
        $legacyParams[] = $status;
    }
    if ($classId) {
        $groupConditions[] = 's.class_id = ?';
        $legacyConditions[] = 's.class_id = ?';
        $groupParams[] = $classId;
        $legacyParams[] = $classId;
    }
    if ($studentId) {
        $groupConditions[] = 'ppg.student_id = ?';
        $legacyConditions[] = 'pp.student_id = ?';
        $groupParams[] = $studentId;
        $legacyParams[] = $studentId;
    }
    $groupWhere = $groupConditions ? ('WHERE ' . implode(' AND ', $groupConditions)) : '';
    $legacyWhere = $legacyConditions ? ('WHERE ' . implode(' AND ', $legacyConditions)) : '';

    $legacySql = "SELECT
            pp.id,
            pp.bill_id,
            pp.student_id,
            pp.proof_file_name,
            pp.proof_path,
            pp.mime_type,
            pp.size_bytes,
            pp.status,
            pp.notes,
            pp.reviewed_by,
            pp.reviewed_at,
            pp.created_at,
            NULL AS reference_no,
            s.name AS student_name,
            s.nis,
            c.name AS class_name,
            b.bill_name,
            b.period,
            b.amount,
            b.status AS bill_status,
            1 AS bill_count,
            CONCAT(b.bill_name, ' (', b.period, ')') AS bill_summary,
            COALESCE(NULLIF(b.remaining_amount, 0), b.amount, 0) AS total_amount,
            0 AS is_group,
            'legacy' AS proof_scope,
            pp.id AS proof_id
        FROM payment_proofs pp
        JOIN students s ON s.id = pp.student_id
        LEFT JOIN classes c ON c.id = s.class_id
        JOIN bills b ON b.id = pp.bill_id
        {$legacyWhere}";

    if (payment_proof_groups_available($pdo)) {
        $groupStmt = $pdo->prepare("SELECT
                ppg.id,
                MIN(b.id) AS bill_id,
                ppg.student_id,
                ppg.proof_file_name,
                ppg.proof_path,
                ppg.mime_type,
                ppg.size_bytes,
                ppg.status,
                ppg.notes,
                ppg.reviewed_by,
                ppg.reviewed_at,
                ppg.created_at,
                ppg.reference_no,
                s.name AS student_name,
                s.nis,
                c.name AS class_name,
                CASE WHEN COUNT(ppgi.id) = 1 THEN MAX(b.bill_name) ELSE CONCAT(COUNT(ppgi.id), ' tagihan') END AS bill_name,
                CASE WHEN COUNT(ppgi.id) = 1 THEN MAX(b.period) ELSE GROUP_CONCAT(DISTINCT b.period ORDER BY b.period SEPARATOR ', ') END AS period,
                SUM(COALESCE(NULLIF(ppgi.amount, 0), NULLIF(b.remaining_amount, 0), b.amount, 0)) AS amount,
                CASE
                    WHEN SUM(CASE WHEN b.status <> 'paid' THEN 1 ELSE 0 END) = 0 THEN 'paid'
                    WHEN SUM(CASE WHEN b.status = 'partial' THEN 1 ELSE 0 END) > 0 THEN 'partial'
                    ELSE 'unpaid'
                END AS bill_status,
                COUNT(ppgi.id) AS bill_count,
                GROUP_CONCAT(CONCAT(b.bill_name, ' (', b.period, ')') ORDER BY b.period, b.id SEPARATOR ', ') AS bill_summary,
                SUM(COALESCE(NULLIF(ppgi.amount, 0), NULLIF(b.remaining_amount, 0), b.amount, 0)) AS total_amount,
                1 AS is_group,
                'group' AS proof_scope,
                ppg.id AS proof_id
            FROM payment_proof_groups ppg
            JOIN payment_proof_group_items ppgi ON ppgi.group_id = ppg.id
            JOIN bills b ON b.id = ppgi.bill_id
            JOIN students s ON s.id = ppg.student_id
            LEFT JOIN classes c ON c.id = s.class_id
            {$groupWhere}
            GROUP BY ppg.id, ppg.student_id, ppg.proof_file_name, ppg.proof_path, ppg.mime_type, ppg.size_bytes, ppg.status,
                ppg.notes, ppg.reviewed_by, ppg.reviewed_at, ppg.created_at, ppg.reference_no, s.name, s.nis, c.name");
        $groupStmt->execute($groupParams);

        $legacyStmt = $pdo->prepare($legacySql);
        $legacyStmt->execute($legacyParams);
        $rows = array_merge($groupStmt->fetchAll(), $legacyStmt->fetchAll());
        usort($rows, function (array $a, array $b): int {
            $dateCompare = strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? ''));
            if ($dateCompare !== 0) return $dateCompare;
            return ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0));
        });
    } else {
        $stmt = $pdo->prepare("SELECT * FROM ({$legacySql}) proof_rows ORDER BY created_at DESC, id DESC");
        $stmt->execute($legacyParams);
        $rows = $stmt->fetchAll();
    }
    response($rows);
}
if ($route === 'admin/payment-proofs/pending-count' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    response([
        'pending_count' => (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE status = 'pending'")
            + (payment_proof_groups_available($pdo) ? (int) scalar("SELECT COUNT(*) FROM payment_proof_groups WHERE status = 'pending'") : 0),
    ]);
}

if ($route === 'admin/payment-proofs/file' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    $proofId = (int) query('id', 0);
    if ($proofId <= 0) response(['message' => 'ID bukti pembayaran wajib diisi'], 422);

    $scope = payment_proof_requested_scope([
        'proof_scope' => query('proof_scope', query('scope', '')),
        'is_group' => query('is_group', ''),
    ]);
    if ($scope === 'group' && !payment_proof_groups_available($pdo)) response(['message' => 'Bukti tidak ditemukan'], 404);
    $table = $scope === 'group' ? 'payment_proof_groups' : 'payment_proofs';
    $stmt = $pdo->prepare("SELECT proof_file_name, proof_path, mime_type FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$proofId]);
    $proof = $stmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if (!$proof['proof_path'] || !file_exists($proof['proof_path'])) response(['message' => 'File bukti tidak ditemukan'], 404);

    $proofDir = API_ROOT . '/storage/payment-proofs';
    if (!is_path_inside_dir((string) $proof['proof_path'], $proofDir)) {
        response(['message' => 'Akses file tidak valid'], 403);
    }

    $storedMimeType = trim((string) ($proof['mime_type'] ?? ''));
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $detectedMimeType = $finfo ? trim((string) finfo_file($finfo, (string) $proof['proof_path'])) : '';
    if ($finfo) finfo_close($finfo);

    $mimeType = $detectedMimeType !== '' ? $detectedMimeType : ($storedMimeType !== '' ? $storedMimeType : 'application/octet-stream');
    $safeFileName = sanitize_filename((string) ($proof['proof_file_name'] ?: 'proof-file'));
    $isInlineAllowed = in_array($mimeType, ['application/pdf', 'image/jpeg', 'image/png'], true);
    $disposition = $isInlineAllowed ? 'inline' : 'attachment';
    $fileSize = (int) filesize((string) $proof['proof_path']);

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    header('Content-Type: ' . $mimeType);
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    header('Content-Transfer-Encoding: binary');
    if ($fileSize > 0) {
        header('Content-Length: ' . $fileSize);
    }
    header('Content-Disposition: ' . $disposition . '; filename="' . basename($safeFileName) . '"');
    readfile((string) $proof['proof_path']);
    exit;
}

if ($route === 'admin/payment-proofs/review' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['payment_proofs']);
    $input = json_input();
    ensure_required($input, ['proof_id', 'status']);
    if (!in_array($input['status'], ['approved', 'rejected'], true)) response(['message' => 'Status review tidak valid'], 422);
    if ($input['status'] === 'rejected' && trim((string) ($input['notes'] ?? '')) === '') {
        response(['message' => 'Alasan penolakan wajib diisi'], 422);
    }

    $scope = payment_proof_requested_scope($input);
    if ($scope === 'group') {
        if (!payment_proof_groups_available($pdo)) response(['message' => 'Bukti tidak ditemukan'], 404);
        $proofStmt = $pdo->prepare("SELECT ppg.*, s.parent_phone, s.name student_name
            FROM payment_proof_groups ppg
            JOIN students s ON s.id = ppg.student_id
            WHERE ppg.id = ? LIMIT 1");
        $proofStmt->execute([$input['proof_id']]);
        $proof = $proofStmt->fetch();
        if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
        if ($proof['status'] !== 'pending') response(['message' => 'Bukti pembayaran ini sudah direview'], 422);

        $itemsStmt = $pdo->prepare("SELECT ppgi.*, b.status bill_status, b.amount bill_amount, b.remaining_amount, b.bill_name, b.period
            FROM payment_proof_group_items ppgi
            JOIN bills b ON b.id = ppgi.bill_id
            WHERE ppgi.group_id = ?
            ORDER BY b.due_date IS NULL, b.due_date ASC, b.id ASC");
        $itemsStmt->execute([$input['proof_id']]);
        $items = $itemsStmt->fetchAll();
        if (!$items) response(['message' => 'Bukti pembayaran tidak memiliki item tagihan'], 422);

        if ($input['status'] === 'approved') {
            $paidBills = [];
            foreach ($items as $item) {
                if (($item['bill_status'] ?? '') === 'paid') $paidBills[] = (string) $item['bill_name'];
            }
            if ($paidBills) {
                response(['message' => 'Sebagian tagihan sudah lunas: ' . implode(', ', $paidBills)], 422);
            }
        }

        $receiptQueued = false;
        $shouldQueueReceipt = false;
        $referenceNo = trim((string) ($proof['reference_no'] ?? ''));
        $totalAmount = 0.0;
        $billSummary = count($items) === 1 ? (string) ($items[0]['bill_name'] ?? 'tagihan') : count($items) . ' tagihan';
        $officerName = strtoupper(trim((string) ($user['name'] ?? 'ADMIN')));
        if ($officerName === '') $officerName = 'ADMIN';

        $pdo->beginTransaction();
        try {
            if ($input['status'] === 'approved') {
                if ($referenceNo === '') $referenceNo = create_manual_payment_reference(date('Y-m-d'));
                $stmt = $pdo->prepare("UPDATE payment_proof_groups SET status=?, reviewed_by=?, reviewed_at=NOW(), notes=?, reference_no=? WHERE id=? AND status='pending'");
                $stmt->execute([$input['status'], $user['id'], $input['notes'] ?? null, $referenceNo, $input['proof_id']]);
                if ($stmt->rowCount() <= 0) throw new RuntimeException('Bukti pembayaran ini sudah direview');

                foreach ($items as $item) {
                    $paymentAmount = (float) ($item['remaining_amount'] ?? 0);
                    if ($paymentAmount <= 0) $paymentAmount = (float) ($item['amount'] ?? 0);
                    if ($paymentAmount <= 0) $paymentAmount = (float) ($item['bill_amount'] ?? 0);
                    record_bill_payment((int) $item['bill_id'], (int) $proof['student_id'], 'Transfer Manual', $paymentAmount, [
                        'reference_no' => $referenceNo,
                        'notes' => 'Verifikasi manual bukti pembayaran grup',
                        'status' => 'paid',
                        'officer_name' => $officerName,
                    ]);
                    sync_bill_payment_status((int) $item['bill_id']);
                    $totalAmount += $paymentAmount;
                }

                $shouldQueueReceipt = true;
            } else {
                $stmt = $pdo->prepare("UPDATE payment_proof_groups SET status=?, reviewed_by=?, reviewed_at=NOW(), notes=? WHERE id=? AND status='pending'");
                $stmt->execute([$input['status'], $user['id'], $input['notes'] ?? null, $input['proof_id']]);
                if ($stmt->rowCount() <= 0) throw new RuntimeException('Bukti pembayaran ini sudah direview');

                $rejectionReason = trim((string) ($input['notes'] ?? ''));
                queue_whatsapp_notification(
                    (int) $proof['student_id'],
                    'Bukti Pembayaran Ditolak',
                    "Bukti pembayaran {$billSummary} ditolak admin.\nAlasan: {$rejectionReason}\nMohon unggah ulang bukti pembayaran dengan data yang lebih jelas."
                );
            }

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            response(['message' => 'Gagal memproses review: ' . $e->getMessage()], 422);
        }

        if ($shouldQueueReceipt) {
            $receiptLinks = generate_receipt_links_for_student((int) $proof['student_id'], [$referenceNo], $officerName);
            $receiptMessage = build_receipt_notification_message($billSummary, $totalAmount, [$referenceNo], $receiptLinks);
            queue_whatsapp_notification((int) $proof['student_id'], 'Kuitansi Pembayaran', $receiptMessage);
            $receiptQueued = true;
        }

        try_dispatch_whatsapp_queue();
        log_activity((int) $user['id'], 'review', 'payment_proof_group', (int) $input['proof_id'], 'Review bukti pembayaran grup: ' . $input['status']);
        response([
            'message' => 'Review bukti pembayaran berhasil disimpan',
            'reference_no' => $referenceNo !== '' ? $referenceNo : null,
            'receipt_queued' => $receiptQueued,
        ]);
    }

    $proofStmt = $pdo->prepare("SELECT pp.*, b.status bill_status, b.amount, b.remaining_amount, b.bill_name, s.parent_phone, s.name student_name
        FROM payment_proofs pp
        JOIN bills b ON b.id=pp.bill_id
        JOIN students s ON s.id=pp.student_id
        WHERE pp.id=? LIMIT 1");
    $proofStmt->execute([$input['proof_id']]);
    $proof = $proofStmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if ($proof['status'] !== 'pending') response(['message' => 'Bukti pembayaran ini sudah direview'], 422);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE payment_proofs SET status=?, reviewed_by=?, reviewed_at=NOW(), notes=? WHERE id=?");
        $stmt->execute([$input['status'], $user['id'], $input['notes'] ?? null, $input['proof_id']]);

        if ($input['status'] === 'approved' && $proof['bill_status'] !== 'paid') {
            $officerName = strtoupper(trim((string) ($user['name'] ?? 'ADMIN')));
            $proofPaymentAmount = (float) ($proof['remaining_amount'] ?? 0);
            if ($proofPaymentAmount <= 0) $proofPaymentAmount = (float) $proof['amount'];
            $tx = create_transaction_and_mark_paid((int) $proof['bill_id'], (int) $proof['student_id'], 'Transfer Manual', $proofPaymentAmount, 'Verifikasi manual bukti pembayaran', 'paid', $officerName);
            if ($officerName === '') $officerName = 'ADMIN';
            $receiptLinks = generate_receipt_links_for_student((int) $proof['student_id'], [(string) ($tx['reference_no'] ?? '')], $officerName);
            $receiptMessage = build_receipt_notification_message(
                (string) ($proof['bill_name'] ?? 'tagihan'),
                $proofPaymentAmount,
                [(string) ($tx['reference_no'] ?? '')],
                $receiptLinks
            );
            queue_whatsapp_notification((int) $proof['student_id'], 'Kuitansi Pembayaran', $receiptMessage);
        }

        if ($input['status'] === 'rejected') {
            $rejectionReason = trim((string) ($input['notes'] ?? ''));
            queue_whatsapp_notification(
                (int) $proof['student_id'],
                'Bukti Pembayaran Ditolak',
                "Bukti pembayaran {$proof['bill_name']} ditolak admin.\nAlasan: {$rejectionReason}\nMohon unggah ulang bukti pembayaran dengan data yang lebih jelas."
            );
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
    $scope = payment_proof_requested_scope($input);
    if ($scope === 'group' && !payment_proof_groups_available($pdo)) response(['message' => 'Bukti tidak ditemukan'], 404);
    $table = $scope === 'group' ? 'payment_proof_groups' : 'payment_proofs';

    $stmt = $pdo->prepare("SELECT * FROM {$table} WHERE id = ? LIMIT 1");
    $stmt->execute([$input['id']]);
    $proof = $stmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if ($proof['status'] === 'approved') response(['message' => 'Bukti yang sudah disetujui tidak bisa dihapus'], 422);

    if ($scope === 'group') {
        $deleteItems = $pdo->prepare("DELETE FROM payment_proof_group_items WHERE group_id = ?");
        $deleteItems->execute([$input['id']]);
    }
    $delete = $pdo->prepare("DELETE FROM {$table} WHERE id = ?");
    $delete->execute([$input['id']]);
    $proofPath = trim((string) ($proof['proof_path'] ?? ''));
    if ($proofPath !== '' && payment_proof_path_usage_count($pdo, $proofPath) === 0 && file_exists($proofPath)) {
        $proofDir = API_ROOT . '/storage/payment-proofs';
        if (is_path_inside_dir($proofPath, $proofDir)) @unlink($proofPath);
    }
    log_activity((int) $user['id'], 'delete', $scope === 'group' ? 'payment_proof_group' : 'payment_proof', (int) $input['id'], 'Menghapus bukti pembayaran');
    response(['message' => 'Bukti pembayaran berhasil dihapus']);
}
