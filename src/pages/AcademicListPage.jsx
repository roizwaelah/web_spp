import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatDate } from "../utils";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";
import { prefetchRoute } from "../prefetch";

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
        <div className="flex w-full justify-end">
          <button
            type="button"
            className="btn-primary shrink-0 px-3"
            onClick={() => navigate("/admin/tahun-ajaran/edit")}
            onMouseEnter={() => prefetchRoute("/admin/tahun-ajaran/edit")}
            onFocus={() => prefetchRoute("/admin/tahun-ajaran/edit")}
            title="Tambah tahun ajaran"
            aria-label="Tambah tahun ajaran"
          >
            <Plus size={18} />
            <span>Tambah tahun ajaran</span>
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="card space-y-3 p-3">
          <input
            className="input h-10 md:h-11"
            placeholder="Cari nama / tanggal tahun ajaran"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="space-y-2 md:hidden">
          {filteredRows.length === 0 ? (
            <div className="card p-4 text-sm text-slate-500">Belum ada tahun ajaran</div>
          ) : (
            filteredRows.map((row, idx) => (
              <div key={row.id} className="card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-semibold text-slate-900">
                      {idx + 1}.
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{row.name || "-"}</p>
                        <span className={row.is_active ? "badge-green" : "badge-slate"}>
                          {row.is_active ? "aktif" : "arsip"}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {formatDate(row.start_date)} - {formatDate(row.end_date)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {Number(row.total_students || 0)} siswa
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="btn-secondary px-3 py-2"
                      onClick={() => navigate(`/admin/tahun-ajaran/edit/${row.id}`)}
                      onMouseEnter={() => prefetchRoute("/admin/tahun-ajaran/edit")}
                      onFocus={() => prefetchRoute("/admin/tahun-ajaran/edit")}
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
                </div>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
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
                      onMouseEnter={() => prefetchRoute("/admin/tahun-ajaran/edit")}
                      onFocus={() => prefetchRoute("/admin/tahun-ajaran/edit")}
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
      </div>
    </Layout>
  );
}
