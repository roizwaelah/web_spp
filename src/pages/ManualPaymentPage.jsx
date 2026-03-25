import { useEffect, useMemo, useState } from "react";
import { HandCoins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const initialForm = {
  class_id: "",
  student_id: "",
  bill_id: "",
  payment_channel: "Tunai",
  payment_date: new Date().toISOString().slice(0, 10),
  reference_no: "",
  notes: "",
};

export default function ManualPaymentPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [billRows, setBillRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useToastMessage(message, setMessage);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const { data } = await fetchRoute("admin/meta");
        setMeta({
          classes: Array.isArray(data?.classes) ? data.classes : [],
          students: Array.isArray(data?.students) ? data.students : [],
        });
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat metadata pembayaran manual",
        });
      }
    };

    loadMeta();
  }, []);

  useEffect(() => {
    const loadBills = async () => {
      setLoading(true);
      try {
        const { data } = await fetchRoute("admin/bills", {
          params: {
            status: "unpaid",
            ...(form.class_id ? { class_id: form.class_id } : {}),
            ...(form.student_id ? { student_id: form.student_id } : {}),
          },
        });
        setBillRows(Array.isArray(data) ? data : []);
        setMessage((current) => (current.type === "error" ? { type: "", text: "" } : current));
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat daftar tagihan belum lunas",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [form.class_id, form.student_id]);

  const studentOptions = useMemo(() => {
    const rows = meta.students.filter((item) => {
      if (!form.class_id) return true;
      const bill = billRows.find((row) => String(row.student_id) === String(item.id));
      return !!bill;
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [meta.students, billRows, form.class_id]);

  const billOptions = useMemo(
    () =>
      billRows.filter((item) => {
        if (form.student_id && String(item.student_id) !== String(form.student_id)) return false;
        return true;
      }),
    [billRows, form.student_id],
  );

  const selectedBill = billOptions.find((item) => String(item.id) === String(form.bill_id));

  const handleClassChange = (value) => {
    setForm((current) => ({
      ...current,
      class_id: value,
      student_id: "",
      bill_id: "",
    }));
  };

  const handleStudentChange = (value) => {
    setForm((current) => ({
      ...current,
      student_id: value,
      bill_id: "",
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const { data } = await fetchRoute("admin/bills/manual-payment", {
        method: "POST",
        data: {
          bill_id: Number(form.bill_id),
          payment_channel: form.payment_channel,
          payment_date: form.payment_date,
          reference_no: form.reference_no || undefined,
          notes: form.notes || undefined,
        },
      });

      setMessage({
        type: "success",
        text: `${data?.message || "Pembayaran manual berhasil disimpan"}${data?.reference_no ? ` Ref: ${data.reference_no}` : ""}`,
      });
      setForm({
        ...initialForm,
        class_id: form.class_id,
        student_id: form.student_id,
      });
      const { data: rows } = await fetchRoute("admin/bills", {
        params: {
          status: "unpaid",
          ...(form.class_id ? { class_id: form.class_id } : {}),
          ...(form.student_id ? { student_id: form.student_id } : {}),
        },
      });
      setBillRows(Array.isArray(rows) ? rows : []);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menyimpan pembayaran manual",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Pembayaran Manual"
      subtitle="Input pembayaran langsung oleh bendahara untuk tagihan siswa yang belum lunas."
      actions={
        <button className="btn-secondary" onClick={() => navigate("/admin/tagihan/list")}>
          Kembali ke Tagihan
        </button>
      }
    >
      <div className="card p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <HandCoins size={20} />
          </div>
          <div>
            <h3 className="section-title">Input pembayaran</h3>
            <p className="text-sm text-slate-500">Pilih tagihan belum lunas lalu simpan transaksi pembayaran manual.</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Filter kelas</label>
              <select className="input" value={form.class_id} onChange={(e) => handleClassChange(e.target.value)}>
                <option value="">Semua kelas</option>
                {meta.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Filter siswa</label>
              <select
                className="input"
                value={form.student_id}
                disabled={studentOptions.length === 0}
                onChange={(e) => handleStudentChange(e.target.value)}
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

          <div>
            <label className="label">Tagihan belum lunas</label>
            <select
              className="input"
              value={form.bill_id}
              disabled={billOptions.length === 0 || loading}
              onChange={(e) => setForm((current) => ({ ...current, bill_id: e.target.value }))}
            >
              <option value="">
                {loading ? "Memuat tagihan..." : billOptions.length === 0 ? "Tidak ada tagihan belum lunas" : "Pilih tagihan"}
              </option>
              {billOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.student_name} - {item.bill_name} - {item.period} - {formatCurrency(item.amount)}
                </option>
              ))}
            </select>
          </div>

          {selectedBill && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                <span className="font-semibold text-slate-900">Siswa:</span> {selectedBill.student_name} ({selectedBill.class_name || "-"})
              </p>
              <p>
                <span className="font-semibold text-slate-900">Tagihan:</span> {selectedBill.bill_name} periode {selectedBill.period}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Jatuh tempo:</span> {formatDate(selectedBill.due_date)}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Nominal:</span> {formatCurrency(selectedBill.amount)}
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Kanal pembayaran</label>
              <select
                className="input"
                value={form.payment_channel}
                onChange={(e) => setForm((current) => ({ ...current, payment_channel: e.target.value }))}
              >
                <option value="Tunai">Tunai</option>
                <option value="Transfer Bank">Transfer Bank</option>
                <option value="QRIS">QRIS</option>
                <option value="Virtual Account">Virtual Account</option>
                <option value="E-Wallet">E-Wallet</option>
              </select>
            </div>
            <div>
              <label className="label">Tanggal pembayaran</label>
              <input
                type="date"
                className="input"
                value={form.payment_date}
                onChange={(e) => setForm((current) => ({ ...current, payment_date: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Nomor referensi</label>
            <input
              className="input"
              placeholder="Opsional, misalnya KW-20260326-01"
              value={form.reference_no}
              onChange={(e) => setForm((current) => ({ ...current, reference_no: e.target.value }))}
            />
          </div>

          <div>
            <label className="label">Catatan</label>
            <textarea
              className="textarea"
              placeholder="Opsional, misalnya dibayar langsung di kantor TU"
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1" disabled={!form.bill_id || saving}>
              {saving ? "Menyimpan..." : "Simpan pembayaran"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setForm((current) => ({
                  ...initialForm,
                  class_id: current.class_id,
                  student_id: current.student_id,
                }))
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
