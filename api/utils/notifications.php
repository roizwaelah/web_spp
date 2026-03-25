<?php
require_once __DIR__ . '/../core/db.php';
require_once __DIR__ . '/../core/helpers.php';

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
        $payload = json_encode(['target' => $row['parent_phone'], 'message' => $row['message']]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: ' . $token,
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_TIMEOUT => 8,
        ]);
        $result = curl_exec($ch);
        $success = !curl_errno($ch) && $result !== false;
        curl_close($ch);
        $stmt = db()->prepare("UPDATE notifications SET status=?, sent_at=NOW() WHERE id=?");
        $stmt->execute([$success ? 'sent' : 'failed', $row['id']]);
    }
}
