import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import ModalFrame from "../components/ModalFrame";
import { downloadRouteFile, fetchRoute } from "../api";
import { formatCurrency, formatDate, formatPeriod } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const getBillRemainingAmount = (bill) => {
  if (bill?.remaining_amount != null) return Number(bill.remaining_amount || 0);
  return Math.max(Number(bill?.amount || 0) - Number(bill?.paid_amount || 0), 0);
};

const getBillStatusLabel = (status) => {
  if (status === "paid") return "Lunas";
  if (status === "partial") return "Sebagian";
  return "Belum Lunas";
};

const getBillPostKey = (bill) => String(bill?.finance_post_id || bill?.bill_name || "");

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
  const blockedBillReasons = useMemo(() => {
    const oldestOpenByPost = new Map();
    const reasons = new Map();

    for (const bill of unpaidBills) {
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
  }, [unpaidBills]);
  const detailBillBlockedReason = detailBill
    ? blockedBillReasons.get(String(detailBill.id)) || ""
    : "";

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
            {unpaidBills.map((row, index) => {
              const blockedReason = blockedBillReasons.get(String(row.id)) || "";
              return (
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
                      <p className="mt-1 text-sm text-slate-700">
                        Sisa {formatCurrency(getBillRemainingAmount(row))}
                        <span className="mx-1 text-slate-300">|</span>
                        {getBillStatusLabel(row.status)}
                      </p>
                      {blockedReason ? (
                        <p className="mt-1 text-xs text-amber-700">{blockedReason}</p>
                      ) : null}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary px-3 py-1" onClick={() => setDetailBillId(String(row.id))}>
                    Lihat
                  </button>
                </div>
              </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="hidden md:block">
        <Table
          striped
          emptyText={loading ? "Memuat tagihan..." : "Belum ada tagihan"}
          columns={[
            {
              key: "bill_name",
              title: "Tagihan",
              headerClassName: "min-w-[180px]",
              cellClassName: "min-w-[180px] font-semibold text-slate-900",
            },
            {
              key: "period",
              title: "Periode",
              headerClassName: "w-28",
              cellClassName: "w-28 whitespace-nowrap",
            },
            {
              key: "due_date",
              title: "Jatuh Tempo",
              headerClassName: "w-32",
              cellClassName: "w-32 whitespace-nowrap",
              render: (row) => formatDate(row.due_date),
            },
            {
              key: "amount",
              title: "Nominal / Sisa",
              headerClassName: "min-w-[180px]",
              cellClassName: "min-w-[180px]",
              render: (row) => (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(getBillRemainingAmount(row))}
                  </p>
                  <p className="text-xs text-slate-500">
                    dari {formatCurrency(row.amount)} · terbayar {formatCurrency(row.paid_amount)}
                  </p>
                </div>
              ),
            },
            {
              key: "status",
              title: "Status",
              headerClassName: "w-32",
              cellClassName: "w-32 whitespace-nowrap",
              render: (row) => (
                <span
                  className={
                    row.status === "paid"
                      ? "badge-green"
                      : row.status === "partial"
                        ? "badge-slate"
                        : "badge-amber"
                  }
                >
                  {getBillStatusLabel(row.status)}
                </span>
              ),
            },
            {
              key: "action",
              title: (
                <div className="flex max-w-[260px] flex-col gap-1">
                  <span>Aksi</span>
                  {!gatewayEnabled && (
                    <span className="w-fit rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold leading-tight text-amber-700">
                      Bayar Otomatis non-aktif, gunakan TF manual
                    </span>
                  )}
                </div>
              ),
              headerClassName: "w-[280px] min-w-[240px]",
              cellClassName: "w-[280px] min-w-[240px] whitespace-normal",
              render: (row) => {
                const proofPending = row.proof_status === "pending";
                const proofApproved = row.proof_status === "approved";
                const isBusy = busyBillId === row.id;
                const blockedReason = blockedBillReasons.get(String(row.id)) || "";

                return row.status === "paid" || proofApproved ? (
                  <button
                    className="btn-secondary"
                    disabled={isBusy}
                    onClick={() => downloadReceipt(row.id)}
                  >
                    {isBusy ? "Memproses..." : "Cetak bukti"}
                  </button>
                ) : (
                  <div className="flex max-w-[260px] flex-col items-start space-y-2">
                    {proofPending ? (
                      <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-100">
                        Bukti pembayaran sedang menunggu review admin.
                      </div>
                    ) : blockedReason ? (
                      <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700 ring-1 ring-amber-100">
                        {blockedReason}
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
              <li>Terbayar: {formatCurrency(detailBill.paid_amount)}</li>
              <li>Sisa: {formatCurrency(getBillRemainingAmount(detailBill))}</li>
              <li>Status: {getBillStatusLabel(detailBill.status)}</li>
            </ul>
            {detailBill.proof_status === "pending" ? (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Bukti pembayaran sedang menunggu review admin.
              </div>
            ) : null}
            {detailBillBlockedReason ? (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {detailBillBlockedReason}
              </div>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetailBillId("")}>
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={detailBill.proof_status === "pending" || !!detailBillBlockedReason}
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
