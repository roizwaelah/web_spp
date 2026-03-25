import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";

export default function ParentBillsPage() {
  const [bills, setBills] = useState([]);
  const [message, setMessage] = useState("");
  const [fileMap, setFileMap] = useState({});

  const load = () =>
    fetchRoute("parent/bills").then(({ data }) =>
      setBills(Array.isArray(data) ? data : []),
    );
  useEffect(() => {
    load();
  }, []);

  const pay = async (billId, channel) => {
    try {
      const { data } = await fetchRoute("parent/payments", {
        method: "POST",
        data: { bill_id: billId, payment_channel: channel },
      });
      setMessage(data.message);
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memproses pembayaran");
    }
  };

  const uploadProof = async (billId) => {
    const file = fileMap[billId];
    if (!file) return alert("Pilih file bukti terlebih dahulu.");
    const data = new FormData();
    data.append("bill_id", billId);
    data.append("notes", "Upload bukti dari portal orang tua");
    data.append("file", file);
    try {
      const res = await fetchRoute("parent/payment-proofs", {
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage(res.data.message);
      setFileMap((prev) => ({ ...prev, [billId]: null }));
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengunggah bukti pembayaran");
    }
  };

  const downloadReceipt = async (billId) => {
    try {
      await downloadRouteFile("parent/receipt", { bill_id: billId }, "bukti-pembayaran.html");
      setMessage("");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengunduh bukti pembayaran");
    }
  };

  return (
    <Layout
      title="Tagihan Saya"
      subtitle="Lakukan pembayaran otomatis atau unggah bukti transfer manual untuk diverifikasi admin."
    >
      {message && (
        <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
          {message}
        </div>
      )}
      <Table
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

              return row.status === "paid" || proofApproved ? (
                <button
                  className="btn-secondary"
                  onClick={() => downloadReceipt(row.id)}
                >
                  Cetak bukti
                </button>
              ) : (
                <div className="space-y-3">
                  {!proofPending ? (
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
                          onClick={() => pay(row.id, channel)}
                        >
                          {channel}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Bukti pembayaran sedang menunggu review admin.
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
                        disabled={proofPending}
                        onChange={(e) =>
                          setFileMap((prev) => ({
                            ...prev,
                            [row.id]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      <button
                        className="btn-primary"
                        disabled={proofPending}
                        onClick={() => uploadProof(row.id)}
                      >
                        {proofPending ? "Menunggu Review" : "Kirim"}
                      </button>
                    </div>
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
