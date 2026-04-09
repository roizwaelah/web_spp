import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

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

  const romanToNumber = (rawValue) => {
    const value = String(rawValue || "").toUpperCase();
    if (!value || !/^[IVXLCDM]+$/.test(value)) return null;
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    let total = 0;
    for (let i = 0; i < value.length; i += 1) {
      const current = map[value[i]] || 0;
      const next = map[value[i + 1]] || 0;
      total += current < next ? -current : current;
    }
    return total > 0 ? total : null;
  };

  const getClassOrder = (row) => {
    const source = `${row?.name || ""} ${row?.grade_level || ""}`.toUpperCase();
    const arabic = source.match(/\b\d+\b/);
    if (arabic) return Number(arabic[0]);
    const tokens = source.split(/[^A-Z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      const roman = romanToNumber(token);
      if (roman != null) return roman;
    }
    return null;
  };

  const filteredRows = useMemo(
    () =>
      rows
        .filter((row) =>
          `${row.name} ${row.grade_level}`
            .toLowerCase()
            .includes(filter.toLowerCase()),
        )
        .slice()
        .sort((a, b) => {
          const orderA = getClassOrder(a);
          const orderB = getClassOrder(b);
          if (orderA != null && orderB != null && orderA !== orderB) return orderA - orderB;
          if (orderA != null && orderB == null) return -1;
          if (orderA == null && orderB != null) return 1;
          const byName = String(a.name || "").localeCompare(String(b.name || ""), "id", {
            numeric: true,
            sensitivity: "base",
          });
          if (byName !== 0) return byName;
          return String(a.grade_level || "").localeCompare(String(b.grade_level || ""), "id", {
            numeric: true,
            sensitivity: "base",
          });
        }),
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
          onMouseEnter={() => prefetchRoute("/admin/kelas/edit")}
          onFocus={() => prefetchRoute("/admin/kelas/edit")}
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
                    onMouseEnter={() => prefetchRoute("/admin/kelas/edit")}
                    onFocus={() => prefetchRoute("/admin/kelas/edit")}
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
