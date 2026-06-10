import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Info, ShieldCheck } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { formatCurrency, formatDate } from "../utils";
import bcaLogo from "../assets/banks/bca.svg";
import bniLogo from "../assets/banks/bni.svg";
import briLogo from "../assets/banks/bri.svg";
import mandiriLogo from "../assets/banks/mandiri.svg";
import bsiLogo from "../assets/banks/bsi.svg";
import muamalatLogo from "../assets/banks/muamalat.png";
import permataLogo from "../assets/banks/permata.svg";
import alfamartLogo from "../assets/banks/alfamart.svg";
import indomaretLogo from "../assets/banks/indomaret.svg";

const getBillRemainingAmount = (bill) => {
  if (bill?.remaining_amount != null) return Number(bill.remaining_amount || 0);
  return Math.max(Number(bill?.amount || 0) - Number(bill?.paid_amount || 0), 0);
};

const normalizeAmountInput = (value) => String(value || "").replace(/[^\d]/g, "");
import gopayLogo from "../assets/banks/gopay.png";
import shopeepayLogo from "../assets/banks/shopeepay.svg";
import qrisLogo from "../assets/banks/qris.png";
import QRCode from "qrcode";

const paymentGatewayProviders = [
  { id: "ipaymu", name: "iPaymu" },
  { id: "tripay", name: "Tripay" },
];

function normalizeGatewayProviderKey(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider) return "";
  if (provider.includes("ipaymu")) return "ipaymu";
  if (provider.includes("tripay")) return "tripay";
  if (provider.includes("midtrans")) return "midtrans";
  if (provider.includes("doku")) return "doku";
  return provider;
}

function getActivePaymentGateway(providerKey) {
  return paymentGatewayProviders.find((provider) => provider.id === providerKey) || paymentGatewayProviders[0];
}

function formatCountdown(secondsLeft) {
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function useCountdown(initialSeconds) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return formatCountdown(secondsLeft);
}

function buildPaymentGroups(providerKey) {
  if (providerKey === "tripay") {
    return [
      {
        group: "Virtual Account",
        method: "va",
        icon: "bank",
        desc: "Pilih bank tujuan Virtual Account",
        items: [
          { id: "tripay-va-bca", name: "Bank Central Asia", shortName: "BCA", method: "va", channel: "tripay-va-bca", icon: "bank", logo: { src: bcaLogo, alt: "BCA" }, paymentCode: "TRX-BCA-001" },
          { id: "tripay-va-bni", name: "Bank Negara Indonesia", shortName: "BNI", method: "va", channel: "tripay-va-bni", icon: "bank", logo: { src: bniLogo, alt: "BNI" }, paymentCode: "TRX-BNI-001" },
          { id: "tripay-va-bri", name: "Bank Rakyat Indonesia", shortName: "BRI", method: "va", channel: "tripay-va-bri", icon: "bank", logo: { src: briLogo, alt: "BRI" }, paymentCode: "TRX-BRI-001" },
          { id: "tripay-va-mandiri", name: "Bank Mandiri", shortName: "Mandiri", method: "va", channel: "tripay-va-mandiri", icon: "bank", logo: { src: mandiriLogo, alt: "Mandiri" }, paymentCode: "TRX-MDR-001" },
          { id: "tripay-va-permata", name: "Bank Permata", shortName: "Permata", method: "va", channel: "tripay-va-permata", icon: "bank", logo: { src: permataLogo, alt: "PermataBank" }, paymentCode: "TRX-PRM-001" },
        ],
      },
      {
        group: "QRIS",
        method: "qris",
        icon: "qr",
        desc: "Pindai satu QRIS dari aplikasi pembayaran yang mendukung",
        items: [{ id: "tripay-qris", name: "QRIS", shortName: "QRIS", method: "qris", channel: "tripay-qris", icon: "qr", logo: { src: qrisLogo, alt: "QRIS" }, paymentCode: "TRIPAY-QRIS" }],
      },
      {
        group: "Convenience Store",
        method: "cstore",
        icon: "store",
        desc: "Bayar di gerai minimarket yang tersedia",
        items: [
          { id: "tripay-retail-indomaret", name: "Indomaret", shortName: "Indomaret", method: "cstore", channel: "tripay-retail-indomaret", icon: "store", logo: { src: indomaretLogo, alt: "Indomaret" }, paymentCode: "TRIPAY-INDO" },
          { id: "tripay-retail-alfamart", name: "Alfamart", shortName: "Alfamart", method: "cstore", channel: "tripay-retail-alfamart", icon: "store", logo: { src: alfamartLogo, alt: "Alfamart" }, paymentCode: "TRIPAY-ALFA" },
        ],
      },
    ];
  }

  return [
    {
      group: "Virtual Account",
      method: "va",
      icon: "bank",
      desc: "Pilih bank tujuan Virtual Account",
      items: [
        { id: "ipaymu-va-bca", name: "Bank Central Asia", shortName: "BCA", method: "va", channel: "ipaymu-va-bca", icon: "bank", logo: { src: bcaLogo, alt: "BCA" }, paymentCode: "IPM-BCA-001" },
        { id: "ipaymu-va-bni", name: "Bank Negara Indonesia", shortName: "BNI", method: "va", channel: "ipaymu-va-bni", icon: "bank", logo: { src: bniLogo, alt: "BNI" }, paymentCode: "IPM-BNI-001" },
        { id: "ipaymu-va-bri", name: "Bank Rakyat Indonesia", shortName: "BRI", method: "va", channel: "ipaymu-va-bri", icon: "bank", logo: { src: briLogo, alt: "BRI" }, paymentCode: "IPM-BRI-001" },
        { id: "ipaymu-va-mandiri", name: "Bank Mandiri", shortName: "Mandiri", method: "va", channel: "ipaymu-va-mandiri", icon: "bank", logo: { src: mandiriLogo, alt: "Mandiri" }, paymentCode: "IPM-MDR-001" },
        { id: "ipaymu-va-bsi", name: "Bank Syariah Indonesia", shortName: "BSI", method: "va", channel: "ipaymu-va-bsi", icon: "bank", logo: { src: bsiLogo, alt: "BSI" }, paymentCode: "IPM-BSI-001" },
        { id: "ipaymu-va-bmi", name: "Bank Muamalat Indonesia", shortName: "BMI", method: "va", channel: "ipaymu-va-bmi", icon: "bank", logo: { src: muamalatLogo, alt: "Bank Muamalat" }, paymentCode: "IPM-BMI-001" },
        { id: "ipaymu-va-permata", name: "Bank Permata", shortName: "Permata", method: "va", channel: "ipaymu-va-permata", icon: "bank", logo: { src: permataLogo, alt: "PermataBank" }, paymentCode: "IPM-PRM-001" },
      ],
    },
    {
      group: "QRIS",
      method: "qris",
      icon: "qr",
      desc: "Pindai satu QRIS dari aplikasi pembayaran yang mendukung",
      items: [{ id: "ipaymu-qris", name: "QRIS", shortName: "QRIS", method: "qris", channel: "ipaymu-qris", icon: "qr", logo: { src: qrisLogo, alt: "QRIS" }, paymentCode: "IPM-QRIS" }],
    },
    {
      group: "E-Wallet",
      method: "ewallet",
      icon: "wallet",
      desc: "Bayar menggunakan dompet digital yang didukung",
      items: [
        { id: "ipaymu-ewallet-gopay", name: "GoPay", shortName: "GoPay", method: "ewallet", channel: "ipaymu-ewallet-gopay", icon: "wallet", logo: { src: gopayLogo, alt: "GoPay" }, paymentCode: "IPM-GOPAY" },
        { id: "ipaymu-ewallet-shopeepay", name: "ShopeePay", shortName: "ShopeePay", method: "ewallet", channel: "ipaymu-ewallet-shopeepay", icon: "wallet", logo: { src: shopeepayLogo, alt: "ShopeePay" }, paymentCode: "IPM-SPAY" },
      ],
    },
    {
      group: "Convenience Store",
      method: "cstore",
      icon: "store",
      desc: "Bayar di gerai minimarket yang tersedia",
      items: [
        { id: "ipaymu-cstore-indomaret", name: "Indomaret", shortName: "Indomaret", method: "cstore", channel: "ipaymu-cstore-indomaret", icon: "store", logo: { src: indomaretLogo, alt: "Indomaret" }, paymentCode: "IPM-INDO" },
        { id: "ipaymu-cstore-alfamart", name: "Alfamart", shortName: "Alfamart", method: "cstore", channel: "ipaymu-cstore-alfamart", icon: "store", logo: { src: alfamartLogo, alt: "Alfamart" }, paymentCode: "IPM-ALFA" },
      ],
    },
  ];
}

