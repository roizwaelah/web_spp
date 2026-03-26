import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Landmark } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ParentManualPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
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
          text: error?.response?.data?.message || "Gagal memuat pembayaran manual",
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

    window.history.pushState({ parentManualPaymentGuard: true }, "", window.location.href);

    const handlePopState = async () => {
      if (allowNavigation || popConfirmingRef.current) return;

      popConfirmingRef.current = true;
      const confirmed = await confirm({
        title: "Tinggalkan pembayaran manual?",
        description: "Bukti pembayaran yang sedang Anda siapkan belum dikirim.",
        confirmLabel: "Ya, tinggalkan",
        cancelLabel: "Tetap di sini",
        variant: "danger",
      });

      if (confirmed) {
        setAllowNavigation(true);
        window.history.back();
      } else {
        window.history.pushState({ parentManualPaymentGuard: true }, "", window.location.href);
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

  const confirmLeavePage = async () => {
    if (allowNavigation) return true;

    const confirmed = await confirm({
      title: "Tinggalkan pembayaran manual?",
      description: "Bukti pembayaran yang sedang Anda siapkan belum dikirim.",
      confirmLabel: "Ya, tinggalkan",
      cancelLabel: "Tetap di sini",
      variant: "danger",
    });

    if (confirmed) setAllowNavigation(true);
    return confirmed;
  };

  const submitProof = async () => {
    if (!selectedBills.length) {
      setMessage({ type: "warning", text: "Tidak ada tagihan yang dipilih." });
      return;
    }
    if (!file) {
      setMessage({ type: "error", text: "Pilih file bukti pembayaran terlebih dahulu." });
      return;
    }

    const formData = new FormData();
    selectedBills.forEach((bill) => formData.append("bill_ids[]", bill.id));
    formData.append("notes", "Upload bukti manual dari halaman pembayaran orang tua");
    formData.append("file", file);

    try {
      setSaving(true);
      const { data } = await fetchRoute("parent/payment-proofs", {
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage({ type: "success", text: data?.message || "Bukti pembayaran berhasil dikirim" });
      setAllowNavigation(true);
      navigate("/orang-tua/tagihan");
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal mengunggah bukti pembayaran",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Pembayaran Manual"
      subtitle="Unggah bukti transfer untuk tagihan yang dipilih."
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
            Pembayaran Manual
          </p>
          <h3 className="section-title mt-1">Tagihan yang akan dibayar</h3>
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
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Landmark size={18} />
            </div>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ringkasan Transfer
              </p>
              <h3 className="section-title mt-1">Informasi pembayaran</h3>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Total Pembayaran
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(totalPayment)}
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Rekening Bank
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {settings?.bank_account || "-"}
            </p>
          </div>

          <div className="mt-4 space-y-2">
            <label className="label">Upload bukti pembayaran</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="input"
              disabled={saving || !selectedBills.length}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-slate-500">
              {file?.name || "Format file: JPG, PNG, atau PDF"}
            </p>
          </div>

          <button
            type="button"
            className="btn-primary mt-4 w-full justify-center"
            disabled={saving || !selectedBills.length}
            onClick={submitProof}
          >
            {saving ? "Mengirim bukti..." : "Kirim bukti pembayaran"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
