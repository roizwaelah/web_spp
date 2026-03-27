<?php
// Route CRUD pengeluaran operasional.

$defaultExpenseCategories = ['Operasional', 'ATK', 'Transport', 'Konsumsi', 'Perawatan', 'Utilitas', 'Honorarium', 'Kegiatan', 'Lainnya'];

function ensure_expense_categories_table(PDO $pdo): void {
    static $ready = false;
    global $defaultExpenseCategories;
    if ($ready) return;

    $pdo->exec("CREATE TABLE IF NOT EXISTS expense_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(80) NOT NULL UNIQUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $total = (int) scalar('SELECT COUNT(*) FROM expense_categories');
    if ($total === 0) {
        $insert = $pdo->prepare('INSERT INTO expense_categories (name, created_at) VALUES (?, NOW())');
        foreach ($defaultExpenseCategories as $categoryName) {
            $insert->execute([$categoryName]);
        }
    }
    $ready = true;
}

function expense_category_names(PDO $pdo): array {
    ensure_expense_categories_table($pdo);
    $rows = $pdo->query('SELECT name FROM expense_categories ORDER BY name ASC')->fetchAll();
    return array_map(static fn($row) => (string) $row['name'], $rows);
}

if ($route === 'admin/expense-categories' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    ensure_expense_categories_table($pdo);
    $rows = $pdo->query('SELECT id, name FROM expense_categories ORDER BY name ASC')->fetchAll();
    response($rows);
}

if ($route === 'admin/expense-categories' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    $input = json_input();
    ensure_required($input, ['name']);
    ensure_expense_categories_table($pdo);

    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') response(['message' => 'Nama kategori wajib diisi'], 422);
    if (mb_strlen($name) > 80) response(['message' => 'Nama kategori maksimal 80 karakter'], 422);
    $exists = scalar('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) LIMIT 1', [$name]);
    if ($exists) response(['message' => 'Kategori sudah ada'], 422);

    $stmt = $pdo->prepare('INSERT INTO expense_categories (name, created_at) VALUES (?, NOW())');
    $stmt->execute([$name]);
    log_activity((int) $user['id'], 'create', 'expense_category', (int) $pdo->lastInsertId(), 'Menambah kategori pengeluaran ' . $name);
    response(['message' => 'Kategori berhasil ditambahkan']);
}

if ($route === 'admin/expense-categories' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    $input = json_input();
    ensure_required($input, ['id', 'name']);
    ensure_expense_categories_table($pdo);

    $categoryId = (int) $input['id'];
    $name = trim((string) ($input['name'] ?? ''));
    if ($name === '') response(['message' => 'Nama kategori wajib diisi'], 422);
    if (mb_strlen($name) > 80) response(['message' => 'Nama kategori maksimal 80 karakter'], 422);
    if (!scalar('SELECT id FROM expense_categories WHERE id = ? LIMIT 1', [$categoryId])) {
        response(['message' => 'Kategori tidak ditemukan'], 404);
    }
    $exists = scalar('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [$name, $categoryId]);
    if ($exists) response(['message' => 'Kategori sudah ada'], 422);

    $oldName = (string) scalar('SELECT name FROM expense_categories WHERE id = ? LIMIT 1', [$categoryId]);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('UPDATE expense_categories SET name = ?, updated_at = NOW() WHERE id = ?');
        $stmt->execute([$name, $categoryId]);
        $syncExpenses = $pdo->prepare('UPDATE expenses SET category = ? WHERE category = ?');
        $syncExpenses->execute([$name, $oldName]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        response(['message' => 'Gagal memperbarui kategori: ' . $e->getMessage()], 422);
    }

    log_activity((int) $user['id'], 'update', 'expense_category', $categoryId, 'Memperbarui kategori pengeluaran menjadi ' . $name);
    response(['message' => 'Kategori berhasil diperbarui']);
}

if ($route === 'admin/expense-categories' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    $input = json_input();
    ensure_required($input, ['id']);
    ensure_expense_categories_table($pdo);

    $categoryId = (int) $input['id'];
    $name = scalar('SELECT name FROM expense_categories WHERE id = ? LIMIT 1', [$categoryId]);
    if (!$name) response(['message' => 'Kategori tidak ditemukan'], 404);

    $usedCount = (int) scalar('SELECT COUNT(*) FROM expenses WHERE category = ?', [$name]);
    if ($usedCount > 0) {
        response(['message' => 'Kategori tidak bisa dihapus karena sudah dipakai data pengeluaran'], 422);
    }

    $total = (int) scalar('SELECT COUNT(*) FROM expense_categories');
    if ($total <= 1) {
        response(['message' => 'Minimal harus ada satu kategori pengeluaran'], 422);
    }

    $stmt = $pdo->prepare('DELETE FROM expense_categories WHERE id = ?');
    $stmt->execute([$categoryId]);
    log_activity((int) $user['id'], 'delete', 'expense_category', $categoryId, 'Menghapus kategori pengeluaran ' . $name);
    response(['message' => 'Kategori berhasil dihapus']);
}

if ($route === 'admin/expenses' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    ensure_expense_categories_table($pdo);
    $start = query('start_date', '');
    $end = query('end_date', '');
    $category = trim((string) query('category', ''));
    $search = trim((string) query('search', ''));

    $conditions = [];
    $params = [];
    if ($start !== '') {
        $conditions[] = 'expense_date >= ?';
        $params[] = $start;
    }
    if ($end !== '') {
        $conditions[] = 'expense_date <= ?';
        $params[] = $end;
    }
    if ($category !== '') {
        $conditions[] = 'category = ?';
        $params[] = $category;
    }
    if ($search !== '') {
        $conditions[] = '(title LIKE ? OR category LIKE ? OR notes LIKE ?)';
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
        $params[] = '%' . $search . '%';
    }

    $where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
    $stmt = $pdo->prepare("SELECT e.*, u.name created_by_name
        FROM expenses e
        LEFT JOIN users u ON u.id = e.created_by
        {$where}
        ORDER BY e.expense_date DESC, e.id DESC");
    $stmt->execute($params);
    response($stmt->fetchAll());
}

if ($route === 'admin/expenses' && $method === 'POST') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    $input = json_input();
    ensure_required($input, ['expense_date', 'title', 'category', 'amount']);
    $allowedExpenseCategories = expense_category_names($pdo);

    $expenseDate = trim((string) $input['expense_date']);
    $title = trim((string) $input['title']);
    $category = trim((string) ($input['category'] ?? ''));
    $amount = (float) ($input['amount'] ?? 0);
    $notes = trim((string) ($input['notes'] ?? ''));

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate)) response(['message' => 'Tanggal pengeluaran harus berformat YYYY-MM-DD'], 422);
    if ($title === '') response(['message' => 'Nama pengeluaran wajib diisi'], 422);
    if (mb_strlen($title) > 150) response(['message' => 'Nama pengeluaran maksimal 150 karakter'], 422);
    if (!in_array($category, $allowedExpenseCategories, true)) response(['message' => 'Kategori pengeluaran tidak valid'], 422);
    if ($category !== '' && mb_strlen($category) > 80) response(['message' => 'Kategori maksimal 80 karakter'], 422);
    if ($amount <= 0) response(['message' => 'Nominal pengeluaran harus lebih dari 0'], 422);
    if ($notes !== '' && mb_strlen($notes) > 1000) response(['message' => 'Keterangan maksimal 1000 karakter'], 422);

    $stmt = $pdo->prepare("INSERT INTO expenses (expense_date, title, category, amount, notes, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())");
    $stmt->execute([$expenseDate, $title, $category !== '' ? $category : null, $amount, $notes !== '' ? $notes : null, $user['id']]);
    $expenseId = (int) $pdo->lastInsertId();

    log_activity((int) $user['id'], 'create', 'expense', $expenseId, 'Menambah pengeluaran ' . $title);
    response(['message' => 'Pengeluaran berhasil ditambahkan']);
}

