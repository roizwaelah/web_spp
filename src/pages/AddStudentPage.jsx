import { useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";

const initialForm = {
  nis: "",
  name: "",
  class_id: "",
  academic_year_id: "",
  parent_name: "",
  parent_phone: "",
  user_email: "",
  address: "",
  status: "active",
  parent_password: "password",
};

export default function AddStudentPage() {
  const [meta, setMeta] = useState({ classes: [], years: [] });
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadMeta = async () => {
      const metaRes = await fetchRoute("admin/meta");
      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
        years: Array.isArray(metaRes.data?.years) ? metaRes.data.years : [],
      });
    };
    loadMeta();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await fetchRoute("admin/students", { method: "POST", data: form });
    setMessage("Siswa berhasil ditambahkan");
    setForm(initialForm);
  };

  const importStudents = async () => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    await fetchRoute("admin/students/import", {
      method: "POST",
      data,
      headers: { "Content-Type": "multipart/form-data" },
    });
    setMessage("Impor data berhasil");
  };

  return (
    <Layout
      title="Tambah Siswa"
      subtitle="Halaman parent untuk menambahkan data siswa baru sebelum masuk ke Data Siswa."
      actions={
        <button className="btn-secondary" onClick={() => navigate("/admin/siswa")}>
          Lihat Data Siswa
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">Form tambah siswa</h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {message && (
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {message}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">NIS</label>
              <input className="input" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} />
            </div>
            <div>
              <label className="label">Nama siswa</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Kelas</label>
              <select className="input" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">Pilih kelas</option>
                {meta.classes.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Tahun ajaran</label>
              <select className="input" value={form.academic_year_id} onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}>
                <option value="">Pilih tahun ajaran</option>
                {meta.years.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Nama orang tua / wali</label>
            <input className="input" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nomor WhatsApp</label>
              <input className="input" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Email akun orang tua</label>
              <input className="input" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Password awal akun orang tua</label>
            <input className="input" value={form.parent_password} onChange={(e) => setForm({ ...form, parent_password: e.target.value })} />
          </div>

          <div>
            <label className="label">Alamat</label>
            <textarea className="textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>

          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="active">Aktif</option>
              <option value="graduated">Lulus</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          <button className="btn-primary w-full">Simpan siswa</button>
        </form>

        <div className="mt-6 rounded-3xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            <Upload size={18} /> Impor Excel / CSV
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="file"
              className="input"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <button type="button" className="btn-secondary" onClick={importStudents}>
              Impor
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
