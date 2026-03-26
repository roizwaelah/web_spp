import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ParentBillsPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState({ type: "", text: "" });
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

  const gatewayEnabled = settings?.payment_gateway_enabled === "1";
  const gatewayLabel = gatewayEnabled ? "Gateway Aktif" : "Gateway Pemeliharaan";
  const gatewayDescription = gatewayEnabled
    ? settings?.payment_gateway_provider || "Pembayaran otomatis tersedia"
    : "Gunakan transfer manual";

  return (
    <Layout
      title="Tagihan Saya"
      subtitle="Lakukan pembayaran otomatis atau unggah bukti transfer manual untuk diverifikasi admin."
      actions={
        <div className="inline-flex items-center gap-3 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-left shadow-sm">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Status Pembayaran
            </p>
            <p className="truncate text-sm text-slate-700">{gatewayDescription}</p>
          </div>
          <span className={gatewayEnabled ? "badge-green" : "badge-amber"}>
            {gatewayLabel}
          </span>
        </div>
      }
    >
      <Table
        striped
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
            headerClassName: "w-0",
            cellClassName: "w-0 whitespace-nowrap",
            render: (row) => {
              const proofPending = row.proof_status === "pending";
              const proofApproved = row.proof_status === "approved";
              const isBusy = busyBillId === row.id;

              return row.status === "paid" || proofApproved ? (
                <button
                  className="btn-secondary"
                  disabled={isBusy}
                  onClick={() => downloadReceipt(row.id)}
                >
                  {isBusy ? "Memproses..." : "Cetak bukti"}
                </button>
              ) : (
                <div className="inline-flex max-w-[320px] flex-col items-start space-y-3">
                  {proofPending ? (
                    <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Bukti pembayaran sedang menunggu review admin.
                    </div>
                  ) : (
                    <div className="inline-flex flex-col items-start gap-2">
                      <button
                        className="btn-primary"
                        disabled={isBusy}
                        onClick={() => navigate(`/orang-tua/tagihan/pembayaran?bill_id=${row.id}`)}
                      >
                        Bayar
                      </button>
                      {!gatewayEnabled && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                          Gateway nonaktif, gunakan transfer manual
                        </span>
                      )}
                    </div>
                  )}
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
