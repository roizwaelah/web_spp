import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";

const initialForm = {
  id: null,
  name: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

export default function AcademicEditPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();

  const selectedAcademicYear = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );

  const load = () =>
    fetchRoute("admin/academic-years")
      .then(({ data }) => {
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat tahun ajaran");
      });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedAcademicYear) {
      setForm(initialForm);
      return;
    }

    setForm({
      id: selectedAcademicYear.id,
      name: selectedAcademicYear.name || "",
      start_date: selectedAcademicYear.start_date || "",
      end_date: selectedAcademicYear.end_date || "",
      is_active: !!selectedAcademicYear.is_active,
    });
  }, [id, selectedAcademicYear]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await fetchRoute("admin/academic-years", { method: "PUT", data: form });
        setMessage("Tahun ajaran berhasil diperbarui");
      } else {
        await fetchRoute("admin/academic-years", { method: "POST", data: form });
        setMessage("Tahun ajaran berhasil ditambahkan");
        setForm(initialForm);
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan tahun ajaran");
    }
  };

  return (
    <Layout
      title="Tambah/Edit Tahun Ajaran"
      subtitle="Form tambah atau edit data tahun ajaran."
      actions={
        <button
          className="btn-secondary"
          onClick={() => navigate("/admin/tahun-ajaran/list")}
        >
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">
          {form.id ? "Edit tahun ajaran" : "Tambah tahun ajaran"}
        </h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {message && (
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {message}
            </div>
          )}
          <div>
            <label className="label">Nama tahun ajaran</label>
            <input
              className="input"
              placeholder="2026/2027"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Tanggal mulai</label>
              <input
                type="date"
                className="input"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Tanggal selesai</label>
              <input
                type="date"
                className="input"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Jadikan tahun ajaran aktif
          </label>
          <div className="flex gap-3">
            <button className="btn-primary flex-1">
              {form.id ? "Update tahun ajaran" : "Simpan tahun ajaran"}
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
