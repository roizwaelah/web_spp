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

function evaluate_whatsapp_gateway_response(array $decoded, bool $isKirimi = false): bool
{
    if (array_key_exists('status', $decoded)) {
        $status = $decoded['status'];
        if (is_bool($status)) return $status;
        $statusText = strtolower(trim((string) $status));
        if ($statusText !== '') {
            if (in_array($statusText, ['true', 'success', 'sent', 'queued', 'ok', '1'], true)) return true;
            if (in_array($statusText, ['false', 'failed', 'error', '0'], true)) return false;
        }
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
    if ($isKirimi) {
        $message = strtolower(trim((string) ($decoded['message'] ?? $decoded['msg'] ?? '')));
        if ($message !== '') {
            if (str_contains($message, 'success') || str_contains($message, 'berhasil') || str_contains($message, 'queued')) {
                return true;
            }
            if (str_contains($message, 'gagal') || str_contains($message, 'error') || str_contains($message, 'invalid')) {
                return false;
            }
        }
    }
    return true;
}

function dispatch_whatsapp_message_result(string $url, string $token, string $target, string $message, ?string $mediaUrlOverride = null): array {
    $cleanMessage = preg_replace("/\n{3,}/", "\n\n", trim($message)) ?: trim($message);
    $isKirimi = false;
    $hasMediaUrl = false;

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
        $isKirimi = true;
        $credentials = parse_kirimi_credentials($token);
        if (!$credentials) {
            return [
                'success' => false,
                'http_code' => 0,
                'curl_error' => 'Kredensial Kirimi tidak valid',
                'response_raw' => '',
                'response_json' => null,
            ];
        }
        $mediaUrl = trim((string) ($mediaUrlOverride ?? ''));
        $hasMediaUrl = $mediaUrl !== '';
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

    $timeoutSeconds = $isKirimi ? ($hasMediaUrl ? 30 : 15) : 8;
    $connectTimeoutSeconds = $isKirimi ? 10 : 5;
    $maxAttempts = $isKirimi ? 2 : 1;
    $attempt = 0;
    $result = false;
    $httpCode = 0;
    $curlError = '';
    $curlErrno = 0;

    do {
        $attempt++;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_CONNECTTIMEOUT => $connectTimeoutSeconds,
            CURLOPT_TIMEOUT => $timeoutSeconds,
        ]);
        $result = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErrno = curl_errno($ch);
        $curlError = $curlErrno !== 0 ? curl_error($ch) : '';
        curl_close($ch);

        if (!in_array($curlErrno, [CURLE_OPERATION_TIMEDOUT, CURLE_COULDNT_CONNECT], true)) {
            break;
        }
    } while ($attempt < $maxAttempts);

    if ($curlError !== '' || $result === false || $httpCode < 200 || $httpCode >= 300) {
        return [
            'success' => false,
            'http_code' => $httpCode,
            'curl_error' => $curlError,
            'response_raw' => is_string($result) ? $result : '',
            'response_json' => null,
        ];
    }

    $decoded = json_decode((string) $result, true);
    $success = !is_array($decoded)
        ? true
        : evaluate_whatsapp_gateway_response($decoded, $isKirimi);

    return [
        'success' => $success,
        'http_code' => $httpCode,
        'curl_error' => '',
        'response_raw' => (string) $result,
        'response_json' => is_array($decoded) ? $decoded : null,
    ];
}

function dispatch_whatsapp_message(string $url, string $token, string $target, string $message, ?string $mediaUrlOverride = null): bool {
    $result = dispatch_whatsapp_message_result($url, $token, $target, $message, $mediaUrlOverride);
    return (bool) ($result['success'] ?? false);
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

function dispatch_whatsapp_queue_batch(int $limit = 5, int $delayMinMs = 0, int $delayMaxMs = 0): array {
    $enabled = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_enabled' LIMIT 1");
    if ($enabled !== '1') {
        return ['attempted' => 0, 'sent' => 0, 'failed' => 0, 'remaining_queued' => 0, 'enabled' => false];
    }

    $url = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_url' LIMIT 1");
    $token = scalar("SELECT setting_value FROM settings WHERE setting_key='whatsapp_gateway_token' LIMIT 1");
    if (!$url || !$token) {
        return ['attempted' => 0, 'sent' => 0, 'failed' => 0, 'remaining_queued' => 0, 'enabled' => true, 'configured' => false];
    }

    $limit = max(1, min(100, $limit));
    $delayMinMs = max(0, $delayMinMs);
    $delayMaxMs = max(0, $delayMaxMs);
    if ($delayMaxMs < $delayMinMs) {
        [$delayMinMs, $delayMaxMs] = [$delayMaxMs, $delayMinMs];
    }

    $rows = db()->query("SELECT n.id, n.student_id, n.title, n.message, s.parent_phone FROM notifications n JOIN students s ON s.id = n.student_id WHERE n.status='queued' ORDER BY n.id ASC LIMIT " . (int) $limit)->fetchAll();
    $attempted = count($rows);
    $sent = 0;
    $failed = 0;

    foreach ($rows as $index => $row) {
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

        if ($success) {
            $sent++;
        } else {
            $failed++;
        }

        if ($delayMaxMs > 0 && $index < ($attempted - 1)) {
            usleep(random_int($delayMinMs * 1000, $delayMaxMs * 1000));
        }
    }

    $remainingQueued = (int) scalar("SELECT COUNT(*) FROM notifications WHERE status='queued'");

    return [
        'attempted' => $attempted,
        'sent' => $sent,
        'failed' => $failed,
        'remaining_queued' => $remainingQueued,
        'enabled' => true,
        'configured' => true,
    ];
}

function try_dispatch_whatsapp_queue(): void {
    dispatch_whatsapp_queue_batch(5, 0, 0);
}
