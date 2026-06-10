import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Landmark, WalletCards } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import ModalFrame from "../components/ModalFrame";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { formatCurrency, formatPeriod } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

function loadExternalScript(id, src, attributes = {}) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      const existingSrc = existing.getAttribute("src") || "";
      const nextSrc = new URL(src, window.location.href).href;
      if (existingSrc === nextSrc) {
        resolve(existing);
        return;
      }
      existing.remove();
      if (id === "midtrans-snap-js" && window.snap) {
        delete window.snap;
      }
      if (id === "doku-jokul-js" && window.loadJokulCheckout) {
        delete window.loadJokulCheckout;
      }
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    Object.entries(attributes).forEach(([key, value]) => {
      if (value) {
        script.setAttribute(key, value);
      }
    });
    script.onload = () => resolve(script);
    script.onerror = () => reject(new Error(`Gagal memuat script ${src}`));
    document.body.appendChild(script);
  });
}

function redirectToGateway(url, navigationBypassRef, setAllowNavigation) {
  if (!url) return false;
  navigationBypassRef.current = true;
  setAllowNavigation(true);
  window.location.replace(url);
  return true;
}

async function openGatewayPopup({ payload, navigate, navigationBypassRef, setAllowNavigation, setAutoPaying, setMessage }) {
  const provider = String(payload?.popup_provider || "").toLowerCase();
  const referenceNo = String(payload?.reference_no || "");
  const redirectUrl = String(payload?.redirect_url || "");
  const transactionUrl = referenceNo
    ? `/orang-tua/transaksi?gateway=${encodeURIComponent(provider)}&ref=${encodeURIComponent(referenceNo)}`
    : "/orang-tua/transaksi";

  if (provider === "midtrans") {
    const scriptUrl = payload?.popup_script_url;
    const clientKey = payload?.popup_client_key;
    const snapToken = payload?.popup_token;
    if (!scriptUrl || !clientKey || !snapToken) {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Konfigurasi popup Midtrans belum lengkap");
    }

    await loadExternalScript("midtrans-snap-js", scriptUrl, { "data-client-key": clientKey });
    if (!window.snap || typeof window.snap.pay !== "function") {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Snap.js Midtrans tidak tersedia");
    }

    setAutoPaying(false);
    try {
      window.snap.pay(snapToken, {
        onSuccess: () => {
          navigationBypassRef.current = true;
          setAllowNavigation(true);
          navigate(transactionUrl);
        },
        onPending: () => {
          navigationBypassRef.current = true;
          setAllowNavigation(true);
          navigate(transactionUrl);
        },
        onError: (result) => {
          setAutoPaying(false);
          const statusMessage = String(result?.status_message || "");
          if (
            statusMessage.toLowerCase().includes("postmessage") &&
            redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)
          ) {
            return;
          }
          setMessage({
            type: "error",
            text: statusMessage || "Pembayaran Midtrans gagal diproses",
          });
        },
        onClose: () => {
          setAutoPaying(false);
          setMessage({
            type: "warning",
            text: "Popup pembayaran ditutup sebelum transaksi selesai.",
          });
        },
      });
    } catch (error) {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw error;
    }
    return true;
  }

  if (provider === "doku") {
    const scriptUrl = payload?.popup_script_url;
    const paymentUrl = payload?.popup_payment_url;
    if (!scriptUrl || !paymentUrl) {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Konfigurasi popup DOKU belum lengkap");
    }

    await loadExternalScript("doku-jokul-js", scriptUrl);
    if (typeof window.loadJokulCheckout !== "function") {
      if (redirectToGateway(redirectUrl, navigationBypassRef, setAllowNavigation)) {
        return true;
      }
      throw new Error("Jokul Checkout JS tidak tersedia");
    }

    setAutoPaying(false);
    window.loadJokulCheckout(paymentUrl);
    return true;
  }

  return false;
}

function normalizeGatewayProviderKey(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider) return "";
  if (provider.includes("ipaymu")) return "ipaymu";
  if (provider.includes("midtrans")) return "midtrans";
  if (provider.includes("doku")) return "doku";
  if (provider.includes("tripay")) return "tripay";
  return provider;
}

const getBillRemainingAmount = (bill) => {
  if (bill?.remaining_amount != null) return Number(bill.remaining_amount || 0);
  return Math.max(Number(bill?.amount || 0) - Number(bill?.paid_amount || 0), 0);
};

const normalizeAmountInput = (value) => String(value || "").replace(/[^\d]/g, "");

const getBillStatusLabel = (status) => {
  if (status === "paid") return "Lunas";
  if (status === "partial") return "Sebagian";
  return "Belum Lunas";
};

const getBillPostKey = (bill) => String(bill?.finance_post_id || bill?.bill_name || "");

