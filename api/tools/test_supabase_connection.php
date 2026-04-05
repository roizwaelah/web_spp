<?php
// Script tes koneksi Supabase Storage.
// Contoh:
// /api/tools/test_supabase_connection.php
// /api/tools/test_supabase_connection.php?bucket=kuitansi
// /api/tools/test_supabase_connection.php?bucket=kuitansi&write_test=1
// /api/tools/test_supabase_connection.php?student_id=18&refs=PAY-... (probe link kuitansi)
// Header wajib: X-Test-Key: <TEST_SUPABASE_SCRIPT_KEY> (fallback: ?key=...)

define('API_ROOT', dirname(__DIR__));

if (file_exists(API_ROOT . '/vendor/autoload.php')) require API_ROOT . '/vendor/autoload.php';
require_once API_ROOT . '/core/helpers.php';
require_once API_ROOT . '/core/db.php';
require_once API_ROOT . '/utils/supabase_storage.php';
require_once API_ROOT . '/utils/payment.php';
require_once API_ROOT . '/bootstrap/app_helpers.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$cfg = supabase_storage_config();
$bucket = trim((string) ($_GET['bucket'] ?? ($cfg['default_bucket'] ?? '')));
$writeTest = ((string) ($_GET['write_test'] ?? '1')) === '1';
$studentId = (int) ($_GET['student_id'] ?? 0);
$refsRaw = trim((string) ($_GET['refs'] ?? ''));

$result = [
    'ok' => true,
    'config' => [
        'enabled' => (bool) ($cfg['enabled'] ?? false),
        'url_set' => trim((string) ($cfg['url'] ?? '')) !== '',
        'service_key_set' => trim((string) ($cfg['service_key'] ?? '')) !== '',
        'default_bucket' => (string) ($cfg['default_bucket'] ?? ''),
        'bucket_used' => $bucket,
    ],
    'checks' => [],
];

if (!supabase_storage_enabled()) {
    $result['ok'] = false;
    $result['checks'][] = [
        'name' => 'config',
        'ok' => false,
        'message' => 'Konfigurasi Supabase belum lengkap/aktif',
    ];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($bucket === '') {
    $result['ok'] = false;
    $result['checks'][] = [
        'name' => 'bucket',
        'ok' => false,
        'message' => 'Bucket tidak ditentukan. Isi SUPABASE_BUCKET atau parameter ?bucket=...',
    ];
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

$url = rtrim((string) $cfg['url'], '/');
$serviceKey = (string) $cfg['service_key'];

$bucketEndpoint = $url . '/storage/v1/bucket/' . rawurlencode($bucket);
$chBucket = curl_init($bucketEndpoint);
curl_setopt_array($chBucket, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'apikey: ' . $serviceKey,
        'Authorization: Bearer ' . $serviceKey,
    ],
    CURLOPT_TIMEOUT => 15,
]);
$bucketBody = curl_exec($chBucket);
$bucketCode = (int) curl_getinfo($chBucket, CURLINFO_HTTP_CODE);
$bucketErr = curl_error($chBucket);
curl_close($chBucket);
$bucketOk = $bucketBody !== false && $bucketCode >= 200 && $bucketCode < 300;
$result['checks'][] = [
    'name' => 'bucket_access',
    'ok' => $bucketOk,
    'http_code' => $bucketCode,
    'error' => $bucketErr !== '' ? $bucketErr : null,
];
if (!$bucketOk) {
    $result['ok'] = false;
}

$dummyPath = 'healthcheck/' . date('YmdHis') . '-' . bin2hex(random_bytes(4)) . '.txt';
$dummyContent = "SUPABASE_TEST " . date('c');

if ($writeTest) {
    $upload = supabase_storage_upload_binary($bucket, $dummyPath, $dummyContent, 'text/plain', true);
    $uploadOk = is_array($upload);
    $result['checks'][] = [
        'name' => 'upload_dummy',
        'ok' => $uploadOk,
        'object_path' => $dummyPath,
    ];
    if (!$uploadOk) {
        $result['ok'] = false;
    } else {
        $signed = supabase_storage_create_signed_url($bucket, $dummyPath, 3600);
        $signedOk = is_string($signed) && $signed !== '';
        $result['checks'][] = [
            'name' => 'signed_url',
            'ok' => $signedOk,
            'url' => $signedOk ? $signed : null,
        ];
        if (!$signedOk) {
            $result['ok'] = false;
        }

        $deleteEndpoint = $url . '/storage/v1/object/' . rawurlencode($bucket) . '/' . supabase_encode_object_path($dummyPath);
        $chDelete = curl_init($deleteEndpoint);
        curl_setopt_array($chDelete, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_HTTPHEADER => [
                'apikey: ' . $serviceKey,
                'Authorization: Bearer ' . $serviceKey,
            ],
            CURLOPT_TIMEOUT => 10,
        ]);
        $deleteBody = curl_exec($chDelete);
        $deleteCode = (int) curl_getinfo($chDelete, CURLINFO_HTTP_CODE);
        $deleteErr = curl_error($chDelete);
        curl_close($chDelete);
        $deleteOk = $deleteBody !== false && $deleteCode >= 200 && $deleteCode < 300;
        $result['checks'][] = [
            'name' => 'cleanup_dummy',
            'ok' => $deleteOk,
            'http_code' => $deleteCode,
            'error' => $deleteErr !== '' ? $deleteErr : null,
        ];
    }
}

if ($studentId > 0) {
    $refs = [];
    if ($refsRaw !== '') {
        foreach (explode(',', $refsRaw) as $rawRef) {
            $ref = trim((string) $rawRef);
            if ($ref !== '') $refs[$ref] = $ref;
        }
    }
    if (!$refs) {
        $stmtRefs = db()->prepare("SELECT reference_no
            FROM transactions
            WHERE student_id = ? AND status = 'paid' AND reference_no IS NOT NULL AND reference_no <> ''
            ORDER BY id DESC
            LIMIT 10");
        $stmtRefs->execute([$studentId]);
        foreach ($stmtRefs->fetchAll() as $row) {
            $ref = trim((string) ($row['reference_no'] ?? ''));
            if ($ref !== '') $refs[$ref] = $ref;
            if (count($refs) >= 3) break;
        }
    }

    $refs = array_values($refs);
    $linkProbe = [
        'student_id' => $studentId,
        'references' => $refs,
        'links' => [],
    ];
    if ($refs && function_exists('generate_receipt_links_for_student')) {
        try {
            $links = generate_receipt_links_for_student($studentId, $refs, 'ADMIN');
            $linkProbe['links'] = $links;
            $linkProbe['ok'] = count($links) > 0;
        } catch (Throwable $e) {
            $linkProbe['ok'] = false;
            $linkProbe['error'] = $e->getMessage();
        }
    } else {
        $linkProbe['ok'] = false;
        $linkProbe['error'] = 'Referensi transaksi paid tidak ditemukan untuk siswa ini';
    }
    $result['receipt_link_probe'] = $linkProbe;
}

echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
