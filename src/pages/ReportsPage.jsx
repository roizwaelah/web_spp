import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ReportsPage() {
  const [filter, setFilter] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    type: "",
    status: "",
    class_id: "",
    student_id: "",
  });
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ classes: [] });
  const [studentSourceRows, setStudentSourceRows] = useState([]);
  const [summary, setSummary] = useState({ count: 0, totalIncome: 0, totalExpense: 0, net: 0, successful: 0, pending: 0 });
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  useToastMessage(message, setMessage);

  const load = async () => {
    try {
      const [metaRes, studentRowsRes, reportsRes] = await Promise.all([
        fetchRoute("admin/meta"),
        fetchRoute("admin/reports", {
          params: {
            start_date: filter.start_date,
            end_date: filter.end_date,
            ...(filter.type ? { type: filter.type } : {}),
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.class_id ? { class_id: filter.class_id } : {}),
          },
        }),
        fetchRoute("admin/reports", {
          params: {
            start_date: filter.start_date,
            end_date: filter.end_date,
            ...(filter.type ? { type: filter.type } : {}),
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.class_id ? { class_id: filter.class_id } : {}),
            ...(filter.student_id ? { student_id: filter.student_id } : {}),
          },
        }),
      ]);

      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
      });
      setStudentSourceRows(Array.isArray(studentRowsRes.data?.rows) ? studentRowsRes.data.rows : []);
      setRows(Array.isArray(reportsRes.data?.rows) ? reportsRes.data.rows : []);
      setSummary(reportsRes.data?.summary || { count: 0, totalIncome: 0, totalExpense: 0, net: 0, successful: 0, pending: 0 });
      setMessage("");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat laporan");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const studentOptions = useMemo(() => {
    const studentMap = new Map();
    for (const row of studentSourceRows) {
      if (!row?.student_id) continue;
      if (!studentMap.has(String(row.student_id))) {
        studentMap.set(String(row.student_id), {
          id: String(row.student_id),
          name: row.student_name || "",
        });
      }
    }
    return Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [studentSourceRows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.report_type || ""} ${row.report_date || ""} ${row.student_name || ""} ${row.class_name || ""} ${row.item_name || ""} ${row.category || ""} ${row.payment_channel || ""} ${row.reference_no || ""} ${row.status || ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [rows, search],
  );

  const exportReport = async () => {
    try {
      const response = await fetchRoute("admin/reports/export", {
        method: "GET",
        params: {
          start_date: filter.start_date,
          end_date: filter.end_date,
          ...(filter.type ? { type: filter.type } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.class_id ? { class_id: filter.class_id } : {}),
          ...(filter.student_id ? { student_id: filter.student_id } : {}),
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "laporan-keuangan.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setMessage("");
    } catch (error) {
      const fallbackMessage =
        error?.response?.status === 401
          ? "Export gagal karena sesi login tidak valid. Silakan login ulang."
          : "Gagal export laporan";
      setMessage(error?.response?.data?.message || fallbackMessage);
    }
  };

  return (
    <Layout
      title="Laporan Keuangan Real-Time"
      subtitle="Filter pemasukan dan pengeluaran, lalu unduh hasilnya dalam format CSV."
    >
      <div className="space-y-4">
        <div className="card p-4">
          <div className="grid gap-4 xl:grid-cols-1">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label">Pencarian</label>
                <input
                  className="input"
                  placeholder="Cari tanggal / siswa / kelas / tagihan / kanal / referensi / status"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Tanggal mulai</label>
                <input
                  type="date"
                  className="input"
                  value={filter.start_date}
                  onChange={(e) => setFilter({ ...filter, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tanggal akhir</label>
                <input
                  type="date"
                  className="input"
                  value={filter.end_date}
                  onChange={(e) => setFilter({ ...filter, end_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Tipe</label>
                <select
                  className="input"
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value, status: "", class_id: "", student_id: "" })}
                >
                  <option value="">Semua data</option>
                  <option value="income">Pemasukan</option>
                  <option value="expense">Pengeluaran</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select
                  className="input"
                  value={filter.status}
                  disabled={filter.type === "expense"}
                  onChange={(e) => setFilter({ ...filter, status: e.target.value, student_id: "" })}
                >
                  <option value="">Semua status</option>
                  <option value="paid">Lunas</option>
                  <option value="pending">Menunggu</option>
                  <option value="failed">Gagal</option>
                </select>
              </div>
              <div>
                <label className="label">Kelas</label>
                <select
                  className="input"
                  value={filter.class_id}
                  disabled={filter.type === "expense"}
                  onChange={(e) => setFilter({ ...filter, class_id: e.target.value, student_id: "" })}
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
                <label className="label">Siswa</label>
                <select
                  className="input"
                  value={filter.student_id}
                  disabled={filter.type === "expense" || studentOptions.length === 0}
                  onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}
                >
                  <option value="">{studentOptions.length === 0 ? "Tidak ada siswa" : "Semua siswa"}</option>
                  {studentOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Data</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.count || 0}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Pemasukan</div>
                <div className="mt-1 text-lg font-semibold text-emerald-700">{formatCurrency(summary.totalIncome || 0)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Pengeluaran</div>
                <div className="mt-1 text-lg font-semibold text-rose-700">{formatCurrency(summary.totalExpense || 0)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Saldo</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{formatCurrency(summary.net || 0)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">Lunas / Pending</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{summary.successful || 0} / {summary.pending || 0}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary" onClick={load}>
                Terapkan
              </button>
              <button className="btn-secondary justify-center" onClick={exportReport}>
                <Download size={18} /> Export
              </button>
            </div>
          </div>
        </div>
        <Table
          columns={[
            {
              key: "report_type",
              title: "Tipe",
              render: (row) => (
                <span className={row.report_type === "income" ? "badge-green" : "badge-red"}>
                  {row.report_type === "income" ? "Pemasukan" : "Pengeluaran"}
                </span>
              ),
            },
            { key: "report_date", title: "Tanggal" },
            { key: "student_name", title: "Siswa" },
            { key: "class_name", title: "Kelas" },
            { key: "item_name", title: "Item" },
            { key: "category", title: "Kategori", render: (row) => row.category || "-" },
            { key: "payment_channel", title: "Kanal" },
            { key: "amount", title: "Nominal", render: (row) => formatCurrency(row.amount) },
            { key: "reference_no", title: "Referensi" },
            {
              key: "status",
              title: "Status",
              render: (row) => (
                <span
                  className={
                    row.status === "paid"
                      ? "badge-green"
                      : row.status === "pending"
                        ? "badge-amber"
                        : row.status === "recorded"
                          ? "badge-slate"
                          : "badge-red"
                  }
                >
                  {row.status === "paid" ? "Lunas" : row.status === "pending" ? "Menunggu" : row.status === "recorded" ? "Tercatat" : "Gagal"}
                </span>
              ),
            },
          ]}
          rows={filteredRows}
        />
      </div>
    </Layout>
  );
}
