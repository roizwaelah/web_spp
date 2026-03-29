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
  const [schoolProfile, setSchoolProfile] = useState({
    school_name: "MADSC PAYMENT",
    school_address: "Dokumen detail transaksi pembayaran siswa",
  });
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
        const [{ data: metaData }, { data: settingsData }] = await Promise.all([
          fetchRoute("admin/meta"),
          fetchRoute("admin/settings"),
        ]);
        setMeta({
          classes: Array.isArray(metaData?.classes) ? metaData.classes : [],
          students: Array.isArray(metaData?.students) ? metaData.students : [],
        });
        setSchoolProfile({
          school_name: (settingsData?.school_name || "MADSC PAYMENT").trim() || "MADSC PAYMENT",
          school_address:
            (settingsData?.school_address || "Dokumen detail transaksi pembayaran siswa").trim() ||
            "Dokumen detail transaksi pembayaran siswa",
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
                  <p className="text-sm font-bold tracking-wide text-slate-900">{schoolProfile.school_name}</p>
                  <p className="text-[11px] text-slate-600">{schoolProfile.school_address}</p>
                </div>
                <div className="border border-slate-500 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                  KUITANSI
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-1 md:grid-cols-2">
                <div className="space-y-1">
                  <p><span className="inline-block w-28 font-semibold">Diterima dari</span>: {detailTransaction.student_name}</p>
                  <p><span className="inline-block w-28 font-semibold">Nomor Induk</span>: {detailTransaction.nis || "-"}</p>
                  <p><span className="inline-block w-28 font-semibold">Kelas</span>: {detailTransaction.class_name || "-"}</p>
                  <p><span className="inline-block w-28 font-semibold">Status Siswa</span>: {detailTransaction.status === "paid" ? "Lunas" : detailTransaction.status}</p>
                </div>
                <div className="space-y-1">
                  <p><span className="inline-block w-28 font-semibold">Tgl. Bayar</span>: {formatDate(detailTransaction.payment_date)}</p>
                  <p><span className="inline-block w-28 font-semibold">No. Bukti</span>: {detailTransaction.reference_no || "-"}</p>
                  <p><span className="inline-block w-28 font-semibold">Metode</span>: {detailTransaction.payment_channel || "-"}</p>
                  <p><span className="inline-block w-28 font-semibold">Petugas</span>: ADMIN</p>
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                <div>
                  <p className="mb-1 font-semibold">Dengan rincian pembayaran sebagai berikut:</p>
                  <div className="grid grid-cols-[1fr_auto] gap-2 border-y border-slate-300 py-1.5">
                    <p>1. {detailTransaction.bill_name} ({detailTransaction.period || "-"})</p>
                    <p className="font-semibold">{formatCurrency(detailTransaction.amount_paid)}</p>
                  </div>
                </div>
                <div className="space-y-1 border-t border-slate-300 pt-1">
                  <div className="flex justify-between"><span className="font-semibold">Jumlah</span><span>{formatCurrency(detailTransaction.amount_paid)}</span></div>
                  <div className="flex justify-between"><span className="font-semibold">Pembayaran</span><span>{formatCurrency(detailTransaction.amount_paid)}</span></div>
                  <div className="flex justify-between border-b border-slate-400 pb-1"><span className="font-semibold">Kembali</span><span>Rp0</span></div>
                </div>
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
