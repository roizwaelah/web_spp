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
require_once API_ROOT . '/utils/ipaymu.php';
require_once API_ROOT . '/utils/midtrans.php';
require_once API_ROOT . '/utils/doku.php';
require_once API_ROOT . '/utils/tripay.php';
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

try {
    $roleColumn = $pdo->query("SHOW COLUMNS FROM users LIKE 'role'")->fetch();
    $roleType = strtolower((string) ($roleColumn['Type'] ?? ''));
    if ($roleType !== '' && !str_contains($roleType, "'verifikator'")) {
        $pdo->exec("ALTER TABLE users MODIFY COLUMN role ENUM('admin','bendahara','verifikator','parent') NOT NULL");
    }
} catch (Throwable $e) {
    // Abaikan jika table users belum tersedia saat bootstrap awal.
}

if (!is_dir(API_ROOT . '/storage/backups')) @mkdir(API_ROOT . '/storage/backups', 0777, true);
if (!is_dir(API_ROOT . '/storage/payment-proofs')) @mkdir(API_ROOT . '/storage/payment-proofs', 0777, true);
if (!is_dir(API_ROOT . '/storage/receipts')) @mkdir(API_ROOT . '/storage/receipts', 0777, true);
if (!is_dir(API_ROOT . '/public/receipts')) @mkdir(API_ROOT . '/public/receipts', 0777, true);

try {
    $txOfficerColumn = $pdo->query("SHOW COLUMNS FROM transactions LIKE 'officer_name'")->fetch();
    if (!$txOfficerColumn) {
        $pdo->exec("ALTER TABLE transactions ADD COLUMN officer_name VARCHAR(120) NULL AFTER notes");
    }
} catch (Throwable $e) {
    // Abaikan jika tabel transactions belum tersedia saat bootstrap awal.
}

$billTableExists = false;
try {
    $tableStmt = $pdo->query("SHOW TABLES LIKE 'bills'");
    $billTableExists = (bool) ($tableStmt && $tableStmt->fetchColumn());
} catch (Throwable $e) {
    $billTableExists = false;
}

if ($billTableExists) {
    $hasBillAcademicYearColumn = false;
    try {
        $colStmt = $pdo->query("SHOW COLUMNS FROM bills LIKE 'academic_year_id'");
        $hasBillAcademicYearColumn = (bool) ($colStmt && $colStmt->fetch());
    } catch (Throwable $e) {
        $hasBillAcademicYearColumn = false;
    }

    if (!$hasBillAcademicYearColumn) {
        try {
            $pdo->exec("ALTER TABLE bills ADD COLUMN academic_year_id INT NULL AFTER student_id");
            $hasBillAcademicYearColumn = true;
        } catch (Throwable $e) {
            // Abaikan jika kolom sudah dibuat di request lain.
        }
    }

    if ($hasBillAcademicYearColumn) {
        try {
            $needsBackfill = (int) scalar("SELECT COUNT(*) FROM bills WHERE academic_year_id IS NULL");
            if ($needsBackfill > 0) {
                $pdo->exec("UPDATE bills b JOIN students s ON s.id = b.student_id SET b.academic_year_id = s.academic_year_id WHERE b.academic_year_id IS NULL");
            }
        } catch (Throwable $e) {
            // Abaikan error backfill sementara.
        }

        try {
            $idxStmt = $pdo->query("SHOW INDEX FROM bills WHERE Key_name = 'idx_bills_academic_year_id'");
            $hasIdx = (bool) ($idxStmt && $idxStmt->fetch());
            if (!$hasIdx) {
                $pdo->exec("ALTER TABLE bills ADD INDEX idx_bills_academic_year_id (academic_year_id)");
            }
        } catch (Throwable $e) {
            // Abaikan jika index belum bisa dibuat saat ini.
        }
    }
}
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_proof_groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        reference_no VARCHAR(100) NULL,
        proof_file_name VARCHAR(255) NOT NULL,
        proof_path VARCHAR(255) NOT NULL,
        mime_type VARCHAR(120) NULL,
        size_bytes BIGINT NOT NULL DEFAULT 0,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        notes TEXT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        created_at DATETIME NULL,
        KEY idx_ppg_student_status (student_id, status),
        KEY idx_ppg_reference_no (reference_no)
    )");
    $pdo->exec("CREATE TABLE IF NOT EXISTS payment_proof_group_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        bill_id INT NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at DATETIME NULL,
        UNIQUE KEY uq_ppgi_group_bill (group_id, bill_id),
        KEY idx_ppgi_bill (bill_id)
    )");
} catch (Throwable $e) {
    // Abaikan jika tabel referensi belum tersedia saat bootstrap awal.
}

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
