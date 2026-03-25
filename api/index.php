<?php
// Bootstrap utama API: load dependency, helper, dan route aggregator.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') exit;

define('API_ROOT', __DIR__);

if (file_exists(API_ROOT . '/vendor/autoload.php')) require API_ROOT . '/vendor/autoload.php';
require_once API_ROOT . '/core/helpers.php';
require_once API_ROOT . '/core/db.php';
require_once API_ROOT . '/core/auth.php';
require_once API_ROOT . '/utils/notifications.php';
require_once API_ROOT . '/utils/payment.php';
require_once API_ROOT . '/bootstrap/app_helpers.php';

$route = ltrim((string) query('route', ''), '/');
$method = request_method();
$pdo = db();

if (!is_dir(API_ROOT . '/storage/backups')) @mkdir(API_ROOT . '/storage/backups', 0777, true);
if (!is_dir(API_ROOT . '/storage/payment-proofs')) @mkdir(API_ROOT . '/storage/payment-proofs', 0777, true);

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
