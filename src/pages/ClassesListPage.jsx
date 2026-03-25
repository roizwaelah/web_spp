import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

export default function ClassesListPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const load = () =>
    fetchRoute("admin/classes")
      .then(({ data }) => {
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat data kelas");
      });

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus kelas",
      description: "Data kelas ini akan dihapus permanen.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/classes", { method: "DELETE", data: { id } });
      setMessage("Kelas berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus kelas");
    }
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.name} ${row.grade_level}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [rows, filter],
  );

  return (
    <Layout
      title="Data Kelas"
      subtitle="Daftar kelas aktif/nonaktif dan aksi kelola data kelas."
      actions={
        <button
          className="btn-primary"
          onClick={() => navigate("/admin/kelas/edit")}
        >
          <Plus size={18} /> Tambah kelas
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-3 space-y-4">
          <input
            className="input"
            placeholder="Cari nama kelas / jenjang"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <Table
          columns={[
            { key: "name", title: "Nama kelas" },
            { key: "grade_level", title: "Jenjang" },
            { key: "total_students", title: "Jumlah siswa" },
            {
              key: "is_active",
              title: "Status",
              render: (row) => (
                <span className={row.is_active ? "badge-green" : "badge-red"}>
                  {row.is_active ? "aktif" : "nonaktif"}
                </span>
              ),
            },
            {
              key: "actions",
              title: "Aksi",
              render: (row) => (
                <div className="flex gap-2">
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => navigate(`/admin/kelas/edit/${row.id}`)}
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
          rows={filteredRows}
        />
      </div>
    </Layout>
  );
}
