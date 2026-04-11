import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import ModalFrame from "../components/ModalFrame";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate, formatPeriod } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ParentBillsPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [busyBillId, setBusyBillId] = useState(null);
  const [detailBillId, setDetailBillId] = useState("");

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
        "bukti-pembayaran.pdf",
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
  const gatewayLabel = gatewayEnabled ? "Gateway Aktif" : "Dalam Pemeliharaan";
  const gatewayDescription = gatewayEnabled
    ? settings?.payment_gateway_provider || "Pembayaran otomatis tersedia"
    : "Gunakan transfer manual";
  const unpaidBills = useMemo(
    () =>
      bills
        .filter((item) => item?.status !== "paid")
        .sort((a, b) => {
          const aPeriod = String(a?.period || "");
          const bPeriod = String(b?.period || "");
          const aMatch = aPeriod.match(/^(\d{4})-(\d{2})$/);
          const bMatch = bPeriod.match(/^(\d{4})-(\d{2})$/);
          if (aMatch && bMatch) {
            const aYear = Number(aMatch[1]);
            const bYear = Number(bMatch[1]);
            if (aYear !== bYear) return aYear - bYear;
            const aMonth = Number(aMatch[2]);
            const bMonth = Number(bMatch[2]);
            if (aMonth !== bMonth) return aMonth - bMonth;
          } else if (aMatch && !bMatch) {
            return -1;
          } else if (!aMatch && bMatch) {
            return 1;
          } else {
            const byPeriodText = aPeriod.localeCompare(bPeriod, "id", { numeric: true, sensitivity: "base" });
            if (byPeriodText !== 0) return byPeriodText;
          }
          return String(a?.bill_name || "").localeCompare(String(b?.bill_name || ""), "id", {
            numeric: true,
            sensitivity: "base",
          });
        }),
    [bills],
  );
  const detailBill = useMemo(
    () => unpaidBills.find((item) => String(item.id) === String(detailBillId)) || null,
    [unpaidBills, detailBillId],
  );

  return (
    <Layout
      title="Tagihan Saya"
      subtitle="Lakukan pembayaran otomatis atau unggah bukti transfer manual untuk diverifikasi admin."
      actions={
        <div className="inline-flex items-center gap-3 rounded-md border border-slate-200 bg-white/80 px-3 py-2 text-left shadow-sm">
          <div className="min-w-0">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pembayaran Online
            </p>
            <p className="truncate text-sm text-slate-700">{gatewayDescription}</p>
          </div>
          <span className={gatewayEnabled ? "badge-green" : "badge-amber"}>
            {gatewayLabel}
          </span>
        </div>
      }
    >
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="card p-4 text-sm text-slate-600">Memuat tagihan...</div>
        ) : unpaidBills.length === 0 ? (
          <div className="card p-4 text-sm text-slate-600">Belum ada tagihan</div>
        ) : (
          <ol className="space-y-2">
            {unpaidBills.map((row, index) => (
              <li key={row.id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-slate-900">
                      {index + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {row.bill_name} {formatPeriod(row.period)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{formatCurrency(row.amount)}</p>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary px-3 py-1" onClick={() => setDetailBillId(String(row.id))}>
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
              key: "action",
              title: (
                <div className="inline-flex items-center gap-2">
                  <span>Aksi</span>
                  {!gatewayEnabled && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      Bayar Otomatis non-aktif, gunakan TF manual
                    </span>
                  )}
                </div>
              ),
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
                      </div>
                    )}
                  </div>
                );
              },
            },
          ]}
          rows={unpaidBills}
        />
      </div>

      <ModalFrame
        open={Boolean(detailBill)}
        title="Detail Tagihan"
        description="Rincian tagihan yang dipilih"
        showIcon={false}
        onClose={() => setDetailBillId("")}
      >
        {detailBill ? (
          <div className="space-y-4">
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Pos Tagihan: {detailBill.bill_name}</li>
              <li>Periode: {formatPeriod(detailBill.period)}</li>
              <li>Jatuh Tempo: {formatDate(detailBill.due_date)}</li>
              <li>Nominal: {formatCurrency(detailBill.amount)}</li>
              <li>Status: {detailBill.status === "paid" ? "Lunas" : "Belum Lunas"}</li>
            </ul>
            {detailBill.proof_status === "pending" ? (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Bukti pembayaran sedang menunggu review admin.
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetailBillId("")}>
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={detailBill.proof_status === "pending"}
                onClick={() => navigate(`/orang-tua/tagihan/pembayaran?bill_id=${detailBill.id}`)}
              >
                Bayar
              </button>
            </div>
          </div>
        ) : null}
      </ModalFrame>
    </Layout>
  );
}
