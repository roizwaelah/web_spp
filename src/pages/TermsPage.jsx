import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchRoute } from "../api";

export default function TermsPage() {
  const [contact, setContact] = useState({
    school_name: "MA DARUSSALAM CILONGOK",
    support_whatsapp: "-",
    support_email: "-",
    support_hours: "Senin-Sabtu",
  });

  useEffect(() => {
    fetchRoute("public/legal-contact", { skipLoading: true })
      .then(({ data }) => {
        setContact((prev) => ({
          ...prev,
          ...data,
          school_name: data?.school_name || prev.school_name,
          support_whatsapp: data?.support_whatsapp || prev.support_whatsapp,
          support_email: data?.support_email || prev.support_email,
          support_hours: data?.support_hours || prev.support_hours,
        }));
      })
      .catch(() => {});
  }, []);

  return (
    <div className="landing-shell text-slate-100">
      <div className="landing-shell__backdrop" />
      <div className="landing-shell__image" />
      <div className="landing-shell__overlay" />
      <div className="landing-shell__content">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <div className="rounded-3xl border border-white/20 bg-slate-900/70 p-6 backdrop-blur">
            <h1 className="text-2xl font-bold text-white">Syarat & Ketentuan</h1>
            <p className="mt-2 text-sm text-slate-200">
              Dengan menggunakan layanan ini, pengguna menyetujui ketentuan pembayaran tagihan pendidikan secara daring.
            </p>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-100">
              <li>Pengguna wajib memastikan data akun dan NISN/NIS yang digunakan sudah benar.</li>
              <li>Pembayaran dilakukan sesuai nominal tagihan yang tampil di sistem.</li>
              <li>Status transaksi dapat berubah setelah verifikasi otomatis atau manual oleh petugas.</li>
              <li>Bukti pembayaran harus disimpan oleh pengguna sampai status transaksi selesai.</li>
              <li>Penyalahgunaan sistem dapat menyebabkan pembatasan akses akun.</li>
              <li>Layanan bantuan operasional tersedia pada jam kerja lembaga ({contact.support_hours}).</li>
            </ul>
            <div className="mt-6 text-sm text-slate-200">
              Bantuan {contact.school_name}: WA {contact.support_whatsapp} | Email {contact.support_email}
            </div>
            <div className="mt-6">
              <Link className="text-sm font-semibold text-sky-300 hover:text-sky-200" to="/">
                Kembali ke Halaman Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
