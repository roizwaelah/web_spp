import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import ModalFrame from "../components/ModalFrame";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

function gatewayLabel(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "payment gateway";
  if (text.includes("ipaymu")) return "iPaymu";
  if (text.includes("midtrans")) return "Midtrans";
  if (text.includes("doku")) return "DOKU";
  return value;
}

export default function ParentTransactionsPage() {
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const [detailRowId, setDetailRowId] = useState("");

  useToastMessage(message, setMessage);

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

  const groupedRows = useMemo(() => {
    const byReference = new Map();

    for (const row of rows) {
      const key = row.reference_no ? `REF:${row.reference_no}` : `TX:${row.id}`;
      if (!byReference.has(key)) {
        byReference.set(key, {
          id: key,
          payment_date: row.payment_date || "",
          reference_no: row.reference_no || "",
          payment_channel: row.payment_channel || "-",
          amount_paid: 0,
          status: row.status || "pending",
          transaction_ids: [],
          bill_names: [],
        });
      }

      const entry = byReference.get(key);
      entry.amount_paid += Number(row.amount_paid || 0);
      entry.transaction_ids.push(Number(row.id));
      if (row.bill_name) entry.bill_names.push(String(row.bill_name));
      if (
        row.payment_date &&
        String(row.payment_date).localeCompare(String(entry.payment_date || "")) > 0
      ) {
        entry.payment_date = row.payment_date;
      }
      if (row.status === "failed") {
        entry.status = "failed";
      } else if (row.status !== "paid" && entry.status !== "failed") {
        entry.status = "pending";
      } else if (entry.status !== "failed" && entry.status !== "pending") {
        entry.status = "paid";
      }
    }

    return Array.from(byReference.values())
      .map((row) => {
        const uniqueBillNames = Array.from(new Set(row.bill_names));
        const billNameLabel =
          uniqueBillNames.length <= 2
            ? uniqueBillNames.join(", ")
            : `${uniqueBillNames[0]}, ${uniqueBillNames[1]} +${uniqueBillNames.length - 2} pos`;

        return {
          ...row,
          bill_name: billNameLabel || "-",
        };
      })
      .sort((a, b) => String(b.payment_date || "").localeCompare(String(a.payment_date || "")));
  }, [rows]);

  const gatewayReturnStatus = useMemo(() => {
    const gateway = String(searchParams.get("gateway") || "").trim();
    const referenceNo = String(searchParams.get("ref") || "").trim();
    if (!gateway || !referenceNo) return null;

    const matchedRow = groupedRows.find((row) => String(row.reference_no || "") === referenceNo) || null;
    const label = gatewayLabel(gateway);

    if (!matchedRow) {
      return {
        tone: "info",
        title: `Transaksi ${label} sedang diproses`,
        description: `Referensi ${referenceNo} belum muncul di riwayat. Jika baru selesai membayar, tunggu beberapa saat lalu muat ulang halaman ini.`,
      };
    }

    if (matchedRow.status === "paid") {
      return {
        tone: "success",
        title: `Pembayaran ${label} berhasil`,
        description: `Referensi ${referenceNo} sudah tercatat lunas dengan nominal ${formatCurrency(matchedRow.amount_paid)}.`,
      };
    }

    if (matchedRow.status === "failed") {
      return {
        tone: "danger",
        title: `Pembayaran ${label} gagal`,
        description: `Referensi ${referenceNo} tercatat gagal. Silakan ulangi pembayaran atau hubungi admin jika dana sudah terpotong.`,
      };
    }

    return {
      tone: "warning",
      title: `Pembayaran ${label} masih menunggu`,
      description: `Referensi ${referenceNo} sudah tercatat, tetapi statusnya masih menunggu konfirmasi gateway.`,
    };
  }, [groupedRows, searchParams]);

  const downloadReceipt = async ({ transactionId, referenceNo }) => {
    try {
      setDownloadingId(referenceNo || transactionId);
      if (referenceNo) {
        await downloadRouteFile("parent/receipt", { reference_no: referenceNo }, `${referenceNo}.pdf`);
      } else {
        await downloadRouteFile("parent/receipt", { transaction_id: transactionId }, "bukti-pembayaran.pdf");
      }
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

  const detailRow = useMemo(
    () => groupedRows.find((row) => String(row.id) === String(detailRowId)) || null,
    [groupedRows, detailRowId],
  );

  return (
    <Layout title="Riwayat Pembayaran" subtitle="Seluruh transaksi yang pernah dilakukan orang tua / wali santri.">
      {gatewayReturnStatus && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            gatewayReturnStatus.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : gatewayReturnStatus.tone === "danger"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : gatewayReturnStatus.tone === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          <p className="font-semibold">{gatewayReturnStatus.title}</p>
          <p className="mt-1">{gatewayReturnStatus.description}</p>
        </div>
      )}

      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card p-4 text-sm text-slate-600">Memuat riwayat pembayaran...</div>
        ) : groupedRows.length === 0 ? (
          <div className="card p-4 text-sm text-slate-600">Belum ada riwayat pembayaran</div>
        ) : (
          <ol className="space-y-2">
            {groupedRows.map((row, index) => (
              <li
                key={row.id}
                className={`card p-3 ${
                  gatewayReturnStatus?.description?.includes(String(row.reference_no || ""))
                    ? "ring-2 ring-sky-200"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-slate-900">
                      {index + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {row.reference_no || "-"}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {formatDate(row.payment_date)} | {formatCurrency(row.amount_paid)}
                      </p>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary px-3 py-1" onClick={() => setDetailRowId(String(row.id))}>
                    Lihat
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="hidden md:block">
        <Table
          striped
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
                  disabled={downloadingId === (row.reference_no || row.transaction_ids?.[0]) || row.status !== "paid"}
                  onClick={() =>
                    downloadReceipt({
                      transactionId: row.transaction_ids?.[0],
                      referenceNo: row.reference_no || "",
                    })
                  }
                >
                  {downloadingId === (row.reference_no || row.transaction_ids?.[0]) ? "Memproses..." : "Download"}
                </button>
              ),
            },
          ]}
          rows={groupedRows}
          rowClassName={(row) =>
            gatewayReturnStatus?.description?.includes(String(row.reference_no || "")) ? "ring-2 ring-sky-200" : ""
          }
        />
      </div>

      <ModalFrame
        open={Boolean(detailRow)}
        title="Detail Riwayat Tagihan"
        description="Rincian transaksi yang dipilih"
        showIcon={false}
        onClose={() => setDetailRowId("")}
      >
        {detailRow ? (
          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Referensi: {detailRow.reference_no || "-"}</li>
              <li>Tanggal: {formatDate(detailRow.payment_date)}</li>
              <li>Nominal: {formatCurrency(detailRow.amount_paid)}</li>
              <li>Kanal: {detailRow.payment_channel || "-"}</li>
              <li>Status: {detailRow.status === "paid" ? "Lunas" : detailRow.status === "failed" ? "Gagal" : "Menunggu"}</li>
              <li>Tagihan: {detailRow.bill_name || "-"}</li>
            </ul>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetailRowId("")}>
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={downloadingId === (detailRow.reference_no || detailRow.transaction_ids?.[0]) || detailRow.status !== "paid"}
                onClick={() =>
                  downloadReceipt({
                    transactionId: detailRow.transaction_ids?.[0],
                    referenceNo: detailRow.reference_no || "",
                  })
                }
              >
                {downloadingId === (detailRow.reference_no || detailRow.transaction_ids?.[0]) ? "Memproses..." : "Unduh"}
              </button>
            </div>
          </div>
        ) : null}
      </ModalFrame>
    </Layout>
  );
}
