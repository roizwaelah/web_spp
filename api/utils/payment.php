<?php
require_once __DIR__ . '/../core/db.php';

function create_payment_reference(string $channel): string {
    $prefix = match ($channel) {
        'Transfer Bank' => 'TRF',
        'QRIS' => 'QRS',
        'Virtual Account' => 'VA',
        'E-Wallet' => 'EWL',
        default => 'PAY',
    };
    return $prefix . '-' . date('YmdHis') . '-' . random_int(100, 999);
}

function create_manual_payment_reference(?string $paymentDate = null): string {
    $normalizedDate = trim((string) $paymentDate);
    if ($normalizedDate === '') {
        $normalizedDate = date('Y-m-d');
    }

    if (!preg_match('/^\d{4}-\d{2}-\d{2}/', $normalizedDate)) {
        $normalizedDate = date('Y-m-d');
    }

    $timestamp = strtotime(substr($normalizedDate, 0, 10)) ?: time();
    $monthKey = date('Y-m', $timestamp);
    $displayDate = date('dmy', $timestamp);

    $stmt = db()->prepare("SELECT COALESCE(MAX(CAST(RIGHT(reference_no, 3) AS UNSIGNED)), 0)
        FROM transactions
        WHERE reference_no LIKE 'KW-%'
          AND DATE_FORMAT(payment_date, '%Y-%m') = ?");
    $stmt->execute([$monthKey]);
    $nextNumber = ((int) $stmt->fetchColumn()) + 1;

    return 'KW-' . $displayDate . '-' . str_pad((string) $nextNumber, 3, '0', STR_PAD_LEFT);
}

function payment_instruction(string $channel): string {
    return match ($channel) {
        'Transfer Bank' => 'Silakan transfer ke rekening madrasah yang terdaftar.',
        'QRIS' => 'Silakan scan QRIS yang tersedia di menu pengaturan sekolah.',
        'Virtual Account' => 'Gunakan nomor virtual account yang diterbitkan sistem.',
        'E-Wallet' => 'Lanjutkan pembayaran melalui aplikasi e-wallet yang didukung.',
        default => 'Lanjutkan pembayaran sesuai kanal yang dipilih.',
    };
}
