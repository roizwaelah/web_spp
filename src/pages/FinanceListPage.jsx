import { useEffect, useMemo, useState } from "react";
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
  const [filter, setFilter] = useState("");
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
        setMessage(error?.response?.data?.message || "Gagal memuat pos pembayaran");
      });

  useEffect(() => {
    load();
  }, []);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus pos pembayaran",
      description: "Pos pembayaran yang sudah dipakai tagihan tidak akan bisa dihapus.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/finance-posts", { method: "DELETE", data: { id } });
      setMessage("Pos pembayaran berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus pos pembayaran");
    }
  };

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.name} ${row.description} ${row.class_name || ""} ${row.student_name || ""}`
          .toLowerCase()
          .includes(filter.toLowerCase()),
      ),
    [rows, filter],
  );

  return (
    <Layout
      title="Pos Pembayaran"
      subtitle="Daftar pos pembayaran per kelas atau per siswa."
      actions={
        <div className="flex w-full justify-end">
          <button
            type="button"
            className="btn-primary shrink-0 px-3"
            onClick={() => navigate("/admin/pos-keuangan/edit")}
            onMouseEnter={() => prefetchRoute("/admin/pos-keuangan/edit")}
            onFocus={() => prefetchRoute("/admin/pos-keuangan/edit")}
            title="Tambah pos pembayaran"
            aria-label="Tambah pos pembayaran"
          >
            <Plus size={18} />
            <span>Tambah pos</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="card p-3">
          <input
            className="input h-10 md:h-11"
            placeholder="Cari pos pembayaran / target"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {filteredRows.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">Belum ada pos pembayaran</div>
          ) : (
            filteredRows.map((row, idx) => (
              <div key={row.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-slate-900">{idx + 1}.</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="pt-0.5 text-sm font-semibold text-slate-900">{row.name || "-"}</p>
                        <span className={row.is_active ? "badge-green" : "badge-red"}>
                          {row.is_active ? "aktif" : "nonaktif"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-700">
                        {row.applies_to === "class" ? (row.class_name || "Semua kelas") : (row.student_name || "Semua siswa")}
                        <span className="text-yellow-500 mx-1">|</span> 
                        {row.billing_type === "one_time" ? "Per TA" : "Bulanan"}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {formatCurrency(row.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <Table
            columns={[
              { key: "name", title: "Pos pembayaran" },
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
            rows={filteredRows}
          />
        </div>
      </div>
    </Layout>
  );
}
