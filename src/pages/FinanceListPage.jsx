import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";

export default function FinanceListPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const load = () =>
    fetchRoute("admin/finance-posts").then(({ data }) =>
      setRows(Array.isArray(data) ? data : []),
    );

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    if (!confirm("Hapus pos keuangan ini?")) return;
    await fetchRoute("admin/finance-posts", { method: "DELETE", data: { id } });
    setMessage("Pos keuangan dihapus");
    load();
  };

  return (
    <Layout
      title="Manajemen Pos Keuangan"
      subtitle="Daftar pos keuangan untuk SPP, uang gedung, seragam, dan tagihan khusus per kelas atau per siswa."
      actions={
        <button
          className="btn-primary"
          onClick={() => navigate("/admin/pos-keuangan/edit")}
        >
          <Plus size={18} /> Tambah pos
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-6">
          {message && (
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
              {message}
            </div>
          )}
        </div>

        <Table
          columns={[
            { key: "name", title: "Pos keuangan" },
            { key: "description", title: "Deskripsi" },
            {
              key: "amount",
              title: "Tarif",
              render: (row) => formatCurrency(row.amount),
            },
            { key: "billing_type", title: "Jenis" },
            {
              key: "scope",
              title: "Target",
              render: (row) =>
                row.applies_to === "class" ? row.class_name : row.student_name,
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
                    className="btn-secondary px-3 py-2"
                    onClick={() => navigate(`/admin/pos-keuangan/edit/${row.id}`)}
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
          rows={rows}
        />
      </div>
    </Layout>
  );
}
