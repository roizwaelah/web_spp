import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, HandCoins, Printer } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute, openRouteFile } from "../api";
import { formatCurrency, formatDate, formatPeriod, roleLabel } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import ModalFrame from "../components/ModalFrame";
import { useAuth } from "../context/AuthContext";

const sortReceiptItems = (items = []) =>
  [...items].sort((left, right) => {
    const leftPeriod = String(left?.period || "");
    const rightPeriod = String(right?.period || "");
    if (leftPeriod !== rightPeriod) {
      return leftPeriod.localeCompare(rightPeriod, "id");
    }

    const leftName = String(left?.bill_name || "").trim();
    const rightName = String(right?.bill_name || "").trim();
    const nameCompare = leftName.localeCompare(rightName, "id", {
      sensitivity: "base",
    });
    if (nameCompare !== 0) return nameCompare;

    return Number(left?.id || 0) - Number(right?.id || 0);
  });

const getOfficerPreviewName = (user) => {
  const name = String(user?.name || "").trim();
  if (name) return name;
  if (user?.role) return roleLabel(user.role).toUpperCase();
  return "ADMIN";
};

const initialForm = {
  student_id: "",
  bill_ids: [],
  payment_amount: "",
  payment_channel: "",
  payment_date: new Date().toISOString().slice(0, 10),
};

const normalizeAmountInput = (value) => String(value || "").replace(/\D/g, "");

const getBillRemainingAmount = (bill) => {
  if (bill?.remaining_amount != null) return Number(bill.remaining_amount || 0);
  return Math.max(Number(bill?.amount || 0) - Number(bill?.paid_amount || 0), 0);
};

const getBillStatusLabel = (status) => {
  if (status === "paid") return "Lunas";
  if (status === "partial") return "Sebagian";
  return "Belum Lunas";
};

const studentStatusOptions = [
  { value: "active", label: "Aktif" },
  { value: "graduated", label: "Lulus" },
  { value: "inactive", label: "Nonaktif" },
];

const getDepositCreditAmount = (data) => Number(data?.deposit_credit_amount || 0);

const formatPaymentSuccessMessage = (data, fallbackMessage) => {
  const depositCreditAmount = getDepositCreditAmount(data);
  return `${data?.message || fallbackMessage}${data?.reference_no ? ` Ref: ${data.reference_no}` : ""}${depositCreditAmount > 0 ? ` Deposit: ${formatCurrency(depositCreditAmount)}` : ""}`;
};

