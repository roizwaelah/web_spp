import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Landmark, WalletCards } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import ModalFrame from "../components/ModalFrame";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { formatCurrency, formatPeriod } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ParentPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const popConfirmingRef = useRef(false);

  useToastMessage(message, setMessage);

  const selectedBillParam =
    searchParams.get("bill_ids") || searchParams.get("bill_id") || "";

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
        title: "Tinggalkan alur pembayaran?",
        description:
          "Pilihan tagihan yang sedang Anda siapkan akan ditinggalkan. Pastikan Anda memang ingin keluar dari halaman ini.",
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
  const gatewayEnabled = settings?.payment_gateway_enabled === "1";

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

  const confirmLeavePage = async () => {
    if (allowNavigation) return true;

    const confirmed = await confirm({
      title: "Tinggalkan alur pembayaran?",
      description:
        "Pilihan tagihan yang sedang Anda siapkan akan ditinggalkan. Pastikan Anda memang ingin keluar dari halaman ini.",
      confirmLabel: "Ya, tinggalkan",
      cancelLabel: "Tetap di sini",
      variant: "danger",
    });

    if (confirmed) {
      setAllowNavigation(true);
    }

    return confirmed;
  };

  const openMethodChooser = () => {
    if (!selectedBills.length) {
      setMessage({ type: "warning", text: "Pilih minimal satu tagihan." });
      return;
    }
    setChooserOpen(true);
  };

  const goToMethod = (mode) => {
    if (mode === "otomatis" && !gatewayEnabled) {
      setMessage({
        type: "warning",
        text: "Payment gateway sedang dinonaktifkan. Gunakan pembayaran manual untuk saat ini.",
      });
      return;
    }

    const query = `bill_ids=${selectedBills.map((bill) => bill.id).join(",")}`;
    setAllowNavigation(true);
    navigate(`/orang-tua/tagihan/pembayaran/${mode}?${query}`);
  };

  return (
    <Layout
      title="Pembayaran"
      subtitle="Pilih tagihan yang ingin dibayar, lalu lanjutkan ke metode pembayaran."
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

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,1fr)_340px]">
        <div className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Langkah 1
              </p>
              <h3 className="section-title mt-1">Pilih tagihan / pos</h3>
            </div>
            <span className="badge-slate">{selectedBills.length} dipilih</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Pilih satu atau beberapa tagihan yang ingin dibayar dalam transaksi yang sama.
          </p>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-600">
                {selectedBills.length} dari {payableBills.length} tagihan dipilih
              </span>
              <button
                type="button"
                className="btn-secondary"
                disabled={loading || !payableBills.length}
                onClick={toggleSelectAll}
              >
                {selectedBillIds.length === payableBills.length ? "Batalkan semua" : "Pilih semua"}
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {payableBills.length ? (
              payableBills.map((bill) => {
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
                      onChange={() => toggleBillSelection(bill.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {bill.bill_name}
                        </p>
                        <span className="shrink-0 text-sm font-semibold text-slate-700">
                          {formatCurrency(bill.amount)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-sky-600">
                        {formatPeriod(bill.period)}
                      </p>
                      {checked && (
                        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                          Termasuk dalam transaksi
                        </p>
                      )}
                    </div>
                  </label>
                );
              })
            ) : (
              <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {loading
                  ? "Memuat pilihan tagihan..."
                  : "Tidak ada tagihan yang bisa diproses saat ini."}
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Langkah 2
          </p>
          <h3 className="section-title mt-1">Lanjutkan pembayaran</h3>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Total Tagihan
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCurrency(selectedTotal)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Jumlah Pos
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {selectedBills.length}
                </p>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">
              Klik <span className="font-semibold">Lanjut</span> untuk memilih pembayaran manual atau otomatis.
            </p>
          </div>

          <button
            type="button"
            className="btn-primary mt-4 w-full justify-center"
            disabled={!selectedBills.length}
            onClick={openMethodChooser}
          >
            Lanjut
          </button>
        </div>
      </div>

      <ModalFrame
        open={chooserOpen}
        title="Pilih metode pembayaran"
        description={
          gatewayEnabled
            ? "Tentukan apakah pembayaran akan dilakukan secara manual atau lewat payment gateway."
            : "Payment gateway sedang dinonaktifkan, jadi untuk saat ini pembayaran hanya tersedia lewat transfer manual."
        }
        onClose={() => setChooserOpen(false)}
      >
        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-start justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-left transition hover:bg-amber-100"
            onClick={() => goToMethod("manual")}
          >
            <div>
              <p className="font-semibold text-amber-900">Manual</p>
              <p className="mt-1 text-sm text-amber-800">
                Tampilkan total pembayaran, rekening bank, lalu unggah bukti transfer.
              </p>
            </div>
            <Landmark className="text-amber-700" size={18} />
          </button>
          <button
            type="button"
            className={`flex w-full items-start justify-between rounded-lg border px-4 py-4 text-left transition ${
              gatewayEnabled
                ? "border-sky-200 bg-sky-50 hover:bg-sky-100"
                : "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            }`}
            disabled={!gatewayEnabled}
            onClick={() => goToMethod("otomatis")}
          >
            <div>
              <p className={`font-semibold ${gatewayEnabled ? "text-sky-900" : "text-slate-500"}`}>
                Otomatis
              </p>
              <p className={`mt-1 text-sm ${gatewayEnabled ? "text-sky-800" : "text-slate-500"}`}>
                {gatewayEnabled
                  ? "Lanjut ke payment gateway dengan total tagihan yang sudah dipilih."
                  : "Payment gateway sedang dinonaktifkan admin. Gunakan pembayaran manual."}
              </p>
            </div>
            <WalletCards className={gatewayEnabled ? "text-sky-700" : "text-slate-400"} size={18} />
          </button>
          {!gatewayEnabled && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Payment gateway sedang nonaktif. Silakan lanjutkan dengan metode manual untuk upload bukti transfer.
            </div>
          )}
        </div>
      </ModalFrame>
    </Layout>
  );
}
