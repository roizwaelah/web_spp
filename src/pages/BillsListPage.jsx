import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";

export default function BillsListPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ students: [] });
  const [filter, setFilter] = useState({
    status: "",
    student_id: "",
  });
  const navigate = useNavigate();

  const load = async () => {
    const [metaRes, rowsRes] = await Promise.all([
      fetchRoute("admin/meta"),
      fetchRoute(
        `admin/bills${filter.status || filter.student_id ? `?${new URLSearchParams({ status: filter.status, student_id: filter.student_id }).toString()}` : ""}`,
      ),
    ]);

    setMeta({
      students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
    });
    setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
  };

  useEffect(() => {
    load();
  }, [filter.status, filter.student_id]);

  return (
    <Layout
      title="Daftar Tagihan"
      subtitle="Lihat daftar tagihan, filter status pembayaran, dan pantau status bukti pembayaran siswa."
      actions={
        <button className="btn-primary" onClick={() => navigate("/admin/tagihan/edit")}>
          <Plus size={18} /> Buat tagihan
        </button>
      }
    >
      <div className="space-y-4">
        <div className="card p-6">
          <div className="grid gap-4 md:grid-cols-2">
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
              value={filter.student_id}
              onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}
            >
              <option value="">Semua siswa</option>
              {meta.students.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} • {item.nis}
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
                  {row.status}
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
          ]}
          rows={rows}
        />
      </div>
    </Layout>
  );
}
