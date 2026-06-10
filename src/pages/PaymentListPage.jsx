import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Printer, RefreshCw, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute, openRouteFile } from "../api";
import { formatCurrency, formatDate, formatPeriod, roleLabel } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import { useUI } from "../context/UIContext";
import ModalFrame from "../components/ModalFrame";
import { prefetchRoute } from "../prefetch";
import { useAuth } from "../context/AuthContext";

const getOfficerPreviewName = (user, officerName = "") => {
  const fromTransaction = String(officerName || "").trim();
  if (fromTransaction) return fromTransaction;
  const fromUser = String(user?.name || "").trim();
  if (fromUser) return fromUser;
  if (user?.role) return roleLabel(user.role).toUpperCase();
  return "ADMIN";
};

const getBillRemainingAmount = (bill) => {
  if (bill?.remaining_amount != null) return Number(bill.remaining_amount || 0);
  return Math.max(Number(bill?.amount || 0) - Number(bill?.paid_amount || 0), 0);
};

const getTransactionRemainingAmount = (transaction) => {
  if (transaction?.remaining_amount != null) return Number(transaction.remaining_amount || 0);
  if (transaction?.bill_remaining_amount != null) return Number(transaction.bill_remaining_amount || 0);
  return 0;
};

const getPaymentStatusLabel = (remainingAmount) =>
  remainingAmount > 0 ? "Sebagian" : "Lunas";

const studentStatusOptions = [
  { value: "active", label: "Aktif" },
  { value: "graduated", label: "Lulus" },
  { value: "inactive", label: "Nonaktif" },
];

const transactionsPerPage = 25;

const sortReceiptItems = (items = []) =>
  [...items].sort((left, right) => {
    const leftName = String(left?.bill_name || "").trim();
    const rightName = String(right?.bill_name || "").trim();
    const nameCompare = leftName.localeCompare(rightName, "id", {
      sensitivity: "base",
    });
    if (nameCompare !== 0) return nameCompare;

    const leftPeriod = String(left?.period || "");
    const rightPeriod = String(right?.period || "");
    if (leftPeriod !== rightPeriod) {
      return leftPeriod.localeCompare(rightPeriod, "id");
    }

    return Number(left?.transaction_id || 0) - Number(right?.transaction_id || 0);
  });

