import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useToastMessage } from "../hooks/useToastMessage";

const initialForm = {
  id: null,
  nis: "",
  nisn: "",
  name: "",
  class_id: "",
  academic_year_id: "",
  parent_name: "",
  parent_phone: "",
  address: "",
  status: "active",
};

export default function StudentEditPage() {
  const [meta, setMeta] = useState({ classes: [], years: [] });
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { id } = useParams();

  useToastMessage(message, setMessage);

  const selectedStudent = useMemo(
    () => students.find((item) => String(item.id) === String(id)),
    [students, id],
  );

  const load = async () => {
    try {
      const [metaRes, studentsRes] = await Promise.all([
        fetchRoute("admin/meta"),
        fetchRoute("admin/students"),
      ]);

      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
        years: Array.isArray(metaRes.data?.years) ? metaRes.data.years : [],
      });
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat form siswa");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedStudent) {
      setForm(initialForm);
      return;
    }

    setForm({
      id: selectedStudent.id,
      nis: selectedStudent.nis,
      nisn: selectedStudent.nisn || "",
      name: selectedStudent.name,
      class_id: String(selectedStudent.class_id),
      academic_year_id: String(selectedStudent.academic_year_id),
      parent_name: selectedStudent.parent_name,
      parent_phone: selectedStudent.parent_phone,
      address: selectedStudent.address || "",
      status: selectedStudent.status || "active",
    });
  }, [id, selectedStudent]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await fetchRoute("admin/students", { method: "PUT", data: form });
        setMessage("Siswa berhasil diperbarui");
      } else {
        await fetchRoute("admin/students", { method: "POST", data: form });
        setMessage("Siswa berhasil ditambahkan");
        setForm(initialForm);
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan data siswa");
    }
  };

  return (
    <Layout
      title="Tambah/Edit Siswa"
      subtitle="Form tambah atau edit data siswa."
      actions={
        <button className="btn-accent" onClick={() => navigate("/admin/siswa/list")}>
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">{form.id ? "Edit siswa" : "Tambah siswa"}</h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">NIS</label>
              <input className="input" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} />
            </div>
            <div>
              <label className="label">NISN</label>
              <input className="input" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Nama siswa</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Nomor WhatsApp</label>
              <input className="input" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })} />
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

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Akun orang tua dibuat otomatis saat siswa disimpan. Login orang tua menggunakan NISN tanpa password.
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

          <div className="flex gap-3">
            <button className="btn-primary flex-1">{form.id ? "Update siswa" : "Simpan siswa"}</button>
            <button type="button" className="btn-secondary" onClick={() => setForm(initialForm)}>Reset</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