function SvgIcon({ name, size = 22, className = "" }) {
  const commonProps = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
  };

  switch (name) {
    case "close":
      return <svg {...commonProps}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>;
    case "chevron":
      return <svg {...commonProps}><path d="m9 18 6-6-6-6" /></svg>;
    case "back":
      return <svg {...commonProps}><path d="m15 18-6-6 6-6" /></svg>;
    case "copy":
      return <svg {...commonProps}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
    case "clock":
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "check":
      return <svg {...commonProps}><path d="M20 6 9 17l-5-5" /></svg>;
    case "bank":
      return <svg {...commonProps}><path d="m3 10 9-6 9 6" /><path d="M4 10h16" /><path d="M6 10v8" /><path d="M10 10v8" /><path d="M14 10v8" /><path d="M18 10v8" /><path d="M4 18h16" /><path d="M3 21h18" /></svg>;
    case "qr":
      return <svg {...commonProps}><path d="M4 4h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6H4z" /><path d="M14 14h2" /><path d="M20 14v2" /><path d="M16 18h4" /><path d="M14 20h2" /></svg>;
    case "store":
      return <svg {...commonProps}><path d="M4 10h16" /><path d="M5 10l1-6h12l1 6" /><path d="M6 10v10h12V10" /><path d="M9 20v-5h6v5" /></svg>;
    case "wallet":
      return <svg {...commonProps}><path d="M20 8V7a3 3 0 0 0-3-3H5a2 2 0 0 0 0 4h15Z" /><path d="M4 8v11a2 2 0 0 0 2 2h14V8" /><path d="M16 14h4" /></svg>;
    default:
      return <svg {...commonProps}><circle cx="12" cy="12" r="9" /></svg>;
  }
}

function ProviderLogo({ method, compact = false }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const fallbackLabel = method.logo?.alt || method.shortName || method.name;
  const normalizedLabel = String(fallbackLabel || "").trim().toLowerCase();
  const isQrisLogo = normalizedLabel === "qris" && !!method.logo?.src;
  const isEwalletWordmarkLogo = (normalizedLabel === "shopeepay" || normalizedLabel === "gopay") && !!method.logo?.src;
  const boxClass = compact
    ? `flex h-10 w-full items-center justify-center rounded-xl px-2 ${isQrisLogo ? "bg-slate-900" : "bg-white"}`
    : `flex h-12 w-full items-center justify-center sm:h-14 ${isQrisLogo ? "rounded-xl bg-slate-900 px-2" : isEwalletWordmarkLogo ? "px-3 sm:px-4" : "px-2"}`;
  const imgClass = compact
    ? isQrisLogo
      ? "max-h-6 max-w-[82px] object-contain sm:max-h-7 sm:max-w-[88px]"
      : isEwalletWordmarkLogo
        ? "max-h-4 max-w-[74px] object-contain sm:max-h-5 sm:max-w-[80px]"
        : "max-h-5 max-w-[70px] object-contain sm:max-h-6 sm:max-w-[78px]"
    : isQrisLogo
      ? "max-h-7 max-w-[92px] object-contain sm:max-h-8 sm:max-w-[100px]"
      : isEwalletWordmarkLogo
        ? "max-h-6 max-w-[110px] object-contain sm:max-h-7 sm:max-w-[122px]"
        : "max-h-6 max-w-[78px] object-contain sm:max-h-7 sm:max-w-[92px]";

  return (
    <div className={boxClass}>
      {method.logo?.src && !logoFailed ? (
        <img src={method.logo.src} alt={method.logo.alt || method.name} className={imgClass} loading="lazy" onError={() => setLogoFailed(true)} />
      ) : (
        <span className="text-center text-xs font-black leading-tight text-slate-900">{fallbackLabel}</span>
      )}
    </div>
  );
}

function PaymentGatewayLogo({ provider }) {
  return (
    <div className="hidden h-8 min-w-[86px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/95 sm:flex">
      {provider?.name || "Gateway"}
    </div>
  );
}

function SupportByFooter({ providerName }) {
  return (
    <div className="sticky bottom-0 mt-auto flex items-center justify-center gap-2 border-t border-slate-200/80 bg-white/95 px-3 py-2.5 text-[11px] text-slate-500 backdrop-blur">
      <span>Support by</span>
      <span className="font-black text-sky-800">{providerName}</span>
    </div>
  );
}

function PaymentCategoryList({ groups, onOpenGroup, providerName }) {
  return (
    <div className="flex min-h-full flex-col p-2.5 sm:p-3">
      <div className="mb-2 px-1">
        <p className="text-[14px] font-black uppercase tracking-[0.18em] text-slate-900">Metode Pembayaran</p>
        <p className="mt-0.5 text-[11px] text-slate-500">Pilih kategori lalu kanal pembayaran.</p>
      </div>
      <div className="flex-1 space-y-1.5 pb-2 sm:space-y-2">
        {groups.map((group) => (
          <button key={group.group} type="button" onClick={() => onOpenGroup(group)} className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md sm:p-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800 ring-1 ring-sky-100"><SvgIcon name={group.icon} size={19} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[12px] font-black leading-tight text-slate-900 sm:text-[13px]">{group.group}</h2>
                </div>
                <p className="mt-px truncate text-[10px] leading-tight text-slate-500 sm:text-[11px]">{group.desc}</p>
              </div>
              <SvgIcon name="chevron" size={18} className="text-slate-300 transition group-hover:text-sky-700" />
          </button>
        ))}
      </div>
      <SupportByFooter providerName={providerName} />
    </div>
  );
}

