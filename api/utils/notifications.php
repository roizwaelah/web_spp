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

function is_kirimi_url(string $url): bool {
    $host = strtolower((string) parse_url($url, PHP_URL_HOST));
    return $host === 'api.kirimi.id' || str_ends_with($host, '.kirimi.id');
}

function parse_kirimi_credentials(string $token): ?array {
    $token = trim($token);
    if ($token === '') return null;

    $decoded = json_decode($token, true);
    if (is_array($decoded)) {
        $userCode = trim((string) ($decoded['user_code'] ?? ''));
        $deviceId = trim((string) ($decoded['device_id'] ?? ''));
        $secret = trim((string) ($decoded['secret'] ?? ''));
        if ($userCode !== '' && $deviceId !== '' && $secret !== '') {
            return [
                'user_code' => $userCode,
                'device_id' => $deviceId,
                'secret' => $secret,
            ];
        }
    }

    foreach (['|', ':', ';', ','] as $separator) {
        $parts = array_map('trim', explode($separator, $token));
        if (count($parts) < 3) continue;
        $userCode = (string) ($parts[0] ?? '');
        $deviceId = (string) ($parts[1] ?? '');
        $secret = (string) ($parts[2] ?? '');
        if ($userCode !== '' && $deviceId !== '' && $secret !== '') {
            return [
                'user_code' => $userCode,
                'device_id' => $deviceId,
                'secret' => $secret,
            ];
        }
    }

    return null;
}

function extract_first_url(string $text): string {
    if (preg_match('/https?:\/\/[^\s<>"\']+/i', $text, $matches)) {
        return trim((string) ($matches[0] ?? ''));
    }
    return '';
}

function extract_receipt_url_from_message(string $message): string {
    $markerPos = stripos($message, 'Link Kuitansi:');
    if ($markerPos !== false) {
        $slice = substr($message, $markerPos);
        if (preg_match('/https?:\/\/[^\s<>"\']+/i', (string) $slice, $matches)) {
            return trim((string) ($matches[0] ?? ''));
        }
    }
    return '';
}

function extract_references_from_message(string $message): array {
    if (!preg_match('/No\.\s*Referensi:\s*(.+)$/mi', $message, $matches)) return [];
    $raw = trim((string) ($matches[1] ?? ''));
    if ($raw === '' || $raw === '-') return [];

    $refs = [];
    foreach (explode(',', $raw) as $part) {
        $ref = trim($part);
        if ($ref === '') continue;
        $refs[$ref] = $ref;
    }
    return array_values($refs);
}

function dispatch_whatsapp_message(string $url, string $token, string $target, string $message, ?string $mediaUrlOverride = null): bool {
    $cleanMessage = preg_replace("/\n{3,}/", "\n\n", trim($message)) ?: trim($message);

    if (is_fonnte_url($url)) {
        $body = http_build_query([
            'target' => $target,
            'message' => $cleanMessage,
        ]);
        $headers = [
            'Authorization: ' . $token,
            'Content-Type: application/x-www-form-urlencoded',
        ];
    } elseif (is_kirimi_url($url)) {
        $credentials = parse_kirimi_credentials($token);
        if (!$credentials) return false;
        $mediaUrl = trim((string) ($mediaUrlOverride ?? ''));
        $body = json_encode([
            'user_code' => $credentials['user_code'],
            'device_id' => $credentials['device_id'],
            'phone' => $target,
            'receiver' => $target,
            'message' => $cleanMessage,
            'media_url' => $mediaUrl,
            'secret' => $credentials['secret'],
        ], JSON_UNESCAPED_UNICODE);
        $headers = [
            'Content-Type: application/json',
        ];
    } else {
        $body = json_encode([
            'target' => $target,
            'message' => $cleanMessage,
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
    if (array_key_exists('success', $decoded)) {
        return (bool) $decoded['success'];
    }
    if (array_key_exists('ok', $decoded)) {
        return (bool) $decoded['ok'];
    }
    if (array_key_exists('error', $decoded)) {
        $errorVal = $decoded['error'];
        if (is_string($errorVal)) return trim($errorVal) === '';
        return !$errorVal;
    }

    return true;
}

function queue_whatsapp_notification(int $studentId, string $title, string $message): void {
    $stmt = db()->prepare("INSERT INTO notifications (student_id, title, message, channel, status, created_at) VALUES (?, ?, ?, 'WhatsApp', 'queued', NOW())");
    $stmt->execute([$studentId, $title, $message]);
}

function send_admin_whatsapp_notification(string $title, string $message): bool {
    $enabled = setting_value('whatsapp_gateway_enabled', '0');
    if ($enabled !== '1') return false;

    $url = trim(setting_value('whatsapp_gateway_url', ''));
    $token = trim(setting_value('whatsapp_gateway_token', ''));
    $targetRaw = trim(setting_value('whatsapp_test_target', ''));
    if ($url === '' || $token === '' || $targetRaw === '') return false;

    $target = normalize_wa_target($targetRaw);
    if ($target === '' || strlen($target) < 10 || strlen($target) > 16) return false;

    $finalMessage = trim($title) !== ''
        ? '*' . trim($title) . '*' . "\n" . $message
        : $message;

    return dispatch_whatsapp_message($url, $token, $target, trim($finalMessage));
}

function try_dispatch_whatsapp_queue(): void {
    $enabled = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_enabled' LIMIT 1");
    if ($enabled !== '1') return;
    $url = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_url' LIMIT 1");
    $token = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_token' LIMIT 1");
    if (!$url || !$token) return;

    $rows = db()->query("SELECT n.id, n.student_id, n.title, n.message, s.parent_phone FROM notifications n JOIN students s ON s.id = n.student_id WHERE n.status='queued' ORDER BY n.id ASC LIMIT 5")->fetchAll();
    foreach ($rows as $row) {
        $target = normalize_wa_target((string) ($row['parent_phone'] ?? ''));
        $mediaUrl = '';
        $isReceiptNotif = trim((string) ($row['title'] ?? '')) === 'Kuitansi Pembayaran';
        if ($isReceiptNotif && function_exists('generate_receipt_links_for_student')) {
            $refs = extract_references_from_message((string) ($row['message'] ?? ''));
            if ($refs) {
                try {
                    $links = generate_receipt_links_for_student((int) ($row['student_id'] ?? 0), $refs, 'ADMIN');
                    foreach ($links as $linkRow) {
                        $candidate = trim((string) ($linkRow['url'] ?? ''));
                        if ($candidate !== '') {
                            $mediaUrl = $candidate;
                            break;
                        }
                    }
                } catch (Throwable $e) {
                    error_log('[WA_MEDIA_URL_BUILD_FAILED] ' . $e->getMessage());
                }
            }
        }
        $success = $target !== '' && dispatch_whatsapp_message($url, $token, $target, (string) $row['message'], $mediaUrl);
        $stmt = db()->prepare("UPDATE notifications SET status=?, sent_at=NOW() WHERE id=?");
        $stmt->execute([$success ? 'sent' : 'failed', $row['id']]);
    }
}
