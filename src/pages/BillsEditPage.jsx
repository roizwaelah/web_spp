import { useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useToastMessage } from "../hooks/useToastMessage";

export default function BillsEditPage() {
  const [meta, setMeta] = useState({ students: [], finance_posts: [] });
  const [form, setForm] = useState({
    period: new Date().toISOString().slice(0, 7),
    due_date: "",
    student_id: "",
    finance_post_id: "",
  });
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useToastMessage(message, setMessage);

  useEffect(() => {
    fetchRoute("admin/meta")
      .then((metaRes) => {
        setMeta({
          students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
          finance_posts: Array.isArray(metaRes.data?.finance_posts) ? metaRes.data.finance_posts : [],
        });
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat form tagihan");
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      const { data } = await fetchRoute("admin/bills/generate", {
        method: "POST",
        data: {
          period: form.period,
          due_date: form.due_date || undefined,
          student_id: form.student_id || undefined,
          finance_post_id: form.finance_post_id || undefined,
        },
      });

      setMessage(data?.message || "Generate tagihan berhasil");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal generate tagihan");
    }
  };

  return (
    <Layout
      title="Buat Tagihan"
      subtitle="Generate tagihan otomatis per periode untuk semua siswa atau siswa tertentu."
      actions={
        <button className="btn-accent" onClick={() => navigate("/admin/tagihan/list")}>
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
            <CalendarCheck2 size={20} />
          </div>
          <div>
            <h3 className="section-title">Generate tagihan</h3>
            <p className="text-sm text-slate-500">Buat tagihan massal untuk satu periode.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="label">Periode</label>
            <input
              type="month"
              className="input"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Jatuh tempo</label>
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Pos (opsional)</label>
            <select
              className="input"
              value={form.finance_post_id}
              onChange={(e) => setForm({ ...form, finance_post_id: e.target.value })}
            >
              <option value="">Semua pos aktif</option>
              {meta.finance_posts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Siswa tertentu (opsional)</label>
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

          <div className="flex gap-3">
            <button className="btn-primary flex-1">Generate sekarang</button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setForm({
                  period: new Date().toISOString().slice(0, 7),
                  due_date: "",
                  student_id: "",
                  finance_post_id: "",
                })
              }
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
