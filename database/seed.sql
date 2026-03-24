INSERT INTO academic_years (id, name, start_date, end_date, is_active, created_at) VALUES
(1, '2025/2026', '2025-07-01', '2026-06-30', 1, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name), start_date=VALUES(start_date), end_date=VALUES(end_date), is_active=VALUES(is_active);

INSERT INTO classes (id, name, grade_level, is_active) VALUES
(1, 'Kelas 1A', '1', 1),
(2, 'Kelas 2A', '2', 1),
(3, 'Kelas 3A', '3', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name), grade_level=VALUES(grade_level), is_active=VALUES(is_active);

INSERT INTO students (id, nis, name, class_id, academic_year_id, parent_name, parent_phone, user_email, address, status, created_at) VALUES
(1, '2025001', 'Ahmad Fauzan', 1, 1, 'Bapak Fauzi', '081234567890', 'parent@madrasah.id', 'Jl. Melati No. 10', 'active', NOW()),
(2, '2025002', 'Siti Rahma', 2, 1, 'Ibu Nur Aisyah', '081111111111', 'wali2@madrasah.id', 'Jl. Anggrek No. 5', 'active', NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name), parent_name=VALUES(parent_name), parent_phone=VALUES(parent_phone), user_email=VALUES(user_email), address=VALUES(address), status=VALUES(status);

INSERT INTO users (id, name, email, password, role, student_id, created_at) VALUES
(1, 'Administrator', 'admin@madrasah.id', '$2y$12$GLCM4.SuuS0ECEqBYD24ZOGbpLlUY/PrWRPCrPeMSC85uBFvuQcpK', 'admin', NULL, NOW()),
(2, 'Bapak Fauzi', 'parent@madrasah.id', '$2y$12$GLCM4.SuuS0ECEqBYD24ZOGbpLlUY/PrWRPCrPeMSC85uBFvuQcpK', 'parent', 1, NOW()),
(3, 'Petugas Bendahara', 'bendahara@madrasah.id', '$2y$12$GLCM4.SuuS0ECEqBYD24ZOGbpLlUY/PrWRPCrPeMSC85uBFvuQcpK', 'bendahara', NULL, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name), password=VALUES(password), role=VALUES(role), student_id=VALUES(student_id);

INSERT INTO finance_posts (id, name, description, amount, applies_to, class_id, student_id, billing_type, is_active, created_at) VALUES
(1, 'SPP Bulanan', 'Tagihan bulanan pendidikan', 250000, 'class', 1, NULL, 'monthly', 1, NOW()),
(2, 'Uang Gedung', 'Biaya fasilitas sekolah', 1500000, 'class', 1, NULL, 'one_time', 1, NOW()),
(3, 'Seragam', 'Seragam peserta didik', 450000, 'student', NULL, 1, 'one_time', 1, NOW())
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), amount=VALUES(amount), applies_to=VALUES(applies_to), class_id=VALUES(class_id), student_id=VALUES(student_id), billing_type=VALUES(billing_type), is_active=VALUES(is_active);

INSERT INTO bills (id, student_id, finance_post_id, bill_name, period, due_date, amount, status, paid_at, created_at) VALUES
(1, 1, 1, 'SPP Bulanan', '2026-03', '2026-03-10', 250000, 'paid', NOW(), NOW()),
(2, 1, 2, 'Uang Gedung', '2026', '2026-03-15', 1500000, 'unpaid', NULL, NOW()),
(3, 1, 3, 'Seragam', '2026', '2026-03-20', 450000, 'unpaid', NULL, NOW()),
(4, 2, 1, 'SPP Bulanan', '2026-03', '2026-03-10', 300000, 'unpaid', NULL, NOW())
ON DUPLICATE KEY UPDATE bill_name=VALUES(bill_name), amount=VALUES(amount), status=VALUES(status);

INSERT INTO transactions (id, bill_id, student_id, payment_channel, amount_paid, payment_date, reference_no, status, notes, created_at) VALUES
(1, 1, 1, 'Transfer Bank', 250000, NOW(), 'TRF-202603200900-101', 'paid', 'Pembayaran sukses', NOW())
ON DUPLICATE KEY UPDATE amount_paid=VALUES(amount_paid), status=VALUES(status);

INSERT INTO notifications (id, student_id, title, message, channel, status, sent_at, created_at) VALUES
(1, 1, 'Pengingat Tagihan', 'Tagihan Uang Gedung masih menunggu pembayaran.', 'WhatsApp', 'sent', NOW(), NOW())
ON DUPLICATE KEY UPDATE message=VALUES(message), status=VALUES(status);

INSERT INTO settings (setting_key, setting_value, updated_at) VALUES
('school_name', 'Madrasah Contoh Indonesia', NOW()),
('school_address', 'Jl. Pendidikan No. 123, Indonesia', NOW()),
('bank_account', 'BCA 123456789 a.n. Madrasah Contoh Indonesia', NOW()),
('qris_text', 'QRIS-DEMO-MADRASAH', NOW()),
('payment_gateway_key', 'demo-gateway-key', NOW()),
('payment_gateway_provider', 'midtrans-demo', NOW()),
('whatsapp_gateway_url', '', NOW()),
('whatsapp_gateway_token', '', NOW()),
('receipt_footer', 'Terima kasih telah melakukan pembayaran tepat waktu.', NOW())
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_at=VALUES(updated_at);

INSERT INTO audit_logs (user_id, action, entity_type, entity_id, description, created_at) VALUES
(1, 'seed', 'system', NULL, 'Data awal sistem enterprise dimuat', NOW());