export default function ParentPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [autoPaying, setAutoPaying] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [selectedBillIds, setSelectedBillIds] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const popConfirmingRef = useRef(false);
  const navigationBypassRef = useRef(false);

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
      if (navigationBypassRef.current) return;
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
      if (allowNavigation || navigationBypassRef.current || popConfirmingRef.current) return;

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
        navigationBypassRef.current = true;
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

  const openBills = useMemo(
    () =>
      bills
        .filter(
          (bill) =>
            bill.status !== "paid" &&
            bill.proof_status !== "pending" &&
            bill.proof_status !== "approved",
        )
        .sort((a, b) => {
          const byPeriod = String(a?.period || "").localeCompare(String(b?.period || ""), "id", {
            numeric: true,
            sensitivity: "base",
          });
          if (byPeriod !== 0) return byPeriod;
          const byDueDate = String(a?.due_date || "").localeCompare(String(b?.due_date || ""));
          if (byDueDate !== 0) return byDueDate;
          return Number(a?.id || 0) - Number(b?.id || 0);
        }),
    [bills],
  );

  const blockedBillReasons = useMemo(() => {
    const oldestOpenByPost = new Map();
    const reasons = new Map();

    const billsForBlocking = bills
      .filter((bill) => bill.status !== "paid")
      .sort((a, b) => {
        const byPeriod = String(a?.period || "").localeCompare(String(b?.period || ""), "id", {
          numeric: true,
          sensitivity: "base",
        });
        if (byPeriod !== 0) return byPeriod;
        const byDueDate = String(a?.due_date || "").localeCompare(String(b?.due_date || ""));
        if (byDueDate !== 0) return byDueDate;
        return Number(a?.id || 0) - Number(b?.id || 0);
      });

    for (const bill of billsForBlocking) {
      const postKey = getBillPostKey(bill);
      if (!postKey) continue;
      const olderBill = oldestOpenByPost.get(postKey);
      if (olderBill) {
        reasons.set(
          String(bill.id),
          `Selesaikan dulu ${olderBill.bill_name} periode ${formatPeriod(olderBill.period)} untuk pos yang sama.`,
        );
        continue;
      }
      oldestOpenByPost.set(postKey, bill);
    }

    return reasons;
  }, [bills]);

  const payableBills = useMemo(
    () => openBills.filter((bill) => !blockedBillReasons.has(String(bill.id))),
    [blockedBillReasons, openBills],
  );

  const blockedBills = useMemo(
    () => openBills.filter((bill) => blockedBillReasons.has(String(bill.id))),
    [blockedBillReasons, openBills],
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
    (total, bill) => total + getBillRemainingAmount(bill),
    0,
  );
  const selectedBillStudentIds = useMemo(
    () => Array.from(new Set(selectedBills.map((bill) => String(bill.student_id || "")))).filter((id) => id !== ""),
    [selectedBills],
  );
  const canUseCustomAmount = selectedBillStudentIds.length === 1 && selectedBills.some((bill) => !!bill?.is_flexible_installment);
  const parsedPaymentAmount = Number(paymentAmount || 0);
  const effectivePaymentAmount = canUseCustomAmount ? parsedPaymentAmount : selectedTotal;
  const gatewayEnabled = settings?.payment_gateway_enabled === "1";
  const gatewayProviderLabel = String(settings?.payment_gateway_provider || "").trim();
  const gatewayProviderKey = normalizeGatewayProviderKey(gatewayProviderLabel);
  const gatewayMode = String(settings?.payment_gateway_mode || "redirect").toLowerCase();
  const isIpaymuDirectPopup = gatewayProviderKey === "ipaymu" && gatewayMode === "popup";
  const usesGatewayChooserPage = gatewayMode === "popup" && ["ipaymu", "tripay"].includes(gatewayProviderKey);

  useEffect(() => {
    setPaymentAmount(canUseCustomAmount ? String(selectedTotal) : "");
  }, [canUseCustomAmount, selectedTotal]);

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
    if (blockedBillReasons.has(key)) return;
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
      navigationBypassRef.current = true;
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

    if (mode === "otomatis") {
      if (!selectedBills.length) {
        setMessage({ type: "warning", text: "Pilih minimal satu tagihan." });
        return;
      }
      if (canUseCustomAmount && effectivePaymentAmount <= 0) {
        setMessage({ type: "warning", text: "Nominal pembayaran wajib lebih dari Rp 0." });
        return;
      }
      if (!gatewayProviderLabel) {
        setMessage({
          type: "warning",
          text: "Provider payment gateway belum diatur di halaman Pengaturan.",
        });
        return;
      }

      if (usesGatewayChooserPage) {
        const query = `bill_ids=${selectedBills.map((bill) => bill.id).join(",")}${canUseCustomAmount ? `&payment_amount=${effectivePaymentAmount}` : ""}`;
        setChooserOpen(false);
        navigationBypassRef.current = true;
        setAllowNavigation(true);
        navigate(`/orang-tua/tagihan/pembayaran/otomatis?${query}`);
        return;
      }

      const startAutoPayment = async () => {
        try {
          setAutoPaying(true);
          const { data } = await fetchRoute("parent/payments", {
            method: "POST",
            data: {
              bill_ids: selectedBills.map((bill) => bill.id),
              payment_channel: gatewayProviderLabel,
              ...(canUseCustomAmount ? { payment_amount: effectivePaymentAmount } : {}),
            },
          });

          if (data?.popup_provider) {
            const opened = await openGatewayPopup({
              payload: data,
              navigate,
              navigationBypassRef,
              setAllowNavigation,
              setAutoPaying,
              setMessage,
            });
            if (opened) {
              return;
            }
          }

          if (data?.redirect_url) {
            navigationBypassRef.current = true;
        setAllowNavigation(true);
            window.location.replace(data.redirect_url);
            return;
          }

          throw new Error(
            data?.message || "Gagal mendapatkan URL pembayaran",
          );
        } catch (error) {
          setMessage({
            type: "error",
            text:
              error?.response?.data?.message ||
              error?.message ||
              "Gagal memproses pembayaran otomatis",
          });
        } finally {
          setAutoPaying(false);
        }
      };

      setChooserOpen(false);
      startAutoPayment();
      return;
    }

    const query = `bill_ids=${selectedBills.map((bill) => bill.id).join(",")}`;
    navigationBypassRef.current = true;
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
                {selectedBills.length} dari {payableBills.length} tagihan bisa dipilih
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

          {blockedBills.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {blockedBills.length} tagihan belum bisa dibayar karena tagihan lama pada pos yang sama harus diselesaikan dulu.
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {openBills.length ? (
              openBills.map((bill) => {
                const checked = selectedBillIds.includes(String(bill.id));
                const blockedReason = blockedBillReasons.get(String(bill.id)) || "";
                const selectable = !blockedReason;
                return (
                  <label
                    key={bill.id}
                    className={`flex gap-3 rounded-lg border p-3 transition ${
                      checked
                        ? "border-emerald-400 bg-emerald-50 shadow-sm ring-2 ring-emerald-100"
                        : blockedReason
                          ? "cursor-not-allowed border-amber-200 bg-amber-50/70"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-200"
                      checked={checked}
                      disabled={!selectable}
                      onChange={() => toggleBillSelection(bill.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">
                          {bill.bill_name}
                        </p>
                        <span className="shrink-0 text-sm font-semibold text-slate-700">
                          {formatCurrency(getBillRemainingAmount(bill))}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-medium text-sky-600">
                        {formatPeriod(bill.period)} · {getBillStatusLabel(bill.status)} · dari {formatCurrency(bill.amount)}
                      </p>
                      {Number(bill.paid_amount || 0) > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Sudah dibayar {formatCurrency(bill.paid_amount)}, sisa gateway {formatCurrency(getBillRemainingAmount(bill))}.
                        </p>
                      ) : null}
                      {blockedReason ? (
                        <p className="mt-1 text-xs text-amber-700">{blockedReason}</p>
                      ) : null}
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
                  Sisa Tagihan
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {formatCurrency(effectivePaymentAmount)}
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
              Klik <span className="font-semibold">Lanjut</span> untuk membayar sisa tagihan lewat manual atau gateway.
            </p>
          </div>

          {canUseCustomAmount ? (
            <div className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-4">
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-900/70">
                Nominal Pembayaran
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="input mt-2 text-xl font-bold text-slate-900"
                value={formatCurrency(paymentAmount)}
                onChange={(event) => setPaymentAmount(normalizeAmountInput(event.target.value))}
              />
              <p className="mt-2 text-xs leading-relaxed text-sky-900/70">
                Masukkan nominal yang akan Bapak/Ibu bayarkan.
              </p>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary mt-4 w-full justify-center"
            disabled={!selectedBills.length || autoPaying}
            onClick={openMethodChooser}
          >
            {autoPaying ? "Memproses..." : "Lanjut"}
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
        showIcon={false}
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
                Lakukan pembayaran - Unggah bukti - Verifikasi oleh staf
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
            disabled={!gatewayEnabled || autoPaying}
            onClick={() => goToMethod("otomatis")}
          >
            <div>
              <p className={`font-semibold ${gatewayEnabled ? "text-sky-900" : "text-slate-500"}`}>
                Otomatis
              </p>
              <p className={`mt-1 text-sm ${gatewayEnabled ? "text-sky-800" : "text-slate-500"}`}>
                {gatewayEnabled
                  ? autoPaying
                    ? gatewayMode === "popup"
                      ? isIpaymuDirectPopup
                        ? `Sedang menyiapkan kanal ${gatewayProviderLabel || "iPaymu"} Direct Payment...`
                        : `Sedang menyiapkan popup ${gatewayProviderLabel || "payment gateway"}...`
                      : `Sedang membuat transaksi dan mengarahkan ke ${gatewayProviderLabel || "payment gateway"}...`
                    : gatewayMode === "popup"
                      ? isIpaymuDirectPopup
                        ? "Lanjut ke pilihan kanal iPaymu Direct Payment, lalu tampilkan VA / QR langsung di web ini."
                        : "Lakukan pembayaran - Verifikasi otomatis"
                      : "Lanjut ke payment gateway dengan total tagihan yang sudah dipilih."
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
