import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Settings2, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useToastMessage } from "../hooks/useToastMessage";
import ModalFrame from "../components/ModalFrame";
import { useUI } from "../context/UIContext";

const initialForm = {
  id: null,
  expense_date: new Date().toISOString().slice(0, 10),
  title: "",
  category: "",
  amount: "",
  notes: "",
};

export default function ExpensesEditPage() {
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, name: "" });
  const [categorySaving, setCategorySaving] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const selectedExpense = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );

  const load = async () => {
    try {
      const [rowsRes, categoriesRes] = await Promise.all([
        fetchRoute("admin/expenses"),
        fetchRoute("admin/expense-categories"),
      ]);

      const listRows = Array.isArray(rowsRes.data) ? rowsRes.data : [];
      const listCategories = Array.isArray(categoriesRes.data) ? categoriesRes.data : [];
      setRows(listRows);
      setCategories(listCategories);
      setForm((current) => {
        if (current.category && listCategories.some((item) => item.name === current.category)) {
          return current;
        }
        return {
          ...current,
          category: listCategories[0]?.name || "",
        };
      });
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat data pengeluaran");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedExpense) {
      setForm((current) => ({
        ...initialForm,
        category: categories[0]?.name || current.category || "",
      }));
      return;
    }

    setForm({
      id: selectedExpense.id,
      expense_date: selectedExpense.expense_date || initialForm.expense_date,
      title: selectedExpense.title || "",
      category: selectedExpense.category || categories[0]?.name || "",
      amount: selectedExpense.amount || "",
      notes: selectedExpense.notes || "",
    });
  }, [categories, id, selectedExpense]);

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
        setForm((current) => ({
          ...initialForm,
          category: categories[0]?.name || current.category || "",
        }));
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan pengeluaran");
    } finally {
      setSaving(false);
    }
  };

  const submitCategory = async (event) => {
    event.preventDefault();
    try {
      setCategorySaving(true);
      if (categoryForm.id) {
        await fetchRoute("admin/expense-categories", {
          method: "PUT",
          data: { id: categoryForm.id, name: categoryForm.name },
        });
        setMessage("Kategori berhasil diperbarui");
      } else {
        await fetchRoute("admin/expense-categories", {
          method: "POST",
          data: { name: categoryForm.name },
        });
        setMessage("Kategori berhasil ditambahkan");
      }
      setCategoryForm({ id: null, name: "" });
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan kategori");
    } finally {
      setCategorySaving(false);
    }
  };

  const removeCategory = async (categoryRow) => {
    const confirmed = await confirm({
      title: "Hapus kategori",
      description: "Kategori yang sudah dipakai data pengeluaran tidak bisa dihapus.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchRoute("admin/expense-categories", {
        method: "DELETE",
        data: { id: categoryRow.id },
      });
      setMessage("Kategori berhasil dihapus");
      if (String(categoryForm.id) === String(categoryRow.id)) {
        setCategoryForm({ id: null, name: "" });
      }
      await load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus kategori");
    }
  };

  return (
    <Layout
      title="Tambah/Edit Pengeluaran"
      subtitle="Form tambah atau edit data pengeluaran operasional."
      actions={
        <button className="btn-accent" onClick={() => navigate("/admin/pengeluaran/list")}>
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">{form.id ? "Edit pengeluaran" : "Tambah pengeluaran"}</h3>

        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={submit}>
          <div>
            <label className="label">Tanggal</label>
            <input type="date" className="input" value={form.expense_date} onChange={(e) => setForm((c) => ({ ...c, expense_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">Kategori</label>
            <div className="flex gap-2">
              <select className="input" value={form.category} onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}>
                {categories.map((category) => (
                  <option key={category.id} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary whitespace-nowrap"
                onClick={() => setCategoryDialogOpen(true)}
              >
                <Settings2 size={16} />
                Kelola Kategori
              </button>
            </div>
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
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setForm((current) => ({
                  ...initialForm,
                  category: categories[0]?.name || current.category || "",
                }))
              }
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      <ModalFrame
        open={categoryDialogOpen}
        title="Kelola Kategori Pengeluaran"
        description="Tambah, edit, atau hapus kategori yang dipakai di form pengeluaran."
        maxWidthClass="max-w-2xl"
        onClose={() => {
          setCategoryDialogOpen(false);
          setCategoryForm({ id: null, name: "" });
        }}
      >
        <form className="space-y-4" onSubmit={submitCategory}>
          <div>
            <label className="label">{categoryForm.id ? "Edit kategori" : "Tambah kategori baru"}</label>
            <div className="flex gap-2">
              <input
                className="input"
                value={categoryForm.name}
                placeholder="Nama kategori"
                onChange={(e) => setCategoryForm((current) => ({ ...current, name: e.target.value }))}
              />
              <button className="btn-primary whitespace-nowrap" disabled={categorySaving}>
                {categorySaving ? "Menyimpan..." : categoryForm.id ? "Update" : "Tambah"}
              </button>
              {categoryForm.id ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCategoryForm({ id: null, name: "" })}
                >
                  Batal Edit
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-black">Kategori</th>
                  <th className="w-0 px-3 py-2 text-left font-semibold text-black">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-2"
                          onClick={() => setCategoryForm({ id: item.id, name: item.name })}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-danger px-3 py-2"
                          onClick={() => removeCategory(item)}
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
              onClick={() => {
                setCategoryDialogOpen(false);
                setCategoryForm({ id: null, name: "" });
              }}
            >
              Selesai
            </button>
          </div>
        </form>
      </ModalFrame>
    </Layout>
  );
}
