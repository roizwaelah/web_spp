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

function payment_instruction(string $channel): string {
    return match ($channel) {
        'Transfer Bank' => 'Silakan transfer ke rekening madrasah yang terdaftar.',
        'QRIS' => 'Silakan scan QRIS yang tersedia di menu pengaturan sekolah.',
        'Virtual Account' => 'Gunakan nomor virtual account yang diterbitkan sistem.',
        'E-Wallet' => 'Lanjutkan pembayaran melalui aplikasi e-wallet yang didukung.',
        default => 'Lanjutkan pembayaran sesuai kanal yang dipilih.',
    };
}
