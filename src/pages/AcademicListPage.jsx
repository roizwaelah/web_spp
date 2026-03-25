import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatDate } from "../utils";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

export default function AcademicListPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

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

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus tahun ajaran",
      description: "Tahun ajaran yang masih dipakai data lain tidak akan bisa dihapus.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/academic-years", {
        method: "DELETE",
        data: { id },
      });
      setMessage("Tahun ajaran berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus tahun ajaran");
    }
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.name} ${row.start_date} ${row.end_date}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [rows, filter],
  );

  return (
    <Layout
      title="Tahun Ajaran"
      subtitle="Daftar periode akademik aktif dan riwayat tahun ajaran."
      actions={
        <button
          className="btn-primary"
          onClick={() => navigate("/admin/tahun-ajaran/edit")}
        >
          <Plus size={18} /> Tambah tahun ajaran
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-4 space-y-4">
          <input
            className="input"
            placeholder="Cari nama / tanggal tahun ajaran"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <Table
          columns={[
            { key: "name", title: "Tahun Ajaran" },
            {
              key: "start_date",
              title: "Mulai",
              render: (row) => formatDate(row.start_date),
            },
            {
              key: "end_date",
              title: "Selesai",
              render: (row) => formatDate(row.end_date),
            },
            { key: "total_students", title: "Jumlah siswa" },
            {
              key: "is_active",
              title: "Status",
              render: (row) => (
                <span className={row.is_active ? "badge-green" : "badge-slate"}>
                  {row.is_active ? "aktif" : "arsip"}
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
                    onClick={() => navigate(`/admin/tahun-ajaran/edit/${row.id}`)}
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