function PaymentSummaryCard({ method, amountLabel, merchant, expiresInSeconds, orderId, customAmountControl = null, showBack = false, onBack = null }) {
  const countdown = useCountdown(expiresInSeconds);
  return (
    <>
      {showBack && onBack ? (
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-sky-50 hover:text-slate-900">
          <SvgIcon name="back" size={16} />
          Kembali
        </button>
      ) : null}
      <div className="rounded-xl bg-gradient-to-br from-sky-800 to-sky-900 p-3 text-white shadow-lg shadow-sky-800/20 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">Total Pembayaran</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-[1.7rem]">{amountLabel}</h2>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1.5 font-mono text-xs font-bold text-white ring-1 ring-white/15">{countdown}</span>
        </div>
      </div>
      {customAmountControl}
      <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          {method ? (
            <div className="flex h-11 w-[88px] shrink-0 items-center justify-center rounded-lg bg-white px-2 shadow-sm ring-1 ring-slate-200 sm:h-12 sm:w-[96px]"><ProviderLogo method={method} compact /></div>
          ) : (
            <div className="flex h-11 w-[88px] shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-800 shadow-sm ring-1 ring-slate-200 sm:h-12 sm:w-[96px]"><SvgIcon name="clock" size={20} /></div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-slate-50/90 p-2.5">
              <p className="text-[12px] font-bold text-slate-400">No. Referensi</p>
              <p className="mt-px truncate font-mono text-[11px] font-black text-slate-900">{orderId}</p>
            </div>
            <div className="rounded-lg bg-slate-50/90 p-2.5">
              <p className="text-[12px] font-bold text-slate-400">Status</p>
              <p className="mt-px truncate text-[11px] font-black text-slate-900">Menunggu</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function QrisSummaryPage({ method, summaryProps, onBack, showBack = true, showSteps = true, onPay = null, busy = false }) {
  return (
    <div className="animate-[slideIn_180ms_ease-out] p-3 sm:px-0 sm:py-3">
      <PaymentSummaryCard method={method} showBack={showBack} onBack={onBack} {...summaryProps} />
      <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm text-center">
        <div className="rounded-xl bg-slate-50 p-3 text-center ring-1 ring-slate-200/80">
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-8 text-sm text-slate-500">
            QR resmi akan tampil di sini setelah transaksi QRIS berhasil dibuat.
          </div>
        </div>
      </div>

      {showSteps ? (
        <PaymentStepsCard
          title="Cara Pembayaran QRIS"
          caption="Setelah QR tampil, ikuti langkah berikut untuk menyelesaikan pembayaran."
          steps={[
            "Klik tombol bayar sekarang untuk membuat transaksi QRIS.",
            "Pindai QR menggunakan mobile banking atau e-wallet yang mendukung QRIS.",
            "Pastikan nama merchant dan nominal pembayaran sudah benar sebelum konfirmasi.",
            "Tunggu hingga status transaksi diperbarui otomatis oleh sistem.",
          ]}
        />
      ) : null}

      {onPay ? (
        <button
          type="button"
          onClick={() => onPay(method)}
          disabled={busy}
          className="mt-2.5 w-full rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-800/20 transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Memproses..." : "Bayar Sekarang"}
        </button>
      ) : null}
    </div>
  );
}

function ProviderGridPage({ group, onBack, onSelect }) {
  const isEwalletGroup = group.method === "ewallet";
  return (
    <div className="p-2.5 animate-[slideIn_180ms_ease-out] sm:p-3">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-sky-50 hover:text-slate-900"><SvgIcon name="back" size={16} />Kembali</button>
      <div className={isEwalletGroup ? "flex flex-wrap items-center justify-center gap-3" : "grid grid-cols-2 gap-2 sm:grid-cols-3"}>
        {group.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            aria-label={`Pilih ${item.name}`}
            title={`${item.name} (${item.method}/${item.channel})`}
            className={`rounded-xl transition hover:-translate-y-0.5 hover:bg-slate-50 ${isEwalletGroup ? "w-[96px] px-3 py-2 sm:w-[102px] sm:px-3.5 sm:py-2.5" : "p-2 sm:p-2.5"}`}
          >
            <ProviderLogo method={item} />
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-500">Ketuk logo kanal pembayaran untuk melihat rincian dan instruksi.</div>
    </div>
  );
}

function getInstructionContent(method) {
  if (method?.method === "qris") {
    return {
      title: "Instruksi Pembayaran QRIS",
      caption: "Pindai QRIS resmi dari gateway lalu selesaikan pembayaran dari aplikasi yang Anda gunakan.",
      badge: "QRIS",
      steps: [
        "Buat transaksi terlebih dahulu agar QRIS resmi ditampilkan oleh gateway.",
        "Pindai QRIS menggunakan mobile banking atau e-wallet yang mendukung QRIS.",
        "Pastikan nama merchant dan nominal pembayaran sudah benar sebelum konfirmasi.",
        "Selesaikan pembayaran dari aplikasi Anda dan tunggu status diperbarui otomatis.",
      ],
    };
  }

  if (method?.method === "ewallet") {
    const walletLabel = method?.shortName || method?.name || "e-wallet";
    return {
      title: `Instruksi Pembayaran ${walletLabel}`,
      caption: `Lanjutkan pembayaran menggunakan ${walletLabel} setelah transaksi dibuat oleh gateway.`,
      badge: "E-Wallet",
      steps: [
        `Klik tombol bayar untuk membuat sesi pembayaran ${walletLabel}.`,
        `Ikuti arahan dari gateway atau aplikasi ${walletLabel} yang terbuka.`,
        "Periksa nominal pembayaran sebelum melanjutkan konfirmasi akhir.",
        "Setelah pembayaran selesai, tunggu status transaksi diperbarui otomatis.",
      ],
      note: `Gunakan akun ${walletLabel} yang aktif agar proses otorisasi tidak tertunda.`,
    };
  }

  if (method?.method === "va") {
    const channel = String(method?.channel || "").toLowerCase();
    const bankLabel = method?.shortName || method?.name || "bank tujuan";
    let steps = [
      "Salin nomor virtual account di bawah ini.",
      "Buka ATM, mobile banking, atau internet banking bank tujuan.",
      "Pilih menu transfer / virtual account lalu masukkan nomor tersebut.",
      "Periksa nama merchant dan nominal pembayaran sebelum konfirmasi.",
      "Simpan bukti pembayaran sampai status transaksi diperbarui otomatis.",
    ];

    if (channel.includes("bca")) {
      steps = [
        "Salin nomor virtual account BCA di bawah ini.",
        "Buka m-BCA, KlikBCA, atau ATM BCA Anda.",
        "Pilih menu m-Transfer / Transfer / BCA Virtual Account.",
        "Masukkan nomor virtual account lalu cek nominal pembayaran.",
        "Konfirmasi transaksi dan simpan bukti pembayaran Anda.",
      ];
    } else if (channel.includes("bri")) {
      steps = [
        "Salin nomor virtual account BRI di bawah ini.",
        "Buka BRImo, ATM BRI, atau internet banking BRI.",
        "Pilih menu pembayaran BRIVA / Virtual Account.",
        "Masukkan nomor virtual account dan periksa detail tagihan.",
        "Lanjutkan pembayaran lalu simpan bukti transaksi.",
      ];
    } else if (channel.includes("bni")) {
      steps = [
        "Salin nomor virtual account BNI di bawah ini.",
        "Buka wondr by BNI, ATM BNI, atau BNI Internet Banking.",
        "Pilih menu transfer / pembayaran virtual account.",
        "Masukkan nomor virtual account dan pastikan nominal sesuai.",
        "Konfirmasi transaksi dan simpan bukti pembayaran.",
      ];
    } else if (channel.includes("mandiri")) {
      steps = [
        "Salin nomor virtual account Mandiri di bawah ini.",
        "Buka Livin' by Mandiri, ATM Mandiri, atau Mandiri Internet Banking.",
        "Pilih menu Bayar / Multipayment / Virtual Account.",
        "Masukkan nomor virtual account lalu cek nama dan nominal tagihan.",
        "Selesaikan pembayaran dan simpan bukti transaksi Anda.",
      ];
    } else if (channel.includes("bsi")) {
      steps = [
        "Salin nomor virtual account BSI di bawah ini.",
        "Buka BYOND by BSI, ATM BSI, atau internet banking BSI.",
        "Pilih menu transfer / virtual account.",
        "Masukkan nomor virtual account lalu pastikan detail pembayaran benar.",
        "Konfirmasi pembayaran dan simpan bukti transaksi.",
      ];
    } else if (channel.includes("bmi") || channel.includes("muamalat")) {
      steps = [
        "Salin nomor virtual account Muamalat di bawah ini.",
        "Buka aplikasi Muamalat DIN, ATM Muamalat, atau internet banking Muamalat.",
        "Pilih menu transfer / virtual account sesuai kanal yang tersedia.",
        "Masukkan nomor virtual account dan cek nominal tagihan.",
        "Selesaikan pembayaran lalu simpan bukti transaksi Anda.",
      ];
    } else if (channel.includes("permata")) {
      steps = [
        "Salin nomor virtual account Permata di bawah ini.",
        "Buka PermataMobile X, ATM Permata, atau internet banking Permata.",
        "Pilih menu pembayaran virtual account.",
        "Masukkan nomor virtual account dan periksa detail pembayaran.",
        "Konfirmasi pembayaran dan simpan bukti transaksi.",
      ];
    }

    return {
      title: `Instruksi Virtual Account ${bankLabel}`,
      caption: `Salin nomor virtual account ${bankLabel} lalu selesaikan pembayaran dari ATM atau mobile banking.`,
      badge: "Virtual Account",
      steps,
      note: `Pembayaran melalui ${bankLabel} akan diverifikasi otomatis setelah dana diterima oleh sistem.`,
    };
  }

  if (method?.method === "cstore") {
    const channel = String(method?.channel || "").toLowerCase();
    const retailLabel = method?.shortName || method?.name || "gerai retail";
    let steps = [
      "Salin atau catat kode pembayaran di bawah ini.",
      "Datangi gerai yang dipilih pada jam operasional.",
      "Sampaikan ke kasir bahwa Anda akan membayar tagihan melalui kode pembayaran.",
      "Tunjukkan kode pembayaran dan lakukan pembayaran sesuai nominal.",
      "Simpan struk dari kasir sampai status pembayaran diperbarui otomatis.",
    ];
    let note = "Kode pembayaran retail biasanya memiliki masa berlaku terbatas, jadi sebaiknya segera digunakan.";

    if (channel.includes("indomaret")) {
      steps = [
        "Salin kode pembayaran Indomaret di bawah ini.",
        "Datangi kasir Indomaret terdekat selama kode masih aktif.",
        "Sampaikan bahwa Anda akan melakukan pembayaran tagihan melalui kode Indomaret.",
        "Tunjukkan kode pembayaran lalu lakukan pembayaran sesuai nominal yang tampil.",
        "Simpan struk Indomaret sampai status pembayaran diperbarui otomatis oleh sistem.",
      ];
      note = "Pada Indomaret, kasir biasanya akan memverifikasi kode lebih dulu sebelum menerima pembayaran.";
    } else if (channel.includes("alfamart")) {
      steps = [
        "Salin kode pembayaran Alfamart di bawah ini.",
        "Kunjungi kasir Alfamart selama masa berlaku kode belum habis.",
        "Informasikan bahwa Anda ingin membayar tagihan menggunakan kode pembayaran Alfamart.",
        "Tunjukkan kode kepada kasir dan lakukan pembayaran sesuai nominal yang diberikan.",
        "Simpan struk Alfamart sampai sistem memperbarui status transaksi secara otomatis.",
      ];
      note = "Kode Alfamart sebaiknya segera digunakan karena masa berlakunya biasanya singkat dan tidak bisa dipakai ulang.";
    }

    return {
      title: `Instruksi Pembayaran ${retailLabel}`,
      caption: `Gunakan kode pembayaran ini saat datang ke kasir ${retailLabel}.`,
      badge: "Convenience Store",
      steps,
      note,
    };
  }

  return {
    title: "Instruksi Pembayaran",
    caption: "Salin kode pembayaran lalu lanjutkan sesuai metode yang dipilih.",
    badge: "Pembayaran",
    steps: [
      "Salin kode pembayaran di bawah ini.",
      "Lanjutkan pembayaran sesuai kanal yang dipilih.",
      "Simpan bukti pembayaran sampai transaksi selesai.",
    ],
    note: "Status transaksi akan diperbarui otomatis setelah pembayaran berhasil.",
  };
}

function inferMethodFromPaymentSession(paymentSession) {
  const summaryName = String(paymentSession?.paymentName || "").toLowerCase();
  const paymentLabel = String(paymentSession?.paymentNumberLabel || "").toLowerCase();
  const baseMethod = paymentSession?.method ? { ...paymentSession.method } : {};
  const combined = `${summaryName} ${paymentLabel} ${baseMethod?.channel || ""}`.toLowerCase();

  if (!baseMethod.method) {
    if (paymentSession?.qrImage || paymentSession?.qrString || combined.includes("qris") || combined.includes("qr")) {
      baseMethod.method = "qris";
    } else if (combined.includes("indomaret") || combined.includes("alfamart") || combined.includes("retail") || combined.includes("cstore")) {
      baseMethod.method = "cstore";
    } else if (combined.includes("virtual") || combined.includes("va")) {
      baseMethod.method = "va";
    } else if (combined.includes("gopay") || combined.includes("shopeepay") || combined.includes("ewallet")) {
      baseMethod.method = "ewallet";
    }
  }

  if (!baseMethod.name && paymentSession?.paymentName) {
    baseMethod.name = paymentSession.paymentName;
  }
  if (!baseMethod.shortName && baseMethod.name) {
    baseMethod.shortName = baseMethod.name;
  }

  if (!baseMethod.channel) {
    if (combined.includes("indomaret")) baseMethod.channel = "session-retail-indomaret";
    else if (combined.includes("alfamart")) baseMethod.channel = "session-retail-alfamart";
    else if (combined.includes("bca")) baseMethod.channel = "session-va-bca";
    else if (combined.includes("bri")) baseMethod.channel = "session-va-bri";
    else if (combined.includes("bni")) baseMethod.channel = "session-va-bni";
    else if (combined.includes("mandiri")) baseMethod.channel = "session-va-mandiri";
    else if (combined.includes("bsi")) baseMethod.channel = "session-va-bsi";
    else if (combined.includes("muamalat") || combined.includes("bmi")) baseMethod.channel = "session-va-bmi";
    else if (combined.includes("permata")) baseMethod.channel = "session-va-permata";
  }

  return baseMethod;
}

function PaymentInstruction({ method, summaryProps, onBack, onPay, busy, showBack = true, showSteps = true }) {
  const [copied, setCopied] = useState(false);
  const instruction = getInstructionContent(method);

  function handleCopy() {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(method.paymentCode).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="animate-[slideIn_180ms_ease-out] p-3 sm:px-0 sm:py-3">
      <PaymentSummaryCard method={method} showBack={showBack} onBack={onBack} {...summaryProps} />
      <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-3">
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200 sm:px-4 sm:py-4">
          <p className="min-w-0 flex-1 break-all text-center font-mono text-lg font-black tracking-wide text-slate-900 sm:text-[1.35rem]">{method.paymentCode}</p>
          <button type="button" onClick={handleCopy} className="shrink-0 rounded-lg bg-slate-950 p-2.5 text-white transition hover:bg-slate-800" aria-label="Salin kode pembayaran"><SvgIcon name={copied ? "check" : "copy"} size={17} /></button>
        </div>
      </div>

      {showSteps ? (
        <PaymentStepsCard
          title={instruction.title}
          caption="Ikuti langkah berikut agar pembayaran tercatat dengan benar."
          steps={instruction.steps}
          note={instruction.note}
          itemKeyPrefix={method.id}
        />
      ) : null}
      <button type="button" onClick={() => onPay(method)} disabled={busy} className="mt-2.5 w-full rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-800/20 transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Memproses..." : "Bayar Sekarang"}</button>
    </div>
  );
}

function PaymentStepsCard({ title, caption, steps, note, itemKeyPrefix = "step" }) {
  return (
    <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
      <div>
        <p className="text-sm font-black text-[#0a2254]">{title}</p>
        <p className="mt-1 text-xs text-slate-500">{caption}</p>
      </div>
      <ol className="mt-4 space-y-2.5">
        {steps.map((step, index) => (
          <li key={`${itemKeyPrefix}-${index}`} className="flex w-full gap-3">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0667ff] text-[11px] font-bold text-white">
              {index + 1}
            </span>
            <span className="text-xs leading-relaxed text-slate-700">{step}</span>
          </li>
        ))}
      </ol>
      {note ? (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-slate-700">
          <div className="flex items-start gap-2">
            <Info size={15} className="mt-0.5 text-[#0667ff]" />
            <span>{note}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopInstructionPanel({ method, onBack }) {
  const instruction = getInstructionContent(method);

  return (
    <div className="p-3">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-slate-500 transition hover:bg-sky-50 hover:text-slate-900">
        <SvgIcon name="back" size={16} />
        Pilih channel lain
      </button>
      <PaymentStepsCard
        title={instruction.title}
        caption="Ikuti langkah berikut agar pembayaran tercatat dengan benar."
        steps={instruction.steps}
        note={instruction.note}
        itemKeyPrefix={method.id}
      />
    </div>
  );
}

function EmptyPaymentDetails({ summaryProps }) {
  return (
    <div className="p-2.5 sm:px-0 sm:py-2">
      <PaymentSummaryCard {...summaryProps} />
      <div className="mt-3 flex min-h-[180px] items-center justify-center rounded-xl bg-slate-50 p-5 ring-1 ring-slate-200/80">
        <div className="max-w-xs text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-sky-50 text-sky-800">
            <SvgIcon name="chevron" size={20} />
          </div>
          <h2 className="mt-3 text-sm font-black text-slate-900">Pilih kanal pembayaran</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Detail pembayaran akan tampil di sini setelah kanal dipilih.
          </p>
        </div>
      </div>
    </div>
  );
}

function BillSummaryCard({ selectedBills, totalPayment }) {
  return (
    <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Ringkasan Tagihan</p>
          <p className="mt-1 text-sm font-black text-[#0a2254]">{selectedBills.length} tagihan dipilih</p>
        </div>
        <span className="rounded-full bg-[#edf5ff] px-2.5 py-1 text-[11px] font-bold text-[#0667ff]">{formatCurrency(totalPayment)}</span>
      </div>
      <div className="mt-3 space-y-2">
        {selectedBills.slice(0, 4).map((bill) => (
          <div key={bill.id} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-800">{bill.bill_name}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{bill.period || "-"}</p>
            </div>
            <span className="shrink-0 text-xs font-bold text-slate-700">{formatCurrency(getBillRemainingAmount(bill))}</span>
          </div>
        ))}
        {selectedBills.length > 4 ? <p className="text-center text-[11px] font-semibold text-slate-500">+{selectedBills.length - 4} tagihan lainnya</p> : null}
      </div>
    </div>
  );
}

function buildPaymentSession(data, method, providerTitle) {
  const popupPayment = data?.popup_payment || {};
  const summaryMethod = popupPayment.payment_name || popupPayment.payment_method || method?.name || providerTitle;
  const summaryMethodKey = String(summaryMethod || "").toLowerCase();
  const paymentNumberLabel = summaryMethodKey.includes("virtual") || summaryMethodKey.includes("va")
    ? "Nomor Virtual Account"
    : summaryMethodKey.includes("alfamart") || summaryMethodKey.includes("indomaret") || summaryMethodKey.includes("retail") || summaryMethodKey.includes("cstore")
      ? "Kode Pembayaran"
      : "Nomor Pembayaran";

  return {
    providerTitle,
    method: method || null,
    referenceNo: data?.reference_no || "",
    redirectUrl: data?.redirect_url || "",
    subtotal: popupPayment.subtotal || data?.total_amount || 0,
    fee: popupPayment.fee || 0,
    total: popupPayment.total || data?.total_amount || 0,
    paymentName: summaryMethod,
    paymentNumberLabel,
    paymentNumber: popupPayment.payment_number || "",
    qrImage: popupPayment.qr_image || "",
    qrString: popupPayment.qr_string || "",
    expiredAt: popupPayment.expired_at || "",
    instructions: Array.isArray(popupPayment.instructions) ? popupPayment.instructions : [],
  };
}

function LivePaymentDetail({ paymentSession, summaryProps, selectedBills, totalPayment, onBack, onOpenHistory, showBack = false }) {
  const [copied, setCopied] = useState(false);
  const [generatedQrImage, setGeneratedQrImage] = useState("");
  const [qrGenerateFailed, setQrGenerateFailed] = useState(false);
  const generatedQrBlobUrlRef = useRef("");
  const hasQr = Boolean(paymentSession?.qrImage);
  const hasPaymentNumber = Boolean(paymentSession?.paymentNumber);
  const derivedMethod = useMemo(() => inferMethodFromPaymentSession(paymentSession), [paymentSession]);
  const fallbackInstruction = useMemo(() => getInstructionContent(derivedMethod), [derivedMethod]);
  const isEwallet = derivedMethod?.method === "ewallet";
  const normalizedQrString = useMemo(() => {
    if (!paymentSession?.qrString) return "";
    return String(paymentSession.qrString).replace(/\s+/g, "").trim();
  }, [paymentSession?.qrString]);
  const hasRenderableQr = Boolean(paymentSession?.qrImage || generatedQrImage);

  function handleCopy(text) {
    if (!text) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  useEffect(() => {
    let cancelled = false;

    const revokeBlobUrl = () => {
      if (typeof URL === "undefined") return;
      const current = generatedQrBlobUrlRef.current;
      if (current && current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
        generatedQrBlobUrlRef.current = "";
      }
    };

    if (hasQr || !normalizedQrString) {
      revokeBlobUrl();
      setGeneratedQrImage("");
      setQrGenerateFailed(false);
      return () => {
        cancelled = true;
      };
    }

    setQrGenerateFailed(false);

    const makeQr = async () => {
      try {
        const primary = await QRCode.toDataURL(normalizedQrString, {
          width: 560,
          margin: 2,
          errorCorrectionLevel: "M",
        });
        if (!cancelled) {
          revokeBlobUrl();
          setGeneratedQrImage(primary);
          return;
        }
      } catch (primaryError) {
        try {
          const fallback = await QRCode.toDataURL([{ data: normalizedQrString, mode: "byte" }], {
            width: 560,
            margin: 2,
            errorCorrectionLevel: "L",
          });
          if (!cancelled) {
            revokeBlobUrl();
            setGeneratedQrImage(fallback);
            return;
          }
        } catch (fallbackError) {
          try {
            const svg = await QRCode.toString(normalizedQrString, {
              type: "svg",
              errorCorrectionLevel: "L",
              margin: 2,
            });
            if (!cancelled && typeof Blob !== "undefined" && typeof URL !== "undefined") {
              revokeBlobUrl();
              const blobUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
              generatedQrBlobUrlRef.current = blobUrl;
              setGeneratedQrImage(blobUrl);
              return;
            }
          } catch (svgError) {
            if (!cancelled) {
              revokeBlobUrl();
              setGeneratedQrImage("");
              setQrGenerateFailed(true);
            }
          }
        }
      }
    };

    makeQr();

    return () => {
      cancelled = true;
    };
  }, [hasQr, normalizedQrString]);

  return (
    <div className="animate-[slideIn_180ms_ease-out] p-3 sm:px-0 sm:py-3">
      <PaymentSummaryCard
        method={derivedMethod}
        showBack={showBack}
        onBack={onBack}
        {...summaryProps}
        amountLabel={formatCurrency(paymentSession?.total || 0)}
        orderId={paymentSession?.referenceNo || summaryProps.orderId}
      />
      <BillSummaryCard selectedBills={selectedBills} totalPayment={totalPayment} />

      {hasPaymentNumber ? (
        <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
            <p className="min-w-0 flex-1 break-all text-center font-mono text-lg font-black tracking-wide text-slate-900 sm:text-[1.35rem]">{paymentSession.paymentNumber}</p>
            <button
              type="button"
              onClick={() => handleCopy(paymentSession.paymentNumber)}
              className="shrink-0 rounded-lg bg-slate-950 p-2.5 text-white transition hover:bg-slate-800"
              aria-label="Salin nomor pembayaran"
            >
              <Copy size={17} />
            </button>
          </div>
        </div>
      ) : null}

      {hasRenderableQr ? (
        <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 text-center">
          <img
            src={paymentSession.qrImage || generatedQrImage}
            alt={`QR ${paymentSession.providerTitle}`}
            className="mx-auto w-full max-w-[180px] rounded-xl border border-emerald-200 bg-white p-2 sm:max-w-[220px]"
          />
        </div>
      ) : null}

      {!hasRenderableQr && paymentSession?.qrString ? (
        <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
            <p className="min-w-0 flex-1 break-all text-center font-mono text-xs font-bold text-slate-700">{normalizedQrString || paymentSession.qrString}</p>
            <button
              type="button"
              onClick={() => handleCopy(normalizedQrString || paymentSession.qrString)}
              className="shrink-0 rounded-lg bg-slate-950 p-2.5 text-white transition hover:bg-slate-800"
              aria-label="Salin QR string"
            >
              <Copy size={17} />
            </button>
          </div>
          {qrGenerateFailed ? (
            <p className="mt-2 text-center text-[11px] font-semibold text-amber-700">Gagal membuat gambar QR dari payload.</p>
          ) : null}
        </div>
      ) : null}

      {isEwallet ? (
        <div className="mt-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">Aksi Pembayaran</p>
              <p className="mt-2 text-sm font-black text-[#0a2254]">Lanjutkan dengan {derivedMethod?.name || "E-Wallet"}</p>
              <p className="mt-1 text-xs text-slate-500">Gunakan tombol di bawah untuk membuka kanal pembayaran, lalu selesaikan otorisasi dari aplikasi Anda.</p>
            </div>
            {derivedMethod ? (
              <div className="flex h-12 w-[72px] shrink-0 items-center justify-center rounded-lg bg-white px-2 shadow-sm ring-1 ring-slate-200 sm:w-20">
                <ProviderLogo method={derivedMethod} compact />
              </div>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2">
            <div className="rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Status Kanal</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Menunggu otorisasi pengguna</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-3 ring-1 ring-slate-200">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Verifikasi</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">Otomatis setelah pembayaran selesai</p>
            </div>
          </div>
          {paymentSession?.redirectUrl ? (
            <button
              type="button"
              className="mt-3 w-full rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-800/20 transition hover:bg-sky-900"
              onClick={() => window.open(paymentSession.redirectUrl, "_blank", "noopener,noreferrer")}
            >
              Buka {derivedMethod?.name || "E-Wallet"}
            </button>
          ) : null}
        </div>
      ) : null}


      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:flex sm:justify-end">
        {paymentSession?.redirectUrl ? (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => window.open(paymentSession.redirectUrl, "_blank", "noopener,noreferrer")}
          >
            Buka Gateway
          </button>
        ) : null}
        <button type="button" className="rounded-lg bg-sky-800 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-800/20 transition hover:bg-sky-900" onClick={onOpenHistory}>
          Lihat Riwayat
        </button>
      </div>
      {copied ? <p className="mt-2 text-center text-[11px] font-semibold text-emerald-700">Berhasil disalin.</p> : null}
    </div>
  );
}

export default function ParentGatewayPopupV2Page() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [paymentSession, setPaymentSession] = useState(null);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [gatewayRejection, setGatewayRejection] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const popConfirmingRef = useRef(false);
  const navigationBypassRef = useRef(false);

  useToastMessage(message, setMessage);

  const requestedBillIds = useMemo(() => (searchParams.get("bill_ids") || "").split(",").map((value) => value.trim()).filter(Boolean), [searchParams]);
  const requestedPaymentAmount = searchParams.get("payment_amount") || "";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: billsData }, { data: dashboardData }] = await Promise.all([
          fetchRoute("parent/bills"),
          fetchRoute("parent/dashboard"),
        ]);
        setBills(Array.isArray(billsData) ? billsData : []);
        setSettings(dashboardData?.settings || {});
      } catch (error) {
        setMessage({ type: "error", text: error?.response?.data?.message || "Gagal memuat payment gateway" });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (allowNavigation) return undefined;
    const handleBeforeUnload = (event) => {
      if (navigationBypassRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [allowNavigation]);

  useEffect(() => {
    if (allowNavigation) return undefined;
    window.history.pushState({ parentGatewayPopupV2Guard: true }, "", window.location.href);

    const handlePopState = async () => {
      if (allowNavigation || navigationBypassRef.current || popConfirmingRef.current) return;
      popConfirmingRef.current = true;
      const confirmed = await confirm({
        title: "Tinggalkan payment gateway?",
        description: "Pilihan kanal pembayaran akan dibatalkan jika Anda keluar dari halaman ini.",
        confirmLabel: "Ya, tinggalkan",
        cancelLabel: "Tetap di sini",
        variant: "danger",
      });

      if (confirmed) {
        navigationBypassRef.current = true;
        setAllowNavigation(true);
        window.history.back();
      } else {
        window.history.pushState({ parentGatewayPopupV2Guard: true }, "", window.location.href);
      }

      popConfirmingRef.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allowNavigation, confirm]);

  const selectedBills = useMemo(() => bills.filter((bill) => requestedBillIds.includes(String(bill.id)) && bill.status !== "paid" && bill.proof_status !== "pending" && bill.proof_status !== "approved"), [bills, requestedBillIds]);
  const totalPayment = selectedBills.reduce((total, bill) => total + getBillRemainingAmount(bill), 0);
  const selectedBillStudentIds = useMemo(() => Array.from(new Set(selectedBills.map((bill) => String(bill.student_id || "")))).filter((id) => id !== ""), [selectedBills]);
  const canUseCustomAmount = selectedBillStudentIds.length === 1 && selectedBills.some((bill) => !!bill?.is_flexible_installment);
  const parsedPaymentAmount = Number(paymentAmount || 0);
  const effectivePaymentAmount = canUseCustomAmount ? parsedPaymentAmount : totalPayment;
  const gatewayEnabled = settings?.payment_gateway_enabled === "1";
  const gatewayProviderKey = normalizeGatewayProviderKey(settings?.payment_gateway_provider || "");
  const gatewayMode = String(settings?.payment_gateway_mode || "redirect").toLowerCase();
  const activeGateway = getActivePaymentGateway(gatewayProviderKey);
  const paymentGroups = useMemo(() => buildPaymentGroups(gatewayProviderKey), [gatewayProviderKey]);
  const orderId = useMemo(() => `INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${selectedBills.length || 0}`, [selectedBills.length]);
  const customAmountControl = canUseCustomAmount ? (
    <div className="mt-2.5 rounded-xl border border-sky-100 bg-sky-50/80 p-3 shadow-sm">
      <label className="text-[11px] font-bold uppercase tracking-wider text-sky-900/70">Nominal Pembayaran</label>
      <input
        type="text"
        inputMode="numeric"
        className="mt-2 w-full rounded-xl border border-sky-200 bg-white px-3 py-2 text-xl font-black text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        value={formatCurrency(paymentAmount)}
        onChange={(event) => setPaymentAmount(normalizeAmountInput(event.target.value))}
      />
      <p className="mt-2 text-xs leading-relaxed text-sky-900/70">
        Masukkan nominal yang akan Bapak/Ibu bayar melalui gateway. Nominal fleksibel ini hanya berlaku untuk satu siswa/santri dan akan dialokasikan ke tagihan periode lama terlebih dahulu.
      </p>
    </div>
  ) : null;
  const summaryProps = useMemo(() => ({ amountLabel: formatCurrency(effectivePaymentAmount), merchant: settings?.school_name || "SPP Darussalam Panusupan", expiresInSeconds: 24 * 60 * 60, orderId, customAmountControl }), [effectivePaymentAmount, settings?.school_name, orderId, customAmountControl]);
  const transactionUrl = paymentSession?.referenceNo ? `/orang-tua/transaksi?gateway=${encodeURIComponent(gatewayProviderKey || "gateway")}&ref=${encodeURIComponent(paymentSession.referenceNo)}` : "/orang-tua/transaksi";

  useEffect(() => {
    const initialAmount = normalizeAmountInput(requestedPaymentAmount) || String(totalPayment);
    setPaymentAmount(canUseCustomAmount ? initialAmount : "");
  }, [canUseCustomAmount, requestedPaymentAmount, totalPayment]);

  useEffect(() => {
    setSelectedGroup(null);
    setSelectedMethod(null);
    setPaymentSession(null);
  }, [gatewayProviderKey]);

  function handleOpenGroup(group) {
    setGatewayRejection("");
    setPaymentSession(null);
    if (group.method === "qris") {
      setSelectedMethod(group.items[0]);
      return;
    }
    setSelectedGroup(group);
  }

  async function pay(method) {
    if (!gatewayEnabled) {
      setMessage({ type: "warning", text: "Payment gateway sedang dinonaktifkan. Gunakan pembayaran manual untuk saat ini." });
      return;
    }
    if (!selectedBills.length) {
      setMessage({ type: "warning", text: "Tidak ada tagihan yang dipilih." });
      return;
    }
    if (canUseCustomAmount && effectivePaymentAmount <= 0) {
      setMessage({ type: "warning", text: "Nominal pembayaran wajib lebih dari Rp 0." });
      return;
    }

    try {
      setBusy(true);
      setGatewayRejection("");
      setPaymentSession(null);
      const { data } = await fetchRoute("parent/payments", {
        method: "POST",
        data: {
          bill_ids: selectedBills.map((bill) => bill.id),
          payment_channel: method.channel,
          ...(canUseCustomAmount ? { payment_amount: effectivePaymentAmount } : {}),
        },
      });

      if (["ipaymu", "tripay"].includes(String(data?.popup_provider || "").toLowerCase())) {
        setPaymentSession(buildPaymentSession(data, method, activeGateway.name));
        return;
      }

      if (data?.redirect_url) {
        navigationBypassRef.current = true;
        setAllowNavigation(true);
        window.location.replace(data.redirect_url);
        return;
      }

      throw new Error(data?.message || "Gagal mendapatkan URL pembayaran");
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || "Gagal memproses pembayaran";
      if (String(errorMessage).toLowerCase().includes("suspicious buyer")) {
        setGatewayRejection(errorMessage);
      }
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setBusy(false);
    }
  }

  function closeAndBack() {
    navigationBypassRef.current = true;
    setAllowNavigation(true);
    navigate(`/orang-tua/tagihan/pembayaran?bill_ids=${requestedBillIds.join(",")}`);
  }

  const unsupported = gatewayMode !== "popup" || !["ipaymu", "tripay"].includes(gatewayProviderKey);

  function MobileContent() {
    if (paymentSession) {
      return <LivePaymentDetail paymentSession={paymentSession} summaryProps={summaryProps} selectedBills={selectedBills} totalPayment={totalPayment} onBack={() => setPaymentSession(null)} onOpenHistory={() => {
        navigationBypassRef.current = true;
        setAllowNavigation(true);
        navigate(transactionUrl);
      }} showBack />;
    }
    if (selectedMethod) {
      if (selectedMethod.method === "qris") {
        return <QrisSummaryPage method={selectedMethod} summaryProps={summaryProps} onBack={() => setSelectedMethod(null)} showBack onPay={pay} busy={busy} />;
      }
      return <PaymentInstruction method={selectedMethod} summaryProps={summaryProps} onBack={() => setSelectedMethod(null)} onPay={pay} busy={busy} showBack />;
    }
    if (selectedGroup) {
      return <ProviderGridPage group={selectedGroup} onBack={() => setSelectedGroup(null)} onSelect={setSelectedMethod} />;
    }
    return <PaymentCategoryList groups={paymentGroups} onOpenGroup={handleOpenGroup} providerName={activeGateway.name} />;
  }

  function DesktopRightPanel() {
    const rightPanelClass = "mx-auto w-full max-w-[450px] px-3 pb-3 sm:px-0";

    if (paymentSession) {
      return (
        <div className={rightPanelClass}>
          <LivePaymentDetail paymentSession={paymentSession} summaryProps={summaryProps} selectedBills={selectedBills} totalPayment={totalPayment} onBack={() => setPaymentSession(null)} onOpenHistory={() => {
            navigationBypassRef.current = true;
            setAllowNavigation(true);
            navigate(transactionUrl);
          }} showBack={false} />
        </div>
      );
    }
    if (!selectedMethod) {
      return <div className={rightPanelClass}><EmptyPaymentDetails summaryProps={summaryProps} /></div>;
    }
    if (selectedMethod.method === "qris") {
      return <div className={rightPanelClass}><QrisSummaryPage method={selectedMethod} summaryProps={summaryProps} onBack={() => setSelectedMethod(null)} showBack={false} showSteps={false} onPay={pay} busy={busy} /></div>;
    }
    return <div className={rightPanelClass}><PaymentInstruction method={selectedMethod} summaryProps={summaryProps} onBack={() => setSelectedMethod(null)} onPay={pay} busy={busy} showBack={false} showSteps={false} /></div>;
  }

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 backdrop-blur-sm sm:p-4"
        style={{
          paddingTop: "max(0.5rem, env(safe-area-inset-top))",
          paddingRight: "max(0.5rem, env(safe-area-inset-right))",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(0.5rem, env(safe-area-inset-left))",
        }}
      >
        <div className="pg-compact flex h-[92dvh] max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-[popupIn_220ms_ease-out] sm:h-[min(820px,calc(100dvh-1rem))] sm:max-h-[calc(100dvh-1rem)] sm:w-[860px] sm:max-w-[calc(100vw-32px)] sm:rounded-2xl">
          <div className="bg-gradient-to-br from-sky-800 via-sky-800 to-sky-900 px-4 py-3.5 text-white sm:px-5 sm:py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">PAYMENT GATEWAY</div>
                <h1 className="mt-1 max-w-[230px] text-sm font-black leading-tight sm:max-w-none sm:text-lg">{settings?.school_name || "SPP DARUSSALAM PANUSUPAN"}</h1>
              </div>
              <div className="flex items-center gap-3">
                <PaymentGatewayLogo provider={activeGateway} />
                <button type="button" className="rounded-full bg-white/15 p-2 transition hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/40" onClick={closeAndBack} aria-label="Tutup popup"><SvgIcon name="close" size={20} /></button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 bg-white">
            {loading ? (
              <div className="grid h-full place-items-center px-6 text-sm text-slate-500">Memuat payment gateway...</div>
            ) : unsupported ? (
              <div className="grid h-full place-items-center px-6 py-8">
                <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-900">
                  <p className="text-lg font-black">PopupV2 hanya aktif untuk iPaymu / Tripay mode Popup</p>
                  <p className="mt-2 text-sm">Saat ini provider atau mode gateway di pengaturan belum sesuai untuk halaman ini.</p>
                  <button type="button" className="btn-primary mt-4" onClick={closeAndBack}>Kembali</button>
                </div>
              </div>
            ) : !selectedBills.length ? (
              <div className="grid h-full place-items-center px-6 py-8">
                <div className="max-w-lg rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-slate-700">
                  <p className="text-lg font-black text-slate-900">Tidak ada tagihan yang dipilih</p>
                  <p className="mt-2 text-sm">Silakan kembali dan pilih minimal satu tagihan sebelum membuka payment gateway.</p>
                  <button type="button" className="btn-primary mt-4" onClick={closeAndBack}>Kembali ke Tagihan</button>
                </div>
              </div>
            ) : (
              <>
                <div className="h-full overflow-y-auto sm:hidden"><MobileContent /></div>
                <div className="hidden h-full grid-cols-[360px_500px] sm:grid">
                  <div className="min-h-0 overflow-y-auto border-r border-slate-200/80 bg-slate-50/70">
                    {selectedMethod ? (
                      <DesktopInstructionPanel method={selectedMethod} onBack={() => setSelectedMethod(null)} />
                    ) : selectedGroup ? (
                      <ProviderGridPage group={selectedGroup} onBack={() => setSelectedGroup(null)} onSelect={setSelectedMethod} />
                    ) : (
                      <PaymentCategoryList groups={paymentGroups} onOpenGroup={handleOpenGroup} providerName={activeGateway.name} />
                    )}
                  </div>
                  <div className="min-h-0 overflow-y-auto bg-white"><DesktopRightPanel /></div>
                </div>
              </>
            )}
          </div>

          {!loading && !unsupported && gatewayRejection ? (
            <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">{gatewayRejection}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold hover:bg-amber-100" onClick={() => { setSelectedGroup(null); setSelectedMethod(null); setGatewayRejection(""); }}>Pilih Metode Lain</button>
                <button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold hover:bg-amber-100" onClick={() => navigate(`/orang-tua/tagihan/pembayaran/manual?bill_ids=${requestedBillIds.join(",")}`)}>Bayar Manual</button>
                <button type="button" className="rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold hover:bg-amber-100" onClick={() => navigate("/orang-tua/notifikasi")}>Hubungi Admin</button>
              </div>
            </div>
          ) : null}

          {!loading && !unsupported && selectedBills.length ? (
            <div className="border-t border-slate-200/80 bg-white/95 px-3 py-2.5 text-center text-[11px] text-slate-500 backdrop-blur sm:px-4">
              {!gatewayEnabled ? (
                <p className="font-semibold text-amber-700">Payment gateway sedang dinonaktifkan admin. Gunakan pembayaran manual untuk saat ini.</p>
              ) : (
                <p><ShieldCheck size={14} className="mr-1 inline-block" />Dengan melanjutkan, Anda menyetujui Syarat & Ketentuan.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {message.type === "warning" && !paymentSession ? (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-[#0a2254] shadow-lg">
          <div className="flex items-start gap-2"><Info size={16} className="mt-0.5 text-[#0667ff]" /><span>{message.text}</span></div>
        </div>
      ) : null}

      <style>{`
        @keyframes popupIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}










