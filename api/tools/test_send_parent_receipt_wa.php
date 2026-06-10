<?php
// Script manual untuk tes kirim WA kuitansi ke orang tua.
// Akses contoh:
// /api/tools/test_send_parent_receipt_wa.php?student_id=12
// /api/tools/test_send_parent_receipt_wa.php?student_id=12&refs=PAY-2026040202031715-597
// /api/tools/test_send_parent_receipt_wa.php?student_id=12&dry_run=1
// Header wajib: X-Test-Key: <TEST_WA_SCRIPT_KEY> (fallback: ?key=...)

define('API_ROOT', dirname(__DIR__));

if (file_exists(API_ROOT . '/vendor/autoload.php')) require API_ROOT . '/vendor/autoload.php';
require_once API_ROOT . '/core/helpers.php';
require_once API_ROOT . '/core/db.php';
require_once API_ROOT . '/utils/notifications.php';
require_once API_ROOT . '/utils/supabase_storage.php';
require_once API_ROOT . '/utils/payment.php';
require_once API_ROOT . '/bootstrap/app_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$studentId = (int) ($_GET['student_id'] ?? 0);
if ($studentId <= 0) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Parameter student_id wajib diisi',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$student = student_row($studentId);
if (!$student) {
    http_response_code(404);
    echo json_encode([
        'ok' => false,
        'message' => 'Siswa tidak ditemukan',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$parentPhoneRaw = trim((string) ($student['parent_phone'] ?? ''));
$target = normalize_wa_target($parentPhoneRaw);
if ($target === '') {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Nomor WA orang tua belum valid pada data siswa',
        'student_id' => $studentId,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$gatewayEnabled = setting_value('whatsapp_gateway_enabled', '0') === '1';
$gatewayUrl = trim((string) setting_value('whatsapp_gateway_url', ''));
$gatewayToken = trim((string) setting_value('whatsapp_gateway_token', ''));
if (!$gatewayEnabled || $gatewayUrl === '' || $gatewayToken === '') {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Konfigurasi WhatsApp Gateway belum lengkap/aktif',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$refsRaw = trim((string) ($_GET['refs'] ?? ''));
$references = [];
if ($refsRaw !== '') {
    foreach (explode(',', $refsRaw) as $rawRef) {
        $ref = trim((string) $rawRef);
        if ($ref !== '') $references[$ref] = $ref;
    }
}

if (!$references) {
    $stmtRefs = db()->prepare("SELECT reference_no
        FROM transactions
        WHERE student_id = ? AND status = 'paid' AND reference_no IS NOT NULL AND reference_no <> ''
        ORDER BY id DESC
        LIMIT 30");
    $stmtRefs->execute([$studentId]);
    foreach ($stmtRefs->fetchAll() as $row) {
        $ref = trim((string) ($row['reference_no'] ?? ''));
        if ($ref === '') continue;
        $references[$ref] = $ref;
        if (count($references) >= 5) break;
    }
}

$references = array_values($references);
if (!$references) {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Tidak ditemukan referensi transaksi paid untuk siswa ini. Tambahkan refs=REF1,REF2 secara manual.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$summary = trim((string) ($_GET['summary'] ?? 'pembayaran'));
$forceUnique = ((string) ($_GET['force_unique'] ?? '0')) === '1';
$links = generate_receipt_links_for_student($studentId, $references, 'ADMIN');
$missingLinks = [];
foreach ($references as $ref) {
    $found = false;
    foreach ($links as $row) {
        if (trim((string) ($row['reference_no'] ?? '')) === $ref) {
            $found = true;
            break;
        }
    }
    if (!$found) $missingLinks[] = $ref;
}

$referenceDiagnostics = [];
if ($references) {
    $diagPlaceholders = implode(',', array_fill(0, count($references), '?'));
    $diagStmt = db()->prepare("SELECT reference_no, student_id, status, COUNT(*) AS rows_count, COALESCE(SUM(amount_paid),0) AS amount_total
        FROM transactions
        WHERE reference_no IN ({$diagPlaceholders})
        GROUP BY reference_no, student_id, status
        ORDER BY reference_no ASC, student_id ASC, status ASC");
    $diagStmt->execute($references);
    $referenceDiagnostics = $diagStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
}

$totalPaid = 0.0;
if ($references) {
    $placeholders = implode(',', array_fill(0, count($references), '?'));
    $params = array_merge([$studentId], $references);
    $stmtTotal = db()->prepare("SELECT COALESCE(SUM(amount_paid),0) AS total_paid
        FROM transactions
        WHERE student_id = ?
          AND status = 'paid'
          AND reference_no IN ({$placeholders})");
    $stmtTotal->execute($params);
    $rowTotal = $stmtTotal->fetch();
    $totalPaid = (float) ($rowTotal['total_paid'] ?? 0);
}

$message = build_receipt_notification_message($summary, $totalPaid, $references, $links);
if ($forceUnique) {
    $message .= "\nKode Tes: " . date('YmdHis') . '-' . substr(sha1((string) microtime(true)), 0, 6);
}
$mediaUrlForGateway = '';
if (function_exists('extract_references_from_message')) {
    $refsFromMessage = extract_references_from_message($message);
    if ($refsFromMessage) {
        try {
            $linksForMedia = generate_receipt_links_for_student($studentId, $refsFromMessage, 'ADMIN');
            foreach ($linksForMedia as $linkRow) {
                $candidate = trim((string) ($linkRow['url'] ?? ''));
                if ($candidate !== '') {
                    $mediaUrlForGateway = $candidate;
                    break;
                }
            }
        } catch (Throwable $e) {
            error_log('[TEST_WA_MEDIA_URL_BUILD_FAILED] ' . $e->getMessage());
        }
    }
}

$gatewayType = 'generic';
if (function_exists('is_kirimi_url') && is_kirimi_url($gatewayUrl)) $gatewayType = 'kirimi';
if (function_exists('is_fonnte_url') && is_fonnte_url($gatewayUrl)) $gatewayType = 'fonnte';
$dryRun = ((string) ($_GET['dry_run'] ?? '0')) === '1';
$sent = false;
$gatewayResult = null;
if (!$dryRun) {
    $gatewayResult = dispatch_whatsapp_message_result($gatewayUrl, $gatewayToken, $target, $message, $mediaUrlForGateway);
    $sent = (bool) ($gatewayResult['success'] ?? false);
}

echo json_encode([
    'ok' => true,
    'dry_run' => $dryRun,
    'force_unique' => $forceUnique,
    'sent' => $dryRun ? null : $sent,
    'student' => [
        'id' => (int) ($student['id'] ?? 0),
        'name' => (string) ($student['name'] ?? '-'),
        'parent_phone' => $parentPhoneRaw,
        'target' => $target,
    ],
    'gateway' => [
        'type' => $gatewayType,
        'url' => $gatewayUrl,
    ],
    'gateway_result' => $gatewayResult,
    'references' => $references,
    'receipt_links' => $links,
    'missing_receipt_links' => $missingLinks,
    'reference_diagnostics' => $referenceDiagnostics,
    'media_url_for_gateway' => $mediaUrlForGateway,
    'message' => $message,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