export default function PaymentListPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [schoolProfile, setSchoolProfile] = useState({
    school_name: "MADSC PAYMENT",
    school_address: "Dokumen detail transaksi pembayaran siswa",
  });
  const [billRows, setBillRows] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionPagination, setTransactionPagination] = useState({
    page: 1,
    per_page: transactionsPerPage,
    total: 0,
    total_pages: 1,
  });
  const [filters, setFilters] = useState({ class_id: "", student_status: "", student_id: "" });
  const [detailStudentId, setDetailStudentId] = useState("");
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [reconcilingPending, setReconcilingPending] = useState(false);
  const [printing, setPrinting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const transactionFilterParams = () => ({
    ...(filters.class_id ? { class_id: filters.class_id } : {}),
    ...(filters.student_status ? { student_status: filters.student_status } : {}),
    ...(filters.student_id ? { student_id: filters.student_id } : {}),
  });

  const applyTransactionPayload = (data, pageFallback = transactionPage) => {
    const payload = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    const rows = Array.isArray(data) ? data : Array.isArray(payload.rows) ? payload.rows : [];
    const pagination = payload.pagination || {};
    const nextPage = Number(pagination.page || pageFallback || 1);
    const totalPages = Math.max(1, Number(pagination.total_pages || 1));
    setTransactions(rows);
    setTransactionPage(nextPage);
    setTransactionPagination({
      page: nextPage,
      per_page: Number(pagination.per_page || transactionsPerPage),
      total: Number(pagination.total ?? rows.length),
      total_pages: totalPages,
    });
  };

  const resetFilters = (updater) => {
    setTransactionPage(1);
    setFilters(updater);
  };

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [{ data: metaData }, { data: settingsData }] = await Promise.all([
          fetchRoute("admin/meta"),
          fetchRoute("admin/settings/profile"),
        ]);
        setMeta({
          classes: Array.isArray(metaData?.classes) ? metaData.classes : [],
          students: Array.isArray(metaData?.students) ? metaData.students : [],
        });
        setSchoolProfile({
          school_name:
            (settingsData?.school_name || "MADSC PAYMENT").trim() ||
            "MADSC PAYMENT",
          school_address:
            (
              settingsData?.school_address ||
              "Dokumen detail transaksi pembayaran siswa"
            ).trim() || "Dokumen detail transaksi pembayaran siswa",
        });
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error?.response?.data?.message ||
            "Gagal memuat metadata pembayaran",
        });
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const { data } = await fetchRoute("admin/bills", {
          params: {
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_status ? { student_status: filters.student_status } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        });
        setBillRows(
          Array.isArray(data)
            ? data.filter((item) => item?.status !== "paid")
            : [],
        );
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error?.response?.data?.message ||
            "Gagal memuat daftar tagihan terbuka",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [filters.class_id, filters.student_status, filters.student_id]);

  useEffect(() => {
    const loadTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const { data } = await fetchRoute("admin/transactions", {
          params: {
            mode: "page",
            page: transactionPage,
            per_page: transactionsPerPage,
            ...transactionFilterParams(),
          },
        });
        applyTransactionPayload(data);
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error?.response?.data?.message ||
            "Gagal memuat transaksi pembayaran",
        });
      } finally {
        setTransactionsLoading(false);
      }
    };

    loadTransactions();
  }, [filters.class_id, filters.student_status, filters.student_id, transactionPage]);

  const studentOptions = useMemo(() => {
    const rows = meta.students.filter((item) => {
      if (filters.student_status && item.status !== filters.student_status) return false;
      if (!filters.class_id) return true;
      const hasBill = billRows.some(
        (row) => String(row.student_id) === String(item.id),
      );
      const hasTransaction = transactions.some(
        (row) => String(row.student_id) === String(item.id),
      );
      return hasBill || hasTransaction;
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [billRows, filters.class_id, filters.student_status, meta.students, transactions]);

  const groupedRows = useMemo(() => {
    const byStudent = new Map();

    for (const row of transactions) {
      const studentId = String(row?.student_id ?? "");
      if (!studentId) continue;

      if (!byStudent.has(studentId)) {
        byStudent.set(studentId, {
          id: studentId,
          student_name: row.student_name || "-",
          class_name: row.class_name || "-",
          nisn: row.nisn || row.nis || "-",
          periods: new Set(),
          channels: new Set(),
          total_amount_paid: 0,
          latest_payment_date: row.payment_date || "",
          transactions: [],
        });
      }

      const entry = byStudent.get(studentId);
      entry.total_amount_paid += Number(row.amount_paid || 0);
      if (row.period) entry.periods.add(String(row.period));
      if (row.payment_channel) entry.channels.add(String(row.payment_channel));
      if (
        row.payment_date &&
        String(row.payment_date).localeCompare(String(entry.latest_payment_date)) > 0
      ) {
        entry.latest_payment_date = row.payment_date;
      }
      entry.transactions.push(row);
    }

    return Array.from(byStudent.values())
      .map((entry) => {
        const periodList = Array.from(entry.periods).sort((a, b) =>
          a.localeCompare(b, "id"),
        );
        const periodLabel =
          periodList.length <= 1
            ? formatPeriod(periodList[0] || "-")
            : `${formatPeriod(periodList[0])} s/d ${formatPeriod(periodList[periodList.length - 1])}`;
        const channelList = Array.from(entry.channels).sort((a, b) =>
          a.localeCompare(b, "id"),
        );
        const channelLabel =
          channelList.length === 0
            ? "-"
            : channelList.length === 1
              ? channelList[0]
              : "Multi Kanal";
        const receiptMap = new Map();
        for (const tx of entry.transactions) {
          const groupKey = tx.reference_no
            ? `REF:${tx.reference_no}`
            : `TX:${tx.id}`;
          if (!receiptMap.has(groupKey)) {
            receiptMap.set(groupKey, {
              id: groupKey,
              student_id: tx.student_id,
              student_name: tx.student_name,
              nisn: tx.nisn || tx.nis || "-",
              class_name: tx.class_name,
              payment_date: tx.payment_date || "",
              payment_channel: tx.payment_channel || "-",
              reference_no: tx.reference_no || "",
              officer_name: tx.officer_name || "",
              transaction_ids: [],
              items: [],
              total_amount_paid: 0,
              deposit_credit_amount: 0,
            });
          }
          const group = receiptMap.get(groupKey);
          if (
            tx.payment_date &&
            String(tx.payment_date).localeCompare(String(group.payment_date || "")) > 0
          ) {
            group.payment_date = tx.payment_date;
          }
          group.transaction_ids.push(Number(tx.id));
          group.items.push({
            transaction_id: Number(tx.id || 0),
            bill_name: tx.bill_name || "-",
            period: tx.period || "-",
            amount: Number(tx.amount_paid || 0),
            bill_amount: Number(tx.bill_amount ?? tx.amount ?? 0),
            paid_amount: Number(tx.paid_amount ?? tx.amount_paid ?? 0),
            remaining_amount: getTransactionRemainingAmount(tx),
            is_flexible_installment: !!tx.is_flexible_installment,
          });
          group.total_amount_paid += Number(tx.amount_paid || 0);
          group.deposit_credit_amount =
            Number(group.deposit_credit_amount || 0) + Number(tx.deposit_credit_amount || 0);
        }

        const receiptGroups = Array.from(receiptMap.values())
          .map((group) => ({
            ...group,
            items: sortReceiptItems(group.items),
            pos_count: group.items.length,
          }))
          .sort((a, b) =>
            String(b.payment_date || "").localeCompare(String(a.payment_date || "")),
          );

        return {
          ...entry,
          period_label: periodLabel,
          channel_label: channelLabel,
          transaction_count: entry.transactions.length,
          receipt_groups: receiptGroups,
          transactions: [...entry.transactions].sort((a, b) =>
            String(b.payment_date || "").localeCompare(String(a.payment_date || "")),
          ),
        };
      })
      .sort((a, b) => a.student_name.localeCompare(b.student_name, "id"));
  }, [transactions]);

  const detailStudentRow = useMemo(
    () =>
      groupedRows.find((row) => String(row.id) === String(detailStudentId)) || null,
    [groupedRows, detailStudentId],
  );

  useEffect(() => {
    if (!detailStudentId) return;
    if (!detailStudentRow) setDetailStudentId("");
  }, [detailStudentId, detailStudentRow]);

  const openBillRemainingTotal = useMemo(
    () => billRows.reduce((sum, item) => sum + getBillRemainingAmount(item), 0),
    [billRows],
  );

  const printTransaction = async ({ transactionId, referenceNo, studentId }) => {
    try {
      setPrinting(true);
      if (referenceNo && studentId) {
        await openRouteFile("admin/transactions/receipt", {
          reference_no: referenceNo,
          student_id: studentId,
        });
      } else {
        await openRouteFile("admin/transactions/receipt", {
          transaction_id: transactionId,
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message || "Gagal mencetak bukti pembayaran",
      });
    } finally {
      setPrinting(false);
    }
  };

  const removeTransactionGroup = async (group) => {
    const txIds = Array.isArray(group?.transaction_ids)
      ? group.transaction_ids.filter((id) => Number(id) > 0)
      : [];
    if (txIds.length === 0) return;

    const confirmed = await confirm({
      title: "Hapus transaksi",
      description:
        txIds.length > 1
          ? `Transaksi ini berisi ${txIds.length} pos. Semua transaksi dalam bukti yang sama akan dihapus.`
          : "Transaksi yang dihapus akan membatalkan status lunas tagihan jika tidak ada pembayaran lain untuk tagihan tersebut.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      for (const txId of txIds) {
        await fetchRoute("admin/transactions", {
          method: "DELETE",
          data: { id: Number(txId) },
        });
      }
      setMessage({
        type: "success",
        text:
          txIds.length > 1
            ? "Transaksi gabungan berhasil dihapus"
            : "Transaksi berhasil dihapus",
      });

      const [{ data: rows }, { data: txRows }] = await Promise.all([
        fetchRoute("admin/bills", {
          params: {
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_status ? { student_status: filters.student_status } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        }),
        fetchRoute("admin/transactions", {
          params: {
            mode: "page",
            page: transactionPage,
            per_page: transactionsPerPage,
            ...transactionFilterParams(),
          },
        }),
      ]);
      setBillRows(
        Array.isArray(rows)
          ? rows.filter((item) => item?.status !== "paid")
          : [],
      );
      applyTransactionPayload(txRows);
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message ||
          "Gagal menghapus transaksi gabungan",
      });
    }
  };

  const reconcilePendingTransactions = async () => {
    setReconcilingPending(true);
    try {
      await fetchRoute("admin/transactions/reconcile-pending", {
        method: "POST",
        data: {
          ...(filters.class_id ? { class_id: filters.class_id } : {}),
          ...(filters.student_id ? { student_id: filters.student_id } : {}),
        },
      });

      const [{ data: rows }, { data: txRows }] = await Promise.all([
        fetchRoute("admin/bills", {
          params: {
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_status ? { student_status: filters.student_status } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        }),
        fetchRoute("admin/transactions", {
          params: {
            mode: "page",
            page: transactionPage,
            per_page: transactionsPerPage,
            ...transactionFilterParams(),
          },
        }),
      ]);

      setBillRows(
        Array.isArray(rows)
          ? rows.filter((item) => item?.status !== "paid")
          : [],
      );
      applyTransactionPayload(txRows);
      setMessage({
        type: "success",
        text: "Rekonsiliasi transaksi pending selesai",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message ||
          "Gagal merekonsiliasi transaksi pending",
      });
    } finally {
      setReconcilingPending(false);
    }
  };

  return (
    <Layout
      title="Pembayaran"
      subtitle="Filter transaksi pembayaran dan pantau tagihan siswa yang masih belum lunas."
      actions={
        <div className="flex w-full justify-end">
          <button
            className="btn-primary"
            onClick={() =>
              navigate("/admin/pembayaran/edit", {
                state: {
                  student_id: filters.student_id,
                  student_status: filters.student_status,
                },
              })
            }
            onMouseEnter={() => prefetchRoute("/admin/pembayaran/edit")}
            onFocus={() => prefetchRoute("/admin/pembayaran/edit")}
          >
            <Plus size={18} /> Input pembayaran
          </button>
        </div>
      }
    >
      <div className="card p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          <div>
            <label className="label">Filter kelas</label>
            <select
              className="input"
              value={filters.class_id}
              onChange={(e) =>
                resetFilters((current) => ({
                  ...current,
                  class_id: e.target.value,
                  student_id: "",
                }))
              }
            >
              <option value="">Semua kelas</option>
              {meta.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status siswa</label>
            <select
              className="input"
              value={filters.student_status}
              onChange={(e) =>
                resetFilters((current) => ({
                  ...current,
                  student_status: e.target.value,
                  student_id: "",
                }))
              }
            >
              <option value="">Semua status siswa</option>
              {studentStatusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Filter siswa</label>
            <select
              className="input"
              value={filters.student_id}
              disabled={studentOptions.length === 0}
              onChange={(e) =>
                resetFilters((current) => ({
                  ...current,
                  student_id: e.target.value,
                }))
              }
            >
              <option value="">
                {studentOptions.length === 0
                  ? "Tidak ada siswa"
                  : "Semua siswa"}
              </option>
              {studentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.nis}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-4 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="section-title">Transaksi pembayaran</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary px-3 py-2"
              disabled={reconcilingPending}
              onClick={reconcilePendingTransactions}
            >
              <RefreshCw
                size={16}
                className={reconcilingPending ? "animate-spin" : ""}
              />
              {reconcilingPending ? "Merekonsiliasi..." : "Rekonsiliasi pending"}
            </button>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Tagihan terbuka:{" "}
              <span className="font-semibold text-slate-900">
                {loading ? "..." : billRows.length}
              </span>
              <span className="mx-2 text-slate-300">|</span>
              Sisa:{" "}
              <span className="font-semibold text-slate-900">
                {loading ? "..." : formatCurrency(openBillRemainingTotal)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {transactionsLoading ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Memuat transaksi...
            </div>
          ) : groupedRows.length === 0 ? (
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-500">
              Belum ada transaksi pembayaran
            </div>
          ) : (
            <ol className="space-y-3">
              {groupedRows.map((row, index) => (
                <li key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5 text-sm font-semibold text-slate-500">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="mt-0.5 text-sm font-semibold text-slate-900">{row.student_name}</p>
                          <p className="text-xs text-slate-700">
                            {row.class_name} 
                            <span className="text-yellow-500 mx-1">|</span> 
                            {row.latest_payment_date ? formatDate(row.latest_payment_date) : "-"}
                          </p>
                        </div>
                        <button
                          className="btn-secondary px-3 py-2"
                          title="Lihat detail transaksi siswa"
                          onClick={() => setDetailStudentId(String(row.id))}
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold text-slate-700">{row.transaction_count} transaksi</p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="hidden md:block">
          <Table
            striped
            emptyText={
              transactionsLoading
                ? "Memuat transaksi..."
                : "Belum ada transaksi pembayaran"
            }
            columns={[
              {
                key: "student_name",
                title: "Nama Siswa",
              },
              {
                key: "class_name",
                title: "Kelas",
              },
              { key: "channel_label", title: "Kanal" },
              {
                key: "period_label",
                title: "Periode",
              },
              {
                key: "latest_payment_date",
                title: "Tgl Bayar",
                render: (row) =>
                  row.latest_payment_date ? formatDate(row.latest_payment_date) : "-",
              },
              {
                key: "transaction_count",
                title: "Transaksi",
                render: (row) => `${row.transaction_count} transaksi`,
              },
              {
                key: "actions",
                title: "Aksi",
                headerClassName: "w-0 whitespace-nowrap",
                cellClassName: "w-0 whitespace-nowrap",
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary px-3 py-2"
                      title="Lihat detail transaksi siswa"
                      onClick={() => setDetailStudentId(String(row.id))}
                    >
                      <Eye size={16} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={groupedRows}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Halaman {transactionPagination.page} dari {transactionPagination.total_pages} ({transactionPagination.total} siswa)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={transactionsLoading || transactionPage <= 1}
              onClick={() => setTransactionPage((page) => Math.max(1, page - 1))}
            >
              Sebelumnya
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={transactionsLoading || transactionPage >= transactionPagination.total_pages}
              onClick={() => setTransactionPage((page) => page + 1)}
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>

      <ModalFrame
        open={Boolean(detailStudentId && detailStudentRow)}
        title={
          detailStudentRow
            ? `Detail Transaksi`
            : "Detail Transaksi"
        }
        maxWidthClass="max-w-3xl"
        showIcon={false}
        onClose={() => setDetailStudentId("")}
      >
        {detailStudentRow ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">Nama Siswa</p>
                <p className="font-semibold text-slate-900">
                  {detailStudentRow.student_name}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">Kelas</p>
                <p className="font-semibold text-slate-900">
                  {detailStudentRow.class_name}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">Periode</p>
                <p className="font-semibold text-slate-900">
                  {detailStudentRow.period_label}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500">Jumlah Transaksi</p>
                <p className="font-semibold text-slate-900">
                  {detailStudentRow.transaction_count}
                </p>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {detailStudentRow.receipt_groups.map((row, index) => (
                <div key={row.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <span className="pt-0.5 text-sm font-semibold text-slate-900">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="pt-0.5 text-sm font-semibold text-slate-900">
                          {row.reference_no || "-"}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(row.total_amount_paid)}
                        </p>
                      </div>
                      <p className="text-xs text-slate-700">
                        {row.payment_channel || "-"} 
                        <span className="text-yellow-500 mx-1">|</span> 
                        {row.payment_date ? formatDate(row.payment_date) : "-"}
                      </p>
                      <div className="flex items-center gap-2 pt-1 justify-end">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          title="Lihat kuitansi"
                          onClick={() => setDetailTransaction(row)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-accent px-3 py-2"
                          title="Cetak PDF"
                          onClick={() =>
                            printTransaction({
                              referenceNo: row.reference_no,
                              studentId: row.student_id,
                              transactionId: row.transaction_ids?.[0],
                            })
                          }
                          disabled={printing}
                        >
                          <Printer size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-2"
                          title="Hapus transaksi"
                          onClick={() => removeTransactionGroup(row)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Tanggal
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Kanal
                    </th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">
                      Referensi
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-slate-700">
                      Total
                    </th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {detailStudentRow.receipt_groups.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 align-top">
                        {row.payment_date ? formatDate(row.payment_date) : "-"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.payment_channel || "-"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {row.reference_no || "-"}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {formatCurrency(row.total_amount_paid)}
                      </td>
                      <td className="px-3 py-2 align-top text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="btn-secondary px-3 py-2"
                            title="Lihat kuitansi"
                            onClick={() => setDetailTransaction(row)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-accent px-3 py-2"
                            title="Cetak PDF"
                            onClick={() =>
                              printTransaction({
                                referenceNo: row.reference_no,
                                studentId: row.student_id,
                                transactionId: row.transaction_ids?.[0],
                              })
                            }
                            disabled={printing}
                          >
                            <Printer size={16} />
                          </button>
                          <button
                            type="button"
                            className="btn-danger px-3 py-2"
                            title="Hapus transaksi"
                            onClick={() => removeTransactionGroup(row)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDetailStudentId("")}
              >
                Tutup
              </button>
            </div>
          </div>
        ) : null}
      </ModalFrame>

      <ModalFrame
        open={!!detailTransaction}
        title="Detail Transaksi Pembayaran"
        description=""
        maxWidthClass="max-w-[720px]"
        showIcon={false}
        showHeader={false}
        cardClassName="gap-2 p-3"
        onClose={() => setDetailTransaction(null)}
      >
        {detailTransaction ? (
          <>
            <div className="mx-auto w-[860px] max-w-full rounded-xl border border-slate-300 bg-white p-2.5 text-[12px] leading-tight text-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold tracking-wide text-slate-900">
                    {schoolProfile.school_name}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {schoolProfile.school_address}
                  </p>
                </div>
                <div className="border border-slate-500 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                  KUITANSI
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-1 md:grid-cols-2">
                <div className="space-y-1">
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Diterima dari
                    </span>
                    : {detailTransaction.student_name}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      NISN
                    </span>
                    : {detailTransaction.nisn || detailTransaction.nis || "-"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Kelas
                    </span>
                    : {detailTransaction.class_name || "-"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Status Pembayaran
                    </span>
                    : {getPaymentStatusLabel(
                      Array.isArray(detailTransaction.items)
                        ? detailTransaction.items.reduce(
                            (sum, item) => sum + Number(item.remaining_amount || 0),
                            0,
                          )
                        : getTransactionRemainingAmount(detailTransaction),
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Tgl. Bayar
                    </span>
                    : {formatDate(detailTransaction.payment_date)}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      No. Bukti
                    </span>
                    : {detailTransaction.reference_no || "-"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Metode
                    </span>
                    : {detailTransaction.payment_channel || "-"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Petugas
                    </span>
                    : {getOfficerPreviewName(user, detailTransaction.officer_name)}
                  </p>
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                <div>
                  <p className="mb-1 font-semibold">
                    Dengan rincian pembayaran sebagai berikut:
                  </p>
                  <div className="border-y border-slate-300 py-1.5">
                    {(
                      Array.isArray(detailTransaction.items) &&
                      detailTransaction.items.length > 0
                        ? detailTransaction.items
                        : [
                            {
                              bill_name: detailTransaction.bill_name || "-",
                              period: detailTransaction.period || "-",
                              amount: Number(detailTransaction.amount_paid || 0),
                              bill_amount: Number(detailTransaction.bill_amount ?? detailTransaction.amount ?? 0),
                              paid_amount: Number(detailTransaction.paid_amount ?? detailTransaction.amount_paid ?? 0),
                              remaining_amount: getTransactionRemainingAmount(detailTransaction),
                              is_flexible_installment: !!detailTransaction.is_flexible_installment,
                            },
                          ]
                    ).map((item, index) => (
                      <div
                        key={`${item.bill_name}-${item.period}-${index}`}
                        className="grid grid-cols-[1fr_auto] gap-2"
                      >
                        <div>
                          <p>{index + 1}. {item.bill_name} ({formatPeriod(item.period)})</p>
                          <p className="text-[11px] text-slate-500">
                            {Number(item.remaining_amount || 0) > 0
                              ? `Sisa ${formatCurrency(item.remaining_amount)}`
                              : "Tagihan lunas"}
                            {item.is_flexible_installment ? " · Fleksibel" : ""}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatCurrency(Number(item.amount || 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 border-t border-slate-300 pt-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">Jumlah</span>
                    <span>
                      {formatCurrency(
                        Number(
                          detailTransaction.total_amount_paid ??
                            detailTransaction.amount_paid ??
                            0,
                        ),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Pembayaran</span>
                    <span>
                      {formatCurrency(
                        Number(
                          detailTransaction.total_amount_paid ??
                            detailTransaction.amount_paid ??
                            0,
                        ),
                      )}
                    </span>
                  </div>
                  {Number(detailTransaction.deposit_credit_amount || 0) > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-semibold">Masuk Deposit</span>
                      <span>{formatCurrency(detailTransaction.deposit_credit_amount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-b border-slate-400 pb-1">
                    <span className="font-semibold">Kembali</span>
                    <span>Rp0</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDetailTransaction(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={printing}
                onClick={() =>
                  printTransaction({
                    referenceNo: detailTransaction.reference_no,
                    studentId: detailTransaction.student_id,
                    transactionId: detailTransaction.transaction_ids?.[0] || detailTransaction.id,
                  })
                }
              >
                <Printer size={16} />
                {printing ? "Menyiapkan..." : "Cetak (PDF)"}
              </button>
            </div>
          </>
        ) : null}
      </ModalFrame>
    </Layout>
  );
}
