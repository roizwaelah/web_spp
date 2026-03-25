import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { staffMenuItems } from "../access";
import { roleLabel } from "../utils";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

const menuLabelMap = Object.fromEntries(
  staffMenuItems.map((item) => [item.accessKey, item.label]),
);

export default function UsersListPage() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const load = () =>
    (setLoading(true),
    fetchRoute("admin/users")
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat data user");
      })
      .finally(() => {
        setLoading(false);
      }));

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus user",
      description: "User yang dihapus tidak akan bisa login lagi.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/users", { method: "DELETE", data: { id } });
      setMessage("User berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus user");
    }
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.name} ${row.email} ${row.role} ${row.student_name || ""}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [rows, filter],
  );

  return (
    <Layout
      title="Users"
      subtitle="Kelola akun user, peran, dan menu yang boleh diakses oleh setiap akun staff."
      actions={
        <button
          className="btn-primary"
          onClick={() => navigate("/admin/users/edit")}
        >
          <Plus size={18} /> Tambah user
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card space-y-4 p-3">
          <input
            className="input"
            placeholder="Cari nama, email, role, atau siswa"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <Table
          columns={[
            { key: "name", title: "Nama" },
            { key: "email", title: "Email" },
            {
              key: "role",
              title: "Role",
              render: (row) => roleLabel(row.role),
            },
            {
              key: "student",
              title: "Terkait siswa",
              render: (row) =>
                row.student_name
                  ? `${row.student_name}${row.student_nis ? ` (${row.student_nis})` : ""}`
                  : "-",
            },
            {
              key: "menu_access",
              title: "Akses menu",
              render: (row) =>
                row.role === "parent"
                  ? "Portal orang tua"
                  : (row.menu_access || [])
                      .map((menuKey) => menuLabelMap[menuKey] || menuKey)
                      .join(", ") || "-",
            },
            {
              key: "actions",
              title: "Aksi",
              render: (row) => (
                <div className="flex gap-2">
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => navigate(`/admin/users/edit/${row.id}`)}
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
          emptyText={loading ? "Memuat data user..." : "Belum ada user"}
        />
      </div>
    </Layout>
  );
}
