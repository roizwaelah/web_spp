# Security & Compliance Baseline

Dokumen ini jadi acuan implementasi keamanan minimum untuk aplikasi `web_spp`.

## 1) Web Server Configuration
- Gunakan HTTPS (TLS 1.2+) di production.
- Redirect HTTP -> HTTPS di reverse proxy (Nginx/Apache).
- Nonaktifkan directory listing.
- Batasi upload size di web server.
- Aktifkan access log + error log terpisah.

## 2) Web Software Security
- JWT secret wajib kuat (`>=32` karakter) di production.
- CORS dibatasi dengan allowlist (`CORS_ALLOWED_ORIGINS`), bukan `*`.
- Rate limiting aktif:
  - global per IP (API)
  - login per IP + per akun/nisn
- Validasi input backend wajib di semua endpoint.

## 3) GDPR Compliance (Operational Checklist)
- Data map: inventaris tabel yang menyimpan data pribadi.
- Privacy notice: jelaskan tujuan pemrosesan & masa simpan data.
- DSAR flow:
  - akses data subjek
  - koreksi data
  - penghapusan data
- Data minimization: simpan data seperlunya.
- Retention policy: tentukan masa retensi + prosedur purge.
- Data breach response: SOP insiden + notifikasi.

## 4) PCI DSS Compliance (Scope Checklist)
- Jangan simpan PAN/CVV kartu di sistem ini.
- Gunakan payment gateway tersertifikasi PCI DSS.
- Segmentasi jaringan sistem kas vs publik.
- Vulnerability scan rutin + patch management.
- Audit log akses admin & transaksi wajib aktif.
- Least privilege untuk akun DB, admin panel, server.

## 5) HTTP Headers Security
Header keamanan backend yang sudah dipasang:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`
- `Content-Security-Policy` (API baseline)
- `Cross-Origin-Resource-Policy: same-origin`
- `Cross-Origin-Opener-Policy: same-origin`
- `Strict-Transport-Security` (saat HTTPS)

## 6) Content Security Policy (CSP)
- Frontend CSP sudah ditambahkan di `index.html`.
- Jika ada domain eksternal baru, update `connect-src`/`img-src` secara eksplisit.
- Hindari inline script baru.

## 7) Cookies Privacy & Security
- Jika session cookie dipakai, wajib:
  - `HttpOnly`
  - `SameSite=Strict`
  - `Secure` (HTTPS)
- Jangan simpan token sensitif di query string.

## 8) External Content Security
- Batasi sumber API/asset eksternal melalui CSP.
- Validasi URL eksternal sebelum ditampilkan/diakses.
- Gunakan HTTPS untuk semua endpoint pihak ketiga.

## 9) Protection from Data Scraping
- Rate limit endpoint list/search/export.
- Tambahkan pagination & batas maksimal query.
- Audit permintaan anomali per IP/user agent.
- Pertimbangkan CAPTCHA untuk login publik jika brute force meningkat.

## 10) DNSSEC Configuration
- Konfigurasi di provider DNS domain (bukan di kode aplikasi):
  1. Aktifkan DNSSEC di zone.
  2. Publish DS record di registrar.
  3. Verifikasi status `secure` via tool DNSSEC checker.

## Environment Variables (Security)
Gunakan variabel ini di production:
- `APP_ENV=production`
- `APP_NAME=web_spp_api`
- `JWT_SECRET=<strong-secret-32+>`
- `CORS_ALLOWED_ORIGINS=https://app.domainanda.com,https://admin.domainanda.com`

## Verification Quick Test
- Cek response header API untuk endpoint `GET /index.php?route=me`.
- Uji origin tidak dikenal harus ditolak CORS.
- Uji brute force login: setelah melewati limit harus `429`.
- Uji import invalid: modal detail error tampil.
