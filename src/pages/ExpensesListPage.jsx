import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

export default function ExpensesListPage() {
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    category: "",
    search: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const loadCategories = async () => {
    try {
      const { data } = await fetchRoute("admin/expense-categories");
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat kategori pengeluaran");
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await fetchRoute("admin/expenses", {
        params: {
          start_date: filter.start_date,
          end_date: filter.end_date,
          ...(filter.category ? { category: filter.category } : {}),
          ...(filter.search ? { search: filter.search } : {}),
        },
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat data pengeluaran");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus pengeluaran",
      description: "Data pengeluaran yang dihapus tidak bisa dipulihkan dari aplikasi.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchRoute("admin/expenses", { method: "DELETE", data: { id } });
      setMessage("Pengeluaran berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus pengeluaran");
    }
  };

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const aTime = new Date(a?.expense_date || "").getTime();
        const bTime = new Date(b?.expense_date || "").getTime();
        if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) return bTime - aTime;
        return String(b?.expense_date || "").localeCompare(String(a?.expense_date || ""), "id");
      }),
    [rows],
  );

  return (
    <Layout
      title="Pengeluaran"
      subtitle="Kelola daftar pengeluaran dan pantau biaya keluar."
      actions={
        <div className="flex w-full justify-end">
          <button
            type="button"
            className="btn-primary shrink-0 px-3"
            onClick={() => navigate("/admin/pengeluaran/edit")}
            onMouseEnter={() => prefetchRoute("/admin/pengeluaran/edit")}
            onFocus={() => prefetchRoute("/admin/pengeluaran/edit")}
            title="Tambah pengeluaran"
            aria-label="Tambah pengeluaran"
          >
            <Plus size={18} />
            <span>Tambah pengeluaran</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="card p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div>
              <label className="label">Tanggal mulai</label>
              <input type="date" className="input" value={filter.start_date} onChange={(e) => setFilter((c) => ({ ...c, start_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tanggal akhir</label>
              <input type="date" className="input" value={filter.end_date} onChange={(e) => setFilter((c) => ({ ...c, end_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={filter.category} onChange={(e) => setFilter((c) => ({ ...c, category: e.target.value }))}>
                <option value="">Semua kategori</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Pencarian</label>
              <input className="input" placeholder="Cari nama / kategori / keterangan" value={filter.search} onChange={(e) => setFilter((c) => ({ ...c, search: e.target.value }))} />
            </div>
            <div className="flex">
              <button className="btn-primary w-full md:w-auto" onClick={load}>Terapkan</button>
            </div>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {loading ? (
            <div className="card p-4 text-sm text-slate-500">Memuat data pengeluaran...</div>
          ) : sortedRows.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">Belum ada pengeluaran</div>
          ) : (
            <ol className="space-y-3">
              {sortedRows.map((row, index) => (
                <li key={row.id} className="card p-3">
                  <div className="flex items-start gap-3">
                    <span className="pt-0.5 text-sm font-semibold text-slate-500">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="pt-0.5 text-sm font-semibold text-slate-900">{row.title || "-"}</p>
                        <p className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(row.amount)}</p>
                      </div>
                      <p className="text-xs text-slate-500">{row.expense_date || "-"}</p>
                      <div className="flex items-center gap-2 pt-1 justify-end">
                        <button
                          className="btn-secondary px-3 py-2"
                          title="Ubah"
                          aria-label="Ubah"
                          onClick={() => navigate(`/admin/pengeluaran/edit/${row.id}`)}
                          onMouseEnter={() => prefetchRoute("/admin/pengeluaran/edit")}
                          onFocus={() => prefetchRoute("/admin/pengeluaran/edit")}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn-danger px-3 py-2"
                          title="Hapus"
                          aria-label="Hapus"
                          onClick={() => remove(row.id)}
                        >
                          <Trash2 size={16} />
                        </button>
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
            emptyText={loading ? "Memuat data pengeluaran..." : "Belum ada pengeluaran"}
            columns={[
              { key: "expense_date", title: "Tanggal" },
              { key: "title", title: "Nama pengeluaran" },
              { key: "category", title: "Kategori", render: (row) => row.category || "-" },
              { key: "amount", title: "Nominal", render: (row) => formatCurrency(row.amount) },
              { key: "notes", title: "Keterangan", render: (row) => row.notes || "-" },
              { key: "created_by_name", title: "Dicatat oleh", render: (row) => row.created_by_name || "-" },
              {
                key: "actions",
                title: "Aksi",
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary px-3 py-2"
                      onClick={() => navigate(`/admin/pengeluaran/edit/${row.id}`)}
                      onMouseEnter={() => prefetchRoute("/admin/pengeluaran/edit")}
                      onFocus={() => prefetchRoute("/admin/pengeluaran/edit")}
                    >
                      <Pencil size={16} />
                    </button>
                    <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={sortedRows}
          />
        </div>
      </div>
    </Layout>
  );
}
