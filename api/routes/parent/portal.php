<?php
// Route portal orang tua: dashboard, tagihan, pembayaran, notifikasi, dan receipt.

if (!function_exists('gateway_api_base_url')) {
    function gateway_api_base_url(): string
    {
        $forcedBase = trim((string) env_value('API_PUBLIC_BASE_URL', ''));
        if ($forcedBase !== '') return rtrim($forcedBase, '/');

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
        $script = trim((string) ($_SERVER['SCRIPT_NAME'] ?? '/api/index.php'));
        $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
        if ($dir === '' || $dir === '.') $dir = '/api';
        return $scheme . '://' . $host . $dir;
    }
}

if (!function_exists('gateway_frontend_base_url')) {
    function gateway_frontend_base_url(): string
    {
        $requestOrigin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
        if ($requestOrigin !== '') {
            return rtrim($requestOrigin, '/');
        }

        $forcedBase = trim((string) env_value('FRONTEND_PUBLIC_BASE_URL', ''));
        if ($forcedBase !== '') return rtrim($forcedBase, '/');

        $allowedOriginsRaw = trim((string) env_value('CORS_ALLOWED_ORIGINS', ''));
        if ($allowedOriginsRaw !== '') {
            $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $allowedOriginsRaw))));
            if (!empty($allowedOrigins)) {
                return rtrim((string) $allowedOrigins[0], '/');
            }
        }

        $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $host = trim((string) ($_SERVER['HTTP_HOST'] ?? ''));
        return $scheme . '://' . $host;
    }
}

if (!function_exists('gateway_is_placeholder_email')) {
    function gateway_is_placeholder_email(string $email): bool
    {
        $email = strtolower(trim($email));
        if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return true;
        }
        $domain = strtolower((string) substr(strrchr($email, '@') ?: '', 1));
        if ($domain === '') return true;
        if (in_array($domain, ['parent.local', 'example.invalid', 'localhost'], true)) {
            return true;
        }
        foreach (['.local', '.invalid', '.test', '.example'] as $suffix) {
            if (str_ends_with($domain, $suffix)) {
                return true;
            }
        }
        return false;
    }
}

if (!function_exists('gateway_resolve_checkout_email')) {
    function gateway_resolve_checkout_email(array $user, array $settings): string
    {
        $candidates = [
            trim((string) ($user['email'] ?? '')),
            trim((string) ($settings['support_email'] ?? '')),
        ];

        $host = strtolower(trim((string) parse_url(gateway_frontend_base_url(), PHP_URL_HOST)));
        if ($host !== '' && !in_array($host, ['localhost', '127.0.0.1'], true) && str_contains($host, '.')) {
            $candidates[] = 'no-reply@' . $host;
        }

        foreach ($candidates as $candidate) {
            if (!gateway_is_placeholder_email((string) $candidate)) {
                return trim((string) $candidate);
            }
        }

        return '';
    }
}

if (!function_exists('gateway_normalize_phone_number')) {
    function gateway_normalize_phone_number(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?: '';
        if ($digits === '') return '';
        if (str_starts_with($digits, '0')) {
            $digits = '62' . substr($digits, 1);
        } elseif (str_starts_with($digits, '8')) {
            $digits = '62' . $digits;
        }
        if (!preg_match('/^62\d{8,15}$/', $digits)) {
            return '';
        }
        return $digits;
    }
}

if (!function_exists('gateway_resolve_checkout_phone')) {
    function gateway_resolve_checkout_phone(array $student, array $settings): string
    {
        $candidates = [
            (string) ($student['parent_phone'] ?? ''),
            (string) ($settings['support_whatsapp'] ?? ''),
        ];

        foreach ($candidates as $candidate) {
            $normalized = gateway_normalize_phone_number((string) $candidate);
            if ($normalized !== '') {
                return $normalized;
            }
        }

        return '';
    }
}


if (!function_exists('tripay_channel_catalog')) {
    function tripay_channel_catalog(): array
    {
        return [
            'tripay-va-bri' => ['method' => 'BRIVA', 'label' => 'BRI Virtual Account', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'virtual_account'],
            'tripay-va-bni' => ['method' => 'BNIVA', 'label' => 'BNI Virtual Account', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'virtual_account'],
            'tripay-va-bca' => ['method' => 'BCAVA', 'label' => 'BCA Virtual Account', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'virtual_account'],
            'tripay-va-mandiri' => ['method' => 'MANDIRIVA', 'label' => 'Mandiri Virtual Account', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'virtual_account'],
            'tripay-va-permata' => ['method' => 'PERMATAVA', 'label' => 'Permata Virtual Account', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'virtual_account'],
            'tripay-qris' => ['method' => 'QRIS', 'label' => 'QRIS', 'min_amount' => 1000, 'mode' => 'direct', 'group' => 'qris'],
            'tripay-retail-alfamart' => ['method' => 'ALFAMART', 'label' => 'Alfamart', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'retail'],
            'tripay-retail-indomaret' => ['method' => 'INDOMARET', 'label' => 'Indomaret', 'min_amount' => 10000, 'mode' => 'direct', 'group' => 'retail'],
            'tripay-ewallet-ovo' => ['method' => 'OVO', 'label' => 'OVO', 'min_amount' => 1000, 'mode' => 'redirect', 'group' => 'ewallet'],
            'tripay-ewallet-dana' => ['method' => 'DANA', 'label' => 'DANA', 'min_amount' => 1000, 'mode' => 'redirect', 'group' => 'ewallet'],
            'tripay-ewallet-shopeepay' => ['method' => 'SHOPEEPAY', 'label' => 'ShopeePay', 'min_amount' => 1000, 'mode' => 'redirect', 'group' => 'ewallet'],
        ];
    }
}

if (!function_exists('tripay_channel_spec')) {
    function tripay_channel_spec(string $channel): array
    {
        $catalog = tripay_channel_catalog();
        return $catalog[strtolower(trim($channel))] ?? [];
    }
}

if (!function_exists('tripay_channel_label')) {
    function tripay_channel_label(string $channel): string
    {
        $spec = tripay_channel_spec($channel);
        return (string) ($spec['label'] ?? 'kanal Tripay');
    }
}

