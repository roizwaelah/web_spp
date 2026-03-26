<?php
// Route CRUD pengeluaran operasional.

$allowedExpenseCategories = ['Operasional', 'ATK', 'Transport', 'Konsumsi', 'Perawatan', 'Utilitas', 'Honorarium', 'Kegiatan', 'Lainnya'];

if ($route === 'admin/expenses' && $method === 'GET') {
    $user = require_auth();
    validate_menu_access($user, ['expenses']);
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

    $expenseId = (int) $input['id'];
    $title = scalar('SELECT title FROM expenses WHERE id = ? LIMIT 1', [$expenseId]);
    if (!$title) response(['message' => 'Data pengeluaran tidak ditemukan'], 404);

    $stmt = $pdo->prepare("DELETE FROM expenses WHERE id = ?");
    $stmt->execute([$expenseId]);
    log_activity((int) $user['id'], 'delete', 'expense', $expenseId, 'Menghapus pengeluaran ' . $title);
    response(['message' => 'Pengeluaran berhasil dihapus']);
}
