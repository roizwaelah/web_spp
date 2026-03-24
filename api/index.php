<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') exit;

if (file_exists(__DIR__ . '/vendor/autoload.php')) require __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/core/helpers.php';
require_once __DIR__ . '/core/db.php';
require_once __DIR__ . '/core/auth.php';
require_once __DIR__ . '/utils/notifications.php';
require_once __DIR__ . '/utils/payment.php';

$route = ltrim((string) query('route', ''), '/');
$method = request_method();
$pdo = db();

if (!is_dir(__DIR__ . '/storage/backups')) @mkdir(__DIR__ . '/storage/backups', 0777, true);
if (!is_dir(__DIR__ . '/storage/payment-proofs')) @mkdir(__DIR__ . '/storage/payment-proofs', 0777, true);

function setting_value(string $key, string $default = ''): string {
    return scalar('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [$key]) ?: $default;
}

function ensure_required(array $input, array $required): void {
    foreach ($required as $field) {
        if (!isset($input[$field]) || trim((string) $input[$field]) === '') response(['message' => 'Field wajib: ' . $field], 422);
    }
}

function log_activity(?int $userId, string $action, string $entityType, ?int $entityId = null, ?string $description = null): void {
    $stmt = db()->prepare("INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, created_at) VALUES (?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$userId, $action, $entityType, $entityId, $description]);
}

function finance_posts_for_student(int $studentId): array {
    $sql = "SELECT fp.* FROM finance_posts fp
            JOIN students s ON s.id = ?
            WHERE fp.is_active = 1 AND (
                (fp.applies_to='student' AND fp.student_id=s.id) OR
                (fp.applies_to='class' AND fp.class_id=s.class_id)
            )
            ORDER BY fp.id DESC";
    $stmt = db()->prepare($sql);
    $stmt->execute([$studentId]);
    return $stmt->fetchAll();
}

function student_row(int $studentId): ?array {
    $stmt = db()->prepare("SELECT s.*, c.name class_name, ay.name academic_year
        FROM students s
        LEFT JOIN classes c ON c.id=s.class_id
        LEFT JOIN academic_years ay ON ay.id=s.academic_year_id
        WHERE s.id=? LIMIT 1");
    $stmt->execute([$studentId]);
    return $stmt->fetch() ?: null;
}

function validate_role_access(array $user, array $roles): void {
    if (!in_array($user['role'], $roles, true)) response(['message' => 'Forbidden'], 403);
}

function save_uploaded_file(string $field, string $folder, array $allowedExt = ['jpg', 'jpeg', 'png', 'pdf']): ?array {
    if (empty($_FILES[$field]['tmp_name'])) return null;
    $ext = strtolower(pathinfo($_FILES[$field]['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExt, true)) response(['message' => 'Format file tidak didukung'], 422);
    $safeName = uniqid($folder . '-', true) . '.' . $ext;
    $targetDir = __DIR__ . '/storage/' . $folder;
    if (!is_dir($targetDir)) @mkdir($targetDir, 0777, true);
    $targetPath = $targetDir . '/' . $safeName;
    if (!move_uploaded_file($_FILES[$field]['tmp_name'], $targetPath)) response(['message' => 'Gagal menyimpan file'], 422);
    return [
        'filename' => $_FILES[$field]['name'],
        'path' => $targetPath,
        'public_url' => query('base_url', '') . 'storage/' . $folder . '/' . $safeName,
        'mime_type' => $_FILES[$field]['type'] ?? '',
        'size_bytes' => filesize($targetPath) ?: 0,
    ];
}

function create_transaction_and_mark_paid(int $billId, int $studentId, string $channel, float $amount, string $notes = '', string $status = 'paid'): array {
    $reference = create_payment_reference($channel);
    $stmt = db()->prepare("INSERT INTO transactions (bill_id, student_id, payment_channel, amount_paid, payment_date, reference_no, status, notes, created_at) VALUES (?, ?, ?, ?, NOW(), ?, ?, ?, NOW())");
    $stmt->execute([$billId, $studentId, $channel, $amount, $reference, $status, $notes]);
    if ($status === 'paid') {
        $stmtBill = db()->prepare("UPDATE bills SET status='paid', paid_at=NOW() WHERE id=?");
        $stmtBill->execute([$billId]);
    }
    return ['transaction_id' => (int) db()->lastInsertId(), 'reference_no' => $reference];
}

function list_settings(): array {
    $rows = db()->query("SELECT setting_key, setting_value FROM settings ORDER BY setting_key ASC")->fetchAll();
    $result = [];
    foreach ($rows as $row) $result[$row['setting_key']] = $row['setting_value'];
    return $result;
}

function parent_user_student(array $user): array {
    if (!$user['student_id']) response(['message' => 'Akun orang tua belum terhubung ke siswa'], 422);
    $student = student_row((int) $user['student_id']);
    if (!$student) response(['message' => 'Data siswa tidak ditemukan'], 404);
    return $student;
}

if ($route === 'login' && $method === 'POST') {
    $input = json_input();
    ensure_required($input, ['email', 'password']);
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    $stmt->execute([$input['email']]);
    $user = $stmt->fetch();
    if (!$user || !password_verify($input['password'], $user['password'])) response(['message' => 'Email atau password salah'], 422);

    $payload = ['id' => $user['id'], 'role' => $user['role'], 'exp' => time() + (86400 * 7)];
    log_activity((int) $user['id'], 'login', 'auth', (int) $user['id'], 'Pengguna login ke sistem');
    response([
        'token' => generate_token($payload),
        'user' => [
            'id' => (int) $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'student_id' => $user['student_id'] ? (int) $user['student_id'] : null,
        ]
    ]);
}

if ($route === 'me' && $method === 'GET') {
    response(['user' => require_auth()]);
}

if ($route === 'admin/meta' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    response([
        'classes' => $pdo->query('SELECT id, name FROM classes WHERE is_active=1 ORDER BY name')->fetchAll(),
        'years' => $pdo->query('SELECT id, name FROM academic_years ORDER BY id DESC')->fetchAll(),
        'students' => $pdo->query('SELECT id, name, nis FROM students ORDER BY name')->fetchAll(),
        'roles' => [
            ['value' => 'admin', 'label' => 'Admin'],
            ['value' => 'bendahara', 'label' => 'Bendahara / TU'],
            ['value' => 'parent', 'label' => 'Orang Tua'],
        ],
    ]);
}

if ($route === 'admin/dashboard' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);

    $summary = [
        'students' => (int) scalar('SELECT COUNT(*) FROM students'),
        'classes' => (int) scalar('SELECT COUNT(*) FROM classes WHERE is_active=1'),
        'activeBills' => (int) scalar("SELECT COUNT(*) FROM bills WHERE status <> 'paid'"),
        'pendingProofs' => (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE status='pending'"),
        'monthIncome' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE status='paid' AND DATE_FORMAT(payment_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')"),
        'yearIncome' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE status='paid' AND YEAR(payment_date) = YEAR(CURDATE())"),
        'lastBackup' => scalar("SELECT DATE_FORMAT(MAX(created_at), '%d-%m-%Y %H:%i') FROM backups") ?: 'Belum ada',
    ];

    $monthly = $pdo->query("SELECT DATE_FORMAT(payment_date, '%b') month, SUM(amount_paid) total
        FROM transactions
        WHERE status='paid' AND YEAR(payment_date)=YEAR(CURDATE())
        GROUP BY DATE_FORMAT(payment_date, '%Y-%m'), DATE_FORMAT(payment_date, '%b')
        ORDER BY MIN(payment_date)")->fetchAll();

    $channelBreakdown = $pdo->query("SELECT payment_channel, SUM(amount_paid) total
        FROM transactions WHERE status='paid' GROUP BY payment_channel ORDER BY total DESC")->fetchAll();

    $dueSoon = $pdo->query("SELECT b.id, b.bill_name, b.period, b.due_date, b.amount, s.name student_name
        FROM bills b
        JOIN students s ON s.id=b.student_id
        WHERE b.status<>'paid'
        ORDER BY b.due_date ASC LIMIT 6")->fetchAll();

    $latestTransactions = $pdo->query("SELECT t.id, s.name student_name, b.bill_name, b.period, t.amount_paid amount, t.payment_channel, t.status
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        ORDER BY t.id DESC LIMIT 6")->fetchAll();

    response(compact('summary', 'monthly', 'channelBreakdown', 'dueSoon', 'latestTransactions'));
}

if ($route === 'admin/classes' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $rows = $pdo->query("SELECT c.*, COUNT(s.id) total_students
        FROM classes c
        LEFT JOIN students s ON s.class_id = c.id
        GROUP BY c.id
        ORDER BY c.name")->fetchAll();
    response($rows);
}

if ($route === 'admin/classes' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['name']);
    $stmt = $pdo->prepare("INSERT INTO classes (name, grade_level, is_active) VALUES (?, ?, ?)");
    $stmt->execute([$input['name'], $input['grade_level'] ?: null, isset($input['is_active']) ? (int) !!$input['is_active'] : 1]);
    log_activity((int) $user['id'], 'create', 'class', (int) $pdo->lastInsertId(), 'Menambah kelas ' . $input['name']);
    response(['message' => 'Kelas berhasil ditambahkan']);
}

if ($route === 'admin/classes' && $method === 'PUT') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id', 'name']);
    $stmt = $pdo->prepare("UPDATE classes SET name=?, grade_level=?, is_active=? WHERE id=?");
    $stmt->execute([$input['name'], $input['grade_level'] ?: null, isset($input['is_active']) ? (int) !!$input['is_active'] : 1, $input['id']]);
    log_activity((int) $user['id'], 'update', 'class', (int) $input['id'], 'Memperbarui kelas ' . $input['name']);
    response(['message' => 'Kelas berhasil diperbarui']);
}

if ($route === 'admin/classes' && $method === 'DELETE') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $stmt = $pdo->prepare("DELETE FROM classes WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'class', (int) $input['id'], 'Menghapus kelas');
    response(['message' => 'Kelas berhasil dihapus']);
}

if ($route === 'admin/academic-years' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $rows = $pdo->query("SELECT ay.*, COUNT(s.id) total_students
        FROM academic_years ay
        LEFT JOIN students s ON s.academic_year_id = ay.id
        GROUP BY ay.id
        ORDER BY ay.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/academic-years' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['name']);
    if (!empty($input['is_active'])) $pdo->exec("UPDATE academic_years SET is_active=0");
    $stmt = $pdo->prepare("INSERT INTO academic_years (name, start_date, end_date, is_active, created_at) VALUES (?, ?, ?, ?, NOW())");
    $stmt->execute([$input['name'], $input['start_date'] ?: null, $input['end_date'] ?: null, isset($input['is_active']) ? (int) !!$input['is_active'] : 0]);
    log_activity((int) $user['id'], 'create', 'academic_year', (int) $pdo->lastInsertId(), 'Menambah tahun ajaran ' . $input['name']);
    response(['message' => 'Tahun ajaran berhasil ditambahkan']);
}

if ($route === 'admin/academic-years' && $method === 'PUT') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id', 'name']);
    if (!empty($input['is_active'])) {
        $stmt = $pdo->prepare("UPDATE academic_years SET is_active=0 WHERE id <> ?");
        $stmt->execute([$input['id']]);
    }
    $stmt = $pdo->prepare("UPDATE academic_years SET name=?, start_date=?, end_date=?, is_active=? WHERE id=?");
    $stmt->execute([$input['name'], $input['start_date'] ?: null, $input['end_date'] ?: null, isset($input['is_active']) ? (int) !!$input['is_active'] : 0, $input['id']]);
    log_activity((int) $user['id'], 'update', 'academic_year', (int) $input['id'], 'Memperbarui tahun ajaran');
    response(['message' => 'Tahun ajaran berhasil diperbarui']);
}

if ($route === 'admin/academic-years' && $method === 'DELETE') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $stmt = $pdo->prepare("DELETE FROM academic_years WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'academic_year', (int) $input['id'], 'Menghapus tahun ajaran');
    response(['message' => 'Tahun ajaran berhasil dihapus']);
}

if ($route === 'admin/students' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $rows = $pdo->query("SELECT s.*, c.name class_name, ay.name academic_year,
            (SELECT COUNT(*) FROM bills b WHERE b.student_id=s.id AND b.status='unpaid') active_bills
        FROM students s
        LEFT JOIN classes c ON c.id=s.class_id
        LEFT JOIN academic_years ay ON ay.id=s.academic_year_id
        ORDER BY s.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/students' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['nis', 'name', 'class_id', 'academic_year_id', 'parent_name', 'parent_phone', 'user_email']);
    $stmt = $pdo->prepare("INSERT INTO students (nis, name, class_id, academic_year_id, parent_name, parent_phone, user_email, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        $input['nis'], $input['name'], $input['class_id'], $input['academic_year_id'],
        $input['parent_name'], $input['parent_phone'], $input['user_email'],
        $input['address'] ?: null, $input['status'] ?: 'active'
    ]);
    $studentId = (int) $pdo->lastInsertId();

    $userStmt = $pdo->prepare("INSERT INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
    $userStmt->execute([$input['parent_name'], $input['user_email'], password_hash($input['parent_password'] ?: 'password', PASSWORD_DEFAULT), $studentId]);

    log_activity((int) $user['id'], 'create', 'student', $studentId, 'Menambah siswa ' . $input['name']);
    response(['message' => 'Siswa berhasil ditambahkan']);
}

if ($route === 'admin/students' && $method === 'PUT') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id', 'nis', 'name', 'class_id', 'academic_year_id', 'parent_name', 'parent_phone', 'user_email']);
    $stmt = $pdo->prepare("UPDATE students SET nis=?, name=?, class_id=?, academic_year_id=?, parent_name=?, parent_phone=?, user_email=?, address=?, status=? WHERE id=?");
    $stmt->execute([
        $input['nis'], $input['name'], $input['class_id'], $input['academic_year_id'],
        $input['parent_name'], $input['parent_phone'], $input['user_email'],
        $input['address'] ?: null, $input['status'] ?: 'active', $input['id']
    ]);
    $u = $pdo->prepare("UPDATE users SET name=?, email=? WHERE student_id=? AND role='parent'");
    $u->execute([$input['parent_name'], $input['user_email'], $input['id']]);
    log_activity((int) $user['id'], 'update', 'student', (int) $input['id'], 'Memperbarui siswa ' . $input['name']);
    response(['message' => 'Siswa berhasil diperbarui']);
}

if ($route === 'admin/students' && $method === 'DELETE') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $pdo->prepare("DELETE FROM users WHERE student_id=? AND role='parent'")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM payment_proofs WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM notifications WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM transactions WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM bills WHERE student_id=?")->execute([$input['id']]);
    $pdo->prepare("DELETE FROM students WHERE id=?")->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'student', (int) $input['id'], 'Menghapus siswa');
    response(['message' => 'Siswa berhasil dihapus']);
}

if ($route === 'admin/students/import' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    if (empty($_FILES['file']['tmp_name'])) response(['message' => 'File tidak ditemukan'], 422);
    $ext = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
    $rows = [];
    if ($ext === 'csv') {
        $handle = fopen($_FILES['file']['tmp_name'], 'r');
        $headers = fgetcsv($handle);
        while (($line = fgetcsv($handle)) !== false) $rows[] = array_combine($headers, $line);
        fclose($handle);
    } else {
        if (!class_exists('PhpOffice\PhpSpreadsheet\IOFactory')) response(['message' => 'Jalankan composer install untuk impor Excel'], 422);
        $sheet = PhpOffice\PhpSpreadsheet\IOFactory::load($_FILES['file']['tmp_name'])->getActiveSheet()->toArray(null, true, true, false);
        $headers = $sheet[0];
        unset($sheet[0]);
        foreach ($sheet as $line) $rows[] = array_combine($headers, $line);
    }

    $imported = 0;
    foreach ($rows as $row) {
        if (empty($row['nis']) || empty($row['name'])) continue;
        $className = $row['class_name'] ?? 'Kelas Baru';
        $yearName = $row['academic_year'] ?? date('Y') . '/' . (date('Y') + 1);

        $classId = scalar('SELECT id FROM classes WHERE name = ? LIMIT 1', [$className]);
        if (!$classId) {
            $stmt = $pdo->prepare('INSERT INTO classes (name, is_active) VALUES (?, 1)');
            $stmt->execute([$className]);
            $classId = (int) $pdo->lastInsertId();
        }

        $yearId = scalar('SELECT id FROM academic_years WHERE name = ? LIMIT 1', [$yearName]);
        if (!$yearId) {
            $stmt = $pdo->prepare('INSERT INTO academic_years (name, is_active, created_at) VALUES (?, 0, NOW())');
            $stmt->execute([$yearName]);
            $yearId = (int) $pdo->lastInsertId();
        }

        $exists = scalar('SELECT id FROM students WHERE nis = ? LIMIT 1', [$row['nis']]);
        if ($exists) continue;

        $stmt = $pdo->prepare("INSERT INTO students (nis, name, class_id, academic_year_id, parent_name, parent_phone, user_email, address, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())");
        $stmt->execute([
            $row['nis'], $row['name'], $classId, $yearId, $row['parent_name'] ?? '-',
            $row['parent_phone'] ?? '-', $row['user_email'] ?? ('wali.' . $row['nis'] . '@madrasah.id'),
            $row['address'] ?? null, $row['status'] ?? 'active'
        ]);
        $studentId = (int) $pdo->lastInsertId();
        $userStmt = $pdo->prepare("INSERT IGNORE INTO users (name, email, password, role, student_id, created_at) VALUES (?, ?, ?, 'parent', ?, NOW())");
        $userStmt->execute([$row['parent_name'] ?? 'Orang Tua', $row['user_email'] ?? ('wali.' . $row['nis'] . '@madrasah.id'), password_hash('password', PASSWORD_DEFAULT), $studentId]);
        $imported++;
    }
    log_activity((int) $user['id'], 'import', 'student', null, 'Impor siswa sebanyak ' . $imported);
    response(['message' => "Impor berhasil. {$imported} siswa ditambahkan."]);
}

if ($route === 'admin/finance-posts' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $rows = $pdo->query("SELECT fp.*, c.name class_name, s.name student_name
        FROM finance_posts fp
        LEFT JOIN classes c ON c.id = fp.class_id
        LEFT JOIN students s ON s.id = fp.student_id
        ORDER BY fp.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/finance-posts' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $input = json_input();
    ensure_required($input, ['name', 'amount', 'applies_to', 'billing_type']);
    $stmt = $pdo->prepare("INSERT INTO finance_posts (name, description, amount, applies_to, class_id, student_id, billing_type, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([
        $input['name'], $input['description'] ?: null, $input['amount'], $input['applies_to'],
        $input['class_id'] ?: null, $input['student_id'] ?: null,
        $input['billing_type'], isset($input['is_active']) ? (int) !!$input['is_active'] : 1
    ]);
    log_activity((int) $user['id'], 'create', 'finance_post', (int) $pdo->lastInsertId(), 'Menambah pos keuangan');
    response(['message' => 'Pos keuangan berhasil disimpan']);
}

if ($route === 'admin/finance-posts' && $method === 'PUT') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $input = json_input();
    ensure_required($input, ['id', 'name', 'amount', 'applies_to', 'billing_type']);
    $stmt = $pdo->prepare("UPDATE finance_posts SET name=?, description=?, amount=?, applies_to=?, class_id=?, student_id=?, billing_type=?, is_active=? WHERE id=?");
    $stmt->execute([
        $input['name'], $input['description'] ?: null, $input['amount'], $input['applies_to'],
        $input['class_id'] ?: null, $input['student_id'] ?: null,
        $input['billing_type'], isset($input['is_active']) ? (int) !!$input['is_active'] : 1, $input['id']
    ]);
    log_activity((int) $user['id'], 'update', 'finance_post', (int) $input['id'], 'Memperbarui pos keuangan');
    response(['message' => 'Pos keuangan berhasil diperbarui']);
}

if ($route === 'admin/finance-posts' && $method === 'DELETE') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    ensure_required($input, ['id']);
    $stmt = $pdo->prepare("DELETE FROM finance_posts WHERE id=?");
    $stmt->execute([$input['id']]);
    log_activity((int) $user['id'], 'delete', 'finance_post', (int) $input['id'], 'Menghapus pos keuangan');
    response(['message' => 'Pos keuangan berhasil dihapus']);
}

if ($route === 'admin/bills' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $status = query('status', '');
    $studentId = query('student_id', '');
    $conditions = [];
    $params = [];
    if ($status) { $conditions[] = 'b.status = ?'; $params[] = $status; }
    if ($studentId) { $conditions[] = 'b.student_id = ?'; $params[] = $studentId; }
    $where = $conditions ? ('WHERE ' . implode(' AND ', $conditions)) : '';
    $stmt = $pdo->prepare("SELECT b.*, s.name student_name, s.nis, c.name class_name,
            (SELECT status FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1) proof_status
        FROM bills b
        JOIN students s ON s.id=b.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        {$where}
        ORDER BY b.id DESC");
    $stmt->execute($params);
    response($stmt->fetchAll());
}

if ($route === 'admin/bills/generate' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $input = json_input();
    $period = $input['period'] ?? date('Y-m');
    $studentFilter = $input['student_id'] ?? null;
    $sql = $studentFilter ? 'SELECT id FROM students WHERE id=?' : 'SELECT id FROM students';
    $stmtStudents = $pdo->prepare($sql);
    $stmtStudents->execute($studentFilter ? [$studentFilter] : []);
    $students = $stmtStudents->fetchAll();
    $created = 0;

    foreach ($students as $student) {
        foreach (finance_posts_for_student((int) $student['id']) as $post) {
            if ($post['billing_type'] === 'one_time') {
                $existsPaid = scalar('SELECT COUNT(*) FROM bills WHERE student_id = ? AND finance_post_id = ?', [$student['id'], $post['id']]);
                if ($existsPaid) continue;
            }
            $exists = scalar('SELECT COUNT(*) FROM bills WHERE student_id = ? AND finance_post_id = ? AND period = ?', [$student['id'], $post['id'], $period]);
            if ($exists) continue;
            $stmt = $pdo->prepare("INSERT INTO bills (student_id, finance_post_id, bill_name, period, due_date, amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'unpaid', NOW())");
            $dueDate = !empty($input['due_date']) ? $input['due_date'] : ($period . '-10');
            $stmt->execute([$student['id'], $post['id'], $post['name'], $period, $dueDate, $post['amount']]);
            $created++;

            $studentDetail = student_row((int) $student['id']);
            $message = "Assalamu'alaikum, tagihan {$post['name']} periode {$period} untuk {$studentDetail['name']} sebesar " . idr($post['amount']) . " jatuh tempo {$dueDate}.";
            queue_whatsapp_notification((int) $student['id'], 'Pengingat Tagihan', $message);
        }
    }

    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'generate', 'bill', null, 'Generate tagihan periode ' . $period . ' sebanyak ' . $created);
    response(['message' => "Generate selesai. {$created} tagihan dibuat."]);
}

if ($route === 'admin/payment-proofs' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $rows = $pdo->query("SELECT pp.*, s.name student_name, s.nis, b.bill_name, b.period, b.amount
        FROM payment_proofs pp
        JOIN students s ON s.id = pp.student_id
        JOIN bills b ON b.id = pp.bill_id
        ORDER BY pp.id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/payment-proofs/review' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $input = json_input();
    ensure_required($input, ['proof_id', 'status']);
    $proofStmt = $pdo->prepare("SELECT pp.*, b.status bill_status, b.amount, b.bill_name, s.parent_phone, s.name student_name
        FROM payment_proofs pp
        JOIN bills b ON b.id=pp.bill_id
        JOIN students s ON s.id=pp.student_id
        WHERE pp.id=? LIMIT 1");
    $proofStmt->execute([$input['proof_id']]);
    $proof = $proofStmt->fetch();
    if (!$proof) response(['message' => 'Bukti tidak ditemukan'], 404);
    if (!in_array($input['status'], ['approved', 'rejected'], true)) response(['message' => 'Status review tidak valid'], 422);

    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare("UPDATE payment_proofs SET status=?, reviewed_by=?, reviewed_at=NOW(), notes=? WHERE id=?");
        $stmt->execute([$input['status'], $user['id'], $input['notes'] ?? null, $input['proof_id']]);

        if ($input['status'] === 'approved' && $proof['bill_status'] !== 'paid') {
            create_transaction_and_mark_paid((int) $proof['bill_id'], (int) $proof['student_id'], 'Upload Bukti / Transfer Manual', (float) $proof['amount'], 'Verifikasi manual bukti pembayaran', 'paid');
            queue_whatsapp_notification((int) $proof['student_id'], 'Bukti Pembayaran Disetujui', "Pembayaran {$proof['bill_name']} untuk {$proof['student_name']} telah diverifikasi.");
        }

        if ($input['status'] === 'rejected') {
            queue_whatsapp_notification((int) $proof['student_id'], 'Bukti Pembayaran Ditolak', "Mohon unggah ulang bukti pembayaran {$proof['bill_name']} dengan data yang lebih jelas.");
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        response(['message' => 'Gagal memproses review: ' . $e->getMessage()], 422);
    }

    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'review', 'payment_proof', (int) $input['proof_id'], 'Review bukti pembayaran: ' . $input['status']);
    response(['message' => 'Review bukti pembayaran berhasil disimpan']);
}

if ($route === 'admin/reports' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $stmt = $pdo->prepare("SELECT t.*, b.bill_name, s.name student_name, c.name class_name
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE DATE(t.payment_date) BETWEEN ? AND ?
        ORDER BY t.payment_date DESC");
    $stmt->execute([$start, $end]);
    $rows = $stmt->fetchAll();

    $summary = [
        'count' => count($rows),
        'total' => array_reduce($rows, fn($carry, $item) => $carry + (float) $item['amount_paid'], 0),
        'successful' => count(array_filter($rows, fn($r) => $r['status'] === 'paid')),
        'pending' => count(array_filter($rows, fn($r) => $r['status'] === 'pending')),
    ];

    $byChannel = [];
    foreach ($rows as $row) {
        $channel = $row['payment_channel'];
        $byChannel[$channel] = ($byChannel[$channel] ?? 0) + (float) $row['amount_paid'];
    }

    response(['rows' => $rows, 'summary' => $summary, 'byChannel' => $byChannel]);
}

if ($route === 'admin/reports/export' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin', 'bendahara']);
    $start = query('start_date', date('Y-m-01'));
    $end = query('end_date', date('Y-m-d'));
    $stmt = $pdo->prepare("SELECT t.payment_date, s.name student_name, c.name class_name, b.bill_name, t.payment_channel, t.amount_paid, t.reference_no, t.status
        FROM transactions t
        JOIN bills b ON b.id=t.bill_id
        JOIN students s ON s.id=t.student_id
        LEFT JOIN classes c ON c.id=s.class_id
        WHERE DATE(t.payment_date) BETWEEN ? AND ?
        ORDER BY t.payment_date DESC");
    $stmt->execute([$start, $end]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=laporan-keuangan.csv');
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Tanggal', 'Siswa', 'Kelas', 'Tagihan', 'Kanal', 'Nominal', 'Referensi', 'Status']);
    foreach ($stmt->fetchAll() as $row) {
        fputcsv($out, [$row['payment_date'], $row['student_name'], $row['class_name'], $row['bill_name'], $row['payment_channel'], $row['amount_paid'], $row['reference_no'], $row['status']]);
    }
    fclose($out);
    exit;
}

if ($route === 'admin/backups' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $rows = $pdo->query("SELECT id, filename, ROUND(size_bytes/1024,2) size_kb, DATE_FORMAT(created_at, '%d-%m-%Y %H:%i') created_at FROM backups ORDER BY id DESC")->fetchAll();
    response($rows);
}

if ($route === 'admin/backups' && $method === 'POST') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $tables = ['academic_years','classes','students','users','finance_posts','bills','transactions','notifications','payment_proofs','settings','audit_logs'];
    $content = "-- Backup SPP Madrasah Enterprise
-- Generated at: " . date('Y-m-d H:i:s') . "

";
    foreach ($tables as $table) {
        $rows = $pdo->query("SELECT * FROM {$table}")->fetchAll();
        foreach ($rows as $row) {
            $values = array_map(function ($value) use ($pdo) {
                return $value === null ? 'NULL' : $pdo->quote((string) $value);
            }, array_values($row));
            $content .= "INSERT INTO {$table} VALUES (" . implode(', ', $values) . ");
";
        }
        $content .= "
";
    }
    $filename = 'backup-' . date('Ymd-His') . '.sql';
    $path = __DIR__ . '/storage/backups/' . $filename;
    file_put_contents($path, $content);
    $stmt = $pdo->prepare('INSERT INTO backups (filename, path, size_bytes, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([$filename, $path, filesize($path)]);
    log_activity((int) $user['id'], 'backup', 'system', null, 'Membuat backup database');
    response(['message' => 'Backup berhasil dibuat']);
}

if ($route === 'admin/backups/download' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $id = query('id');
    ensure_required(['id' => $id], ['id']);
    $stmt = $pdo->prepare("SELECT * FROM backups WHERE id=? LIMIT 1");
    $stmt->execute([$id]);
    $file = $stmt->fetch();
    if (!$file || !file_exists($file['path'])) response(['message' => 'File backup tidak ditemukan'], 404);
    header('Content-Type: application/sql');
    header('Content-Disposition: attachment; filename="' . basename($file['filename']) . '"');
    readfile($file['path']);
    exit;
}

if ($route === 'admin/settings' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    response(list_settings());
}

if ($route === 'admin/settings' && $method === 'PUT') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $input = json_input();
    foreach ($input as $key => $value) {
        $stmt = $pdo->prepare("INSERT INTO settings (setting_key, setting_value, updated_at) VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_at=NOW()");
        $stmt->execute([$key, $value]);
    }
    log_activity((int) $user['id'], 'update', 'setting', null, 'Memperbarui pengaturan sistem');
    response(['message' => 'Pengaturan berhasil diperbarui']);
}

if ($route === 'admin/activity-logs' && $method === 'GET') {
    $user = require_auth();
    validate_role_access($user, ['admin']);
    $rows = $pdo->query("SELECT al.*, u.name user_name FROM audit_logs al LEFT JOIN users u ON u.id=al.user_id ORDER BY al.id DESC LIMIT 100")->fetchAll();
    response($rows);
}

if ($route === 'parent/dashboard' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $summary = [
        'activeBills' => (int) scalar("SELECT COUNT(*) FROM bills WHERE student_id=? AND status='unpaid'", [$student['id']]),
        'outstanding' => (float) scalar("SELECT COALESCE(SUM(amount),0) FROM bills WHERE student_id=? AND status='unpaid'", [$student['id']]),
        'paidThisYear' => (float) scalar("SELECT COALESCE(SUM(amount_paid),0) FROM transactions WHERE student_id=? AND status='paid' AND YEAR(payment_date)=YEAR(CURDATE())", [$student['id']]),
        'pendingProofs' => (int) scalar("SELECT COUNT(*) FROM payment_proofs WHERE student_id=? AND status='pending'", [$student['id']]),
    ];
    response(['summary' => $summary, 'student' => $student, 'settings' => list_settings()]);
}

if ($route === 'parent/bills' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT b.*,
            (SELECT status FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1) proof_status,
            (SELECT proof_file_name FROM payment_proofs pp WHERE pp.bill_id=b.id ORDER BY pp.id DESC LIMIT 1) proof_file_name
        FROM bills b WHERE b.student_id=? ORDER BY b.id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/payments' && $method === 'POST') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $input = json_input();
    ensure_required($input, ['bill_id', 'payment_channel']);
    $stmt = $pdo->prepare("SELECT * FROM bills WHERE id=? AND student_id=? LIMIT 1");
    $stmt->execute([$input['bill_id'], $student['id']]);
    $bill = $stmt->fetch();
    if (!$bill) response(['message' => 'Tagihan tidak ditemukan'], 404);
    if ($bill['status'] === 'paid') response(['message' => 'Tagihan sudah lunas']);

    $tx = create_transaction_and_mark_paid((int) $bill['id'], (int) $student['id'], $input['payment_channel'], (float) $bill['amount'], payment_instruction($input['payment_channel']), 'paid');
    queue_whatsapp_notification((int) $student['id'], 'Pembayaran Berhasil', "Pembayaran {$bill['bill_name']} sebesar " . idr($bill['amount']) . " berhasil diterima. Ref: {$tx['reference_no']}");
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'pay', 'bill', (int) $bill['id'], 'Pembayaran orang tua via ' . $input['payment_channel']);
    response(['message' => 'Pembayaran berhasil diproses', 'reference_no' => $tx['reference_no'], 'instruction' => payment_instruction($input['payment_channel'])]);
}

if ($route === 'parent/payment-proofs' && $method === 'POST') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $billId = $_POST['bill_id'] ?? null;
    ensure_required(['bill_id' => $billId], ['bill_id']);
    $stmt = $pdo->prepare("SELECT * FROM bills WHERE id=? AND student_id=? LIMIT 1");
    $stmt->execute([$billId, $student['id']]);
    $bill = $stmt->fetch();
    if (!$bill) response(['message' => 'Tagihan tidak ditemukan'], 404);

    $file = save_uploaded_file('file', 'payment-proofs');
    if (!$file) response(['message' => 'File bukti pembayaran wajib diunggah'], 422);

    $stmt = $pdo->prepare("INSERT INTO payment_proofs (bill_id, student_id, proof_file_name, proof_path, mime_type, size_bytes, status, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())");
    $stmt->execute([$bill['id'], $student['id'], $file['filename'], $file['path'], $file['mime_type'], $file['size_bytes'], $_POST['notes'] ?? null]);
    queue_whatsapp_notification((int) $student['id'], 'Bukti Pembayaran Diterima', "Bukti pembayaran untuk {$bill['bill_name']} berhasil diunggah dan menunggu verifikasi admin.");
    try_dispatch_whatsapp_queue();
    log_activity((int) $user['id'], 'upload', 'payment_proof', (int) $pdo->lastInsertId(), 'Unggah bukti pembayaran');
    response(['message' => 'Bukti pembayaran berhasil diunggah dan menunggu verifikasi']);
}

if ($route === 'parent/transactions' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT t.*, b.bill_name FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE t.student_id=? ORDER BY t.id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/notifications' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);
    $stmt = $pdo->prepare("SELECT * FROM notifications WHERE student_id=? ORDER BY id DESC");
    $stmt->execute([$student['id']]);
    response($stmt->fetchAll());
}

if ($route === 'parent/receipt' && $method === 'GET') {
    $user = require_auth('parent');
    $student = parent_user_student($user);

    $transactionId = query('transaction_id');
    $billId = query('bill_id');
    if ($transactionId) {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE t.id=? AND t.student_id=? LIMIT 1");
        $stmt->execute([$transactionId, $student['id']]);
        $row = $stmt->fetch();
    } else {
        $stmt = $pdo->prepare("SELECT t.*, b.bill_name, b.period FROM transactions t JOIN bills b ON b.id=t.bill_id WHERE b.id=? AND t.student_id=? ORDER BY t.id DESC LIMIT 1");
        $stmt->execute([$billId, $student['id']]);
        $row = $stmt->fetch();
    }
    if (!$row) response(['message' => 'Bukti pembayaran tidak ditemukan'], 404);

    header('Content-Type: text/html; charset=utf-8');
    echo "<html><head><title>Bukti Pembayaran</title><style>body{font-family:Arial,sans-serif;padding:30px;background:#f8fafc}.card{max-width:650px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:28px}.title{color:#047857;font-size:28px;font-weight:700}.row{margin:10px 0;color:#334155}.label{font-weight:700;display:inline-block;width:170px}</style></head><body>";
    echo "<div class='card'><div class='title'>Bukti Pembayaran SPP Madrasah</div>";
    echo "<div class='row'><span class='label'>Nama Siswa</span>" . htmlspecialchars($student['name']) . "</div>";
    echo "<div class='row'><span class='label'>Tagihan</span>" . htmlspecialchars($row['bill_name']) . "</div>";
    echo "<div class='row'><span class='label'>Periode</span>" . htmlspecialchars($row['period']) . "</div>";
    echo "<div class='row'><span class='label'>Kanal</span>" . htmlspecialchars($row['payment_channel']) . "</div>";
    echo "<div class='row'><span class='label'>Nominal</span>" . idr($row['amount_paid']) . "</div>";
    echo "<div class='row'><span class='label'>Referensi</span>" . htmlspecialchars($row['reference_no']) . "</div>";
    echo "<div class='row'><span class='label'>Tanggal</span>" . htmlspecialchars($row['payment_date']) . "</div>";
    echo "<div class='row'><span class='label'>Status</span>" . strtoupper(htmlspecialchars($row['status'])) . "</div>";
    echo "<div class='row' style='margin-top:24px'>Dokumen ini dicetak otomatis oleh sistem SPP Madrasah.</div>";
    echo "</div></body></html>";
    exit;
}

response(['message' => 'Route tidak ditemukan'], 404);
