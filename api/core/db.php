<?php
require_once __DIR__ . '/helpers.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', env_value('DB_HOST', '127.0.0.1'), env_value('DB_PORT', '3306'), env_value('DB_NAME', 'spp_madrasah_prod'));
    $pdo = new PDO($dsn, env_value('DB_USER', 'root'), env_value('DB_PASS', ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    return $pdo;
}

function scalar(string $sql, array $params = []) {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchColumn();
}
