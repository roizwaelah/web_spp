import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const PAYMENT_CHANNELS = [
  {
    label: "Transfer Bank",
    accent: "border-blue-200 bg-blue-50/80 hover:border-blue-300 hover:bg-blue-100/80",
    badge: "bg-blue-100 text-blue-700",
    hint: "Transfer langsung ke rekening sekolah",
  },
  {
    label: "QRIS",
    accent: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-100/80",
    badge: "bg-emerald-100 text-emerald-700",
    hint: "Praktis dipindai lewat mobile banking",
  },
  {
    label: "Virtual Account",
    accent: "border-violet-200 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-100/80",
    badge: "bg-violet-100 text-violet-700",
    hint: "Nomor virtual account otomatis dari sistem",
  },
  {
    label: "E-Wallet",
    accent: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/80",
    badge: "bg-amber-100 text-amber-700",
    hint: "Bayar lewat dompet digital yang tersedia",
  },
];

export default function ParentGatewayPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [allowNavigation, setAllowNavigation] = useState(false);
  const popConfirmingRef = useRef(false);

  useToastMessage(message, setMessage);

  const requestedBillIds = useMemo(
    () =>
      (searchParams.get("bill_ids") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [searchParams],
  );

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
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat payment gateway",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (allowNavigation) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [allowNavigation]);

  useEffect(() => {
    if (allowNavigation) return undefined;

    window.history.pushState({ parentGatewayPaymentGuard: true }, "", window.location.href);

    const handlePopState = async () => {
      if (allowNavigation || popConfirmingRef.current) return;

      popConfirmingRef.current = true;
      const confirmed = await confirm({
        title: "Tinggalkan payment gateway?",
        description: "Pilihan kanal pembayaran akan dibatalkan jika Anda keluar dari halaman ini.",
        confirmLabel: "Ya, tinggalkan",
        cancelLabel: "Tetap di sini",
        variant: "danger",
      });

      if (confirmed) {
        setAllowNavigation(true);
        window.history.back();
      } else {
        window.history.pushState({ parentGatewayPaymentGuard: true }, "", window.location.href);
      }

      popConfirmingRef.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allowNavigation, confirm]);

  const selectedBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          requestedBillIds.includes(String(bill.id)) &&
          bill.status !== "paid" &&
          bill.proof_status !== "pending" &&
          bill.proof_status !== "approved",
      ),
    [bills, requestedBillIds],
  );

  const totalPayment = selectedBills.reduce(
    (total, bill) => total + Number(bill.amount || 0),
    0,
  );
  const gatewayEnabled = settings?.payment_gateway_enabled === "1";

  const confirmLeavePage = async () => {
    if (allowNavigation) return true;

    const confirmed = await confirm({
      title: "Tinggalkan payment gateway?",
      description: "Pilihan kanal pembayaran akan dibatalkan jika Anda keluar dari halaman ini.",
      confirmLabel: "Ya, tinggalkan",
      cancelLabel: "Tetap di sini",
      variant: "danger",
    });

    if (confirmed) setAllowNavigation(true);
    return confirmed;
  };

  const pay = async (channel) => {
    if (!gatewayEnabled) {
      setMessage({
        type: "warning",
        text: "Payment gateway sedang dinonaktifkan. Gunakan pembayaran manual untuk saat ini.",
      });
      return;
    }

    if (!selectedBills.length) {
      setMessage({ type: "warning", text: "Tidak ada tagihan yang dipilih." });
      return;
    }

    try {
      setBusy(true);
      const { data } = await fetchRoute("parent/payments", {
        method: "POST",
        data: {
          bill_ids: selectedBills.map((bill) => bill.id),
          payment_channel: channel,
        },
      });
      setMessage({ type: "success", text: data?.message || "Pembayaran berhasil diproses" });
      setAllowNavigation(true);
      navigate("/orang-tua/transaksi");
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal memproses pembayaran",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout
      title="Payment Gateway"
      subtitle="Pilih kanal otomatis untuk total tagihan yang sudah dipilih."
      showHeader={false}
      onNavigateAttempt={confirmLeavePage}
    >
      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:border-slate-400 hover:bg-white"
        onClick={async () => {
          const confirmed = await confirmLeavePage();
          if (!confirmed) return;
          navigate("/orang-tua/tagihan/pembayaran");
        }}
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,1fr)_360px]">
        <div className="card p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Payment Gateway
          </p>
          <h3 className="section-title mt-1">Tagihan yang akan dibayar otomatis</h3>
          <div className="mt-4 space-y-3">
            {selectedBills.length ? (
              selectedBills.map((bill) => (
                <div key={bill.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{bill.bill_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {bill.period || "-"} | Jatuh tempo {formatDate(bill.due_date)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700">
                      {formatCurrency(bill.amount)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {loading ? "Memuat tagihan..." : "Tidak ada tagihan valid yang dipilih."}
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Total Pembayaran
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(totalPayment)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Gateway: {settings?.payment_gateway_provider || "Otomatis"}
          </p>

          {!gatewayEnabled && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Payment gateway sedang dinonaktifkan admin. Silakan kembali dan gunakan pembayaran manual.
            </div>
          )}

          <div className="mt-4 space-y-3">
            {PAYMENT_CHANNELS.map((channel) => (
              <button
                key={channel.label}
                className={`flex min-h-[108px] w-full flex-col items-start justify-between rounded-lg border px-4 py-4 text-left transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${channel.accent}`}
                disabled={!selectedBills.length || busy || !gatewayEnabled}
                onClick={() => pay(channel.label)}
              >
                <div className="space-y-2">
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${channel.badge}`}>
                    {channel.label}
                  </span>
                  <span className="block text-sm text-slate-700">
                    {channel.hint}
                  </span>
                </div>
                <span className="block text-sm text-slate-700">
                  {busy
                    ? "Memproses pembayaran..."
                    : `${selectedBills.length} tagihan | ${formatCurrency(totalPayment)}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
