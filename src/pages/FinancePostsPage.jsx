import { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { fetchRoute } from "../api";
import { formatCurrency } from "../utils";

const initialForm = {
  id: null,
  name: "",
  description: "",
  amount: "",
  applies_to: "class",
  class_id: "",
  student_id: "",
  billing_type: "monthly",
  is_active: true,
};

export default function FinancePostsPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const formCardRef = useRef(null);

  const load = async () => {
    const [metaRes, rowsRes] = await Promise.all([
      fetchRoute("admin/meta"),
      fetchRoute("admin/finance-posts"),
    ]);
    setMeta({
      classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
      students: Array.isArray(metaRes.data?.students)
        ? metaRes.data.students
        : [],
    });
    setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (form.id) {
      await fetchRoute("admin/finance-posts", { method: "PUT", data: form });
      setMessage("Pos keuangan diperbarui");
    } else {
      await fetchRoute("admin/finance-posts", { method: "POST", data: form });
      setMessage("Pos keuangan ditambahkan");
    }
    setForm(initialForm);
    load();
  };

  const remove = async (id) => {
    if (!confirm("Hapus pos keuangan ini?")) return;
    await fetchRoute("admin/finance-posts", { method: "DELETE", data: { id } });
    setMessage("Pos keuangan dihapus");
    load();
  };

  const targetLabel = useMemo(
    () => (form.applies_to === "class" ? "kelas" : "siswa"),
    [form.applies_to],
  );

  const openCreateForm = () => {
    setForm(initialForm);
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Layout
      title="Manajemen Pos Keuangan"
      subtitle="Atur jenis pembayaran SPP, uang gedung, seragam, dan tagihan khusus per kelas atau per siswa."
      actions={
        <button className="btn-primary" onClick={openCreateForm}>
          <Plus size={18} /> Tambah pos
        </button>
      }
    >
      <div className="page-grid">
        <div className="card p-5" ref={formCardRef}>
          <h3 className="section-title">
            {form.id ? "Edit pos keuangan" : "Tambah pos keuangan"}
          </h3>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            {message && (
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {message}
              </div>
            )}
            <div>
              <label className="label">Nama pos</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Deskripsi</label>
              <textarea
                className="textarea"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Nominal</label>
              <input
                type="number"
                className="input"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Berlaku untuk</label>
                <select
                  className="input"
                  value={form.applies_to}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      applies_to: e.target.value,
                      class_id: "",
                      student_id: "",
                    })
                  }
                >
                  <option value="class">Per kelas</option>
                  <option value="student">Per siswa</option>
                </select>
              </div>
              <div>
                <label className="label">Jenis tagihan</label>
                <select
                  className="input"
                  value={form.billing_type}
                  onChange={(e) =>
                    setForm({ ...form, billing_type: e.target.value })
                  }
                >
                  <option value="monthly">Bulanan</option>
                  <option value="one_time">Sekali bayar</option>
                </select>
              </div>
            </div>

            {form.applies_to === "class" ? (
              <div>
                <label className="label">Target {targetLabel}</label>
                <select
                  className="input"
                  value={form.class_id}
                  onChange={(e) =>
                    setForm({ ...form, class_id: e.target.value })
                  }
                >
                  <option value="">Pilih kelas</option>
                  {meta.classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="label">Target {targetLabel}</label>
                <select
                  className="input"
                  value={form.student_id}
                  onChange={(e) =>
                    setForm({ ...form, student_id: e.target.value })
                  }
                >
                  <option value="">Pilih siswa</option>
                  {meta.students.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} • {item.nis}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) =>
                  setForm({ ...form, is_active: e.target.checked })
                }
              />
              Pos keuangan aktif
            </label>

            <div className="flex gap-3">
              <button className="btn-primary flex-1">
                {form.id ? "Update pos" : "Simpan pos"}
              </button>
              {form.id && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setForm(initialForm)}
                >
                  Batal
                </button>
              )}
            </div>
          </form>
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
                    onClick={() =>
                      setForm({
                        id: row.id,
                        name: row.name,
                        description: row.description || "",
                        amount: row.amount,
                        applies_to: row.applies_to,
                        class_id: row.class_id ? String(row.class_id) : "",
                        student_id: row.student_id
                          ? String(row.student_id)
                          : "",
                        billing_type: row.billing_type,
                        is_active: !!row.is_active,
                      })
                    }
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
