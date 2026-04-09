import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, HandCoins, Printer } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute, openRouteFile } from "../api";
import { formatCurrency, formatDate, formatPeriod } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import ModalFrame from "../components/ModalFrame";

const initialForm = {
  class_id: "",
  student_id: "",
  bill_ids: [],
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
  const [billDropdownOpen, setBillDropdownOpen] = useState(false);
  const [studentDropdownOpen, setStudentDropdownOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const billDropdownRef = useRef(null);
  const studentDropdownRef = useRef(null);
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
          text:
            error?.response?.data?.message ||
            "Gagal memuat metadata pembayaran",
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
          text:
            error?.response?.data?.message ||
            "Gagal memuat daftar tagihan belum lunas",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [form.class_id, form.student_id]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        billDropdownRef.current &&
        !billDropdownRef.current.contains(event.target)
      ) {
        setBillDropdownOpen(false);
      }
      if (
        studentDropdownRef.current &&
        !studentDropdownRef.current.contains(event.target)
      ) {
        setStudentDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const studentOptions = useMemo(() => {
    const rows = meta.students.filter((item) => {
      if (!form.class_id) return true;
      return billRows.some((row) => String(row.student_id) === String(item.id));
    });

    return rows.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [billRows, form.class_id, meta.students]);

  useEffect(() => {
    if (!form.student_id) {
      setStudentSearch("");
      return;
    }
    const selected = studentOptions.find(
      (item) => String(item.id) === String(form.student_id),
    );
    if (selected) {
      setStudentSearch(`${selected.name} - ${selected.nis || "-"}`);
    }
  }, [form.student_id, studentOptions]);

  const filteredStudentOptions = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    if (!keyword) return studentOptions;
    return studentOptions.filter((item) => {
      const text =
        `${item.name || ""} ${item.nis || ""} ${item.nisn || ""}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [studentOptions, studentSearch]);

  const billOptions = useMemo(
    () =>
      billRows.filter((item) => {
        if (
          form.student_id &&
          String(item.student_id) !== String(form.student_id)
        )
          return false;
        return true;
      }),
    [billRows, form.student_id],
  );

  useEffect(() => {
    setForm((current) => {
      const nextIds = current.bill_ids.filter((id) =>
        billOptions.some((item) => String(item.id) === String(id)),
      );
      if (
        nextIds.length === current.bill_ids.length &&
        nextIds.every((id, idx) => String(id) === String(current.bill_ids[idx]))
      ) {
        return current;
      }
      return { ...current, bill_ids: nextIds };
    });
  }, [billOptions]);

  const selectedBills = useMemo(
    () =>
      billOptions.filter((item) =>
        form.bill_ids.some((id) => String(id) === String(item.id)),
      ),
    [billOptions, form.bill_ids],
  );

  const selectedBillsTotal = useMemo(
    () =>
      selectedBills.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [selectedBills],
  );

  const selectedBillLabel = useMemo(() => {
    if (loading) return "Memuat tagihan...";
    if (billOptions.length === 0) return "Tidak ada tagihan belum lunas";
    if (selectedBills.length === 0) return "Pilih satu atau beberapa tagihan";
    if (selectedBills.length === 1) {
      const item = selectedBills[0];
      return `${item.bill_name} (${formatPeriod(item.period)}) - ${formatCurrency(item.amount)}`;
    }
    return `${selectedBills.length} tagihan dipilih - ${formatCurrency(selectedBillsTotal)}`;
  }, [billOptions.length, loading, selectedBills, selectedBillsTotal]);

  const toggleBillSelection = (billId) => {
    setForm((current) => {
      const exists = current.bill_ids.some(
        (id) => String(id) === String(billId),
      );
      if (exists) {
        return {
          ...current,
          bill_ids: current.bill_ids.filter(
            (id) => String(id) !== String(billId),
          ),
        };
      }
      return { ...current, bill_ids: [...current.bill_ids, String(billId)] };
    });
  };

  const savePayment = async () => {
    const { data } = await fetchRoute("admin/bills/manual-payment", {
      method: "POST",
      data: {
        bill_ids: form.bill_ids.map((id) => Number(id)),
        payment_channel: form.payment_channel,
        payment_date: form.payment_date,
      },
    });
    return data;
  };

  const printTransaction = async ({
    transactionId,
    referenceNo,
    studentId,
  }) => {
    if (referenceNo && studentId) {
      await openRouteFile("admin/transactions/receipt", {
        reference_no: referenceNo,
        student_id: studentId,
      });
      return;
    }
    await openRouteFile("admin/transactions/receipt", {
      transaction_id: transactionId,
    });
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
      const selectedStudentIds = Array.from(
        new Set(selectedBills.map((item) => String(item.student_id || ""))),
      ).filter((id) => id !== "");
      const isSingleStudentSelection = selectedStudentIds.length === 1;

      if (isSingleStudentSelection) {
        await printTransaction({
          referenceNo: data?.reference_no,
          studentId: Number(selectedStudentIds[0]),
          transactionId: data?.transaction_id,
        });
      }
      setMessage({
        type: "success",
        text: isSingleStudentSelection
          ? `${data?.message || "Pembayaran berhasil disimpan"}${data?.reference_no ? ` Ref: ${data.reference_no}` : ""}`
          : `${data?.message || "Pembayaran berhasil disimpan"}${data?.reference_no ? ` Ref: ${data.reference_no}` : ""}. Cetak kuitansi per transaksi dari daftar pembayaran.`,
      });
      setPaymentDialogOpen(false);
      navigate("/admin/pembayaran/list", { replace: true });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message ||
          error?.message ||
          "Gagal mencetak pembayaran",
      });
    } finally {
      setSaving(false);
    }
  };

  const openPaymentDialog = (event) => {
    event.preventDefault();
    if (!form.bill_ids.length) return;
    setPaymentDialogOpen(true);
  };

  return (
    <Layout
      title="Pembayaran"
      subtitle="Input pembayaran langsung oleh bendahara untuk tagihan siswa yang belum lunas."
      actions={
        <button
          className="btn-accent"
          onClick={() => navigate("/admin/pembayaran/list")}
        >
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
            <p className="text-sm text-slate-500">
              Pilih tagihan belum lunas lalu simpan transaksi pembayaran manual.
            </p>
          </div>
        </div>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={openPaymentDialog}
        >
          <div className="h-full">
            <label className="label">Filter Kelas</label>
            <select
              className="input"
              value={form.class_id}
              onChange={(e) =>
                setForm((current) => ({
                  ...current,
                  class_id: e.target.value,
                  student_id: "",
                  bill_ids: [],
                }))
              }
            >
              <option value="">Semua Kelas</option>
              {meta.classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-full">
            <label className="label">Filter Siswa</label>
            <div className="relative" ref={studentDropdownRef}>
              <input
                className="input"
                placeholder={
                  studentOptions.length === 0
                    ? "Tidak ada siswa"
                    : "Cari nama/NIM siswa..."
                }
                value={studentSearch}
                disabled={studentOptions.length === 0}
                onFocus={() => setStudentDropdownOpen(true)}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setStudentDropdownOpen(true);
                  if (form.student_id) {
                    setForm((current) => ({
                      ...current,
                      student_id: "",
                      bill_ids: [],
                    }));
                  }
                }}
              />

              {studentDropdownOpen && studentOptions.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-300 bg-white p-1 shadow-lg">
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        student_id: "",
                        bill_ids: [],
                      }));
                      setStudentSearch("");
                      setStudentDropdownOpen(false);
                    }}
                  >
                    Semua Siswa
                  </button>
                  {filteredStudentOptions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setForm((current) => ({
                          ...current,
                          student_id: String(item.id),
                          bill_ids: [],
                        }));
                        setStudentSearch(`${item.name} - ${item.nis || "-"}`);
                        setStudentDropdownOpen(false);
                      }}
                    >
                      {item.name} - {item.nis || "-"}
                    </button>
                  ))}
                  {filteredStudentOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-slate-500">
                      Siswa tidak ditemukan
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
            <div>
              <label className="label">Tagihan</label>
              <div className="relative" ref={billDropdownRef}>
                <button
                  type="button"
                  className="input flex items-center justify-between text-left"
                  disabled={billOptions.length === 0 || loading}
                  onClick={() => setBillDropdownOpen((open) => !open)}
                >
                  <span className="truncate">{selectedBillLabel}</span>
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-black transition-transform ${billDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {billDropdownOpen && billOptions.length > 0 && !loading && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-300 bg-white p-2 shadow-lg">
                    <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                      <button
                        type="button"
                        className="text-sky-700 hover:underline"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            bill_ids: billOptions.map((item) =>
                              String(item.id),
                            ),
                          }))
                        }
                      >
                        Pilih semua
                      </button>
                      <button
                        type="button"
                        className="text-slate-600 hover:underline"
                        onClick={() =>
                          setForm((current) => ({ ...current, bill_ids: [] }))
                        }
                      >
                        Kosongkan
                      </button>
                    </div>
                    <div className="space-y-1">
                      {billOptions.map((item) => {
                        const checked = form.bill_ids.some(
                          (id) => String(id) === String(item.id),
                        );
                        return (
                          <label
                            key={item.id}
                            className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleBillSelection(item.id)}
                              className="mt-0.5"
                            />
                            <span className="text-sm text-slate-700">
                              {form.student_id ? "" : `${item.student_name} - `}
                              {item.bill_name} -{formatPeriod(item.period)} -{" "}
                              {formatCurrency(item.amount)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Kanal pembayaran</label>
                <select
                  className="input"
                  value={form.payment_channel}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      payment_channel: e.target.value,
                    }))
                  }
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
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      payment_date: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 md:col-span-2">
            <button
              className="btn-primary"
              disabled={!form.bill_ids.length || saving}
            >
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
        {selectedBills.length > 0 ? (
          <>
            <div className="mx-auto w-[860px] max-w-full rounded-xl border border-slate-300 bg-white p-2.5 text-[12px] leading-tight text-slate-800">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold tracking-wide text-slate-900">
                    MADSC PAYMENT
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Konfirmasi transaksi pembayaran siswa
                  </p>
                </div>
                <div className="border border-slate-500 px-2.5 py-1 text-[11px] font-semibold text-slate-900">
                  KUITANSI
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-1 md:grid-cols-2">
                <div className="space-y-1">
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Diterima dari
                    </span>
                    :{" "}
                    {selectedBills.length === 1
                      ? selectedBills[0].student_name
                      : "Beberapa siswa"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Nomor Induk
                    </span>
                    :{" "}
                    {selectedBills.length === 1
                      ? selectedBills[0].nis || "-"
                      : "-"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Kelas
                    </span>
                    :{" "}
                    {selectedBills.length === 1
                      ? selectedBills[0].class_name || "-"
                      : "-"}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Status Siswa
                    </span>
                    : Akan Lunas
                  </p>
                </div>
                <div className="space-y-1">
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Tgl. Bayar
                    </span>
                    : {formatDate(form.payment_date)}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      No. Bukti
                    </span>
                    : Otomatis saat disimpan
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Metode
                    </span>
                    : {form.payment_channel}
                  </p>
                  <p>
                    <span className="inline-block w-28 font-semibold">
                      Petugas
                    </span>
                    : ADMIN
                  </p>
                </div>
              </div>

              <div className="my-1.5 border-t border-dashed border-slate-400" />

              <div className="grid gap-3 md:grid-cols-[1fr_240px]">
                <div>
                  <p className="mb-1 font-semibold">
                    Dengan rincian pembayaran sebagai berikut:
                  </p>
                  <div className="space-y-1 border-y border-slate-300 py-1.5">
                    {selectedBills.map((bill, index) => (
                      <div
                        key={bill.id}
                        className="grid grid-cols-[1fr_auto] gap-2"
                      >
                        <p>
                          {index + 1}. {bill.bill_name} (
                          {formatPeriod(bill.period)})
                        </p>
                        <p className="font-semibold">
                          {formatCurrency(bill.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-1 border-t border-slate-300 pt-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">Jumlah</span>
                    <span>{formatCurrency(selectedBillsTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Pembayaran</span>
                    <span>{formatCurrency(selectedBillsTotal)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-400 pb-1">
                    <span className="font-semibold">Kembali</span>
                    <span>Rp0</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPaymentDialogOpen(false)}
                disabled={saving}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveOnly}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={saveAndPrint}
                disabled={saving}
              >
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
