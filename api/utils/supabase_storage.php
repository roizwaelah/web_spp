<?php
require_once __DIR__ . '/../core/helpers.php';

function supabase_storage_config(): array {
    $enabled = env_value('SUPABASE_ENABLED', '0') === '1';
    $url = rtrim((string) env_value('SUPABASE_URL', ''), '/');
    $serviceKey = trim((string) env_value('SUPABASE_SERVICE_ROLE_KEY', ''));
    $defaultBucket = trim((string) env_value('SUPABASE_BUCKET', ''));

    return [
        'enabled' => $enabled,
        'url' => $url,
        'service_key' => $serviceKey,
        'default_bucket' => $defaultBucket,
    ];
}

function supabase_storage_enabled(): bool {
    $cfg = supabase_storage_config();
    return $cfg['enabled'] === true
        && $cfg['url'] !== ''
        && $cfg['service_key'] !== '';
}

function supabase_encode_object_path(string $path): string {
    $parts = array_values(array_filter(explode('/', str_replace('\\', '/', trim($path))), static fn($p) => $p !== ''));
    return implode('/', array_map('rawurlencode', $parts));
}

function supabase_storage_upload_binary(
    string $bucket,
    string $objectPath,
    string $binaryContent,
    string $contentType = 'application/octet-stream',
    bool $upsert = true
): ?array {
    if (!supabase_storage_enabled()) return null;

    $bucket = trim($bucket);
    if ($bucket === '') {
        $cfg = supabase_storage_config();
        $bucket = (string) ($cfg['default_bucket'] ?? '');
    }
    if ($bucket === '' || $objectPath === '') return null;

    $cfg = supabase_storage_config();
    $encodedPath = supabase_encode_object_path($objectPath);
    $endpoint = $cfg['url'] . '/storage/v1/object/' . rawurlencode($bucket) . '/' . $encodedPath;

    $headers = [
        'apikey: ' . $cfg['service_key'],
        'Authorization: Bearer ' . $cfg['service_key'],
        'Content-Type: ' . ($contentType !== '' ? $contentType : 'application/octet-stream'),
        'x-upsert: ' . ($upsert ? 'true' : 'false'),
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $binaryContent,
        CURLOPT_TIMEOUT => 15,
    ]);
    $responseBody = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hasCurlError = curl_errno($ch) !== 0;
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($hasCurlError || $responseBody === false || $httpCode < 200 || $httpCode >= 300) {
        error_log('[SUPABASE_UPLOAD_FAILED] http=' . $httpCode . ' error=' . $curlError . ' path=' . $objectPath);
        return null;
    }

    $publicUrl = $cfg['url'] . '/storage/v1/object/public/' . rawurlencode($bucket) . '/' . $encodedPath;
    return [
        'bucket' => $bucket,
        'object_path' => $objectPath,
        'public_url' => $publicUrl,
    ];
}

function supabase_storage_create_signed_url(string $bucket, string $objectPath, int $expiresInSeconds = 604800): ?string {
    if (!supabase_storage_enabled()) return null;
    if (trim($bucket) === '' || trim($objectPath) === '') return null;
    if ($expiresInSeconds <= 0) $expiresInSeconds = 604800;

    $cfg = supabase_storage_config();
    $encodedPath = supabase_encode_object_path($objectPath);
    $endpoint = $cfg['url'] . '/storage/v1/object/sign/' . rawurlencode($bucket) . '/' . $encodedPath;
    $body = json_encode(['expiresIn' => $expiresInSeconds], JSON_UNESCAPED_UNICODE);

    $headers = [
        'apikey: ' . $cfg['service_key'],
        'Authorization: Bearer ' . $cfg['service_key'],
        'Content-Type: application/json',
    ];

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_TIMEOUT => 10,
    ]);
    $responseBody = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hasCurlError = curl_errno($ch) !== 0;
    curl_close($ch);

    if ($hasCurlError || $responseBody === false || $httpCode < 200 || $httpCode >= 300) return null;
    $decoded = json_decode((string) $responseBody, true);
    if (!is_array($decoded)) return null;

    $relative = trim((string) ($decoded['signedURL'] ?? $decoded['signedUrl'] ?? ''), '/');
    if ($relative === '') return null;
    return $cfg['url'] . '/storage/v1/' . $relative;
}

