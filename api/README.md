# API Structure

Struktur backend PHP sekarang dibagi tipis dan modular:

- `index.php`
  Bootstrap utama: load dependency, inisialisasi DB, lalu include route aggregator.
- `bootstrap/helpers/`
  Kumpulan helper yang dipisah berdasarkan tanggung jawab:
  - `settings.php`
  - `validation.php`
  - `access.php`
  - `storage_and_logs.php`
  - `student_finance.php`
- `routes/public/`
  Route publik dan autentikasi, termasuk `login`, `me`, dan `admin/meta`.
- `routes/admin/`
  Route admin per menu, satu file per domain fitur.
- `routes/parent/`
  Route portal orang tua.
- `routes/*.php`
  File aggregator kecil yang hanya me-`require` kumpulan route yang relevan.

Urutan load saat request:

1. `api/index.php`
2. `bootstrap/app_helpers.php`
3. `routes/auth.php`
4. `routes/admin_master.php`
5. `routes/admin_finance.php`
6. `routes/admin_system.php`
7. `routes/parent.php`

Prinsip yang dipakai:

- satu menu admin satu file route
- helper dipisah per tanggung jawab
- aggregator tetap dipertahankan agar entrypoint tetap sederhana
- perubahan perilaku endpoint dihindari saat refactor struktur