export default function PaymentEditPage() {
  const [meta, setMeta] = useState({ classes: [], students: [] });
  const [schoolProfile, setSchoolProfile] = useState({
    school_name: "MADSC PAYMENT",
    school_address: "Konfirmasi transaksi pembayaran siswa",
  });
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
  const [studentStatusFilter, setStudentStatusFilter] = useState(location.state?.student_status || "");
  const navigate = useNavigate();
  const { user } = useAuth();

  useToastMessage(message, setMessage);

  useEffect(() => {
    if (location.state?.student_id) {
      setForm((current) => ({
        ...current,
        student_id: location.state?.student_id || "",
      }));
    }
  }, [location.state]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [{ data }, { data: settingsData }] = await Promise.all([
          fetchRoute("admin/meta"),
          fetchRoute("admin/settings/profile"),
        ]);
        setMeta({
          classes: Array.isArray(data?.classes) ? data.classes : [],
          students: Array.isArray(data?.students) ? data.students : [],
        });
        setSchoolProfile({
          school_name:
            (settingsData?.school_name || "MADSC PAYMENT").trim() ||
            "MADSC PAYMENT",
          school_address:
            (
              settingsData?.school_address ||
              "Konfirmasi transaksi pembayaran siswa"
            ).trim() || "Konfirmasi transaksi pembayaran siswa",
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
            ...(studentStatusFilter ? { student_status: studentStatusFilter } : {}),
            ...(form.student_id ? { student_id: form.student_id } : {}),
          },
        });
        setBillRows(
          Array.isArray(data)
            ? data.filter((item) => item?.status !== "paid")
            : [],
        );
      } catch (error) {
        setMessage({
          type: "error",
          text:
            error?.response?.data?.message ||
            "Gagal memuat daftar tagihan terbuka",
        });
      } finally {
        setLoading(false);
      }
    };

    loadBills();
  }, [studentStatusFilter, form.student_id]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (billDropdownRef.current && !billDropdownRef.current.contains(event.target)) {
        setBillDropdownOpen(false);
      }
      if (studentDropdownRef.current && !studentDropdownRef.current.contains(event.target)) {
        setStudentDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const studentOptions = useMemo(
    () =>
      meta.students
        .filter((item) => !studentStatusFilter || item.status === studentStatusFilter)
        .sort((a, b) => a.name.localeCompare(b.name, "id")),
    [meta.students, studentStatusFilter],
  );

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
      const text = `${item.name || ""} ${item.nis || ""} ${item.nisn || ""}`.toLowerCase();
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
      selectedBills.reduce((sum, item) => sum + getBillRemainingAmount(item), 0),
    [selectedBills],
  );

  const selectedBillStudentIds = useMemo(
    () =>
      Array.from(
        new Set(selectedBills.map((item) => String(item.student_id || ""))),
      ).filter((id) => id !== ""),
    [selectedBills],
  );

  const canUseCustomAmount =
    selectedBillStudentIds.length === 1 &&
    selectedBills.some((item) => !!item?.is_flexible_installment);
  const customPaymentAmount = Number(form.payment_amount || 0);
  const paymentAmount = canUseCustomAmount ? customPaymentAmount : selectedBillsTotal;
  const customDepositBase =
    selectedBills.length === 1
      ? getBillRemainingAmount(selectedBills[0])
      : selectedBillsTotal;
  const customDepositEstimate = canUseCustomAmount
    ? Math.max(paymentAmount - customDepositBase, 0)
    : 0;

  const selectedBillLabel = useMemo(() => {
    if (loading) return "Memuat tagihan...";
    if (billOptions.length === 0) return "Tidak ada tagihan terbuka";
    if (selectedBills.length === 0) return "Pilih satu atau beberapa tagihan";
    if (selectedBills.length === 1) {
      const item = selectedBills[0];
      return `${item.bill_name} (${formatPeriod(item.period)}) - sisa ${formatCurrency(getBillRemainingAmount(item))}`;
    }
    return `${selectedBills.length} tagihan dipilih - sisa ${formatCurrency(selectedBillsTotal)}`;
  }, [billOptions.length, loading, selectedBills, selectedBillsTotal]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      payment_amount: canUseCustomAmount ? String(selectedBillsTotal) : "",
    }));
  }, [canUseCustomAmount, selectedBillsTotal]);

  const receiptBills = useMemo(
    () => sortReceiptItems(selectedBills),
    [selectedBills],
  );

  const receiptPaymentByBillId = useMemo(() => {
    const allocations = new Map();
    if (!canUseCustomAmount) return allocations;
    if (selectedBills.length === 1) {
      allocations.set(String(selectedBills[0].id), paymentAmount);
      return allocations;
    }

    let remainingToAllocate = paymentAmount;
    receiptBills.forEach((bill) => {
      const remainingAmount = getBillRemainingAmount(bill);
      const allocatedAmount = Math.min(remainingAmount, Math.max(remainingToAllocate, 0));
      allocations.set(String(bill.id), allocatedAmount);
      remainingToAllocate -= allocatedAmount;
    });
    return allocations;
  }, [canUseCustomAmount, paymentAmount, receiptBills, selectedBills]);

  const toggleBillSelection = (billId) => {
    setForm((current) => {
      const exists = current.bill_ids.some((id) => String(id) === String(billId));
      if (exists) {
        return {
          ...current,
          bill_ids: current.bill_ids.filter((id) => String(id) !== String(billId)),
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
        ...(canUseCustomAmount ? { payment_amount: paymentAmount } : {}),
      },
    });
    return data;
  };

  const printTransaction = async ({ transactionId, referenceNo, studentId }) => {
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
        text: formatPaymentSuccessMessage(data, "Pembayaran berhasil disimpan"),
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
        text:
          isSingleStudentSelection
            ? formatPaymentSuccessMessage(data, "Pembayaran berhasil disimpan")
            : `${formatPaymentSuccessMessage(data, "Pembayaran berhasil disimpan")}. Cetak kuitansi per transaksi dari daftar pembayaran.`,
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
    if (canUseCustomAmount && paymentAmount <= 0) {
      setMessage({
        type: "warning",
        text: "Masukkan nominal pembayaran lebih dari Rp0.",
      });
      return;
    }
    setPaymentDialogOpen(true);
  };

  return (
    <Layout
      title="Pembayaran"
      subtitle="Input pembayaran langsung oleh bendahara untuk tagihan siswa yang masih terbuka."
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
              Pilih tagihan terbuka lalu simpan transaksi pembayaran manual.
            </p>
          </div>
        </div>

        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={openPaymentDialog}
        >
          <div>
            <label className="label">Status Siswa</label>
            <select
              className="input"
              value={studentStatusFilter}
              onChange={(e) => {
                setStudentStatusFilter(e.target.value);
                setStudentSearch("");
                setForm((current) => ({
                  ...current,
                  student_id: "",
                  bill_ids: [],
                }));
              }}
            >
              <option value="">Semua status siswa</option>
              {studentStatusOptions.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
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
                    : "Cari nama/NIS siswa..."
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
                            bill_ids: billOptions.map((item) => String(item.id)),
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
                            <span className="min-w-0 text-sm text-slate-700">
                              <span className="block font-semibold text-slate-900">
                                {form.student_id ? "" : `${item.student_name} - `}{item.bill_name} - {formatPeriod(item.period)}
                              </span>
                              <span className="mt-1 flex flex-wrap gap-1.5">
                                {Number(item.deposit_balance || 0) > 0 ? (
                                  <span className="badge-slate">
                                    Deposit {formatCurrency(item.deposit_balance)}
                                  </span>
                                ) : null}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="label">Nominal diterima</label>
              <input
                type="text"
                inputMode="numeric"
                className="input"
                value={canUseCustomAmount ? formatCurrency(form.payment_amount) : formatCurrency(selectedBillsTotal)}
                disabled={!canUseCustomAmount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payment_amount: normalizeAmountInput(event.target.value),
                  }))
                }
              />
              <p className="mt-1 text-xs text-slate-500">
                {canUseCustomAmount
                  ? "Cicilan fleksibel: nominal dapat disesuaikan untuk satu tagihan ini."
                  : "Nominal otomatis mengikuti sisa tagihan untuk pembayaran penuh."}
              </p>
              {customDepositEstimate > 0 ? (
                <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 ring-1 ring-emerald-100">
                  Perkiraan lebih bayar {formatCurrency(customDepositEstimate)} akan masuk deposit siswa jika diterima backend.
                </p>
              ) : null}
            </div>
            <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
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
                  <option value="" disabled>
                    Pilih kanal
                  </option>
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
              disabled={
                !form.bill_ids.length ||
                !form.payment_channel ||
                saving ||
                (canUseCustomAmount && paymentAmount <= 0)
              }
            >
              Bayar
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setForm((current) => ({
                  ...initialForm,
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
                    {schoolProfile.school_name || "MADSC PAYMENT"}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    {schoolProfile.school_address || "Konfirmasi transaksi pembayaran siswa"}
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
                      NISN
                    </span>
                    :{" "}
                    {selectedBills.length === 1
                      ? selectedBills[0].nisn || selectedBills[0].nis || "-"
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
                    : {canUseCustomAmount && paymentAmount < selectedBillsTotal ? "Akan Sebagian" : "Akan Lunas"}
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
                    : {getOfficerPreviewName(user)}
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
                    {receiptBills.map((bill, index) => {
                      const remainingAmount = getBillRemainingAmount(bill);
                      const itemPaymentAmount = canUseCustomAmount
                        ? (receiptPaymentByBillId.get(String(bill.id)) ?? 0)
                        : remainingAmount;
                      return (
                      <div
                        key={bill.id}
                        className="grid grid-cols-[1fr_auto] gap-2"
                      >
                        <div>
                          <p>{index + 1}. {bill.bill_name} ({formatPeriod(bill.period)})</p>
                          <p className="text-[11px] text-slate-500">
                            Tagihan {formatCurrency(bill.amount)} · Terbayar {formatCurrency(bill.paid_amount)} · Sisa {formatCurrency(remainingAmount)}
                            {bill.is_flexible_installment ? " · Fleksibel" : ""}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {formatCurrency(itemPaymentAmount)}
                        </p>
                      </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1 border-t border-slate-300 pt-1">
                  <div className="flex justify-between">
                    <span className="font-semibold">Sisa Tagihan</span>
                    <span>{formatCurrency(selectedBillsTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Pembayaran</span>
                    <span>{formatCurrency(paymentAmount)}</span>
                  </div>
                  {customDepositEstimate > 0 ? (
                    <div className="flex justify-between text-emerald-700">
                      <span className="font-semibold">Masuk Deposit</span>
                      <span>{formatCurrency(customDepositEstimate)}</span>
                    </div>
                  ) : null}
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
