<?php
// Helper domain siswa dan transaksi pembayaran.

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

function create_transaction_and_mark_paid(int $billId, int $studentId, string $channel, float $amount, string $notes = '', string $status = 'paid'): array {
    return record_bill_payment($billId, $studentId, $channel, $amount, [
        'notes' => $notes,
        'status' => $status,
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

    $stmt = db()->prepare("INSERT INTO transactions (bill_id, student_id, payment_channel, amount_paid, payment_date, reference_no, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$billId, $studentId, $channel, $amount, $paymentDate, $reference, $status, $notes]);

    if ($status === 'paid') {
        $stmtBill = db()->prepare("UPDATE bills SET status='paid', paid_at=? WHERE id=?");
        $stmtBill->execute([$paymentDate, $billId]);
    }

    return ['transaction_id' => (int) db()->lastInsertId(), 'reference_no' => $reference];
}

function sync_bill_payment_status(int $billId): void {
    $latestPaid = db()->prepare("SELECT payment_date
        FROM transactions
        WHERE bill_id = ? AND status = 'paid'
        ORDER BY payment_date DESC, id DESC
        LIMIT 1");
    $latestPaid->execute([$billId]);
    $row = $latestPaid->fetch();

    if ($row) {
        $stmtBill = db()->prepare("UPDATE bills SET status='paid', paid_at=? WHERE id=?");
        $stmtBill->execute([$row['payment_date'], $billId]);
        return;
    }

    $stmtBill = db()->prepare("UPDATE bills SET status='unpaid', paid_at=NULL WHERE id=?");
    $stmtBill->execute([$billId]);
}

function parent_user_student(array $user): array {
    if (!$user['student_id']) response(['message' => 'Akun orang tua belum terhubung ke siswa'], 422);
    $student = student_row((int) $user['student_id']);
    if (!$student) response(['message' => 'Data siswa tidak ditemukan'], 404);
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
            $savedPublic = save_receipt_pdf_to_local_public($receiptPdf, $referenceNo, $studentId);
            if ($savedPublic) {
                $shareUrl = trim((string) ($savedPublic['url'] ?? ''));
            }
        }

        if ($shareUrl === '') {
            $savedLocal = save_receipt_pdf_to_local($receiptPdf, $referenceNo, $studentId);
            if ($savedLocal) {
                $shareUrl = (string) (build_local_receipt_signed_url((string) $savedLocal['relative_path']) ?? '');
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
        $message .= "\nKuitansi pembayaran telah tersedia."
            . "\nKuitansi juga bisa diunduh pada menu Riwayat Pembayaran di portal orang tua.";
    } else {
        $message .= "\nKuitansi bisa diunduh pada menu Riwayat Pembayaran di portal orang tua.";
    }

    return $message;
}
