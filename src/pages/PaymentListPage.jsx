import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import { useUI } from "../context/UIContext";

export default function PaymentListPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [billRows, setBillRows] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [filters, setFilters] = useState({ class_id: "", student_id: "" });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
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
                <button className="btn-danger px-3 py-2" onClick={() => removeTransaction(row)}>
                  <Trash2 size={16} />
                </button>
              ),
            },
          ]}
          rows={transactions}
        />
      </div>
    </Layout>
  );
}
