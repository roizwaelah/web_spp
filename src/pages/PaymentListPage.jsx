import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Printer, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import { useUI } from "../context/UIContext";
import ModalFrame from "../components/ModalFrame";

export default function PaymentListPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [billRows, setBillRows] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({ class_id: "", student_id: "" });
  const [detailTransaction, setDetailTransaction] = useState(null);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const navigate = useNavigate();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const { data } = await fetchRoute("admin/meta");
        setMeta({
          classes: Array.isArray(data?.classes) ? data.classes : [],
          students: Array.isArray(data?.students) ? data.students : [],
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat metadata pembayaran",
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
            status: "unpaid",
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        });
        setBillRows(Array.isArray(data) ? data : []);
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat daftar tagihan belum lunas",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [filters.class_id, filters.student_id]);

  useEffect(() => {
    const loadTransactions = async () => {
      setTransactionsLoading(true);
      try {
        const { data } = await fetchRoute("admin/transactions", {
          params: {
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        });
        setTransactions(Array.isArray(data) ? data : []);
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat transaksi pembayaran",
        });
      } finally {
        setTransactionsLoading(false);
      }
    };

    loadTransactions();
  }, [filters.class_id, filters.student_id]);

  const studentOptions = useMemo(() => {
    const rows = meta.students.filter((item) => {
      if (!filters.class_id) return true;
      const hasBill = billRows.some((row) => String(row.student_id) === String(item.id));
      const hasTransaction = transactions.some((row) => String(row.student_id) === String(item.id));
      return hasBill || hasTransaction;
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [billRows, filters.class_id, meta.students, transactions]);

  const removeTransaction = async (transaction) => {
    const confirmed = await confirm({
      title: "Hapus transaksi",
      description: "Transaksi yang dihapus akan membatalkan status lunas tagihan jika tidak ada pembayaran lain untuk tagihan tersebut.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchRoute("admin/transactions", {
        method: "DELETE",
        data: { id: transaction.id },
      });
      setMessage({
        type: "success",
        text: "Transaksi berhasil dihapus",
      });

      const [{ data: rows }, { data: txRows }] = await Promise.all([
        fetchRoute("admin/bills", {
          params: {
            status: "unpaid",
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        }),
        fetchRoute("admin/transactions", {
          params: {
            ...(filters.class_id ? { class_id: filters.class_id } : {}),
            ...(filters.student_id ? { student_id: filters.student_id } : {}),
          },
        }),
      ]);
      setBillRows(Array.isArray(rows) ? rows : []);
      setTransactions(Array.isArray(txRows) ? txRows : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menghapus transaksi",
      });
    }
  };

  const printTransaction = async (transactionId) => {
    try {
      setPrinting(true);
      const { data } = await fetchRoute("admin/transactions/receipt", {
        method: "GET",
        params: { transaction_id: transactionId },
        responseType: "text",
        transformResponse: [(value) => value],
      });

      const printWindow = window.open("", "_blank", "width=900,height=720");
      if (!printWindow) {
        setMessage({
          type: "error",
          text: "Popup diblokir browser. Izinkan popup untuk mencetak bukti pembayaran.",
        });
        return;
      }

      printWindow.document.open();
      printWindow.document.write(data);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
      }, 400);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal mencetak bukti pembayaran",
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Layout
      title="Pembayaran"
      subtitle="Filter transaksi pembayaran dan pantau tagihan siswa yang masih belum lunas."
      actions={
        <button
          className="btn-primary"
          onClick={() =>
            navigate("/admin/pembayaran/edit", {
              state: {
                class_id: filters.class_id,
                student_id: filters.student_id,
              },
            })
          }
        >
          <Plus size={18} /> Input pembayaran
        </button>
      }
    >
      <div className="card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Filter kelas</label>
            <select
              className="input"
              value={filters.class_id}
              onChange={(e) =>
                setFilters((current) => ({
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
            <label className="label">Filter siswa</label>
            <select
              className="input"
              value={filters.student_id}
              disabled={studentOptions.length === 0}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  student_id: e.target.value,
                }))
              }
            >
              <option value="">{studentOptions.length === 0 ? "Tidak ada siswa" : "Semua siswa"}</option>
              {studentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.nis}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="section-title">Transaksi pembayaran</h3>
            <p className="text-sm text-slate-500">Riwayat transaksi berdasarkan filter kelas dan siswa yang sedang dipilih.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            Tagihan belum lunas: <span className="font-semibold text-slate-900">{loading ? "..." : billRows.length}</span>
          </div>
        </div>

        <Table
          striped
          emptyText={transactionsLoading ? "Memuat transaksi..." : "Belum ada transaksi pembayaran"}
          columns={[
            { key: "payment_date", title: "Tanggal", render: (row) => formatDate(row.payment_date) },
            { key: "student_name", title: "Siswa", render: (row) => `${row.student_name} - ${row.class_name || "-"}` },
            { key: "bill_name", title: "Tagihan", render: (row) => `${row.bill_name} (${row.period || "-"})` },
            { key: "payment_channel", title: "Kanal" },
            { key: "amount_paid", title: "Nominal", render: (row) => formatCurrency(row.amount_paid) },
            { key: "reference_no", title: "Referensi", render: (row) => row.reference_no || "-" },
            {
              key: "actions",
              title: "Aksi",
              headerClassName: "w-0 whitespace-nowrap",
              cellClassName: "w-0 whitespace-nowrap",
              render: (row) => (
                <div className="flex gap-2">
                  <button className="btn-accent px-3 py-2" onClick={() => setDetailTransaction(row)}>
                    <Eye size={16} />
                  </button>
                  <button className="btn-danger px-3 py-2" onClick={() => removeTransaction(row)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={transactions}
        />
      </div>

      <ModalFrame
        open={!!detailTransaction}
        title="Detail Transaksi Pembayaran"
        description="Periksa rincian transaksi sebelum mencetak bukti pembayaran."
        maxWidthClass="max-w-2xl"
        onClose={() => setDetailTransaction(null)}
      >
        {detailTransaction ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Siswa</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detailTransaction.student_name}</p>
                <p className="mt-1 text-sm text-slate-600">NIS: {detailTransaction.nis || "-"}</p>
                <p className="text-sm text-slate-600">Kelas: {detailTransaction.class_name || "-"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tagihan</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detailTransaction.bill_name}</p>
                <p className="mt-1 text-sm text-slate-600">Periode: {detailTransaction.period || "-"}</p>
                <p className="text-sm text-slate-600">Status: {detailTransaction.status === "paid" ? "Lunas" : detailTransaction.status}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kanal</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detailTransaction.payment_channel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(detailTransaction.payment_date)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Referensi</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{detailTransaction.reference_no || "-"}</p>
              </div>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Total Dibayar</p>
                <p className="mt-1 text-2xl font-bold text-sky-900">{formatCurrency(detailTransaction.amount_paid)}</p>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setDetailTransaction(null)}>
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={printing}
                onClick={() => printTransaction(detailTransaction.id)}
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