if ($route === 'admin/expenses' && $method === 'PUT') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    $input = json_input();
    ensure_required($input, ['id', 'expense_date', 'title', 'category', 'amount']);
    $allowedExpenseCategories = expense_category_names($pdo);

    $expenseId = (int) $input['id'];
    if (!scalar('SELECT id FROM expenses WHERE id = ? LIMIT 1', [$expenseId])) {
        response(['message' => 'Data pengeluaran tidak ditemukan'], 404);
    }

    $expenseDate = trim((string) $input['expense_date']);
    $title = trim((string) $input['title']);
    $category = trim((string) ($input['category'] ?? ''));
    $amount = (float) ($input['amount'] ?? 0);
    $notes = trim((string) ($input['notes'] ?? ''));

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $expenseDate)) response(['message' => 'Tanggal pengeluaran harus berformat YYYY-MM-DD'], 422);
    if ($title === '') response(['message' => 'Nama pengeluaran wajib diisi'], 422);
    if (mb_strlen($title) > 150) response(['message' => 'Nama pengeluaran maksimal 150 karakter'], 422);
    if (!in_array($category, $allowedExpenseCategories, true)) response(['message' => 'Kategori pengeluaran tidak valid'], 422);
    if ($category !== '' && mb_strlen($category) > 80) response(['message' => 'Kategori maksimal 80 karakter'], 422);
    if ($amount <= 0) response(['message' => 'Nominal pengeluaran harus lebih dari 0'], 422);
    if ($notes !== '' && mb_strlen($notes) > 1000) response(['message' => 'Keterangan maksimal 1000 karakter'], 422);

    $stmt = $pdo->prepare("UPDATE expenses
        SET expense_date = ?, title = ?, category = ?, amount = ?, notes = ?
        WHERE id = ?");
    $stmt->execute([$expenseDate, $title, $category !== '' ? $category : null, $amount, $notes !== '' ? $notes : null, $expenseId]);

    log_activity((int) $user['id'], 'update', 'expense', $expenseId, 'Memperbarui pengeluaran ' . $title);
    response(['message' => 'Pengeluaran berhasil diperbarui']);
}

if ($route === 'admin/expenses' && $method === 'DELETE') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
    $input = json_input();
    ensure_required($input, ['id']);
    ensure_expense_categories_table($pdo);

    $expenseId = (int) $input['id'];
    $title = scalar('SELECT title FROM expenses WHERE id = ? LIMIT 1', [$expenseId]);
    if (!$title) response(['message' => 'Data pengeluaran tidak ditemukan'], 404);

    $stmt = $pdo->prepare("DELETE FROM expenses WHERE id = ?");
    $stmt->execute([$expenseId]);
    log_activity((int) $user['id'], 'delete', 'expense', $expenseId, 'Menghapus pengeluaran ' . $title);
    response(['message' => 'Pengeluaran berhasil dihapus']);
}
