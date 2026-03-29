import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

export default function FinanceListPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const load = () =>
    fetchRoute("admin/finance-posts")
      .then(({ data }) => {
        setRows(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat pos keuangan");
      });

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus pos keuangan",
      description: "Pos keuangan yang sudah dipakai tagihan tidak akan bisa dihapus.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/finance-posts", { method: "DELETE", data: { id } });
      setMessage("Pos keuangan berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus pos keuangan");
    }
  };

  return (
    <Layout
      title="Pos Keuangan"
      subtitle="Daftar pos keuangan untuk SPP, uang gedung, seragam, dan tagihan khusus per kelas atau per siswa."
      actions={
        <button
          className="btn-primary"
          onClick={() => navigate("/admin/pos-keuangan/edit")}
          onMouseEnter={() => prefetchRoute("/admin/pos-keuangan/edit")}
          onFocus={() => prefetchRoute("/admin/pos-keuangan/edit")}
        >
          <Plus size={18} /> Tambah pos
        </button>
      }
    >
      <div className="space-y-4">
        <Table
          columns={[
            { key: "name", title: "Pos keuangan" },
            { key: "description", title: "Deskripsi" },
            {
              key: "amount",
              title: "Tarif",
              render: (row) => formatCurrency(row.amount),
            },
            {
              key: "billing_type",
              title: "Jenis",
              render: (row) => (row.billing_type === "one_time" ? "Per TA" : "Bulanan"),
            },
            {
              key: "scope",
              title: "Target",
              render: (row) => {
                if (row.applies_to === "class") {
                  return row.class_name || "Semua kelas";
                }
                return row.student_name || "Semua siswa";
              },
            },
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
                    className="btn-accent px-3 py-2"
                    onClick={() =>
                      navigate("/admin/pos-keuangan/edit", {
                        state: { copyId: row.id },
                      })
                    }
                    onMouseEnter={() => prefetchRoute("/admin/pos-keuangan/edit")}
                    onFocus={() => prefetchRoute("/admin/pos-keuangan/edit")}
                    title="Salin pos"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    className="btn-secondary px-3 py-2"
                    onClick={() => navigate(`/admin/pos-keuangan/edit/${row.id}`)}
                    onMouseEnter={() => prefetchRoute("/admin/pos-keuangan/edit")}
                    onFocus={() => prefetchRoute("/admin/pos-keuangan/edit")}
                    title="Edit pos"
                  >
                    <Pencil size={16} />
                  </button>
                  {isAdmin && (
                    <button
                      className="btn-danger px-3 py-2"
                      onClick={() => remove(row.id)}
                      title="Hapus pos"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      </div>
    </Layout>
  );
}
