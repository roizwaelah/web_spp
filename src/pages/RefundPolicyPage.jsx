import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchRoute } from "../api";

export default function RefundPolicyPage() {
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
            <h1 className="text-2xl font-bold text-white">Refund Policy</h1>
            <p className="mt-2 text-sm text-slate-200">
              Kebijakan refund berlaku untuk transaksi pembayaran tagihan pendidikan yang terbukti mengalami kendala tertentu.
            </p>
            <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-100">
              <li>Refund dapat diajukan jika terjadi pembayaran ganda atau transaksi tidak tercatat namun dana terdebet.</li>
              <li>Pengajuan refund dilakukan maksimal 3 x 24 jam sejak transaksi.</li>
              <li>Data yang wajib disertakan: nama siswa, NISN/NIS, referensi transaksi, bukti pembayaran.</li>
              <li>Transaksi yang sudah tervalidasi dan sah digunakan untuk pelunasan tagihan tidak dapat dibatalkan sepihak.</li>
              <li>Waktu proses refund: maksimal 7 hari kerja setelah dokumen dinyatakan lengkap.</li>
            </ul>
            <div className="mt-6 text-sm text-slate-200">
              Informasi refund: WA {contact.support_whatsapp} | Email {contact.support_email} ({contact.school_name})
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
