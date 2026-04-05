<?php
// Bootstrap utama API: load dependency, helper, dan route aggregator.

define('API_ROOT', __DIR__);

if (file_exists(API_ROOT . '/vendor/autoload.php')) require API_ROOT . '/vendor/autoload.php';
require_once API_ROOT . '/core/helpers.php';
require_once API_ROOT . '/core/db.php';
require_once API_ROOT . '/core/auth.php';
require_once API_ROOT . '/utils/notifications.php';
require_once API_ROOT . '/utils/supabase_storage.php';
require_once API_ROOT . '/utils/payment.php';
require_once API_ROOT . '/bootstrap/app_helpers.php';

set_exception_handler(static function (Throwable $e): void {
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
    }
    error_log('[API_FATAL] ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    echo json_encode([
        'message' => 'Terjadi kesalahan pada server',
        'debug' => env_value('APP_ENV', 'development') === 'development' ? $e->getMessage() : null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
});

$origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
$allowedOriginsRaw = env_value('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173');
$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', (string) $allowedOriginsRaw))));

if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Max-Age: 600');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()');
header("Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self';");
header('Cross-Origin-Resource-Policy: same-origin');
header('Cross-Origin-Opener-Policy: same-origin');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_samesite', 'Strict');
if (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['SERVER_PORT'] ?? '') === '443')
) {
    ini_set('session.cookie_secure', '1');
}
if (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
    || (($_SERVER['SERVER_PORT'] ?? '') === '443')
) {
    header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    if ($origin !== '' && !in_array($origin, $allowedOrigins, true)) {
        response(['message' => 'Origin tidak diizinkan'], 403);
    }
    http_response_code(204);
    exit;
}

if (env_value('APP_ENV', 'development') === 'production') {
    $jwtSecret = (string) env_value('JWT_SECRET', '');
    if ($jwtSecret === '' || in_array($jwtSecret, ['secret', 'changeme', 'default'], true) || strlen($jwtSecret) < 32) {
        response(['message' => 'Konfigurasi keamanan tidak valid: JWT_SECRET wajib kuat pada mode production'], 500);
    }
}

rate_limit_or_fail('api:ip:' . client_ip(), 600, 60, 'Terlalu banyak permintaan API. Coba lagi sebentar.');


$route = ltrim((string) query('route', ''), '/');
$method = request_method();
$pdo = db();

if (!is_dir(API_ROOT . '/storage/backups')) @mkdir(API_ROOT . '/storage/backups', 0777, true);
if (!is_dir(API_ROOT . '/storage/payment-proofs')) @mkdir(API_ROOT . '/storage/payment-proofs', 0777, true);
if (!is_dir(API_ROOT . '/storage/receipts')) @mkdir(API_ROOT . '/storage/receipts', 0777, true);
if (!is_dir(API_ROOT . '/public/receipts')) @mkdir(API_ROOT . '/public/receipts', 0777, true);

$pdo->exec("CREATE TABLE IF NOT EXISTS user_menu_access (
    user_id INT NOT NULL,
    menu_key VARCHAR(50) NOT NULL,
    created_at DATETIME NULL,
    PRIMARY KEY (user_id, menu_key),
    CONSTRAINT fk_user_menu_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)");

require API_ROOT . '/routes/auth.php';
require API_ROOT . '/routes/admin_master.php';
require API_ROOT . '/routes/admin_finance.php';
require API_ROOT . '/routes/admin_system.php';
require API_ROOT . '/routes/parent.php';

response(['message' => 'Route tidak ditemukan'], 404);
