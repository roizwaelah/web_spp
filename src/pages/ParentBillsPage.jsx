import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fileUrl, fetchRoute } from "../api";
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
    const { data } = await fetchRoute("parent/payments", {
      method: "POST",
      data: { bill_id: billId, payment_channel: channel },
    });
    setMessage(data.message);
    load();
  };

  const uploadProof = async (billId) => {
    const file = fileMap[billId];
    if (!file) return alert("Pilih file bukti terlebih dahulu.");
    const data = new FormData();
    data.append("bill_id", billId);
    data.append("notes", "Upload bukti dari portal orang tua");
    data.append("file", file);
    const res = await fetchRoute("parent/payment-proofs", {
      method: "POST",
      data,
      headers: { "Content-Type": "multipart/form-data" },
    });
    setMessage(res.data.message);
    setFileMap((prev) => ({ ...prev, [billId]: null }));
    load();
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
                {row.status}
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
                  {row.proof_status}
                </span>
              ) : (
                <span className="badge-slate">-</span>
              ),
          },
          {
            key: "action",
            title: "Aksi",
            render: (row) =>
              row.status === "paid" ? (
                <a
                  className="btn-secondary"
                  href={fileUrl("parent/receipt", { bill_id: row.id })}
                  target="_blank"
                  rel="noreferrer"
                >
                  Cetak bukti
                </a>
              ) : (
                <div className="space-y-3">
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
                  <div className="rounded-2xl border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Upload bukti transfer manual
                    </p>
                    <div className="flex flex-col gap-2 md:flex-row">
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="input"
                        onChange={(e) =>
                          setFileMap((prev) => ({
                            ...prev,
                            [row.id]: e.target.files?.[0] || null,
                          }))
                        }
                      />
                      <button
                        className="btn-primary"
                        onClick={() => uploadProof(row.id)}
                      >
                        Kirim
                      </button>
                    </div>
                  </div>
                </div>
              ),
          },
        ]}
        rows={bills}
      />
    </Layout>
  );
}
