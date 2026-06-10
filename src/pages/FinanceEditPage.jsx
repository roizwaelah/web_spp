import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useToastMessage } from "../hooks/useToastMessage";
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
  is_flexible_installment: false,
  is_active: true,
};

const normalizeAmountInput = (value) => value.replace(/\D/g, "");

export default function FinanceEditPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const copyId = location.state?.copyId;

  useToastMessage(message, setMessage);

  const selectedPost = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );
  const copiedPost = useMemo(
    () => rows.find((item) => String(item.id) === String(copyId)),
    [rows, copyId],
  );

  const load = async () => {
    try {
      const [metaRes, rowsRes] = await Promise.all([
        fetchRoute("admin/meta"),
        fetchRoute("admin/finance-posts"),
      ]);

      setMeta({
        classes: Array.isArray(metaRes.data?.classes) ? metaRes.data.classes : [],
        students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
      });
      setRows(Array.isArray(rowsRes.data) ? rowsRes.data : []);
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memuat pos pembayaran");
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (id && selectedPost) {
      setForm({
        id: selectedPost.id,
        name: selectedPost.name || "",
        description: selectedPost.description || "",
        amount: selectedPost.amount,
        applies_to: selectedPost.applies_to,
        class_id: selectedPost.class_id ? String(selectedPost.class_id) : "",
        student_id: selectedPost.student_id ? String(selectedPost.student_id) : "",
        billing_type: selectedPost.billing_type,
        is_flexible_installment: !!selectedPost.is_flexible_installment,
        is_active: !!selectedPost.is_active,
      });
      return;
    }

    if (copyId && copiedPost) {
      setForm({
        id: null,
        name: copiedPost.name || "",
        description: copiedPost.description || "",
        amount: copiedPost.amount,
        applies_to: copiedPost.applies_to,
        class_id: copiedPost.class_id ? String(copiedPost.class_id) : "",
        student_id: copiedPost.student_id ? String(copiedPost.student_id) : "",
        billing_type: copiedPost.billing_type,
        is_flexible_installment: !!copiedPost.is_flexible_installment,
        is_active: !!copiedPost.is_active,
      });
      return;
    }

    if (!id) {
      setForm(initialForm);
    }
  }, [copyId, copiedPost, id, selectedPost]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (form.id) {
        await fetchRoute("admin/finance-posts", { method: "PUT", data: form });
        setMessage("Pos pembayaran berhasil diperbarui");
      } else {
        await fetchRoute("admin/finance-posts", { method: "POST", data: form });
        setMessage(copyId ? "Salinan pos pembayaran berhasil ditambahkan" : "Pos pembayaran berhasil ditambahkan");
        setForm(initialForm);
        if (copyId) {
          navigate("/admin/pos-keuangan/edit", { replace: true });
        }
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan pos pembayaran");
    }
  };

  const targetLabel = form.applies_to === "class" ? "kelas" : "siswa";

  return (
    <Layout
      title="Tambah/Edit Pos Pembayaran"
      subtitle="Form tambah atau edit pos pembayaran per kelas maupun per siswa."
      actions={
        <button
          className="btn-accent"
          onClick={() => navigate("/admin/pos-keuangan/list")}
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">
          {form.id ? "Edit pos pembayaran" : copyId ? "Salin pos pembayaran" : "Tambah pos pembayaran"}
        </h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
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
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Nominal</label>
            <input
              type="text"
              inputMode="numeric"
              className="input"
              value={form.amount ? formatCurrency(form.amount) : ""}
              placeholder="Rp0"
              onChange={(e) =>
                setForm({ ...form, amount: normalizeAmountInput(e.target.value) })
              }
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
                onChange={(e) => setForm({ ...form, billing_type: e.target.value })}
              >
                <option value="monthly">Bulanan</option>
                <option value="one_time">Per TA</option>
              </select>
            </div>
          </div>

          {form.applies_to === "class" ? (
            <div>
              <label className="label">Target {targetLabel}</label>
              <select
                className="input"
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
              >
                <option value="">Semua kelas</option>
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
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
              >
                <option value="">Semua siswa</option>
                {meta.students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} - {item.nis}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={!!form.is_flexible_installment}
              onChange={(e) =>
                setForm({ ...form, is_flexible_installment: e.target.checked })
              }
            />
            <span>
              <span className="font-semibold text-slate-900">
                Izinkan cicilan fleksibel
              </span>
              <span className="mt-1 block text-slate-500">
                Bendahara dapat menerima pembayaran sebagian untuk satu tagihan ini. Pembayaran orang tua tetap mengikuti sisa tagihan penuh lewat gateway.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={!!form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Pos pembayaran aktif
          </label>

          <div className="flex gap-3">
            <button className="btn-primary flex-1">
              {form.id ? "Update pos" : "Simpan pos"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setForm(initialForm)}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

