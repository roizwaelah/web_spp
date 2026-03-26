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
  },
  {
    label: "QRIS",
    accent: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300 hover:bg-emerald-100/80",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    label: "Virtual Account",
    accent: "border-violet-200 bg-violet-50/80 hover:border-violet-300 hover:bg-violet-100/80",
    badge: "bg-violet-100 text-violet-700",
  },
  {
    label: "E-Wallet",
    accent: "border-amber-200 bg-amber-50/80 hover:border-amber-300 hover:bg-amber-100/80",
    badge: "bg-amber-100 text-amber-700",
  },
];

export default function ParentPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const popConfirmingRef = useRef(false);

  useToastMessage(message, setMessage);

  const selectedBillParam = searchParams.get("bill_ids") || searchParams.get("bill_id") || "";

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: billsData }, { data: dashboardData }] = await Promise.all([
        fetchRoute("parent/bills"),
        fetchRoute("parent/dashboard"),
      ]);
      setBills(Array.isArray(billsData) ? billsData : []);
      setSettings(dashboardData?.settings || {});
      setMessage((current) =>
        current.type === "error" ? { type: "", text: "" } : current,
      );
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message || "Gagal memuat halaman pembayaran",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (allowNavigation) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [allowNavigation]);

  useEffect(() => {
    if (allowNavigation) return undefined;

    window.history.pushState({ paymentGuard: true }, "", window.location.href);

    const handlePopState = async () => {
      if (allowNavigation || popConfirmingRef.current) return;

      popConfirmingRef.current = true;
      const confirmed = await confirm({
        title: "Tinggalkan halaman pembayaran?",
        description: "Pilihan tagihan yang sedang Anda siapkan akan ditinggalkan. Pastikan Anda memang ingin keluar dari halaman ini.",
        confirmLabel: "Ya, tinggalkan",
        cancelLabel: "Tetap di sini",
        variant: "danger",
      });

      if (confirmed) {
        setAllowNavigation(true);
        window.history.back();
      } else {
        window.history.pushState({ paymentGuard: true }, "", window.location.href);
      }

      popConfirmingRef.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [allowNavigation, confirm]);

  const payableBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          bill.status !== "paid" &&
          bill.proof_status !== "pending" &&
          bill.proof_status !== "approved",
      ),
    [bills],
  );

  useEffect(() => {
    if (!payableBills.length) {
      setSelectedBillIds([]);
      return;
    }

    const requestedIds = selectedBillParam
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const validRequestedIds = requestedIds.filter((id) =>
      payableBills.some((bill) => String(bill.id) === id),
    );

    if (validRequestedIds.length) {
      setSelectedBillIds(validRequestedIds);
      setSearchParams({ bill_ids: validRequestedIds.join(",") }, { replace: true });
      return;
    }

    const fallbackIds = [String(payableBills[0].id)];
    setSelectedBillIds(fallbackIds);
    setSearchParams({ bill_ids: fallbackIds.join(",") }, { replace: true });
  }, [payableBills, selectedBillParam, setSearchParams]);

  const selectedBills = useMemo(
    () =>
      payableBills.filter((bill) => selectedBillIds.includes(String(bill.id))),
    [payableBills, selectedBillIds],
  );

  const selectedTotal = selectedBills.reduce(
    (total, bill) => total + Number(bill.amount || 0),
    0,
  );

  const syncSelectedBillIds = (nextIds) => {
    setSelectedBillIds(nextIds);
    if (nextIds.length) {
      setSearchParams({ bill_ids: nextIds.join(",") }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  };

  const toggleBillSelection = (billId) => {
    const key = String(billId);
    const nextIds = selectedBillIds.includes(key)
      ? selectedBillIds.filter((id) => id !== key)
      : [...selectedBillIds, key];
    syncSelectedBillIds(nextIds);
  };

  const toggleSelectAll = () => {
    if (selectedBillIds.length === payableBills.length) {
      syncSelectedBillIds([]);
      return;
    }
    syncSelectedBillIds(payableBills.map((bill) => String(bill.id)));
  };

  const pay = async (channel) => {
    if (!selectedBills.length) {
      setMessage({ type: "warning", text: "Pilih minimal satu tagihan." });
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
      setMessage({ type: "success", text: data.message });
      await load();
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

  const gatewayEnabled = settings?.payment_gateway_enabled === "1";

  const confirmLeavePage = async () => {
    if (allowNavigation) return true;

    const confirmed = await confirm({
      title: "Tinggalkan halaman pembayaran?",
      description: "Pilihan tagihan yang sedang Anda siapkan akan ditinggalkan. Pastikan Anda memang ingin keluar dari halaman ini.",
      confirmLabel: "Ya, tinggalkan",
      cancelLabel: "Tetap di sini",
      variant: "danger",
    });

    if (confirmed) {
      setAllowNavigation(true);
    }

    return confirmed;
  };

  return (
    <Layout
      title="Pembayaran Online"
      subtitle="Pilih satu atau beberapa tagihan aktif lalu lanjutkan pembayaran melalui kanal yang tersedia."
      showHeader={false}
      onNavigateAttempt={confirmLeavePage}
    >
      <button
        type="button"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:border-slate-400 hover:bg-white"
        onClick={async () => {
          const confirmed = await confirmLeavePage();
          if (!confirmed) return;
          navigate("/orang-tua/tagihan");
        }}
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      {!gatewayEnabled ? (
        <div className="card border border-amber-200 bg-amber-50/80 p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-amber-700">
            Pembayaran Online
          </p>
          <h3 className="section-title mt-1 text-amber-900">
            Sedang dalam pemeliharaan
          </h3>
          <p className="mt-2 text-sm text-amber-800">
            Silakan kembali ke menu Tagihan untuk mengunggah bukti transfer
            manual.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_1fr]">
            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Langkah 1
                  </p>
                  <h3 className="section-title mt-1">Pilih tagihan</h3>
                </div>
                <span className="badge-slate">{selectedBills.length} dipilih</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Hanya tagihan belum lunas dan tidak sedang direview yang
                dapat dibayar otomatis.
              </p>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-600">
                    {selectedBills.length} dari {payableBills.length} tagihan dipilih
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={loading || !payableBills.length || busy}
                    onClick={toggleSelectAll}
                  >
                    {selectedBillIds.length === payableBills.length ? "Batalkan semua" : "Pilih semua"}
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {payableBills.length ? (
                  <div className="space-y-3">
                    {payableBills.map((bill) => {
                      const checked = selectedBillIds.includes(String(bill.id));
                      return (
                        <label
                          key={bill.id}
                          className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                            checked
                              ? "border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-100"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1 h-4 w-4 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-200"
                            checked={checked}
                            disabled={busy}
                            onChange={() => toggleBillSelection(bill.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">
                                  {bill.bill_name}
                                </p>
                                <span className="shrink-0 text-sm font-semibold text-slate-700">
                                  {formatCurrency(bill.amount)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {bill.period || "-"} | Jatuh tempo {formatDate(bill.due_date)}
                              </p>
                              {checked && (
                                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                                  Termasuk dalam pembayaran
                                </p>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {loading
                      ? "Memuat pilihan tagihan..."
                      : "Tidak ada tagihan yang bisa dibayar otomatis saat ini."}
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Langkah 2
                  </p>
                  <h3 className="section-title mt-1">Pilih kanal pembayaran</h3>
                </div>
                <span className={selectedBills.length ? "badge-green" : "badge-amber"}>
                  {selectedBills.length ? "Siap dibayar" : "Belum ada pilihan"}
                </span>
              </div>
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Total Pembayaran
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {formatCurrency(selectedTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Tagihan Dipilih
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {selectedBills.length}
                    </p>
                  </div>
                </div>
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-sm text-red-600 ring-1 ring-slate-200">
                  Pastikan tagihan yang dicentang sudah benar sebelum melanjutkan pembayaran.
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {PAYMENT_CHANNELS.map((channel) => (
                  <button
                    key={channel.label}
                    className={`flex min-h-[112px] flex-col items-start justify-between rounded-lg border px-4 py-4 text-left transition hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${channel.accent}`}
                    disabled={!selectedBills.length || busy}
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
                    <div className="space-y-1">
                      <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                        {busy ? "Memproses pembayaran..." : "Klik untuk membayar"}
                      </span>
                      <span className="block text-sm text-slate-700">
                        {selectedBills.length
                          ? `${selectedBills.length} tagihan | ${formatCurrency(selectedTotal)}`
                          : "Pilih tagihan terlebih dahulu"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
