import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
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

const initialForm = {
  id: null,
  expense_date: new Date().toISOString().slice(0, 10),
  title: "",
  category: expenseCategories[0],
  amount: "",
  notes: "",
};

export default function ExpensesPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [filter, setFilter] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    category: "",
    search: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const payload = { ...form, amount: Number(form.amount || 0) };
      if (form.id) {
        await fetchRoute("admin/expenses", { method: "PUT", data: payload });
        setMessage("Pengeluaran berhasil diperbarui");
      } else {
        await fetchRoute("admin/expenses", { method: "POST", data: payload });
        setMessage("Pengeluaran berhasil ditambahkan");
      }
      setForm(initialForm);
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan pengeluaran");
    } finally {
      setSaving(false);
    }
  };

  const editRow = (row) => {
    setForm({
      id: row.id,
      expense_date: row.expense_date || initialForm.expense_date,
      title: row.title || "",
      category: row.category || "",
      amount: row.amount || "",
      notes: row.notes || "",
    });
  };

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
      if (String(form.id) === String(id)) setForm(initialForm);
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus pengeluaran");
    }
  };

  return (
    <Layout
      title="Pengeluaran"
      subtitle="Catat pengeluaran operasional dan pantau total biaya keluar dalam periode tertentu."
      actions={
        <button className="btn-primary" onClick={() => setForm(initialForm)}>
          <Plus size={18} /> Pengeluaran baru
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-5">
          <div className="mb-4">
            <div>
              <h3 className="section-title">{form.id ? "Edit pengeluaran" : "Tambah pengeluaran"}</h3>
              <p className="text-sm text-slate-500">Isi detail pengeluaran operasional yang ingin dicatat.</p>
            </div>
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <div>
              <label className="label">Tanggal</label>
              <input type="date" className="input" value={form.expense_date} onChange={(e) => setForm((c) => ({ ...c, expense_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Kategori</label>
              <select className="input" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Nama pengeluaran</label>
              <input className="input" placeholder="Misalnya Pembelian kertas ujian" value={form.title} onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nominal</label>
              <input type="number" min="0" className="input" placeholder="0" value={form.amount} onChange={(e) => setForm((c) => ({ ...c, amount: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Keterangan</label>
              <textarea className="textarea" placeholder="Opsional" value={form.notes} onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))} />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <button className="btn-primary flex-1" disabled={saving}>
                {saving ? "Menyimpan..." : form.id ? "Update pengeluaran" : "Simpan pengeluaran"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setForm(initialForm)}>
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="card p-4">
          <div className="grid gap-4 md:grid-cols-4">
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
          </div>
          <div className="mt-4 flex gap-3">
            <button className="btn-primary" onClick={load}>Terapkan</button>
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
                  <button className="btn-secondary px-3 py-2" onClick={() => editRow(row)}>
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
