import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useAuth } from "../context/AuthContext";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

export default function BillsListPage() {
  const [rows, setRows] = useState([]);
  const [studentSourceRows, setStudentSourceRows] = useState([]);
  const [meta, setMeta] = useState({ students: [], classes: [] });
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState({
    status: "",
    class_id: "",
    student_id: "",
  });
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const load = async () => {
    try {
      const [metaRes, studentRowsRes, rowsRes] = await Promise.all([
        fetchRoute("admin/meta"),
        fetchRoute("admin/bills", {
          params: {
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.class_id ? { class_id: filter.class_id } : {}),
          },
        }),
        fetchRoute("admin/bills", {
          params: {
            ...(filter.status ? { status: filter.status } : {}),
            ...(filter.class_id ? { class_id: filter.class_id } : {}),
            ...(filter.student_id ? { student_id: filter.student_id } : {}),
          },
        }),
      ]);

      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
        students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
      });
      setStudentSourceRows(Array.isArray(studentRowsRes.data) ? studentRowsRes.data : []);
      setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat data tagihan");
    }
  };

  useEffect(() => {
    load();
  }, [filter.status, filter.class_id, filter.student_id]);

  const remove = async (id) => {
    const confirmed = await confirm({
      title: "Hapus tagihan",
      description: "Tagihan yang sudah punya transaksi atau bukti bayar tidak akan bisa dihapus.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      await fetchRoute("admin/bills", { method: "DELETE", data: { id } });
      setMessage("Tagihan berhasil dihapus");
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus tagihan");
    }
  };

  const studentOptions = useMemo(() => {
    const studentMap = new Map();
    for (const row of studentSourceRows) {
      if (!row?.student_id) continue;
      if (!studentMap.has(String(row.student_id))) {
        studentMap.set(String(row.student_id), {
          id: String(row.student_id),
          name: row.student_name || "",
          nis: row.nis || "",
        });
      }
    }
    return Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [studentSourceRows]);

  return (
    <Layout
      title="Daftar Tagihan"
      subtitle="Lihat daftar tagihan, filter status pembayaran, dan pantau status bukti pembayaran siswa."
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => navigate("/admin/pembayaran/list")}>
            Pembayaran
          </button>
          <button className="btn-primary" onClick={() => navigate("/admin/tagihan/edit")}>
            <Plus size={18} /> Buat tagihan
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="card p-3">
          <div className="grid gap-4 md:grid-cols-3">
            <select
              className="input"
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            >
              <option value="">Semua status</option>
              <option value="unpaid">Belum lunas</option>
              <option value="paid">Lunas</option>
            </select>
            <select
              className="input"
              value={filter.class_id}
              onChange={(e) => setFilter({ ...filter, class_id: e.target.value, student_id: "" })}
            >
              <option value="">Semua kelas</option>
              {meta.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={filter.student_id}
              disabled={studentOptions.length === 0}
              onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}
            >
              <option value="">{studentOptions.length === 0 ? "Tidak ada siswa" : "Semua siswa"}</option>
              {studentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.nis}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Table
          columns={[
            { key: "student_name", title: "Siswa" },
            { key: "class_name", title: "Kelas" },
            { key: "bill_name", title: "Tagihan" },
            { key: "period", title: "Periode" },
            {
              key: "due_date",
              title: "Jatuh tempo",
              render: (row) => formatDate(row.due_date),
            },
            {
              key: "amount",
              title: "Nominal",
              render: (row) => formatCurrency(row.amount),
            },
            {
              key: "status",
              title: "Status",
              render: (row) => (
                <span className={row.status === "paid" ? "badge-green" : "badge-amber"}>
                  {row.status === "paid" ? "Lunas" : "Belum Lunas"}
                </span>
              ),
            },
            {
              key: "proof_status",
              title: "Bukti Bayar",
              render: (row) =>
                row.proof_status ? (
                  <span
                    className={
                      row.proof_status === "approved"
                        ? "badge-green"
                        : row.proof_status === "rejected"
                          ? "badge-red"
                          : "badge-amber"
                    }
                  >
                    {row.proof_status}
                  </span>
                ) : (
                  <span className="badge-slate">-</span>
                ),
            },
            ...(isAdmin
              ? [
                  {
                    key: "actions",
                    title: "Aksi",
                    render: (row) => (
                      <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}>
                        <Trash2 size={16} />
                      </button>
                    ),
                  },
                ]
              : []),
          ]}
          rows={rows}
        />
      </div>
    </Layout>
  );
}
