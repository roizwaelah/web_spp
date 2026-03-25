import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";

export default function ParentTransactionsPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await fetchRoute("parent/transactions");
        setRows(Array.isArray(data) ? data : []);
        setMessage((current) => (current.type === "error" ? { type: "", text: "" } : current));
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat riwayat pembayaran",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const downloadReceipt = async (transactionId) => {
    try {
      setDownloadingId(transactionId);
      await downloadRouteFile("parent/receipt", { transaction_id: transactionId }, "bukti-pembayaran.html");
      setMessage({ type: "", text: "" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal mengunduh bukti pembayaran",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Layout title="Riwayat Pembayaran" subtitle="Seluruh transaksi yang pernah dilakukan orang tua / wali siswa.">
      {message.text && (
        <div
          className={`mb-4 rounded-2xl px-4 py-3 text-sm ${
            message.type === "error" ? "bg-red-50 text-red-700" : "bg-sky-50 text-sky-700"
          }`}
        >
          {message.text}
        </div>
      )}
      <Table
        emptyText={loading ? "Memuat riwayat pembayaran..." : "Belum ada riwayat pembayaran"}
        columns={[
          { key: "payment_date", title: "Tanggal", render: (row) => formatDate(row.payment_date) },
          { key: "bill_name", title: "Tagihan" },
          { key: "payment_channel", title: "Kanal" },
          { key: "amount_paid", title: "Nominal", render: (row) => formatCurrency(row.amount_paid) },
          { key: "reference_no", title: "Referensi" },
          {
            key: "status",
            title: "Status",
            render: (row) => (
              <span className={row.status === "paid" ? "badge-green" : row.status === "failed" ? "badge-red" : "badge-amber"}>
                {row.status === "paid" ? "Lunas" : row.status === "failed" ? "Gagal" : "Menunggu"}
              </span>
            ),
          },
          {
            key: "receipt",
            title: "Bukti",
            render: (row) => (
              <button
                className="btn-secondary"
                disabled={downloadingId === row.id || row.status !== "paid"}
                onClick={() => downloadReceipt(row.id)}
              >
                {downloadingId === row.id ? "Memproses..." : "Download"}
              </button>
            ),
          },
        ]}
        rows={rows}
      />
    </Layout>
  );
}
