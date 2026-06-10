CREATE TABLE IF NOT EXISTS academic_years (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL,
  start_date DATE NULL,
  end_date DATE NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  grade_level VARCHAR(20) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nis VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  class_id INT NOT NULL,
  academic_year_id INT NOT NULL,
  parent_name VARCHAR(120) NOT NULL,
  parent_phone VARCHAR(50) NOT NULL,
  user_email VARCHAR(120) NOT NULL,
  address TEXT NULL,
  status ENUM('active','graduated','inactive') NOT NULL DEFAULT 'active',
  created_at DATETIME NULL,
  CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES classes(id),
  CONSTRAINT fk_students_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id)
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','bendahara','verifikator','parent') NOT NULL,
  student_id INT NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_users_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS user_menu_access (
  user_id INT NOT NULL,
  menu_key VARCHAR(50) NOT NULL,
  created_at DATETIME NULL,
  PRIMARY KEY (user_id, menu_key),
  CONSTRAINT fk_user_menu_access_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finance_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  amount DECIMAL(12,2) NOT NULL,
  applies_to ENUM('class','student') NOT NULL DEFAULT 'class',
  class_id INT NULL,
  student_id INT NULL,
  billing_type ENUM('monthly','one_time') NOT NULL DEFAULT 'monthly',
  is_flexible_installment TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NULL,
  CONSTRAINT fk_finance_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  academic_year_id INT NULL,
  finance_post_id INT NOT NULL,
  bill_name VARCHAR(120) NOT NULL,
  period VARCHAR(20) NOT NULL,
  due_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  paid_at DATETIME NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_bill_student FOREIGN KEY (student_id) REFERENCES students(id),
  CONSTRAINT fk_bill_year FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
  CONSTRAINT fk_bill_finance FOREIGN KEY (finance_post_id) REFERENCES finance_posts(id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  student_id INT NOT NULL,
  payment_channel VARCHAR(50) NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  payment_date DATETIME NOT NULL,
  reference_no VARCHAR(100) NOT NULL,
  status ENUM('paid','pending','failed') NOT NULL DEFAULT 'paid',
  notes TEXT NULL,
  officer_name VARCHAR(120) NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_tx_bill FOREIGN KEY (bill_id) REFERENCES bills(id),
  CONSTRAINT fk_tx_student FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS student_deposits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  updated_at DATETIME NULL,
  created_at DATETIME NULL,
  UNIQUE KEY uq_student_deposits_student (student_id),
  CONSTRAINT fk_student_deposits_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_deposit_mutations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  bill_id INT NULL,
  transaction_id INT NULL,
  mutation_type ENUM('credit','debit') NOT NULL,
  source_type VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  mutation_date DATETIME NOT NULL,
  notes TEXT NULL,
  created_at DATETIME NULL,
  KEY idx_student_deposit_mutations_student (student_id),
  KEY idx_student_deposit_mutations_bill (bill_id),
  KEY idx_student_deposit_mutations_transaction (transaction_id),
  CONSTRAINT fk_student_deposit_mutations_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_student_deposit_mutations_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
  CONSTRAINT fk_student_deposit_mutations_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
);



CREATE TABLE IF NOT EXISTS payment_proofs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bill_id INT NOT NULL,
  student_id INT NOT NULL,
  proof_file_name VARCHAR(255) NOT NULL,
  proof_path VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  notes TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_pp_bill FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_proof_groups (
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
);

CREATE TABLE IF NOT EXISTS payment_proof_group_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  bill_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NULL,
  UNIQUE KEY uq_ppgi_group_bill (group_id, bill_id),
  KEY idx_ppgi_bill (bill_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  status ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  sent_at DATETIME NULL,
  created_at DATETIME NULL,
  CONSTRAINT fk_notification_student FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE TABLE IF NOT EXISTS backups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  path VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(120) NOT NULL UNIQUE,
  setting_value TEXT NULL,
  updated_at DATETIME NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NULL,
  description TEXT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);
