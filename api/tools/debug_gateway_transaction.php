<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

$debugKey = (string) env_value('DEBUG_TOOLS_KEY', '');
$inputKey = (string) ($_GET['key'] ?? '');
if ($debugKey === '' || !hash_equals($debugKey, $inputKey)) {
    http_response_code(403);
    echo json_encode([
        'ok' => false,
        'message' => 'Forbidden',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$referenceNo = trim((string) ($_GET['reference_no'] ?? $_GET['ref'] ?? ''));
if ($referenceNo === '') {
    http_response_code(422);
    echo json_encode([
        'ok' => false,
        'message' => 'Parameter reference_no wajib diisi',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $stmt = db()->prepare("
        SELECT
            t.id,
            t.reference_no,
            t.payment_channel,
            t.status,
            t.amount_paid,
            t.payment_date,
            t.created_at,
            t.notes,
            t.bill_id,
            t.student_id,
            b.bill_name,
            b.period,
            s.name AS student_name,
            s.nisn
        FROM transactions t
        LEFT JOIN bills b ON b.id = t.bill_id
        LEFT JOIN students s ON s.id = t.student_id
        WHERE t.reference_no = ?
        ORDER BY t.id ASC
    ");
    $stmt->execute([$referenceNo]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) {
        http_response_code(404);
        echo json_encode([
            'ok' => false,
            'message' => 'Transaksi tidak ditemukan',
            'reference_no' => $referenceNo,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $notesParsed = null;
    $rawNotes = (string) ($rows[0]['notes'] ?? '');
    if ($rawNotes !== '') {
        $decoded = json_decode($rawNotes, true);
        if (is_array($decoded)) {
            if (isset($decoded['gateway_response']) && is_array($decoded['gateway_response'])) {
                unset($decoded['gateway_response']['Signature']);
                unset($decoded['gateway_response']['signature']);
            }
            $notesParsed = $decoded;
        }
    }

    $summary = [
        'reference_no' => $referenceNo,
        'rows_count' => count($rows),
        'statuses' => array_values(array_unique(array_map(
            static fn(array $r): string => (string) ($r['status'] ?? ''),
            $rows
        ))),
        'channels' => array_values(array_unique(array_map(
            static fn(array $r): string => (string) ($r['payment_channel'] ?? ''),
            $rows
        ))),
        'amount_total' => array_sum(array_map(
            static fn(array $r): float => (float) ($r['amount_paid'] ?? 0),
            $rows
        )),
    ];

    echo json_encode([
        'ok' => true,
        'summary' => $summary,
        'gateway_notes_parsed' => $notesParsed,
        'gateway_notes_raw' => $rawNotes,
        'transactions' => $rows,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'message' => 'Gagal membaca data debug',
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}

