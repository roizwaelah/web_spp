<?php
// Helper domain santri dan transaksi pembayaran.

function finance_posts_for_student(int $studentId): array {
    $sql = "SELECT fp.* FROM finance_posts fp
            JOIN students s ON s.id = ?
            WHERE fp.is_active = 1 AND (
                (fp.applies_to='student' AND (fp.student_id IS NULL OR fp.student_id=s.id)) OR
                (fp.applies_to='class' AND (fp.class_id IS NULL OR fp.class_id=s.class_id))
            )
            ORDER BY fp.id DESC";
    $stmt = db()->prepare($sql);
    $stmt->execute([$studentId]);
    return $stmt->fetchAll();
}

function student_row(int $studentId): ?array {
    $stmt = db()->prepare("SELECT s.*, c.name class_name, ay.name academic_year
        FROM students s
        LEFT JOIN classes c ON c.id=s.class_id
        LEFT JOIN academic_years ay ON ay.id=s.academic_year_id
        WHERE s.id=? LIMIT 1");
    $stmt->execute([$studentId]);
    return $stmt->fetch() ?: null;
}

function create_transaction_and_mark_paid(int $billId, int $studentId, string $channel, float $amount, string $notes = '', string $status = 'paid', string $officerName = ''): array {
    return record_bill_payment($billId, $studentId, $channel, $amount, [
        'notes' => $notes,
        'status' => $status,
        'officer_name' => $officerName,
    ]);
}

function record_bill_payment(int $billId, int $studentId, string $channel, float $amount, array $options = []): array {
    $reference = trim((string) ($options['reference_no'] ?? ''));
    if ($reference === '') {
        $reference = create_payment_reference($channel);
    }

    $paymentDate = trim((string) ($options['payment_date'] ?? ''));
    if ($paymentDate === '') {
        $paymentDate = date('Y-m-d H:i:s');
    } elseif (preg_match('/^\d{4}-\d{2}-\d{2}$/', $paymentDate)) {
        $paymentDate .= ' 00:00:00';
    }

    $status = (string) ($options['status'] ?? 'paid');
    $notes = (string) ($options['notes'] ?? '');
    $officerName = trim((string) ($options['officer_name'] ?? ''));
    if ($officerName !== '') {
        $officerName = strtoupper($officerName);
    }

    $stmt = db()->prepare("INSERT INTO transactions (bill_id, student_id, payment_channel, amount_paid, payment_date, reference_no, status, notes, officer_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$billId, $studentId, $channel, $amount, $paymentDate, $reference, $status, $notes, $officerName !== '' ? $officerName : null]);

    if ($status === 'paid') {
        sync_bill_payment_status($billId);
    }

    return ['transaction_id' => (int) db()->lastInsertId(), 'reference_no' => $reference];
}

function sync_bill_payment_status(int $billId): void {
    $stmt = db()->prepare("SELECT amount FROM bills WHERE id = ? LIMIT 1");
    $stmt->execute([$billId]);
    $bill = $stmt->fetch();
    if (!$bill) return;

    $amount = round((float) ($bill['amount'] ?? 0), 2);
    $paidFromTransactions = (float) scalar("SELECT COALESCE(SUM(amount_paid), 0) FROM transactions WHERE bill_id = ? AND status = 'paid'", [$billId]);
    $paidFromDeposit = (float) scalar("SELECT COALESCE(SUM(amount), 0) FROM student_deposit_mutations WHERE bill_id = ? AND mutation_type = 'debit'", [$billId]);
    $rawPaid = round($paidFromTransactions + $paidFromDeposit, 2);
    $paidAmount = min($amount, max(0.0, $rawPaid));
    $remainingAmount = max(0.0, round($amount - $paidAmount, 2));

    $status = 'unpaid';
    if ($paidAmount > 0 && $remainingAmount > 0) {
        $status = 'partial';
    } elseif ($amount > 0 && $remainingAmount <= 0) {
        $status = 'paid';
    }

    $paidAt = null;
    if ($status === 'paid') {
        $latestPaid = db()->prepare("SELECT MAX(payment_at) FROM (
            SELECT payment_date AS payment_at FROM transactions WHERE bill_id = ? AND status = 'paid'
            UNION ALL
            SELECT mutation_date AS payment_at FROM student_deposit_mutations WHERE bill_id = ? AND mutation_type = 'debit'
        ) paid_events");
        $latestPaid->execute([$billId, $billId]);
        $paidAt = $latestPaid->fetchColumn() ?: date('Y-m-d H:i:s');
    }

    $stmtBill = db()->prepare("UPDATE bills SET paid_amount=?, remaining_amount=?, status=?, paid_at=? WHERE id=?");
    $stmtBill->execute([$paidAmount, $remainingAmount, $status, $paidAt, $billId]);
}

function student_deposit_balance(int $studentId): float {
    if ($studentId <= 0) return 0.0;
    $balance = scalar("SELECT balance FROM student_deposits WHERE student_id = ? LIMIT 1", [$studentId]);
    return round((float) ($balance ?? 0), 2);
}

function student_deposit_credit(int $studentId, float $amount, string $sourceType, ?int $billId = null, ?int $transactionId = null, string $notes = '', ?string $mutationDate = null): int {
    if ($studentId <= 0 || $amount <= 0) return 0;
    $amount = round($amount, 2);
    $mutationDate = $mutationDate ?: date('Y-m-d H:i:s');
    db()->prepare("INSERT INTO student_deposits (student_id, balance, updated_at, created_at) VALUES (?, 0, NOW(), NOW()) ON DUPLICATE KEY UPDATE student_id = VALUES(student_id)")->execute([$studentId]);
    db()->prepare("UPDATE student_deposits SET balance = balance + ?, updated_at = NOW() WHERE student_id = ?")->execute([$amount, $studentId]);
    $stmt = db()->prepare("INSERT INTO student_deposit_mutations (student_id, bill_id, transaction_id, mutation_type, source_type, amount, mutation_date, notes, created_at) VALUES (?, ?, ?, 'credit', ?, ?, ?, ?, NOW())");
    $stmt->execute([$studentId, $billId, $transactionId, $sourceType, $amount, $mutationDate, $notes !== '' ? $notes : null]);
    return (int) db()->lastInsertId();
}

function student_deposit_debit(int $studentId, float $amount, string $sourceType, ?int $billId = null, ?int $transactionId = null, string $notes = '', ?string $mutationDate = null): int {
    if ($studentId <= 0 || $amount <= 0) return 0;
    $amount = round($amount, 2);
    $currentBalance = student_deposit_balance($studentId);
    if ($amount > $currentBalance) {
        response(['message' => 'Saldo deposit santri tidak mencukupi'], 422);
    }
    $mutationDate = $mutationDate ?: date('Y-m-d H:i:s');
    db()->prepare("UPDATE student_deposits SET balance = balance - ?, updated_at = NOW() WHERE student_id = ?")->execute([$amount, $studentId]);
    $stmt = db()->prepare("INSERT INTO student_deposit_mutations (student_id, bill_id, transaction_id, mutation_type, source_type, amount, mutation_date, notes, created_at) VALUES (?, ?, ?, 'debit', ?, ?, ?, ?, NOW())");
    $stmt->execute([$studentId, $billId, $transactionId, $sourceType, $amount, $mutationDate, $notes !== '' ? $notes : null]);
    if ($billId !== null) sync_bill_payment_status($billId);
    return (int) db()->lastInsertId();
}

function oldest_unpaid_bill_for_same_post(int $studentId, int $financePostId, int $billId): ?array {
    $stmt = db()->prepare("SELECT id, bill_name, period, due_date, status
        FROM bills
        WHERE student_id = ?
          AND finance_post_id = ?
          AND status <> 'paid'
          AND (due_date < (SELECT due_date FROM bills WHERE id = ?) OR (due_date = (SELECT due_date FROM bills WHERE id = ?) AND id < ?))
        ORDER BY due_date ASC, id ASC
        LIMIT 1");
    $stmt->execute([$studentId, $financePostId, $billId, $billId, $billId]);
    return $stmt->fetch() ?: null;
}

function parent_user_student(array $user): array {
    if (!$user['student_id']) response(['message' => 'Akun orang tua belum terhubung ke santri'], 422);
    $student = student_row((int) $user['student_id']);
    if (!$student) response(['message' => 'Data santri tidak ditemukan'], 404);
    return $student;
}

function parent_user_by_student_id(int $studentId): ?array {
    $stmt = db()->prepare("SELECT * FROM users WHERE student_id = ? AND role = 'parent' LIMIT 1");
    $stmt->execute([$studentId]);
    return $stmt->fetch() ?: null;
}

function parent_login_email_for_student(array $student): string {
    $identifier = trim((string) ($student['nisn'] ?? $student['nis'] ?? ''));
    if ($identifier === '') {
        $identifier = 'student-' . ($student['id'] ?? time());
    }

    $normalized = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '.', $identifier));
    $normalized = trim($normalized, '.') ?: 'student';

    return 'parent.' . $normalized . '@parent.local';
}

function generate_receipt_links_for_student(int $studentId, array $referenceNumbers, string $officerName = 'ADMIN'): array {
    $studentId = (int) $studentId;
    if ($studentId <= 0) return [];

    $refs = array_values(array_unique(array_filter(array_map(
        static fn($ref) => trim((string) $ref),
        $referenceNumbers
    ))));
    if (!$refs) return [];

    $settings = list_settings();
    $links = [];
    $linkMode = strtolower(trim((string) env_value('SUPABASE_RECEIPT_LINK_MODE', 'auto')));
    if (!in_array($linkMode, ['auto', 'public', 'signed'], true)) $linkMode = 'auto';

    foreach ($refs as $referenceNo) {
        $row = receipt_row_by_reference($studentId, $referenceNo);
        if (!$row) continue;

        $receiptHtml = render_payment_receipt_html($row, $settings, $officerName);
        $receiptPdf = render_pdf_from_html($receiptHtml);

        $shareUrl = '';
        $supabaseUpload = upload_receipt_pdf_to_supabase($receiptPdf, $referenceNo, $studentId);
        if ($supabaseUpload) {
            $signedUrl = trim((string) ($supabaseUpload['signed_url'] ?? ''));
            $publicUrl = trim((string) ($supabaseUpload['public_url'] ?? ''));
            if ($linkMode === 'public') {
                $shareUrl = $publicUrl !== '' ? $publicUrl : $signedUrl;
            } elseif ($linkMode === 'signed') {
                $shareUrl = $signedUrl !== '' ? $signedUrl : $publicUrl;
            } else {
                $shareUrl = $signedUrl !== '' ? $signedUrl : $publicUrl;
            }
        }

        if ($shareUrl === '') {
            $savedLocal = save_receipt_pdf_to_local($receiptPdf, $referenceNo, $studentId);
            if ($savedLocal) {
                $shareUrl = (string) (build_local_receipt_signed_url((string) $savedLocal['relative_path']) ?? '');
            }
        }

        if ($shareUrl === '') {
            $savedPublic = save_receipt_pdf_to_local_public($receiptPdf, $referenceNo, $studentId);
            if ($savedPublic) {
                $shareUrl = trim((string) ($savedPublic['url'] ?? ''));
            }
        }

        if ($shareUrl !== '') {
            $links[] = [
                'reference_no' => $referenceNo,
                'url' => $shareUrl,
            ];
        }
    }

    return $links;
}

function build_receipt_notification_message(string $billSummary, float $totalAmount, array $referenceNumbers, array $receiptLinks = []): string {
    $cleanBillSummary = trim($billSummary) !== '' ? trim($billSummary) : 'tagihan';
    $refs = array_values(array_filter(array_map(
        static fn($ref) => trim((string) $ref),
        $referenceNumbers
    )));
    $refLine = $refs ? implode(', ', $refs) : '-';
    $linkLines = [];
    foreach ($receiptLinks as $row) {
        $url = trim((string) ($row['url'] ?? ''));
        if ($url === '') continue;
        $ref = trim((string) ($row['reference_no'] ?? ''));
        $linkLines[] = $ref !== '' ? ("- {$ref}: {$url}") : ("- {$url}");
    }

    $message = "Terima Kasih. Pembayaran {$cleanBillSummary} sebesar " . idr($totalAmount) . " berhasil diterima.\n"
        . "No. Referensi: {$refLine}";
    if ($linkLines) {
        $message .= "\nKuitansi juga bisa diunduh di https://spp.darussalampanusupan.net pada menu Riwayat Pembayaran di portal orang tua.";
    } else {
        $message .= "\nKuitansi bisa diunduh di https://spp.darussalampanusupan.net pada menu Riwayat Pembayaran di portal orang tua.";
    }

    return $message;
}

if (!function_exists('mark_reference_transactions_paid')) {
    function mark_reference_transactions_paid(PDO $pdo, string $referenceNo, ?string $paidAt = null): void
    {
        if ($referenceNo === '') return;
        $rowsStmt = $pdo->prepare("SELECT id, bill_id, student_id, COALESCE(officer_name, '') AS officer_name FROM transactions WHERE reference_no = ? ORDER BY id ASC");
        $rowsStmt->execute([$referenceNo]);
        $rows = $rowsStmt->fetchAll();
        if (!$rows) return;

        $paidAtSql = $paidAt ?: date('Y-m-d H:i:s');
        $statusChanged = false;
        $pdo->beginTransaction();
        try {
            $txUpdate = $pdo->prepare("UPDATE transactions SET status = 'paid', payment_date = ? WHERE id = ? AND status <> 'paid'");
            $billUpdate = $pdo->prepare("UPDATE bills SET status = 'paid', paid_at = ? WHERE id = ? AND status <> 'paid'");
            foreach ($rows as $row) {
                $txUpdate->execute([$paidAtSql, (int) $row['id']]);
                if ($txUpdate->rowCount() > 0) {
                    $statusChanged = true;
                }
                $billUpdate->execute([$paidAtSql, (int) $row['bill_id']]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }

        if (!$statusChanged) return;

        $studentId = (int) ($rows[0]['student_id'] ?? 0);
        if ($studentId <= 0) return;

        $officerName = 'ADMIN';
        foreach ($rows as $row) {
            $candidate = strtoupper(trim((string) ($row['officer_name'] ?? '')));
            if ($candidate !== '') {
                $officerName = $candidate;
                break;
            }
        }

        if (!function_exists('receipt_row_by_reference') || !function_exists('generate_receipt_links_for_student') || !function_exists('build_receipt_notification_message')) {
            return;
        }

        $receiptRow = receipt_row_by_reference($studentId, $referenceNo);
        if (!$receiptRow) return;

        $items = is_array($receiptRow['items'] ?? null) ? $receiptRow['items'] : [];
        $billSummary = count($items) === 1
            ? (string) ($items[0]['bill_name'] ?? 'tagihan')
            : count($items) . ' tagihan';
        $receiptLinks = generate_receipt_links_for_student($studentId, [$referenceNo], $officerName);
        $receiptMessage = build_receipt_notification_message(
            $billSummary,
            (float) ($receiptRow['amount_paid'] ?? 0),
            [$referenceNo],
            $receiptLinks,
        );
        queue_whatsapp_notification($studentId, 'Kuitansi Pembayaran', $receiptMessage);
        try_dispatch_whatsapp_queue();
    }
}

if (!function_exists('mark_reference_transactions_failed')) {
    function mark_reference_transactions_failed(PDO $pdo, string $referenceNo, string $notes = ''): void
    {
        if ($referenceNo === '') return;
        $sql = "UPDATE transactions SET status = 'failed'" . ($notes !== '' ? ", notes = ?" : "") . " WHERE reference_no = ? AND status = 'pending'";
        $stmt = $pdo->prepare($sql);
        $params = $notes !== '' ? [$notes, $referenceNo] : [$referenceNo];
        $stmt->execute($params);
    }
}

if (!function_exists('pending_gateway_stale_cutoff_hours')) {
    function pending_gateway_stale_cutoff_hours(string $providerKey): int
    {
        return 25;
    }
}

if (!function_exists('pending_gateway_provider_from_transaction')) {
    function pending_gateway_provider_from_transaction(array $transaction): string
    {
        $notes = trim((string) ($transaction['notes'] ?? ''));
        if ($notes !== '') {
            $decoded = json_decode($notes, true);
            if (is_array($decoded)) {
                $provider = payment_gateway_provider_key((string) ($decoded['provider'] ?? ''));
                if ($provider !== '') return $provider;
            }
            $provider = payment_gateway_provider_key($notes);
            if ($provider !== '') return $provider;
        }

        return payment_gateway_provider_key((string) ($transaction['payment_channel'] ?? ''));
    }
}

if (!function_exists('pending_gateway_meta_from_transaction')) {
    function pending_gateway_meta_from_transaction(array $transaction): array
    {
        $notes = trim((string) ($transaction['notes'] ?? ''));
        if ($notes === '') return [];
        $decoded = json_decode($notes, true);
        return is_array($decoded) ? $decoded : [];
    }
}

if (!function_exists('pending_reference_created_at')) {
    function pending_reference_created_at(array $transactions): string
    {
        $createdAt = '';
        foreach ($transactions as $transaction) {
            $value = trim((string) ($transaction['created_at'] ?? ''));
            if ($value === '') continue;
            if ($createdAt === '' || strtotime($value) < strtotime($createdAt)) {
                $createdAt = $value;
            }
        }
        return $createdAt;
    }
}

if (!function_exists('pending_reference_is_stale')) {
    function pending_reference_is_stale(array $transactions, string $providerKey): bool
    {
        $createdAt = pending_reference_created_at($transactions);
        if ($createdAt === '') return false;
        $timestamp = strtotime($createdAt);
        if ($timestamp === false) return false;
        $cutoffHours = pending_gateway_stale_cutoff_hours($providerKey);
        return $timestamp <= strtotime("-{$cutoffHours} hours");
    }
}

if (!function_exists('reconcile_pending_reference_transactions')) {
    function reconcile_pending_reference_transactions(PDO $pdo, string $referenceNo, array $transactions): void
    {
        if ($referenceNo === '' || !$transactions) return;

        $providerKey = pending_gateway_provider_from_transaction($transactions[0]);
        if ($providerKey === '') {
            if (pending_reference_is_stale($transactions, '')) {
                mark_reference_transactions_failed($pdo, $referenceNo, 'Pending kedaluwarsa tanpa provider terdeteksi');
            }
            return;
        }

        try {
            if ($providerKey === 'ipaymu') {
                $meta = pending_gateway_meta_from_transaction($transactions[0]);
                $transactionId = trim((string) ($meta['gateway_transaction_id'] ?? ''));
                if ($transactionId !== '' && ipaymu_is_config_valid(ipaymu_config())) {
                    $verified = ipaymu_verify_transaction_status($transactionId, ipaymu_config());
                    if (ipaymu_is_paid_payload($verified)) {
                        mark_reference_transactions_paid($pdo, $referenceNo);
                        return;
                    }
                    if (ipaymu_is_failed_payload($verified)) {
                        mark_reference_transactions_failed($pdo, $referenceNo, 'iPaymu status: ' . json_encode($verified, JSON_UNESCAPED_UNICODE));
                        return;
                    }
                }
            } elseif ($providerKey === 'midtrans' && midtrans_is_config_valid(midtrans_config())) {
                $verified = midtrans_get_status($referenceNo, midtrans_config());
                if (midtrans_is_paid_payload($verified)) {
                    mark_reference_transactions_paid($pdo, $referenceNo, (string) ($verified['settlement_time'] ?? ''));
                    return;
                }
                if (midtrans_is_failed_payload($verified)) {
                    mark_reference_transactions_failed($pdo, $referenceNo, 'Midtrans status: ' . (string) ($verified['transaction_status'] ?? 'failed'));
                    return;
                }
            } elseif ($providerKey === 'doku' && doku_is_config_valid(doku_config())) {
                $verified = doku_get_status($referenceNo, doku_config());
                if (doku_is_paid_payload($verified)) {
                    mark_reference_transactions_paid($pdo, $referenceNo, (string) ($verified['transaction']['date'] ?? ''));
                    return;
                }
                if (doku_is_failed_payload($verified)) {
                    mark_reference_transactions_failed($pdo, $referenceNo, 'DOKU status: ' . (string) ($verified['transaction']['status'] ?? 'failed'));
                    return;
                }
            } elseif ($providerKey === 'tripay' && tripay_is_config_valid(tripay_config())) {
                $meta = pending_gateway_meta_from_transaction($transactions[0]);
                $gatewayReference = trim((string) ($meta['gateway_reference'] ?? ''));
                if ($gatewayReference !== '') {
                    $verified = tripay_get_transaction_detail($gatewayReference, tripay_config());
                    if (tripay_is_paid_payload($verified)) {
                        $paidAt = !empty($verified['data']['paid_at']) ? date('Y-m-d H:i:s', (int) $verified['data']['paid_at']) : null;
                        mark_reference_transactions_paid($pdo, $referenceNo, $paidAt);
                        return;
                    }
                    if (tripay_is_failed_payload($verified)) {
                        mark_reference_transactions_failed($pdo, $referenceNo, 'Tripay status: ' . (string) ($verified['data']['status'] ?? 'failed'));
                        return;
                    }
                }
            }
        } catch (Throwable $e) {
            error_log('[PENDING_RECONCILE] ' . $providerKey . ' ' . $referenceNo . ' ' . $e->getMessage());
        }

        if (pending_reference_is_stale($transactions, $providerKey)) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Pending gateway kedaluwarsa dan dilepas otomatis');
        }
    }
}

if (!function_exists('reconcile_pending_transaction_groups')) {
    function reconcile_pending_transaction_groups(PDO $pdo, array $rows): void
    {
        if (!$rows) return;

        $groups = [];
        foreach ($rows as $row) {
            $referenceNo = trim((string) ($row['reference_no'] ?? ''));
            $groupKey = $referenceNo !== '' ? $referenceNo : 'row-' . (int) ($row['id'] ?? 0);
            $groups[$groupKey][] = $row;
        }

        foreach ($groups as $groupKey => $transactions) {
            $referenceNo = str_starts_with((string) $groupKey, 'row-') ? '' : (string) $groupKey;
            if ($referenceNo === '') {
                if (pending_reference_is_stale($transactions, pending_gateway_provider_from_transaction($transactions[0] ?? []))) {
                    $stmtFail = $pdo->prepare("UPDATE transactions SET status='failed', notes=? WHERE id=? AND status='pending'");
                    foreach ($transactions as $transaction) {
                        $stmtFail->execute(['Pending tanpa reference kedaluwarsa', (int) $transaction['id']]);
                    }
                }
                continue;
            }
            reconcile_pending_reference_transactions($pdo, $referenceNo, $transactions);
        }
    }
}

if (!function_exists('reconcile_all_pending_transactions_for_student')) {
    function reconcile_all_pending_transactions_for_student(PDO $pdo, int $studentId): void
    {
        if ($studentId <= 0) return;
        $stmt = $pdo->prepare("SELECT id, bill_id, student_id, payment_channel, reference_no, status, notes, created_at
            FROM transactions
            WHERE student_id = ?
              AND status = 'pending'
            ORDER BY created_at ASC, id ASC");
        $stmt->execute([$studentId]);
        reconcile_pending_transaction_groups($pdo, $stmt->fetchAll());
    }
}

if (!function_exists('reconcile_pending_transactions_for_student_bills')) {
    function reconcile_pending_transactions_for_student_bills(PDO $pdo, int $studentId, array $billIds): void
    {
        if ($studentId <= 0 || !$billIds) return;
        $placeholders = implode(',', array_fill(0, count($billIds), '?'));
        $params = array_merge($billIds, [$studentId]);
        $stmt = $pdo->prepare("SELECT id, bill_id, student_id, payment_channel, reference_no, status, notes, created_at
            FROM transactions
            WHERE bill_id IN ($placeholders)
              AND student_id = ?
              AND status = 'pending'
            ORDER BY created_at ASC, id ASC");
        $stmt->execute($params);
        reconcile_pending_transaction_groups($pdo, $stmt->fetchAll());
    }
}

if (!function_exists('reconcile_pending_transactions_for_admin_filters')) {
    function reconcile_pending_transactions_for_admin_filters(PDO $pdo, ?int $classId = null, ?int $studentId = null): void
    {
        $conditions = ["t.status = 'pending'"];
        $params = [];

        if (($classId ?? 0) > 0) {
            $conditions[] = 's.class_id = ?';
            $params[] = (int) $classId;
        }
        if (($studentId ?? 0) > 0) {
            $conditions[] = 't.student_id = ?';
            $params[] = (int) $studentId;
        }

        $where = implode(' AND ', $conditions);
        $stmt = $pdo->prepare("SELECT t.id, t.bill_id, t.student_id, t.payment_channel, t.reference_no, t.status, t.notes, t.created_at
            FROM transactions t
            JOIN students s ON s.id = t.student_id
            WHERE {$where}
            ORDER BY t.created_at ASC, t.id ASC");
        $stmt->execute($params);
        reconcile_pending_transaction_groups($pdo, $stmt->fetchAll());
    }
}
