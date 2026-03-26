import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
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

export default function ExpensesEditPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useToastMessage(message, setMessage);

  const selectedExpense = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );

  const load = async () => {
    try {
      const { data } = await fetchRoute("admin/expenses");
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat data pengeluaran");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedExpense) {
      setForm(initialForm);
      return;
    }

    setForm({
      id: selectedExpense.id,
      expense_date: selectedExpense.expense_date || initialForm.expense_date,
      title: selectedExpense.title || "",
      category: selectedExpense.category || expenseCategories[0],
      amount: selectedExpense.amount || "",
      notes: selectedExpense.notes || "",
    });
  }, [id, selectedExpense]);

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
        setForm(initialForm);
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan pengeluaran");
    } finally {
      setSaving(false);
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
    </Layout>
  );
}