if (!function_exists('tripay_channel_minimum_amount')) {
    function tripay_channel_minimum_amount(string $channel): int
    {
        $spec = tripay_channel_spec($channel);
        return (int) ($spec['min_amount'] ?? 0);
    }
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
            $billIds = [];
            foreach ($rows as $row) {
                $txUpdate->execute([$paidAtSql, (int) $row['id']]);
                if ($txUpdate->rowCount() > 0) {
                    $statusChanged = true;
                }
                $billIds[(int) $row['bill_id']] = true;
            }
            foreach (array_keys($billIds) as $paidBillId) {
                sync_bill_payment_status((int) $paidBillId);
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

if (!function_exists('insert_pending_gateway_transactions')) {
    function insert_pending_gateway_transactions(PDO $pdo, array $bills, int $studentId, string $paymentChannel, string $referenceNo, string $notes): void
    {
        $stmt = $pdo->prepare("INSERT INTO transactions
            (bill_id, student_id, payment_channel, amount_paid, payment_date, reference_no, status, notes, created_at)
            VALUES (?, ?, ?, ?, NOW(), ?, 'pending', ?, NOW())");

        $pdo->beginTransaction();
        try {
            foreach ($bills as $bill) {
                $amountPaid = (float) ($bill['__payment_amount'] ?? ($bill['remaining_amount'] ?? $bill['amount'] ?? 0));
                if ($amountPaid <= 0) continue;
                $stmt->execute([
                    (int) $bill['id'],
                    $studentId,
                    $paymentChannel,
                    $amountPaid,
                    $referenceNo,
                    $notes,
                ]);
            }
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
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
        $rows = $stmt->fetchAll();
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
        $rows = $stmt->fetchAll();
        if (!$rows) return;

        $groups = [];
        foreach ($rows as $row) {
            $referenceNo = trim((string) ($row['reference_no'] ?? ''));
            $groupKey = $referenceNo !== '' ? $referenceNo : 'row-' . (int) ($row['id'] ?? 0);
            $groups[$groupKey][] = $row;
        }

        foreach ($groups as $groupKey => $transactions) {
            $referenceNo = str_starts_with($groupKey, 'row-') ? '' : $groupKey;
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

if ($route === 'public/ipaymu/notify' && $method === 'POST') {
    rate_limit_or_fail('ipaymu-notify:ip:' . client_ip(), 120, 60, 'Terlalu banyak notifikasi iPaymu');

    $payload = $_POST;
    if (!is_array($payload) || !$payload) {
        $payload = json_input();
    }
    if (!is_array($payload)) $payload = [];

    $referenceNo = ipaymu_extract_reference_id($payload);
    $transactionId = ipaymu_extract_transaction_id($payload);
    if ($referenceNo === '' && $transactionId === '') {
        response(['message' => 'Payload notifikasi iPaymu tidak valid'], 422);
    }

    $isPaid = ipaymu_is_paid_payload($payload);

    $ipaymuCfg = ipaymu_config();
    if ($transactionId !== '' && ipaymu_is_config_valid($ipaymuCfg)) {
        try {
            $verified = ipaymu_verify_transaction_status($transactionId, $ipaymuCfg);
            $isPaid = ipaymu_is_paid_payload($verified);
            if ($referenceNo === '') {
                $referenceNo = ipaymu_extract_reference_id($verified);
            }
        } catch (Throwable $e) {
            error_log('[IPAYMU_NOTIFY_VERIFY] ' . $e->getMessage());
        }
    }

    if ($referenceNo !== '') {
        $txStmt = $pdo->prepare("SELECT t.id, t.bill_id, t.student_id, t.reference_no, t.status
            FROM transactions t
            WHERE t.reference_no = ?
            ORDER BY t.id ASC");
        $txStmt->execute([$referenceNo]);
        $txRows = $txStmt->fetchAll();

        if ($txRows) {
            if ($isPaid) {
                $pdo->beginTransaction();
                try {
                    $txUpdate = $pdo->prepare("UPDATE transactions
                        SET status = 'paid', payment_date = NOW()
                        WHERE id = ? AND status <> 'paid'");
                    $billUpdate = $pdo->prepare("UPDATE bills
                        SET status = 'paid', paid_at = NOW()
                        WHERE id = ? AND status <> 'paid'");

                    foreach ($txRows as $tx) {
                        $txUpdate->execute([(int) $tx['id']]);
                        $billUpdate->execute([(int) $tx['bill_id']]);
                    }

                    $pdo->commit();
                } catch (Throwable $e) {
                    if ($pdo->inTransaction()) $pdo->rollBack();
                    error_log('[IPAYMU_NOTIFY_COMMIT] ' . $e->getMessage());
                }
            } else {
                $failStmt = $pdo->prepare("UPDATE transactions SET status='failed' WHERE id=? AND status='pending'");
                foreach ($txRows as $tx) {
                    $failStmt->execute([(int) $tx['id']]);
                }
            }
        }
    }

    response(['ok' => true]);
}


if ($route === 'public/midtrans/notify' && $method === 'POST') {
    rate_limit_or_fail('midtrans-notify:ip:' . client_ip(), 120, 60, 'Terlalu banyak notifikasi Midtrans');

    $payload = json_input();
    if (!is_array($payload)) $payload = [];

    $referenceNo = midtrans_extract_reference_id($payload);
    if ($referenceNo === '') {
        response(['message' => 'Payload notifikasi Midtrans tidak valid'], 422);
    }

    $midtransCfg = midtrans_config();
    if (!midtrans_verify_notification_signature($payload, $midtransCfg)) {
        response(['message' => 'Signature Midtrans tidak valid'], 422);
    }

    try {
        if (midtrans_is_paid_payload($payload)) {
            mark_reference_transactions_paid($pdo, $referenceNo, (string) ($payload['settlement_time'] ?? ''));
        } elseif (midtrans_is_failed_payload($payload)) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Midtrans status: ' . (string) ($payload['transaction_status'] ?? 'failed'));
        }
    } catch (Throwable $e) {
        error_log('[MIDTRANS_NOTIFY] ' . $e->getMessage());
    }

    response(['ok' => true]);
}

if ($route === 'public/doku/notify' && $method === 'POST') {
    rate_limit_or_fail('doku-notify:ip:' . client_ip(), 120, 60, 'Terlalu banyak notifikasi DOKU');

    $rawBody = file_get_contents('php://input');
    $payload = json_decode($rawBody ?: '[]', true);
    if (!is_array($payload)) $payload = [];
    $referenceNo = doku_extract_reference_id($payload);
    if ($referenceNo === '') {
        response(['message' => 'Payload notifikasi DOKU tidak valid'], 422);
    }

    $headers = doku_notification_headers();
    $requestPath = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: '';
    $requestUri = trim((string) ($_SERVER['REQUEST_URI'] ?? ''));
    $requestTargets = [$requestPath];
    if ($requestUri !== '') {
        $requestTargets[] = $requestUri;
    }
    if (($queryRoute = trim((string) query('route', ''))) !== '') {
        $requestTargets[] = $requestPath . '?route=' . $queryRoute;
    }
    $configuredNotify = gateway_api_base_url() . '/index.php?route=public/doku/notify';
    $configuredNotifyParts = parse_url($configuredNotify);
    $configuredNotifyPath = trim((string) ($configuredNotifyParts['path'] ?? ''));
    $configuredNotifyQuery = trim((string) ($configuredNotifyParts['query'] ?? ''));
    if ($configuredNotifyPath !== '') {
        $requestTargets[] = $configuredNotifyPath;
        if ($configuredNotifyQuery !== '') {
            $requestTargets[] = $configuredNotifyPath . '?' . $configuredNotifyQuery;
        }
    }
    $requestTargets = array_values(array_unique(array_filter(array_map(
        static fn($target) => trim((string) $target),
        $requestTargets
    ))));

    $dokuCfg = doku_config();
    if (!doku_verify_notification_signature((string) $rawBody, $headers, $dokuCfg, $requestTargets)) {
        error_log('[DOKU_NOTIFY_SIGNATURE_FAILED] ' . json_encode([
            'invoice' => $referenceNo,
            'request_targets' => $requestTargets,
            'headers' => [
                'client-id' => $headers['client-id'] ?? '',
                'request-id' => $headers['request-id'] ?? '',
                'request-timestamp' => $headers['request-timestamp'] ?? '',
                'signature' => $headers['signature'] ?? '',
            ],
        ], JSON_UNESCAPED_UNICODE));
        response(['message' => 'Signature DOKU tidak valid'], 422);
    }

    try {
        if (doku_is_paid_payload($payload)) {
            mark_reference_transactions_paid($pdo, $referenceNo, (string) ($payload['transaction']['date'] ?? ''));
        } elseif (doku_is_failed_payload($payload)) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'DOKU status: ' . (string) ($payload['transaction']['status'] ?? 'failed'));
        }
    } catch (Throwable $e) {
        error_log('[DOKU_NOTIFY] ' . $e->getMessage());
    }

    response(['ok' => true]);
}

if ($route === 'public/tripay/notify' && $method === 'POST') {
    rate_limit_or_fail('tripay-notify:ip:' . client_ip(), 120, 60, 'Terlalu banyak notifikasi Tripay');

    $rawBody = file_get_contents('php://input') ?: '';
    $payload = json_decode($rawBody, true);
    if (!is_array($payload)) {
        response(['success' => false, 'message' => 'Payload notifikasi Tripay tidak valid'], 400);
    }

    $tripayCfg = tripay_config();
    $headers = tripay_notification_headers();
    if (!tripay_verify_callback_signature($rawBody, $headers, $tripayCfg)) {
        response(['success' => false, 'message' => 'Signature Tripay tidak valid'], 403);
    }
    if (trim((string) ($headers['x-callback-event'] ?? '')) !== 'payment_status') {
        response(['success' => false, 'message' => 'Event notifikasi Tripay tidak dikenali'], 400);
    }

    $referenceNo = tripay_extract_reference_id($payload);
    if ($referenceNo === '') {
        response(['success' => false, 'message' => 'Reference Tripay tidak ditemukan'], 422);
    }

    try {
        if (tripay_is_paid_payload($payload)) {
            $paidAt = !empty($payload['paid_at']) ? date('Y-m-d H:i:s', (int) $payload['paid_at']) : null;
            mark_reference_transactions_paid($pdo, $referenceNo, $paidAt);
        } elseif (tripay_is_failed_payload($payload)) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Tripay status: ' . (string) ($payload['status'] ?? 'failed'));
        }
    } catch (Throwable $e) {
        error_log('[TRIPAY_NOTIFY] ' . $e->getMessage());
    }

    response(['success' => true]);
}

if ($route === 'parent/dashboard' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $summary = [
        'activeBills' => (int) scalar("SELECT COUNT(*) FROM bills WHERE student_id=? AND status <> 'paid'", [$student['id']]),
        'outstanding' => (float) scalar("SELECT COALESCE(SUM(remaining_amount),0) FROM bills WHERE student_id=? AND status <> 'paid'", [$student['id']]),
        'paidThisYear' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE student_id=? AND status='paid' AND YEAR(payment_date)=YEAR(CURDATE())", [$student['id']]),
        'pendingProofs' => (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE student_id=? AND status='pending'", [$student['id']])
            + (int) scalar("SELECT COUNT(*) FROM payment_proof_groups WHERE student_id=? AND status='pending'", [$student['id']]),
    ];
    response(['summary' => $summary, 'student' => $student, 'settings' => list_settings()]);
}

if ($route === 'parent/bills' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT b.*, fp.is_flexible_installment,
            COALESCE(
                (SELECT ppg.status
                    FROM payment_proof_group_items ppgi
                    JOIN payment_proof_groups ppg ON ppg.id = ppgi.group_id
                    WHERE ppgi.bill_id = b.id
                    ORDER BY ppg.id DESC LIMIT 1),
                (SELECT status FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1)
            ) proof_status,
            COALESCE(
                (SELECT ppg.proof_file_name
                    FROM payment_proof_group_items ppgi
                    JOIN payment_proof_groups ppg ON ppg.id = ppgi.group_id
                    WHERE ppgi.bill_id = b.id
                    ORDER BY ppg.id DESC LIMIT 1),
                (SELECT proof_file_name FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1)
            ) proof_file_name
        FROM bills b
        JOIN finance_posts fp ON fp.id=b.finance_post_id
        WHERE b.student_id=? ORDER BY b.id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/payments' && $method === 'POST') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $input = json_input();
    ensure_required($input, ['payment_channel']);
    if (!setting_is_enabled('payment_gateway_enabled')) {
        response(['message' => 'Payment gateway sedang dinonaktifkan oleh admin'], 422);
    }
    $rawBillIds = $input['bill_ids'] ?? ($input['bill_id'] ?? null);
    if ($rawBillIds === null) response(['message' => 'Tagihan yang akan dibayar wajib dipilih'], 422);
    if (!is_array($rawBillIds)) $rawBillIds = [$rawBillIds];

    $billIds = [];
    foreach ($rawBillIds as $billId) {
        $billId = (int) $billId;
        if ($billId > 0) $billIds[] = $billId;
    }
    $billIds = array_values(array_unique($billIds));
    if (!$billIds) response(['message' => 'Tagihan yang akan dibayar wajib dipilih'], 422);

    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $params = array_merge($billIds, [$student['id']]);
    $stmt = $pdo->prepare("SELECT b.*, fp.is_flexible_installment FROM bills b JOIN finance_posts fp ON fp.id=b.finance_post_id WHERE b.id IN ($placeholders) AND b.student_id=? ORDER BY b.due_date IS NULL, b.due_date ASC, b.id ASC");
    $stmt->execute($params);
    $bills = $stmt->fetchAll();
    if (count($bills) !== count($billIds)) response(['message' => 'Sebagian tagihan tidak ditemukan'], 404);

    reconcile_pending_transactions_for_student_bills($pdo, (int) $student['id'], $billIds);

    $olderBillRequirements = [];
    foreach ($bills as $bill) {
        if ($bill['status'] === 'paid') response(['message' => "Tagihan {$bill['bill_name']} sudah lunas"], 422);
        $pendingProof = scalar("SELECT id FROM payment_proofs WHERE bill_id = ? AND student_id = ? AND status = 'pending' LIMIT 1", [$bill['id'], $student['id']]);
        if (!$pendingProof) {
            $pendingProof = scalar("SELECT ppg.id
                FROM payment_proof_groups ppg
                JOIN payment_proof_group_items ppgi ON ppgi.group_id = ppg.id
                WHERE ppgi.bill_id = ? AND ppg.student_id = ? AND ppg.status = 'pending'
                LIMIT 1", [$bill['id'], $student['id']]);
        }
        if ($pendingProof) response(['message' => "Bukti pembayaran untuk tagihan {$bill['bill_name']} masih menunggu review admin"], 422);
        $pendingTx = scalar("SELECT id FROM transactions WHERE bill_id = ? AND student_id = ? AND status = 'pending' LIMIT 1", [(int) $bill['id'], (int) $student['id']]);
        if ($pendingTx) {
            response(['message' => "Tagihan {$bill['bill_name']} masih memiliki transaksi pending"], 422);
        }
        $olderBill = oldest_unpaid_bill_for_same_post((int) $student['id'], (int) $bill['finance_post_id'], (int) $bill['id']);
        if ($olderBill) {
            $olderBillRequirements[] = $olderBill;
        }
    }

    $customAmountProvided = array_key_exists('amount', $input) || array_key_exists('payment_amount', $input) || array_key_exists('custom_amount', $input);
    $customAmount = null;
    if ($customAmountProvided) {
        $customAmount = (float) ($input['payment_amount'] ?? $input['custom_amount'] ?? $input['amount'] ?? 0);
        if ($customAmount <= 0) response(['message' => 'Nominal pembayaran wajib lebih dari Rp 0'], 422);

        $customStudentIds = array_values(array_unique(array_map(static fn($bill) => (int) ($bill['student_id'] ?? 0), $bills)));
        if (count($customStudentIds) !== 1 || (int) $customStudentIds[0] !== (int) $student['id']) {
            response(['message' => 'Nominal custom hanya dapat digunakan untuk tagihan satu siswa/santri'], 422);
        }

        $hasFlexibleBill = false;
        foreach ($bills as $bill) {
            if ((int) ($bill['is_flexible_installment'] ?? 0) === 1) {
                $hasFlexibleBill = true;
                break;
            }
        }
        if (!$hasFlexibleBill) response(['message' => 'Nominal custom hanya dapat digunakan untuk tagihan fleksibel'], 422);
    }

    $configuredProviderRaw = trim((string) setting_value('payment_gateway_provider', ''));
    $providerKey = payment_gateway_provider_key($configuredProviderRaw);
    $gatewayMode = strtolower(trim((string) setting_value('payment_gateway_mode', 'redirect')));
    if ($gatewayMode === '') $gatewayMode = 'redirect';
    if (!in_array($providerKey, ['ipaymu', 'midtrans', 'doku', 'tripay'], true)) {
        response(['message' => 'Provider payment gateway saat ini belum didukung'], 422);
    }

    $referenceNo = match ($providerKey) {
        'ipaymu' => 'IPM-' . date('YmdHis') . '-' . random_int(100, 999),
        'midtrans' => 'MTS-' . date('YmdHis') . '-' . random_int(100, 999),
        'doku' => 'DKU-' . date('YmdHis') . '-' . random_int(100, 999),
        'tripay' => 'TPY-' . date('YmdHis') . '-' . random_int(100, 999),
        default => 'PG-' . date('YmdHis') . '-' . random_int(100, 999),
    };

    $totalAmount = 0.0;
    $products = [];
    $qty = [];
    $prices = [];
    $descriptions = [];
    $lineItems = [];
    $paymentBills = [];
    $plannedFullPayments = [];
    $remainingCustomAmount = $customAmountProvided ? (float) $customAmount : null;
    foreach ($bills as $bill) {
        $billName = (string) ($bill['bill_name'] ?? 'Tagihan');
        $periodText = (string) ($bill['period'] ?? '-');
        $remainingAmount = (float) ($bill['remaining_amount'] ?? $bill['amount'] ?? 0);
        $priceValue = (int) round($remainingAmount);
        if ($customAmountProvided) {
            $priceValue = (int) round(min($remainingAmount, max((float) $remainingCustomAmount, 0.0)));
            $remainingCustomAmount -= $priceValue;
        }
        if ($priceValue <= 0) continue;
        if ($customAmountProvided && (int) ($bill['is_flexible_installment'] ?? 0) !== 1 && $priceValue < (int) round($remainingAmount)) {
            response(['message' => "Tagihan {$billName} wajib dibayar penuh"], 422);
        }
        $billId = (int) ($bill['id'] ?? 0);
        if ($priceValue >= (int) round($remainingAmount)) {
            $plannedFullPayments[$billId] = true;
        }
        $bill['__payment_amount'] = $priceValue;
        $paymentBills[] = $bill;
        $products[] = $billName;
        $qty[] = 1;
        $prices[] = $priceValue;
        $descriptions[] = 'Periode ' . $periodText;
        $lineItems[] = [
            'id' => (string) ($bill['id'] ?? ''),
            'name' => $billName,
            'price' => $priceValue,
            'quantity' => 1,
        ];
        $totalAmount += $priceValue;
    }
    if ($customAmountProvided && (float) $remainingCustomAmount > 0.009) {
        response(['message' => 'Nominal pembayaran melebihi total sisa tagihan yang dipilih'], 422);
    }
    if (!$paymentBills) response(['message' => 'Nominal pembayaran tidak cukup untuk memproses tagihan yang dipilih'], 422);
    foreach ($olderBillRequirements as $olderBill) {
        $olderBillId = (int) ($olderBill['id'] ?? 0);
        if ($olderBillId > 0 && !isset($plannedFullPayments[$olderBillId])) {
            response(['message' => "Tagihan {$olderBill['bill_name']} periode {$olderBill['period']} harus diselesaikan lebih dahulu"], 422);
        }
    }

    $studentName = (string) ($student['name'] ?? 'Siswa');
    $parentName = trim((string) ($student['parent_name'] ?? '')) !== '' ? trim((string) ($student['parent_name'] ?? '')) : $studentName;
    $settings = list_settings();
    $email = gateway_resolve_checkout_email($user, $settings);
    $phone = gateway_resolve_checkout_phone($student, $settings);
    $apiBase = gateway_api_base_url();
    $frontendBase = gateway_frontend_base_url();
    $returnUrl = rtrim($frontendBase, '/') . '/orang-tua/transaksi?gateway=' . rawurlencode($providerKey) . '&ref=' . rawurlencode($referenceNo);
    $cancelUrl = rtrim($frontendBase, '/') . '/orang-tua/tagihan/pembayaran?bill_ids=' . implode(',', $billIds) . '&gateway_cancel=1';

    $paymentChannel = trim((string) ($input['payment_channel'] ?? '')) !== '' ? trim((string) ($input['payment_channel'] ?? '')) : $configuredProviderRaw;
    $pendingNote = match ($providerKey) {
        'ipaymu' => 'Menunggu pembayaran iPaymu',
        'midtrans' => 'Menunggu pembayaran Midtrans',
        'doku' => 'Menunggu pembayaran DOKU',
        'tripay' => 'Menunggu pembayaran Tripay',
        default => 'Menunggu pembayaran gateway',
    };

    if ($providerKey === 'ipaymu') {
        $minimumAmount = ipaymu_channel_minimum_amount($paymentChannel);
        if ($minimumAmount > 0 && (int) round($totalAmount) < $minimumAmount) {
            response([
                'message' => sprintf(
                    'Minimal pembayaran untuk %s adalah Rp %s.',
                    ipaymu_channel_label($paymentChannel),
                    number_format($minimumAmount, 0, ',', '.')
                ),
            ], 422);
        }
    }

    if ($providerKey === 'tripay') {
        $minimumAmount = tripay_channel_minimum_amount($paymentChannel);
        if ($minimumAmount > 0 && (int) round($totalAmount) < $minimumAmount) {
            response([
                'message' => sprintf(
                    'Minimal pembayaran untuk %s adalah Rp %s.',
                    tripay_channel_label($paymentChannel),
                    number_format($minimumAmount, 0, ',', '.')
                ),
            ], 422);
        }
    }

    try {
        insert_pending_gateway_transactions($pdo, $paymentBills, (int) $student['id'], $paymentChannel, $referenceNo, $pendingNote);
    } catch (Throwable $e) {
        response(['message' => 'Gagal menyiapkan transaksi pembayaran'], 500);
    }

    if ($providerKey === 'ipaymu') {
        $ipaymuCfg = ipaymu_config();
        if (!ipaymu_is_config_valid($ipaymuCfg)) {
            response(['message' => 'Konfigurasi iPaymu belum lengkap (VA / API key)'], 422);
        }
        if ($email === '') {
            response(['message' => 'Email untuk checkout iPaymu belum valid. Isi email akun orang tua atau Email Bantuan di Pengaturan.'], 422);
        }
        if ($phone === '') {
            response(['message' => 'Nomor HP untuk checkout iPaymu belum valid. Isi nomor wali atau WA Bantuan di Pengaturan.'], 422);
        }

        $notifyUrl = $apiBase . '/index.php?route=public/ipaymu/notify';

        if ($gatewayMode === 'popup') {
            $channelSpec = ipaymu_direct_channel_spec($paymentChannel);
            if (!$channelSpec) {
                mark_reference_transactions_failed($pdo, $referenceNo, 'Kanal iPaymu Direct tidak dikenali: ' . $paymentChannel);
                response(['message' => 'Kanal iPaymu Direct belum didukung pada halaman popup ini'], 422);
            }

            $directBasePayload = [
                'name' => $parentName,
                'phone' => $phone,
                'email' => $email,
                'amount' => (int) round($totalAmount),
                'notifyUrl' => $notifyUrl,
                'referenceId' => $referenceNo,
                'expired' => 24,
                'comments' => 'Pembayaran ' . count($billIds) . ' tagihan oleh ' . $studentName,
                'successUrl' => $returnUrl,
                'cancelUrl' => $cancelUrl,
            ];

            try {
                $gatewayResponse = null;
                $selectedDirectChannel = '';
                $lastChannelError = null;
                foreach ((array) ($channelSpec['payment_channels'] ?? []) as $directChannel) {
                    $payload = $directBasePayload;
                    $payload['paymentMethod'] = (string) ($channelSpec['payment_method'] ?? '');
                    $payload['paymentChannel'] = trim((string) $directChannel);

                    try {
                        $gatewayResponse = ipaymu_post('/payment/direct', $payload, $ipaymuCfg);
                        $selectedDirectChannel = trim((string) $directChannel);
                        break;
                    } catch (Throwable $channelError) {
                        $lastChannelError = $channelError;
                    }
                }

                if (!is_array($gatewayResponse)) {
                    throw $lastChannelError ?: new RuntimeException('Kanal iPaymu Direct tidak tersedia');
                }

                $gatewayTransactionId = ipaymu_extract_transaction_id($gatewayResponse);
                $paymentInfo = ipaymu_extract_direct_payment_details($gatewayResponse);
                $gatewayMeta = [
                    'provider' => 'ipaymu',
                    'gateway_mode' => 'popup',
                    'gateway_transaction_id' => $gatewayTransactionId,
                    'gateway_response' => $gatewayResponse,
                    'payment_method' => (string) ($channelSpec['payment_method'] ?? ''),
                    'payment_channel' => $selectedDirectChannel,
                ];
                $metaJson = json_encode($gatewayMeta, JSON_UNESCAPED_UNICODE);
                $updateStmt = $pdo->prepare("UPDATE transactions SET notes=? WHERE reference_no=?");
                $updateStmt->execute([$metaJson !== false ? $metaJson : 'Gateway iPaymu Direct', $referenceNo]);

                log_activity((int) $user['id'], 'create', 'transaction', null, 'Membuat transaksi iPaymu Direct untuk ' . count($billIds) . ' tagihan');
                response([
                    'message' => 'Transaksi iPaymu Direct berhasil dibuat. Selesaikan pembayaran pada popup ini.',
                    'reference_no' => $referenceNo,
                    'processed_bills' => count($billIds),
                    'total_amount' => $totalAmount,
                    'popup_provider' => 'ipaymu',
                    'popup_payment' => $paymentInfo,
                ]);
            } catch (Throwable $e) {
                mark_reference_transactions_failed($pdo, $referenceNo, 'Gagal create iPaymu Direct: ' . $e->getMessage());
                $errorText = strtolower($e->getMessage());
                $isClientError =
                    str_contains($errorText, 'unauthorized credential') ||
                    str_contains($errorText, 'konfigurasi ipaymu') ||
                    str_contains($errorText, 'kanal') ||
                    str_contains($errorText, 'suspicious buyer') ||
                    str_contains($errorText, 'failed to generate va');
                $statusCode = $isClientError ? 422 : 502;
                $message = 'Gagal membuat transaksi iPaymu Direct: ' . $e->getMessage();
                if (str_contains($errorText, 'suspicious buyer')) {
                    $message = 'Transaksi ditolak iPaymu (Suspicious buyer). Silakan gunakan kanal lain (mis. VA/QRIS/retail), atau pembayaran manual sambil menunggu verifikasi akun oleh iPaymu.';
                } elseif (str_contains($errorText, 'failed to generate va')) {
                    $message = 'iPaymu tidak berhasil membuat Virtual Account. Pada mode sandbox, channel VA tertentu bisa belum tersedia atau belum aktif untuk akun Anda. Coba VA bank lain, QRIS, retail, atau pembayaran manual.';
                }
                response(['message' => $message], $statusCode);
            }
        }

        $payload = [
            'account' => $ipaymuCfg['va'],
            'product' => $products,
            'qty' => $qty,
            'price' => $prices,
            'description' => $descriptions,
            'name' => $parentName,
            'email' => $email,
            'phone' => $phone,
            'buyerName' => $parentName,
            'buyerEmail' => $email,
            'buyerPhone' => $phone,
            'notifyUrl' => $notifyUrl,
            'returnUrl' => $returnUrl,
            'cancelUrl' => $cancelUrl,
            'unotify' => $notifyUrl,
            'ureturn' => $returnUrl,
            'ucancel' => $cancelUrl,
            'referenceId' => $referenceNo,
            'expired' => 24,
            'expiredType' => 'hours',
        ];

        try {
            $gatewayResponse = ipaymu_post('/payment', $payload, $ipaymuCfg);
            $redirectUrl = ipaymu_extract_redirect_url($gatewayResponse);
            $gatewayTransactionId = ipaymu_extract_transaction_id($gatewayResponse);
            if ($redirectUrl === '') {
                throw new RuntimeException('URL redirect iPaymu tidak ditemukan');
            }

            $gatewayMeta = [
                'provider' => 'ipaymu',
                'gateway_transaction_id' => $gatewayTransactionId,
                'gateway_response' => $gatewayResponse,
            ];
            $metaJson = json_encode($gatewayMeta, JSON_UNESCAPED_UNICODE);
            $updateStmt = $pdo->prepare("UPDATE transactions SET notes=? WHERE reference_no=?");
            $updateStmt->execute([$metaJson !== false ? $metaJson : 'Gateway iPaymu', $referenceNo]);

            log_activity((int) $user['id'], 'create', 'transaction', null, 'Membuat transaksi iPaymu untuk ' . count($billIds) . ' tagihan');
            response([
                'message' => 'Transaksi iPaymu berhasil dibuat. Lanjutkan pembayaran pada halaman iPaymu.',
                'reference_no' => $referenceNo,
                'redirect_url' => $redirectUrl,
                'processed_bills' => count($billIds),
                'total_amount' => $totalAmount,
            ]);
        } catch (Throwable $e) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Gagal create iPaymu: ' . $e->getMessage());
            $errorText = strtolower($e->getMessage());
            $statusCode = (
                str_contains($errorText, 'unauthorized credential') ||
                str_contains($errorText, 'konfigurasi ipaymu') ||
                str_contains($errorText, 'failed to generate va')
            ) ? 422 : 502;
            $message = 'Gagal membuat transaksi iPaymu: ' . $e->getMessage();
            if (str_contains($errorText, 'failed to generate va')) {
                $message = 'iPaymu tidak berhasil membuat Virtual Account. Pada mode sandbox, channel VA tertentu bisa belum tersedia atau belum aktif untuk akun Anda. Coba VA bank lain, QRIS, retail, atau pembayaran manual.';
            }
            response(['message' => $message], $statusCode);
        }
    }

    if ($providerKey === 'midtrans') {
        $midtransCfg = midtrans_config();
        if (!midtrans_is_config_valid($midtransCfg)) {
            response(['message' => 'Konfigurasi Midtrans belum lengkap (Server Key)'], 422);
        }

        $payload = [
            'transaction_details' => [
                'order_id' => $referenceNo,
                'gross_amount' => (int) round($totalAmount),
            ],
            'customer_details' => [
                'first_name' => $parentName,
                'last_name' => '',
                'email' => $email,
                'phone' => $phone !== '' ? $phone : '6280000000000',
            ],
            'item_details' => $lineItems,
            'credit_card' => [
                'secure' => true,
            ],
            'callbacks' => [
                'finish' => $returnUrl,
            ],
        ];
        $enabledPayments = midtrans_enabled_payments_for_channel($paymentChannel);
        if ($enabledPayments) {
            $payload['enabled_payments'] = $enabledPayments;
        }

        try {
            $gatewayResponse = midtrans_post('/snap/v1/transactions', $payload, $midtransCfg);
            $redirectUrl = midtrans_extract_redirect_url($gatewayResponse);
            if ($redirectUrl === '') {
                throw new RuntimeException('URL redirect Midtrans tidak ditemukan');
            }

            $gatewayMeta = [
                'provider' => 'midtrans',
                'gateway_response' => $gatewayResponse,
            ];
            $metaJson = json_encode($gatewayMeta, JSON_UNESCAPED_UNICODE);
            $updateStmt = $pdo->prepare("UPDATE transactions SET notes=? WHERE reference_no=?");
            $updateStmt->execute([$metaJson !== false ? $metaJson : 'Gateway Midtrans', $referenceNo]);

            log_activity((int) $user['id'], 'create', 'transaction', null, 'Membuat transaksi Midtrans untuk ' . count($billIds) . ' tagihan');
            $responsePayload = [
                'message' => 'Transaksi Midtrans berhasil dibuat. Lanjutkan pembayaran pada halaman Midtrans.',
                'reference_no' => $referenceNo,
                'processed_bills' => count($billIds),
                'total_amount' => $totalAmount,
            ];

            if ($gatewayMode === 'popup') {
                $responsePayload['popup_provider'] = 'midtrans';
                $responsePayload['popup_token'] = trim((string) ($gatewayResponse['token'] ?? ''));
                $responsePayload['popup_client_key'] = (string) ($midtransCfg['client_key'] ?? '');
                $responsePayload['popup_script_url'] = $midtransCfg['environment'] === 'sandbox'
                    ? 'https://app.sandbox.midtrans.com/snap/snap.js'
                    : 'https://app.midtrans.com/snap/snap.js';
                $responsePayload['redirect_url'] = $redirectUrl;
            } else {
                $responsePayload['redirect_url'] = $redirectUrl;
            }

            response($responsePayload);
        } catch (Throwable $e) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Gagal create Midtrans: ' . $e->getMessage());
            response(['message' => 'Gagal membuat transaksi Midtrans: ' . $e->getMessage()], 502);
        }
    }

    if ($providerKey === 'doku') {
        $dokuCfg = doku_config();
        if (!doku_is_config_valid($dokuCfg)) {
            response(['message' => 'Konfigurasi DOKU belum lengkap (Client ID / Secret Key)'], 422);
        }

        $payload = [
            'order' => [
                'amount' => (int) round($totalAmount),
                'invoice_number' => $referenceNo,
                'currency' => 'IDR',
                'callback_url' => $returnUrl,
                'callback_url_result' => $returnUrl,
                'callback_url_cancel' => $cancelUrl,
                'language' => 'ID',
                'auto_redirect' => true,
                'line_items' => $lineItems,
            ],
            'payment' => [
                'payment_due_date' => 1440,
                'type' => 'SALE',
            ],
            'customer' => [
                'id' => 'STU-' . (int) ($student['id'] ?? 0),
                'name' => $parentName,
                'email' => $email,
                'phone' => $phone !== '' ? $phone : '6280000000000',
                'address' => trim((string) ($student['address'] ?? $student['class_name'] ?? 'Alamat tidak tersedia')),
                'city' => 'Banyumas',
                'country' => 'ID',
            ],
            'additional_info' => [
                'override_notification_url' => $apiBase . '/index.php?route=public/doku/notify',
            ],
        ];
        $paymentMethods = doku_payment_methods_for_channel($paymentChannel);
        if ($paymentMethods) {
            $payload['payment']['payment_method_types'] = $paymentMethods;
        }

        try {
            $gatewayResponse = doku_post('/checkout/v1/payment', $payload, $dokuCfg);
            $redirectUrl = doku_extract_redirect_url($gatewayResponse);
            if ($redirectUrl === '') {
                error_log('[DOKU_CREATE_MISSING_URL] ' . json_encode($gatewayResponse, JSON_UNESCAPED_UNICODE));
                throw new RuntimeException('URL checkout DOKU tidak ditemukan');
            }

            $gatewayMeta = [
                'provider' => 'doku',
                'gateway_response' => $gatewayResponse,
            ];
            $metaJson = json_encode($gatewayMeta, JSON_UNESCAPED_UNICODE);
            $updateStmt = $pdo->prepare("UPDATE transactions SET notes=? WHERE reference_no=?");
            $updateStmt->execute([$metaJson !== false ? $metaJson : 'Gateway DOKU', $referenceNo]);

            log_activity((int) $user['id'], 'create', 'transaction', null, 'Membuat transaksi DOKU untuk ' . count($billIds) . ' tagihan');
            $responsePayload = [
                'message' => 'Transaksi DOKU berhasil dibuat. Lanjutkan pembayaran pada halaman DOKU.',
                'reference_no' => $referenceNo,
                'processed_bills' => count($billIds),
                'total_amount' => $totalAmount,
                'redirect_url' => $redirectUrl,
            ];

            if ($gatewayMode === 'popup') {
                $responsePayload['popup_provider'] = 'doku';
                $responsePayload['popup_payment_url'] = $redirectUrl;
                $responsePayload['popup_script_url'] = $dokuCfg['environment'] === 'sandbox'
                    ? 'https://sandbox.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js'
                    : 'https://jokul.doku.com/jokul-checkout-js/v1/jokul-checkout-1.0.0.js';
            }

            response($responsePayload);
        } catch (Throwable $e) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Gagal create DOKU: ' . $e->getMessage());
            $errorText = strtolower($e->getMessage());
            $statusCode = (
                str_contains($errorText, 'invalid client-id')
                || str_contains($errorText, 'invalid client id')
                || str_contains($errorText, 'unauthorized')
                || str_contains($errorText, 'invalid signature')
                || str_contains($errorText, 'merchant not found')
                || str_contains($errorText, 'client-id')
            ) ? 422 : 502;
            response(['message' => 'Gagal membuat transaksi DOKU: ' . $e->getMessage()], $statusCode);
        }
    }

    if ($providerKey === 'tripay') {
        $tripayCfg = tripay_config();
        if (!tripay_is_config_valid($tripayCfg)) {
            response(['message' => 'Konfigurasi Tripay belum lengkap (API Key / Private Key / Merchant Code)'], 422);
        }

        $tripaySpec = tripay_channel_spec($paymentChannel);
        if (!$tripaySpec) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Kanal Tripay tidak dikenali: ' . $paymentChannel);
            response(['message' => 'Kanal Tripay belum didukung pada halaman ini'], 422);
        }

        if ($gatewayMode === 'popup' && (string) ($tripaySpec['mode'] ?? '') !== 'direct') {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Kanal Tripay redirect-only dipilih pada mode popup: ' . $paymentChannel);
            response(['message' => tripay_channel_label($paymentChannel) . ' di Tripay memakai alur redirect, bukan popup langsung. Ganti mode gateway ke redirect atau pilih kanal direct lain.'], 422);
        }

        $notifyUrl = $apiBase . '/index.php?route=public/tripay/notify';
        $amountInt = (int) round($totalAmount);
        $payload = [
            'method' => (string) ($tripaySpec['method'] ?? ''),
            'merchant_ref' => $referenceNo,
            'amount' => $amountInt,
            'customer_name' => $parentName,
            'customer_email' => $email !== '' ? $email : 'no-reply@sppanel.local',
            'customer_phone' => $phone,
            'order_items' => $lineItems,
            'return_url' => $returnUrl,
            'callback_url' => $notifyUrl,
            'expired_time' => time() + (24 * 60 * 60),
            'signature' => tripay_signature(
                (string) ($tripayCfg['merchant_code'] ?? ''),
                $referenceNo,
                $amountInt,
                (string) ($tripayCfg['private_key'] ?? ''),
            ),
        ];

        try {
            $gatewayResponse = tripay_post('/transaction/create', $payload, $tripayCfg);
            $redirectUrl = tripay_extract_redirect_url($gatewayResponse);
            $gatewayReference = tripay_extract_gateway_reference($gatewayResponse);
            $paymentInfo = tripay_extract_payment_info($gatewayResponse);
            $gatewayMeta = [
                'provider' => 'tripay',
                'gateway_mode' => $gatewayMode,
                'gateway_reference' => $gatewayReference,
                'gateway_response' => $gatewayResponse,
                'payment_method' => (string) ($tripaySpec['method'] ?? ''),
                'payment_channel' => $paymentChannel,
            ];
            $metaJson = json_encode($gatewayMeta, JSON_UNESCAPED_UNICODE);
            $updateStmt = $pdo->prepare("UPDATE transactions SET notes=? WHERE reference_no=?");
            $updateStmt->execute([$metaJson !== false ? $metaJson : 'Gateway Tripay', $referenceNo]);

            log_activity((int) $user['id'], 'create', 'transaction', null, 'Membuat transaksi Tripay untuk ' . count($billIds) . ' tagihan');
            $responsePayload = [
                'message' => $gatewayMode === 'popup'
                    ? 'Transaksi Tripay berhasil dibuat. Selesaikan pembayaran dari detail berikut.'
                    : 'Transaksi Tripay berhasil dibuat. Lanjutkan pembayaran pada halaman Tripay.',
                'reference_no' => $referenceNo,
                'processed_bills' => count($billIds),
                'total_amount' => $totalAmount,
            ];

            if ($gatewayMode === 'popup') {
                $responsePayload['popup_provider'] = 'tripay';
                $responsePayload['popup_payment'] = $paymentInfo;
                if ($redirectUrl !== '') {
                    $responsePayload['redirect_url'] = $redirectUrl;
                }
            } else {
                if ($redirectUrl === '') {
                    throw new RuntimeException('URL checkout Tripay tidak ditemukan');
                }
                $responsePayload['redirect_url'] = $redirectUrl;
            }

            response($responsePayload);
        } catch (Throwable $e) {
            mark_reference_transactions_failed($pdo, $referenceNo, 'Gagal create Tripay: ' . $e->getMessage());
            $errorText = strtolower($e->getMessage());
            $statusCode = (
                str_contains($errorText, 'invalid api key')
                || str_contains($errorText, 'merchant')
                || str_contains($errorText, 'signature')
                || str_contains($errorText, 'channel')
            ) ? 422 : 502;
            response(['message' => 'Gagal membuat transaksi Tripay: ' . $e->getMessage()], $statusCode);
        }
    }

    response(['message' => 'Provider payment gateway belum didukung'], 422);
}

if ($route === 'parent/payment-proofs' && $method === 'POST') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $rawBillIds = $_POST['bill_ids'] ?? ($_POST['bill_id'] ?? null);
    if ($rawBillIds === null) response(['message' => 'Tagihan yang akan dibuktikan wajib dipilih'], 422);
    if (!is_array($rawBillIds)) $rawBillIds = [$rawBillIds];

    $billIds = [];
    foreach ($rawBillIds as $billId) {
        $billId = (int) $billId;
        if ($billId > 0) $billIds[] = $billId;
    }
    $billIds = array_values(array_unique($billIds));
    if (!$billIds) response(['message' => 'Tagihan yang akan dibuktikan wajib dipilih'], 422);

    $placeholders = implode(',', array_fill(0, count($billIds), '?'));
    $params = array_merge($billIds, [$student['id']]);
    $stmt = $pdo->prepare("SELECT b.*, fp.is_flexible_installment FROM bills b JOIN finance_posts fp ON fp.id=b.finance_post_id WHERE b.id IN ($placeholders) AND b.student_id=? ORDER BY b.due_date IS NULL, b.due_date ASC, b.id ASC");
    $stmt->execute($params);
    $bills = $stmt->fetchAll();
    if (count($bills) !== count($billIds)) response(['message' => 'Sebagian tagihan tidak ditemukan'], 404);

    foreach ($bills as $bill) {
        if ($bill['status'] === 'paid') response(['message' => "Tagihan {$bill['bill_name']} sudah lunas, bukti pembayaran tidak perlu diunggah lagi"], 422);
        $olderBill = oldest_unpaid_bill_for_same_post((int) $student['id'], (int) $bill['finance_post_id'], (int) $bill['id']);
        if ($olderBill) {
            response(['message' => "Tagihan {$olderBill['bill_name']} periode {$olderBill['period']} harus diselesaikan lebih dahulu"], 422);
        }
        $pendingProof = scalar("SELECT id FROM payment_proofs WHERE bill_id = ? AND student_id = ? AND status = 'pending' LIMIT 1", [$bill['id'], $student['id']]);
        if (!$pendingProof) {
            $pendingProof = scalar("SELECT ppg.id
                FROM payment_proof_groups ppg
                JOIN payment_proof_group_items ppgi ON ppgi.group_id = ppg.id
                WHERE ppgi.bill_id = ? AND ppg.student_id = ? AND ppg.status = 'pending'
                LIMIT 1", [$bill['id'], $student['id']]);
        }
        if ($pendingProof) response(['message' => "Bukti pembayaran untuk {$bill['bill_name']} masih menunggu review admin"], 422);
    }

    $notes = trim((string) ($_POST['notes'] ?? ''));
    if ($notes !== '' && mb_strlen($notes) > 500) {
        response(['message' => 'Catatan maksimal 500 karakter'], 422);
    }

    $file = save_uploaded_file('file', 'payment-proofs');
    if (!$file) response(['message' => 'File bukti pembayaran wajib diunggah'], 422);

    $groupId = 0;
    $pdo->beginTransaction();
    try {
        $groupStmt = $pdo->prepare("INSERT INTO payment_proof_groups (student_id, proof_file_name, proof_path, mime_type, size_bytes, status, notes, created_at)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, NOW())");
        $groupStmt->execute([$student['id'], $file['filename'], $file['path'], $file['mime_type'], $file['size_bytes'], $notes !== '' ? $notes : null]);
        $groupId = (int) $pdo->lastInsertId();

        $itemStmt = $pdo->prepare("INSERT INTO payment_proof_group_items (group_id, bill_id, amount, created_at) VALUES (?, ?, ?, NOW())");
        foreach ($bills as $bill) {
            $billAmount = (float) ($bill['remaining_amount'] ?? 0);
            if ($billAmount <= 0) $billAmount = (float) ($bill['amount'] ?? 0);
            $itemStmt->execute([$groupId, $bill['id'], $billAmount]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        response(['message' => 'Gagal menyimpan bukti pembayaran'], 500);
    }

    $totalAmount = 0.0;
    foreach ($bills as $bill) {
        $totalAmount += (float) ($bill['remaining_amount'] ?? $bill['amount'] ?? 0);
    }

    $billSummary = count($bills) === 1 ? $bills[0]['bill_name'] : count($bills) . ' tagihan';
    queue_whatsapp_notification((int) $student['id'], 'Bukti Pembayaran Diterima', "Bukti pembayaran untuk {$billSummary} berhasil diunggah dan menunggu verifikasi admin.");
    $adminNotes = $notes !== '' ? $notes : '-';
    $adminMessage = "Orang tua baru saja mengunggah bukti transfer.\n"
        . "Siswa: {$student['name']}\n"
        . "Kelas: " . ($student['class_name'] ?: '-') . "\n"
        . "Tagihan: {$billSummary}\n"
        . "Total: " . idr($totalAmount) . "\n"
        . "Catatan: {$adminNotes}\n"
        . "Waktu: " . date('Y-m-d H:i:s');
    send_admin_whatsapp_notification('Bukti Transfer Baru', $adminMessage);
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'upload', 'payment_proof_group', $groupId, 'Unggah bukti pembayaran untuk ' . count($billIds) . ' tagihan');
    response([
        'message' => count($billIds) > 1 ? 'Bukti pembayaran berhasil diunggah untuk beberapa tagihan dan menunggu verifikasi' : 'Bukti pembayaran berhasil diunggah dan menunggu verifikasi',
        'proof_id' => $groupId,
        'proof_scope' => 'group',
        'is_group' => true,
        'bill_count' => count($billIds),
    ]);
}

if ($route === 'parent/transactions' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    reconcile_all_pending_transactions_for_student($pdo, (int) $student['id']);
    $stmt = $pdo->prepare("SELECT t.*, b.bill_name FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE t.student_id=? ORDER BY t.id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/notifications' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE student_id=? ORDER BY id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/receipt' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);

    $transactionId = query('transaction_id');
    $billId = query('bill_id');
    $referenceNo = trim((string) query('reference_no', ''));
    if (!$transactionId && !$billId && $referenceNo === '') {
        response(['message' => 'ID transaksi, tagihan, atau nomor referensi wajib diisi'], 422);
    }

    $fetchByReference = static function (PDO $pdo, string $refNo, int $studentId): array {
        $stmtRows = $pdo->prepare("SELECT t.*, COALESCE(t.officer_name, '') AS officer_name, b.bill_name, b.period, s.name AS student_name, s.nis, s.nisn, c.name AS class_name, ay.name AS academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE t.reference_no = ? AND t.student_id = ?
            ORDER BY CASE WHEN b.period REGEXP '^[0-9]{4}-[0-9]{2}$' THEN b.period ELSE '9999-99' END ASC, t.id ASC");
        $stmtRows->execute([$refNo, $studentId]);
        $rows = $stmtRows->fetchAll();
        if (!$rows) return [];

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
    };

    $row = null;
    if ($referenceNo !== '') {
        $row = $fetchByReference($pdo, $referenceNo, (int) $student['id']);
    } elseif ($transactionId) {
        $stmt = $pdo->prepare("SELECT t.*, COALESCE(t.officer_name, '') AS officer_name, b.bill_name, b.period, s.name AS student_name, s.nis, s.nisn, c.name AS class_name, ay.name AS academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE t.id=? AND t.student_id=? LIMIT 1");
        $stmt->execute([$transactionId, $student['id']]);
        $baseRow = $stmt->fetch();
        if ($baseRow) {
            $baseReference = trim((string) ($baseRow['reference_no'] ?? ''));
            if ($baseReference !== '') {
                $row = $fetchByReference($pdo, $baseReference, (int) $student['id']);
            }
            if (!$row) $row = $baseRow;
        }
    } else {
        $stmt = $pdo->prepare("SELECT t.*, COALESCE(t.officer_name, '') AS officer_name, b.bill_name, b.period, s.name AS student_name, s.nis, s.nisn, c.name AS class_name, ay.name AS academic_year
            FROM transactions t
            JOIN bills b ON b.id=t.bill_id
            JOIN students s ON s.id=t.student_id
            LEFT JOIN classes c ON c.id=s.class_id
            LEFT JOIN academic_years ay ON ay.id = COALESCE(b.academic_year_id, s.academic_year_id)
            WHERE b.id=? AND t.student_id=? ORDER BY t.id DESC LIMIT 1");
        $stmt->execute([$billId, $student['id']]);
        $row = $stmt->fetch();
        if ($row) {
            $baseReference = trim((string) ($row['reference_no'] ?? ''));
            if ($baseReference !== '') {
                $groupedRow = $fetchByReference($pdo, $baseReference, (int) $student['id']);
                if ($groupedRow) $row = $groupedRow;
            }
        }
    }
    if (!$row) response(['message' => 'Bukti pembayaran tidak ditemukan'], 404);
    $settings = list_settings();

    $receiptHtml = render_payment_receipt_html($row, $settings, 'ADMIN');
    $receiptPdf = render_pdf_from_html($receiptHtml);
    $referenceNo = (string) ($row['reference_no'] ?: ('TRX' . str_pad((string) ($row['id'] ?? 0), 10, '0', STR_PAD_LEFT)));
    $receiptRef = preg_replace('/[^a-zA-Z0-9._-]/', '-', $referenceNo);
    $receiptRef = trim((string) $receiptRef, '-') ?: 'TRX0000000000';
    try {
        upload_receipt_pdf_to_supabase($receiptPdf, $referenceNo, (int) ($student['id'] ?? 0));
    } catch (Throwable $e) {
        error_log('[SUPABASE_RECEIPT_UPLOAD][parent] ' . $e->getMessage());
    }

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $receiptRef . '.pdf"');
    echo $receiptPdf;
    exit;
}
