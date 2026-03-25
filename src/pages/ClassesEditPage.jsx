import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";

const initialForm = { id: null, name: "", grade_level: "", is_active: true };

export default function ClassesEditPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();

  const selectedClass = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );

  const load = () =>
    fetchRoute("admin/classes").then(({ data }) =>
      setRows(Array.isArray(data) ? data : []),
    );

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedClass) {
      setForm(initialForm);
      return;
    }

    setForm({
      id: selectedClass.id,
      name: selectedClass.name || "",
      grade_level: selectedClass.grade_level || "",
      is_active: !!selectedClass.is_active,
    });
  }, [id, selectedClass]);

  const submit = async (e) => {
    e.preventDefault();
    if (form.id) {
      await fetchRoute("admin/classes", { method: "PUT", data: form });
      setMessage("Kelas diperbarui");
    } else {
      await fetchRoute("admin/classes", { method: "POST", data: form });
      setMessage("Kelas ditambahkan");
      setForm(initialForm);
    }
  };

  return (
    <Layout
      title="Tambah/Edit Kelas"
      subtitle="Form tambah atau edit data kelas."
      actions={
        <button
          className="btn-secondary"
          onClick={() => navigate("/admin/kelas/list")}
        >
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">{form.id ? "Edit kelas" : "Tambah kelas"}</h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {message && (
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {message}
            </div>
          )}
          <div>
            <label className="label">Nama kelas</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Jenjang / level</label>
            <input
              className="input"
              value={form.grade_level}
              onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Kelas aktif
          </label>
          <div className="flex gap-3">
            <button className="btn-primary flex-1">
              {form.id ? "Update kelas" : "Simpan kelas"}
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
