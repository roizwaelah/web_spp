import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

const expenseCategories = [
  "Operasional",
  "ATK",
  "Transport",
  "Konsumsi",
  "Perawatan",
  "Utilitas",
  "Honorarium",
  "Kegiatan",
  "Lainnya",
];

export default function ExpensesListPage() {
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

  return (
    <Layout
      title="Pengeluaran"
      subtitle="Kelola daftar pengeluaran operasional dan pantau biaya keluar dalam periode tertentu."
      actions={
        <button className="btn-primary" onClick={() => navigate("/admin/pengeluaran/edit")}>
          <Plus size={18} /> Tambah pengeluaran
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-4">
          <div className="grid gap-4 md:grid-cols-5 md:items-end">
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
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
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
                  <button className="btn-secondary px-3 py-2" onClick={() => navigate(`/admin/pengeluaran/edit/${row.id}`)}>
                    <Pencil size={16} />
                  </button>
                  <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      </div>
    </Layout>
  );
}
