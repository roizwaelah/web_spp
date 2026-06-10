import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchRoute } from "../api";

const faqs = [
  {
    q: "Bagaimana cara membayar tagihan?",
    a: "Masuk sebagai Orang Tua, buka menu Tagihan, pilih tagihan, lalu lanjutkan ke metode pembayaran manual atau otomatis.",
  },
  {
    q: "Kenapa status transaksi masih menunggu?",
    a: "Beberapa metode memerlukan verifikasi dari sistem provider atau petugas bendahara sehingga status tidak langsung berubah.",
  },
  {
    q: "Bagaimana jika saldo terpotong tetapi status gagal?",
    a: "Simpan bukti transaksi dan segera laporkan ke admin/bendahara agar dapat dilakukan pengecekan pada referensi pembayaran.",
  },
  {
    q: "Di mana mengunduh bukti pembayaran?",
    a: "Bukti pembayaran dapat dilihat pada menu Riwayat Tagihan/Transaksi setelah pembayaran terverifikasi.",
  },
];

export default function FaqPage() {
  const [contact, setContact] = useState({
    school_name: "MA DARUSSALAM CILONGOK",
    support_whatsapp: "-",
    support_email: "-",
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
            <h1 className="text-2xl font-bold text-white">FAQ</h1>
            <div className="mt-5 space-y-4">
              {faqs.map((item) => (
                <div key={item.q} className="rounded-2xl bg-white/10 p-4">
                  <h2 className="text-sm font-semibold text-white">{item.q}</h2>
                  <p className="mt-1 text-sm text-slate-200">{item.a}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 text-sm text-slate-200">
              Pertanyaan lain: WA {contact.support_whatsapp} | Email {contact.support_email} ({contact.school_name})
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
