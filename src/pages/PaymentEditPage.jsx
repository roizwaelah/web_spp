import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, HandCoins, Printer } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import ModalFrame from "../components/ModalFrame";

const initialForm = {
  class_id: "",
  student_id: "",
  bill_id: "",
  payment_channel: "Tunai",
  payment_date: new Date().toISOString().slice(0, 10),
};

export default function PaymentEditPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [billRows, setBillRows] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useToastMessage(message, setMessage);

  useEffect(() => {
    if (location.state?.class_id || location.state?.student_id) {
      setForm((current) => ({
        ...current,
        class_id: location.state?.class_id || "",
        student_id: location.state?.student_id || "",
      }));
    }
  }, [location.state]);

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
          text: error?.response?.data?.message || "Gagal memuat metadata pembayaran",
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
      return billRows.some((row) => String(row.student_id) === String(item.id));
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [billRows, form.class_id, meta.students]);

  const billOptions = useMemo(
    () =>
      billRows.filter((item) => {
        if (form.student_id && String(item.student_id) !== String(form.student_id)) return false;
        return true;
      }),
    [billRows, form.student_id],
  );

  const selectedBill = billOptions.find((item) => String(item.id) === String(form.bill_id));

  const savePayment = async () => {
    const { data } = await fetchRoute("admin/bills/manual-payment", {
      method: "POST",
      data: {
        bill_id: Number(form.bill_id),
        payment_channel: form.payment_channel,
        payment_date: form.payment_date,
      },
    });
    return data;
  };

  const printTransaction = async (transactionId) => {
    const { data } = await fetchRoute("admin/transactions/receipt", {
      method: "GET",
      params: { transaction_id: transactionId },
      responseType: "text",
      transformResponse: [(value) => value],
    });

    const printWindow = window.open("", "_blank", "width=900,height=720");
    if (!printWindow) {
      throw new Error("Popup diblokir browser. Izinkan popup untuk mencetak bukti pembayaran.");
    }

    printWindow.document.open();
    printWindow.document.write(data);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const saveOnly = async () => {
    try {
      setSaving(true);
      const data = await savePayment();
      setMessage({
        type: "success",
        text: `${data?.message || "Pembayaran berhasil disimpan"}${data?.reference_no ? ` Ref: ${data.reference_no}` : ""}`,
      });
      setPaymentDialogOpen(false);
      navigate("/admin/pembayaran/list", { replace: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal menyimpan pembayaran",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveAndPrint = async () => {
    try {
      setSaving(true);
      const data = await savePayment();
      await printTransaction(data?.transaction_id);
      setMessage({
        type: "success",
        text: `${data?.message || "Pembayaran berhasil disimpan"}${data?.reference_no ? ` Ref: ${data.reference_no}` : ""}`,
      });
      setPaymentDialogOpen(false);
      navigate("/admin/pembayaran/list", { replace: true });
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || error?.message || "Gagal mencetak pembayaran",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPaymentDialog = (event) => {
    event.preventDefault();
    if (!form.bill_id) return;
    setPaymentDialogOpen(true);
  };

  return (
    <Layout
      title="Pembayaran"
      subtitle="Input pembayaran langsung oleh bendahara untuk tagihan siswa yang belum lunas."
      actions={
        <button className="btn-accent" onClick={() => navigate("/admin/pembayaran/list")}>
          <ArrowLeft size={16} />
          Kembali ke Daftar
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

        <form className="grid gap-4 md:grid-cols-2" onSubmit={openPaymentDialog}>
          <div className="h-full">
            <label className="label">Filter kelas</label>
            <select
              className="input"
              value={form.class_id}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  class_id: e.target.value,
                  student_id: "",
                  bill_id: "",
                }))
              }
            >
              <option value="">Semua kelas</option>
              {meta.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-full">
            <label className="label">Filter siswa</label>
            <select
              className="input"
              value={form.student_id}
              disabled={studentOptions.length === 0}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  student_id: e.target.value,
                  bill_id: "",
                }))
              }
            >
              <option value="">{studentOptions.length === 0 ? "Tidak ada siswa" : "Semua siswa"}</option>
              {studentOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} - {item.nis}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:col-span-2">
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

          <div className="h-full">
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
          <div className="h-full">
            <label className="label">Tanggal pembayaran</label>
            <input
              type="date"
              className="input"
              value={form.payment_date}
              onChange={(e) => setForm((current) => ({ ...current, payment_date: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 md:col-span-2">
            <button className="btn-primary flex-1" disabled={!form.bill_id || saving}>
              Bayar
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

      <ModalFrame
        open={paymentDialogOpen}
        title="Konfirmasi Transaksi Pembayaran"
        description=""
        maxWidthClass="max-w-[720px]"
        showIcon={false}
        showHeader={false}
        cardClassName="gap-2 p-3"
        onClose={() => setPaymentDialogOpen(false)}
      >
        {selectedBill ? (
          <>
            <div className="mx-auto w-[860px] max-w-full rounded-xl border border-slate-300 bg-white p-2.5 text-[12px] leading-tight text-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold tracking-wide text-slate-900">MADSC PAYMENT</p>
                  <p className="text-[11px] text-slate-600">Konfirmasi transaksi pembayaran siswa</p>
                </div>
                <div className="border border-slate-500 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                  BUKTI PEMBAYARAN
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-1 md:grid-cols-2">
                <div className="space-y-1">
                  <p><span className="inline-block w-28 font-semibold">Diterima dari</span>: {selectedBill.student_name}</p>
                  <p><span className="inline-block w-28 font-semibold">Nomor Induk</span>: {selectedBill.nis || "-"}</p>
                  <p><span className="inline-block w-28 font-semibold">Kelas</span>: {selectedBill.class_name || "-"}</p>
                  <p><span className="inline-block w-28 font-semibold">Status Siswa</span>: Akan Lunas</p>
                </div>
                <div className="space-y-1">
                  <p><span className="inline-block w-28 font-semibold">Tgl. Bayar</span>: {formatDate(form.payment_date)}</p>
                  <p><span className="inline-block w-28 font-semibold">No. Bukti</span>: Otomatis saat disimpan</p>
                  <p><span className="inline-block w-28 font-semibold">Metode</span>: {form.payment_channel}</p>
                  <p><span className="inline-block w-28 font-semibold">Petugas</span>: ADMIN</p>
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                <div>
                  <p className="mb-1 font-semibold">Dengan rincian pembayaran sebagai berikut:</p>
                  <div className="grid grid-cols-[1fr_auto] gap-2 border-y border-slate-300 py-1.5">
                    <p>1. {selectedBill.bill_name} ({selectedBill.period || "-"})</p>
                    <p className="font-semibold">{formatCurrency(selectedBill.amount)}</p>
                  </div>
                </div>
                <div className="space-y-1 border-t border-slate-300 pt-1">
                  <div className="flex justify-between"><span className="font-semibold">Jumlah</span><span>{formatCurrency(selectedBill.amount)}</span></div>
                  <div className="flex justify-between"><span className="font-semibold">Pembayaran</span><span>{formatCurrency(selectedBill.amount)}</span></div>
                  <div className="flex justify-between border-b border-slate-400 pb-1"><span className="font-semibold">Kembali</span><span>Rp0</span></div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setPaymentDialogOpen(false)} disabled={saving}>
                Batal
              </button>
              <button type="button" className="btn-primary" onClick={saveOnly} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button type="button" className="btn-primary" onClick={saveAndPrint} disabled={saving}>
                <Printer size={16} />
                {saving ? "Menyiapkan..." : "Cetak (PDF)"}
              </button>
            </div>
          </>
        ) : null}
      </ModalFrame>
    </Layout>
  );
}
