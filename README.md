# SPP Madrasah Enterprise

Versi enterprise / production-ready dari website SPP Madrasah berbasis:

- **Frontend:** Vite React JS + Tailwind CSS
- **Backend:** PHP Native modular API
- **Database:** MySQL

## Fitur utama

### Halaman awal

- Informasi singkat sistem
- Form login untuk **Admin**, **Bendahara/TU**, dan **Orang Tua**

### Manajemen Madrasah

- CRUD **Siswa** lengkap: tambah, edit, hapus
- CRUD **Kelas** terpisah
- CRUD **Tahun Ajaran** terpisah
- Impor data siswa melalui **CSV / Excel**
- Manajemen **Pos Keuangan** per kelas atau per siswa
- Generate tagihan otomatis per periode
- Pencatatan transaksi otomatis
- Laporan keuangan real-time
- Export laporan ke **CSV**
- Verifikasi **bukti pembayaran**
- Backup database manual + download file backup
- Pengaturan sekolah, rekening, QRIS, payment gateway, WhatsApp gateway
- Audit log aktivitas backend

### Orang Tua / Wali

- Cek status tagihan
- Pembayaran multi-kanal:
  - Transfer Bank
  - QRIS
  - Virtual Account
  - E-Wallet
- Upload bukti pembayaran manual
- Riwayat transaksi
- Cetak bukti pembayaran
- Notifikasi otomatis

## Akun demo

- **Admin**
  - `admin@madrasah.id`
  - `password`

- **Bendahara**
  - `bendahara@madrasah.id`
  - `password`

- **Orang Tua**
  - `parent@madrasah.id`
  - `password`

## Struktur project

- `frontend/` → React + Tailwind
- `api/` → API PHP
- `database/schema.sql` → skema database
- `database/seed.sql` → data awal
- `database/sample-import.csv` → contoh impor siswa

## Setup frontend

```bash
cd frontend
npm install
npm run dev
```

Jika ingin build production:

```bash
npm run build
```

## Setup backend

1. Buat database MySQL, misalnya: `spp_madrasah_enterprise`
2. Import:
   - `database/schema.sql`
   - `database/seed.sql`
3. Salin file env:

```bash
cd api
cp .env.example .env
```

4. Sesuaikan isi `.env`

Contoh:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=spp_madrasah_enterprise
DB_USER=root
DB_PASS=
JWT_SECRET=super-secret-key
```

5. Jalankan server PHP:

```bash
php -S localhost:8000 -t api
```

> Pastikan menggunakan `-t api`. Jika tidak, endpoint `/index.php` akan 404.

API default frontend diarahkan ke:

```env
VITE_API_URL=/index.php?route=
```

## Impor Excel

Untuk file `.xlsx/.xls`, jalankan composer di folder api:

```bash
composer install
```

## Catatan production

Project ini sudah lebih siap untuk production, tetapi untuk production penuh tetap perlu:

- HTTPS + reverse proxy (Nginx / Apache)
- Rate limiting
- Validasi file upload lebih ketat
- Cron job backup otomatis
- Integrasi gateway nyata:
  - Midtrans / Xendit / Tripay
  - WhatsApp Gateway resmi / provider BSP
- Monitoring log
- Hardening auth & refresh token
- Permission file server yang aman

## Dokumen keamanan

- Lihat [SECURITY.md](./SECURITY.md) untuk baseline hardening dan checklist:
  - GDPR
  - PCI DSS
  - HTTP/CSP headers
  - anti scraping
  - DNSSEC (operasional domain)

## Hal yang sudah ditingkatkan dibanding versi sebelumnya

- Role **Bendahara**
- CRUD lengkap **edit/hapus**
- Master **kelas** dan **tahun ajaran** terpisah
- Upload **bukti pembayaran**
- Review bukti bayar oleh admin / bendahara
- UI admin lebih premium
- Struktur data lebih matang
