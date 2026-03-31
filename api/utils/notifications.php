<?php
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../core/helpers.php';

function normalize_wa_target(string $phone): string {
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if ($digits === '') return '';
    if (str_starts_with($digits, '0')) return '62' . substr($digits, 1);
    if (str_starts_with($digits, '62')) return $digits;
    return $digits;
}

function is_fonnte_url(string $url): bool {
    $host = strtolower((string) parse_url($url, PHP_URL_HOST));
    return $host === 'api.fonnte.com' || str_ends_with($host, '.fonnte.com');
}

function dispatch_whatsapp_message(string $url, string $token, string $target, string $message): bool {
    if (is_fonnte_url($url)) {
        $body = http_build_query([
            'target' => $target,
            'message' => $message,
        ]);
        $headers = [
            'Authorization: ' . $token,
            'Content-Type: application/x-www-form-urlencoded',
        ];
    } else {
        $body = json_encode([
            'target' => $target,
            'message' => $message,
        ]);
        $headers = [
            'Authorization: ' . $token,
            'Content-Type: application/json',
        ];
    }

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 8,
    ]);
    $result = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hasCurlError = curl_errno($ch) !== 0;
    curl_close($ch);

    if ($hasCurlError || $result === false || $httpCode < 200 || $httpCode >= 300) {
        return false;
    }

    $decoded = json_decode((string) $result, true);
    if (!is_array($decoded)) {
        return true;
    }

    if (array_key_exists('status', $decoded)) {
        return (bool) $decoded['status'];
    }

    return true;
}

function queue_whatsapp_notification(int $studentId, string $title, string $message): void {
    $stmt = db()->prepare("INSERT INTO notifications (student_id, title, message, channel, status, created_at) VALUES (?, ?, ?, 'WhatsApp', 'queued', NOW())");
    $stmt->execute([$studentId, $title, $message]);
}

function try_dispatch_whatsapp_queue(): void {
    $enabled = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_enabled' LIMIT 1");
    if ($enabled !== '1') return;
    $url = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_url' LIMIT 1");
    $token = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_token' LIMIT 1");
    if (!$url || !$token) return;

    $rows = db()->query("SELECT n.id, n.message, s.parent_phone FROM notifications n JOIN students s ON s.id = n.student_id WHERE n.status='queued' ORDER BY n.id ASC LIMIT 5")->fetchAll();
    foreach ($rows as $row) {
        $target = normalize_wa_target((string) ($row['parent_phone'] ?? ''));
        $success = $target !== '' && dispatch_whatsapp_message($url, $token, $target, (string) $row['message']);
        $stmt = db()->prepare("UPDATE notifications SET status=?, sent_at=NOW() WHERE id=?");
        $stmt->execute([$success ? 'sent' : 'failed', $row['id']]);
    }
}
