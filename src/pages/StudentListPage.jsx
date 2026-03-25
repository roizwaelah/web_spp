import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";

export default function StudentListPage() {
  const [students, setStudents] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const studentsRes = await fetchRoute("admin/students");
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat data siswa");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    if (!confirm("Hapus data siswa ini?")) return;
    try {
      await fetchRoute("admin/students", { method: "DELETE", data: { id } });
      setMessage("Siswa berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus siswa");
    }
  };

  const importStudents = async () => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    try {
      await fetchRoute("admin/students/import", {
        method: "POST",
        data,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage("Impor data berhasil");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal impor data siswa");
    }
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
      title="Data Siswa"
      subtitle="Daftar lengkap siswa, pencarian cepat, impor data, dan aksi edit/hapus."
      actions={
        <button className="btn-primary" onClick={() => navigate("/admin/siswa/edit")}> 
          <Plus size={18} /> Tambah Siswa
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-3 flex flex-col md:flex-row md:items-end gap-4">
          {message && (
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700 md:max-w-xs">
              {message}
            </div>
          )}

          {/* Tambahkan md:flex, md:items-end, dan gap di sini */}
          <div className="flex-1 flex flex-col md:flex-row md:items-end gap-4">
            <div className="flex-1">
              <label className="label">Pencarian</label>
              <input
                className="input w-full"
                placeholder="Cari nama / NIS / orang tua / kelas"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>

            <div className="w-full md:w-64">
              <label className="label">Impor Excel / CSV</label>
              <input
                type="file"
                className="input w-full"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <button type="button" className="btn-primary whitespace-nowrap" onClick={importStudents}>
              Impor
            </button>
          </div>
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
                <span className={row.status === "active" ? "badge-green" : "badge-amber"}>
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
                    onClick={() => navigate(`/admin/siswa/edit/${row.id}`)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ),
            },
          ]}
          rows={filtered}
        />
      </div>
    </Layout>
  );
}
