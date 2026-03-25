import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ParentBillsPage() {
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState({ type: "", text: "" });
  const [fileMap, setFileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyBillId, setBusyBillId] = useState(null);

  useToastMessage(message, setMessage);

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
        text: error?.response?.data?.message || "Gagal memuat tagihan",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const pay = async (billId, channel) => {
    try {
      setBusyBillId(billId);
      const { data } = await fetchRoute("parent/payments", {
        method: "POST",
        data: { bill_id: billId, payment_channel: channel },
      });
      setMessage({ type: "success", text: data.message });
      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal memproses pembayaran",
      });
    } finally {
      setBusyBillId(null);
    }
  };

  const uploadProof = async (billId) => {
    const file = fileMap[billId];
    if (!file) {
      setMessage({ type: "error", text: "Pilih file bukti terlebih dahulu." });
      return;
    }

    const data = new FormData();
    data.append("bill_id", billId);
    data.append("notes", "Upload bukti dari portal orang tua");
    data.append("file", file);

    try {
      setBusyBillId(billId);
      const res = await fetchRoute("parent/payment-proofs", {
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage({ type: "success", text: res.data.message });
      setFileMap((prev) => ({ ...prev, [billId]: null }));
      await load();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message || "Gagal mengunggah bukti pembayaran",
      });
    } finally {
      setBusyBillId(null);
    }
  };

  const downloadReceipt = async (billId) => {
    try {
      setBusyBillId(billId);
      await downloadRouteFile(
        "parent/receipt",
        { bill_id: billId },
        "bukti-pembayaran.html",
      );
      setMessage({ type: "", text: "" });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message || "Gagal mengunduh bukti pembayaran",
      });
    } finally {
      setBusyBillId(null);
    }
  };

  return (
    <Layout
      title="Tagihan Saya"
      subtitle="Lakukan pembayaran otomatis atau unggah bukti transfer manual untuk diverifikasi admin."
    >
      <div
        className={`card p-4 ${
          settings?.payment_gateway_enabled === "1"
            ? "border border-sky-200 bg-sky-50/70"
            : "border border-amber-200 bg-amber-50/80"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p
              className={`text-sm font-semibold ${
                settings?.payment_gateway_enabled === "1"
                  ? "text-sky-700"
                  : "text-amber-900"
              }`}
            >
              {settings?.payment_gateway_enabled === "1"
                ? "Payment gateway aktif"
                : "Pembayaran Online sedang dalam pemeliharaan"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {settings?.payment_gateway_enabled === "1"
                ? `Pembayaran otomatis tersedia melalui ${settings?.payment_gateway_provider || "gateway sekolah"}.`
                : "Pembayaran otomatis sementara tidak tersedia. Silakan gunakan transfer manual dan unggah bukti pembayaran."}
            </p>
          </div>
          <span
            className={
              settings?.payment_gateway_enabled === "1"
                ? "badge-green"
                : "badge-amber"
            }
          >
            {settings?.payment_gateway_enabled === "1"
              ? "Aktif"
              : "Pemeliharaan"}
          </span>
        </div>
      </div>
      <Table
        emptyText={loading ? "Memuat tagihan..." : "Belum ada tagihan"}
        columns={[
          { key: "bill_name", title: "Tagihan" },
          { key: "period", title: "Periode" },
          {
            key: "due_date",
            title: "Jatuh Tempo",
            render: (row) => formatDate(row.due_date),
          },
          {
            key: "amount",
            title: "Nominal",
            render: (row) => formatCurrency(row.amount),
          },
          {
            key: "status",
            title: "Status",
            render: (row) => (
              <span
                className={
                  row.status === "paid" ? "badge-green" : "badge-amber"
                }
              >
                {row.status === "paid" ? "Lunas" : "Belum Lunas"}
              </span>
            ),
          },
          {
            key: "proof_status",
            title: "Bukti Bayar",
            render: (row) =>
              row.proof_status ? (
                <span
                  className={
                    row.proof_status === "approved"
                      ? "badge-green"
                      : row.proof_status === "rejected"
                        ? "badge-red"
                        : "badge-amber"
                  }
                >
                  {row.proof_status === "approved"
                    ? "Disetujui"
                    : row.proof_status === "rejected"
                      ? "Ditolak"
                      : "Menunggu"}
                </span>
              ) : (
                <span className="badge-slate">-</span>
              ),
          },
          {
            key: "action",
            title: "Aksi",
            render: (row) => {
              const proofPending = row.proof_status === "pending";
              const proofApproved = row.proof_status === "approved";
              const isBusy = busyBillId === row.id;
              const selectedFileName = fileMap[row.id]?.name;

              return row.status === "paid" || proofApproved ? (
                <button
                  className="btn-secondary"
                  disabled={isBusy}
                  onClick={() => downloadReceipt(row.id)}
                >
                  {isBusy ? "Memproses..." : "Cetak bukti"}
                </button>
              ) : (
                <div className="space-y-3">
                  {proofPending ? (
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Bukti pembayaran sedang menunggu review admin.
                    </div>
                  ) : settings?.payment_gateway_enabled === "1" ? (
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Transfer Bank",
                        "QRIS",
                        "Virtual Account",
                        "E-Wallet",
                      ].map((channel) => (
                        <button
                          key={channel}
                          className="btn-secondary text-xs"
                          disabled={isBusy}
                          onClick={() => pay(row.id, channel)}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Pembayaran Online sedang tidak aktif. Silakan unggah bukti
                      transfer manual.
                    </div>
                  )}
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Upload bukti transfer manual
                    </p>
                    <div className="flex flex-col gap-2 md:flex-row">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="input"
                        disabled={proofPending || isBusy}
                        onChange={(e) =>
                          setFileMap((prev) => ({
                            ...prev,
                            [row.id]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      <button
                        className="btn-primary"
                        disabled={proofPending || isBusy}
                        onClick={() => uploadProof(row.id)}
                      >
                        {proofPending
                          ? "Menunggu Review"
                          : isBusy
                            ? "Memproses..."
                            : "Kirim"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {selectedFileName || "Format file: JPG, PNG, atau PDF"}
                    </p>
                  </div>
                </div>
              );
            },
          },
        ]}
        rows={bills}
      />
    </Layout>
  );
}
