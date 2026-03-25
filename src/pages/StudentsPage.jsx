import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Trash2, Upload } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";

const initialForm = {
  id: null,
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

export default function StudentsPage() {
  const [meta, setMeta] = useState({ classes: [], years: [] });
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const formCardRef = useRef(null);

  const load = async () => {
    const [metaRes, studentsRes] = await Promise.all([
      fetchRoute("admin/meta"),
      fetchRoute("admin/students"),
    ]);
    setMeta({
      classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
      years: Array.isArray(metaRes.data?.years) ? metaRes.data.years : [],
    });
    setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (form.id) {
      await fetchRoute("admin/students", { method: "PUT", data: form });
      setMessage("Siswa berhasil diperbarui");
    } else {
      await fetchRoute("admin/students", { method: "POST", data: form });
      setMessage("Siswa berhasil ditambahkan");
    }
    setForm(initialForm);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Hapus data siswa ini?")) return;
    await fetchRoute("admin/students", { method: "DELETE", data: { id } });
    setMessage("Siswa berhasil dihapus");
    load();
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
    load();
  };

  const filtered = useMemo(
    () =>
      students.filter((item) =>
        `${item.name} ${item.nis} ${item.parent_name} ${item.class_name}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [students, filter],
  );

  return (
    <Layout
      title="Manajemen Data Siswa"
      subtitle="Data lengkap siswa, edit/hapus data, relasi kelas dan tahun ajaran, serta impor Excel/CSV."
    >
      <div className="page-grid">
        <div className="card p-5" ref={formCardRef}>
          <h3 className="section-title">
            {form.id ? "Edit siswa" : "Tambah siswa"}
          </h3>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            {message && (
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {message}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">NIS</label>
                <input
                  className="input"
                  value={form.nis}
                  onChange={(e) => setForm({ ...form, nis: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Nama siswa</label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Kelas</label>
                <select
                  className="input"
                  value={form.class_id}
                  onChange={(e) =>
                    setForm({ ...form, class_id: e.target.value })
                  }
                >
                  <option value="">Pilih kelas</option>
                  {meta.classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tahun ajaran</label>
                <select
                  className="input"
                  value={form.academic_year_id}
                  onChange={(e) =>
                    setForm({ ...form, academic_year_id: e.target.value })
                  }
                >
                  <option value="">Pilih tahun ajaran</option>
                  {meta.years.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Nama orang tua / wali</label>
              <input
                className="input"
                value={form.parent_name}
                onChange={(e) =>
                  setForm({ ...form, parent_name: e.target.value })
                }
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Nomor WhatsApp</label>
                <input
                  className="input"
                  value={form.parent_phone}
                  onChange={(e) =>
                    setForm({ ...form, parent_phone: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Email akun orang tua</label>
                <input
                  className="input"
                  value={form.user_email}
                  onChange={(e) =>
                    setForm({ ...form, user_email: e.target.value })
                  }
                />
              </div>
            </div>

            {!form.id && (
              <div>
                <label className="label">Password awal akun orang tua</label>
                <input
                  className="input"
                  value={form.parent_password}
                  onChange={(e) =>
                    setForm({ ...form, parent_password: e.target.value })
                  }
                />
              </div>
            )}

            <div>
              <label className="label">Alamat</label>
              <textarea
                className="textarea"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="active">Aktif</option>
                <option value="graduated">Lulus</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button className="btn-primary flex-1">
                {form.id ? "Update siswa" : "Simpan siswa"}
              </button>
              {form.id && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setForm(initialForm)}
                >
                  Batal
                </button>
              )}
            </div>
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
              <button
                type="button"
                className="btn-secondary"
                onClick={importStudents}
              >
                Impor
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <input
              className="input"
              placeholder="Cari nama / NIS / orang tua / kelas"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
          </div>

          <Table
            columns={[
              { key: "nis", title: "NIS" },
              { key: "name", title: "Nama" },
              { key: "class_name", title: "Kelas" },
              { key: "academic_year", title: "Tahun Ajaran" },
              { key: "parent_name", title: "Wali" },
              { key: "parent_phone", title: "WA" },
              {
                key: "status",
                title: "Status",
                render: (row) => (
                  <span
                    className={
                      row.status === "active" ? "badge-green" : "badge-amber"
                    }
                  >
                    {row.status}
                  </span>
                ),
              },
              { key: "active_bills", title: "Tagihan Aktif" },
              {
                key: "actions",
                title: "Aksi",
                render: (row) => (
                  <div className="flex gap-2">
                    <button
                      className="btn-secondary px-3 py-2"
                      onClick={() =>
                        setForm({
                          id: row.id,
                          nis: row.nis,
                          name: row.name,
                          class_id: String(row.class_id),
                          academic_year_id: String(row.academic_year_id),
                          parent_name: row.parent_name,
                          parent_phone: row.parent_phone,
                          user_email: row.user_email,
                          address: row.address || "",
                          status: row.status || "active",
                          parent_password: "password",
                        })
                      }
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="btn-danger px-3 py-2"
                      onClick={() => remove(row.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filtered}
          />
        </div>
      </div>
    </Layout>
  );
}
