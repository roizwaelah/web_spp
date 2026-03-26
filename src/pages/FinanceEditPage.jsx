import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useToastMessage } from "../hooks/useToastMessage";

const initialForm = {
  id: null,
  name: "",
  description: "",
  amount: "",
  applies_to: "class",
  class_id: "",
  student_id: "",
  billing_type: "monthly",
  is_active: true,
};

export default function FinanceEditPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();

  useToastMessage(message, setMessage);

  const selectedPost = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );

  const load = async () => {
    try {
      const [metaRes, rowsRes] = await Promise.all([
        fetchRoute("admin/meta"),
        fetchRoute("admin/finance-posts"),
      ]);

      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
        students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
      });
      setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat pos keuangan");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedPost) {
      setForm(initialForm);
      return;
    }

    setForm({
      id: selectedPost.id,
      name: selectedPost.name || "",
      description: selectedPost.description || "",
      amount: selectedPost.amount,
      applies_to: selectedPost.applies_to,
      class_id: selectedPost.class_id ? String(selectedPost.class_id) : "",
      student_id: selectedPost.student_id ? String(selectedPost.student_id) : "",
      billing_type: selectedPost.billing_type,
      is_active: !!selectedPost.is_active,
    });
  }, [id, selectedPost]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await fetchRoute("admin/finance-posts", { method: "PUT", data: form });
        setMessage("Pos keuangan berhasil diperbarui");
      } else {
        await fetchRoute("admin/finance-posts", { method: "POST", data: form });
        setMessage("Pos keuangan berhasil ditambahkan");
        setForm(initialForm);
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan pos keuangan");
    }
  };

  const targetLabel = form.applies_to === "class" ? "kelas" : "siswa";

  return (
    <Layout
      title="Tambah/Edit Pos Keuangan"
      subtitle="Form tambah atau edit pos keuangan per kelas maupun per siswa."
      actions={
        <button
          className="btn-accent"
          onClick={() => navigate("/admin/pos-keuangan/list")}
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">
          {form.id ? "Edit pos keuangan" : "Tambah pos keuangan"}
        </h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          <div>
            <label className="label">Nama pos</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea
              className="textarea"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nominal</label>
            <input
              type="number"
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Berlaku untuk</label>
              <select
                className="input"
                value={form.applies_to}
                onChange={(e) =>
                  setForm({
                    ...form,
                    applies_to: e.target.value,
                    class_id: "",
                    student_id: "",
                  })
                }
              >
                <option value="class">Per kelas</option>
                <option value="student">Per siswa</option>
              </select>
            </div>
            <div>
              <label className="label">Jenis tagihan</label>
              <select
                className="input"
                value={form.billing_type}
                onChange={(e) => setForm({ ...form, billing_type: e.target.value })}
              >
                <option value="monthly">Bulanan</option>
                <option value="one_time">Sekali bayar</option>
              </select>
            </div>
          </div>

          {form.applies_to === "class" ? (
            <div>
              <label className="label">Target {targetLabel}</label>
              <select
                className="input"
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Pilih kelas</option>
                {meta.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Target {targetLabel}</label>
              <select
                className="input"
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              >
                <option value="">Pilih siswa</option>
                {meta.students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} • {item.nis}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Pos keuangan aktif
          </label>

          <div className="flex gap-3">
            <button className="btn-primary flex-1">
              {form.id ? "Update pos" : "Simpan pos"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setForm(initialForm)}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
