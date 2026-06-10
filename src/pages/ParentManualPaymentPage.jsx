import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Copy, Landmark, QrCode } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { formatCurrency, formatDate } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";
import QRCode from "qrcode";
import logoBri from "../assets/banks/bri.svg";
import logoBca from "../assets/banks/bca.svg";
import logoBni from "../assets/banks/bni.svg";
import logoMandiri from "../assets/banks/mandiri.svg";
import logoBsi from "../assets/banks/bsi.svg";
import logoBtn from "../assets/banks/btn.svg";
import logoMuamalat from "../assets/banks/muamalat.png";

const getBillRemainingAmount = (bill) => {
  if (bill?.remaining_amount != null) return Number(bill.remaining_amount || 0);
  return Math.max(Number(bill?.amount || 0) - Number(bill?.paid_amount || 0), 0);
};

const getBillStatusLabel = (status) => {
  if (status === "paid") return "Lunas";
  if (status === "partial") return "Sebagian";
  return "Belum Lunas";
};

const getBillPostKey = (bill) => String(bill?.finance_post_id || bill?.bill_name || "");

const normalizeAmountInput = (value) => String(value || "").replace(/[^\d]/g, "");

const getBillBlockedReason = (bill, allBills) => {
  const currentId = Number(bill?.id || 0);
  const postKey = getBillPostKey(bill);
  if (!currentId || !postKey) return "";

  const olderBill = allBills.find((candidate) => {
    if (!candidate || candidate.status === "paid") return false;
    if (getBillPostKey(candidate) !== postKey) return false;
    const candidateId = Number(candidate.id || 0);
    if (!candidateId || candidateId === currentId) return false;

    const candidateDueDate = String(candidate.due_date || "");
    const currentDueDate = String(bill?.due_date || "");
    if (candidateDueDate && currentDueDate && candidateDueDate !== currentDueDate) {
      return candidateDueDate < currentDueDate;
    }

    return candidateId < currentId;
  });

  if (!olderBill) return "";
  return `Tagihan ${olderBill.bill_name} periode ${olderBill.period} harus diselesaikan lebih dulu.`;
};

function sanitizeQrisPayloadInput(payload) {
  return String(payload || "").replace(/[\r\n\t]/g, "").trim();
}

function calculateQrisCrc16(value) {
  let crc = 0xffff;

  for (let index = 0; index < value.length; index += 1) {
    crc ^= value.charCodeAt(index) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeQrisPayload(payload) {
  if (!payload) return { payload: "", error: "" };
  if (!/^[\x20-\x7E]+$/.test(payload)) {
    return { payload, error: "Payload QRIS mengandung karakter yang tidak valid." };
  }
  if (!payload.startsWith("000201")) {
    return { payload, error: "Payload QRIS tidak valid." };
  }
  if (payload.length < 50) {
    return { payload, error: "Payload QRIS terlalu pendek." };
  }

  const checksumMatch = payload.match(/6304([0-9A-Fa-f]{4})$/);
  if (!checksumMatch) {
    return { payload, error: "Payload QRIS tidak memiliki CRC yang valid." };
  }

  let cursor = 0;
  while (cursor < payload.length) {
    if (cursor + 4 > payload.length) {
      return { payload, error: "Struktur payload QRIS terpotong." };
    }

    const tagLength = payload.slice(cursor + 2, cursor + 4);
    if (!/^\d{2}$/.test(tagLength)) {
      return { payload, error: "Struktur payload QRIS tidak valid." };
    }

    const valueLength = Number(tagLength);
    cursor += 4;
    if (cursor + valueLength > payload.length) {
      return { payload, error: "Panjang data payload QRIS tidak konsisten." };
    }

    const tag = payload.slice(cursor - 4, cursor - 2);
    cursor += valueLength;

    if (tag === "63" && cursor !== payload.length) {
      return { payload, error: "CRC QRIS harus berada di bagian akhir payload." };
    }
  }

  const payloadWithoutChecksum = payload.slice(0, -4);
  return {
    payload: `${payloadWithoutChecksum}${calculateQrisCrc16(payloadWithoutChecksum)}`,
    error: "",
  };
}

function parseBankAccounts(bankAccount) {
  const text = String(bankAccount || "").trim();
  if (!text) return [];

  return text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines, index) => {
      if (lines.length === 1) {
        return {
          id: `bank-${index}`,
          bankName: `Rekening ${index + 1}`,
          accountNumber: lines[0],
          accountHolder: "",
          copyText: lines[0],
        };
      }

      if (lines.length === 2) {
        return {
          id: `bank-${index}`,
          bankName: lines[0],
          accountNumber: lines[1],
          accountHolder: "",
          copyText: lines[1],
        };
      }

      const [bankName, accountNumber, ...holderLines] = lines;
      return {
        id: `bank-${index}`,
        bankName,
        accountNumber,
        accountHolder: holderLines.join(" "),
        copyText: accountNumber,
      };
    });
}

function getBankBrand(bankName) {
  const normalized = String(bankName || "").toLowerCase();

  if (normalized.includes("bri")) {
    return {
      shortName: "BRI",
      logoSrc: logoBri,
      logoClassName: "max-h-7 max-w-full",
    };
  }
  if (normalized.includes("bca")) {
    return {
      shortName: "BCA",
      logoSrc: logoBca,
      logoClassName: "max-h-5.5 max-w-full",
    };
  }
  if (normalized.includes("bni")) {
    return {
      shortName: "BNI",
      logoSrc: logoBni,
      logoClassName: "max-h-6 max-w-full",
    };
  }
  if (normalized.includes("mandiri")) {
    return {
      shortName: "MAND",
      logoSrc: logoMandiri,
      logoClassName: "max-h-5.5 max-w-full",
    };
  }
  if (normalized.includes("bsi") || normalized.includes("syariah indonesia")) {
    return {
      shortName: "BSI",
      logoSrc: logoBsi,
      logoClassName: "max-h-4.5 max-w-full",
    };
  }
  if (normalized.includes("btn")) {
    return {
      shortName: "BTN",
      logoSrc: logoBtn,
      logoClassName: "max-h-5 max-w-full",
    };
  }
  if (normalized.includes("muamalat")) {
    return {
      shortName: "BMI",
      logoSrc: logoMuamalat,
      logoClassName: "max-h-5 max-w-full",
    };
  }

  return {
    shortName: String(bankName || "BANK")
      .replace(/[^A-Za-z0-9 ]/g, "")
      .trim()
      .split(/\s+/)
      .map((part) => part.slice(0, 1))
      .join("")
      .slice(0, 4)
      .toUpperCase() || "BANK",
    logoSrc: "",
    logoClassName: "",
  };
}

export default function ParentManualPaymentPage() {
  const navigate = useNavigate();
  const { confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [bills, setBills] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState(null);
  const [qrisImageUrl, setQrisImageUrl] = useState("");
  const [copyingAccountId, setCopyingAccountId] = useState("");
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" });
  const popConfirmingRef = useRef(false);

  useToastMessage(message, setMessage);

  const requestedBillIds = useMemo(
    () =>
      (searchParams.get("bill_ids") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [searchParams],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: billsData }, { data: dashboardData }] = await Promise.all([
          fetchRoute("parent/bills"),
          fetchRoute("parent/dashboard"),
        ]);
        setBills(Array.isArray(billsData) ? billsData : []);
        setSettings(dashboardData?.settings || {});
      } catch (error) {
        setMessage({
          type: "error",
          text: error?.response?.data?.message || "Gagal memuat pembayaran manual",
        });
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    if (allowNavigation) return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [allowNavigation]);

  useEffect(() => {
    if (allowNavigation) return undefined;

    window.history.pushState({ parentManualPaymentGuard: true }, "", window.location.href);

    const handlePopState = async () => {
      if (allowNavigation || popConfirmingRef.current) return;

      popConfirmingRef.current = true;
      const confirmed = await confirm({
        title: "Tinggalkan pembayaran manual?",
        description: "Bukti pembayaran yang sedang Anda siapkan belum dikirim.",
        confirmLabel: "Ya, tinggalkan",
        cancelLabel: "Tetap di sini",
        variant: "danger",
      });

      if (confirmed) {
        setAllowNavigation(true);
        window.history.back();
      } else {
        window.history.pushState({ parentManualPaymentGuard: true }, "", window.location.href);
      }

      popConfirmingRef.current = false;
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [allowNavigation, confirm]);

  const selectedBills = useMemo(
    () =>
      bills.filter(
        (bill) =>
          requestedBillIds.includes(String(bill.id)) &&
          bill.status !== "paid" &&
          bill.proof_status !== "pending" &&
          bill.proof_status !== "approved",
      ),
    [bills, requestedBillIds],
  );

  const blockedSelectedBills = useMemo(
    () =>
      selectedBills
        .map((bill) => ({
          ...bill,
          blocked_reason: getBillBlockedReason(bill, bills),
        }))
        .filter((bill) => bill.blocked_reason),
    [bills, selectedBills],
  );

  const payableSelectedBills = useMemo(
    () => selectedBills.filter((bill) => !getBillBlockedReason(bill, bills)),
    [bills, selectedBills],
  );

  const totalPayment = payableSelectedBills.reduce(
    (total, bill) => total + getBillRemainingAmount(bill),
    0,
  );
  const selectedBillStudentIds = useMemo(
    () =>
      Array.from(
        new Set(payableSelectedBills.map((bill) => String(bill.student_id || ""))),
      ).filter((id) => id !== ""),
    [payableSelectedBills],
  );
  const canUseCustomAmount =
    selectedBillStudentIds.length === 1 &&
    payableSelectedBills.some((bill) => !!bill?.is_flexible_installment);
  const parsedPaymentAmount = Number(paymentAmount || 0);
  const effectivePaymentAmount = canUseCustomAmount ? parsedPaymentAmount : totalPayment;
  const bankAccounts = useMemo(() => parseBankAccounts(settings?.bank_account || ""), [settings]);
  const rawQrisPayload = useMemo(
    () => sanitizeQrisPayloadInput(settings?.qris_mpm_statis_payload || ""),
    [settings],
  );
  const normalizedQris = useMemo(() => normalizeQrisPayload(rawQrisPayload), [rawQrisPayload]);
  const qrisPayload = normalizedQris.payload;
  const qrisPayloadError = normalizedQris.error;

  useEffect(() => {
    setPaymentAmount(canUseCustomAmount ? String(totalPayment) : "");
  }, [canUseCustomAmount, totalPayment]);

  useEffect(() => {
    if (!qrisPayload || qrisPayloadError) {
      setQrisImageUrl("");
      return undefined;
    }

    let active = true;
    QRCode.toDataURL(qrisPayload, {
      errorCorrectionLevel: "L",
      margin: 1,
      width: 512,
      rendererOpts: {
        quality: 1,
      },
    })
      .then((url) => {
        if (active) setQrisImageUrl(url);
      })
      .catch(() => {
        if (active) setQrisImageUrl("");
      });

    return () => {
      active = false;
    };
  }, [qrisPayload, qrisPayloadError]);

  const confirmLeavePage = async () => {
    if (allowNavigation) return true;

    const confirmed = await confirm({
      title: "Tinggalkan pembayaran manual?",
      description: "Bukti pembayaran yang sedang Anda siapkan belum dikirim.",
      confirmLabel: "Ya, tinggalkan",
      cancelLabel: "Tetap di sini",
      variant: "danger",
    });

    if (confirmed) setAllowNavigation(true);
    return confirmed;
  };

  const submitProof = async () => {
    if (!payableSelectedBills.length) {
      setMessage({ type: "warning", text: "Tidak ada tagihan yang dipilih." });
      return;
    }
    if (blockedSelectedBills.length) {
      setMessage({
        type: "warning",
        text:
          blockedSelectedBills[0]?.blocked_reason ||
          "Masih ada tagihan lama yang harus diselesaikan lebih dulu.",
      });
      return;
    }
    if (!file) {
      setMessage({ type: "error", text: "Pilih file bukti pembayaran terlebih dahulu." });
      return;
    }
    if (canUseCustomAmount && effectivePaymentAmount <= 0) {
      setMessage({ type: "warning", text: "Masukkan nominal pembayaran lebih dari Rp0." });
      return;
    }

    const formData = new FormData();
    payableSelectedBills.forEach((bill) => formData.append("bill_ids[]", bill.id));
    if (canUseCustomAmount) {
      formData.append("payment_amount", String(effectivePaymentAmount));
    }
    formData.append(
      "notes",
      canUseCustomAmount
        ? `Upload bukti manual dari halaman pembayaran orang tua (nominal: ${formatCurrency(effectivePaymentAmount)})`
        : "Upload bukti manual dari halaman pembayaran orang tua",
    );
    formData.append("file", file);

    try {
      setSaving(true);
      const { data } = await fetchRoute("parent/payment-proofs", {
        method: "POST",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });
      setMessage({ type: "success", text: data?.message || "Bukti pembayaran berhasil dikirim" });
      setAllowNavigation(true);
      navigate("/orang-tua/tagihan");
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Gagal mengunggah bukti pembayaran",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyBankAccount = async (account) => {
    if (!account?.copyText) return;

    try {
      setCopyingAccountId(account.id);
      await navigator.clipboard.writeText(account.copyText);
      setMessage({ type: "success", text: "Nomor rekening berhasil disalin" });
    } catch {
      setMessage({ type: "error", text: "Gagal menyalin nomor rekening" });
    } finally {
      setCopyingAccountId("");
    }
  };

  return (
    <Layout
      title="Pembayaran Manual"
      subtitle="Unggah bukti transfer untuk tagihan yang dipilih."
      showHeader={false}
      onNavigateAttempt={confirmLeavePage}
    >
      <button
        type="button"
        className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur transition hover:border-slate-400 hover:bg-white sm:bottom-5 sm:right-5 sm:px-4 sm:py-3"
        onClick={async () => {
          const confirmed = await confirmLeavePage();
          if (!confirmed) return;
          navigate("/orang-tua/tagihan/pembayaran");
        }}
      >
        <ArrowLeft size={16} />
        Kembali
      </button>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,1fr)_360px]">
        <div className="card p-4 sm:p-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Pembayaran Manual
          </p>
          <h3 className="section-title mt-1">Tagihan yang akan dibayar</h3>
          <div className="mt-4 space-y-3">
            {selectedBills.length ? (
              selectedBills.map((bill) => (
                <div key={bill.id} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{bill.bill_name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {bill.period || "-"} | Jatuh tempo {formatDate(bill.due_date)}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-slate-700 sm:text-right">
                      <p>{formatCurrency(getBillRemainingAmount(bill))}</p>
                      <p className="mt-1 text-xs font-normal text-slate-500">
                        {getBillStatusLabel(bill.status)} · dari {formatCurrency(bill.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-slate-50 px-4 py-6 text-sm text-slate-500">
                {loading ? "Memuat tagihan..." : "Tidak ada tagihan valid yang dipilih."}
              </div>
            )}
          </div>
        </div>

        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-100 p-2.5 text-amber-700 sm:p-3">
              <Landmark size={18} />
            </div>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Ringkasan Transfer
              </p>
              <h3 className="section-title mt-1">Informasi pembayaran</h3>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {canUseCustomAmount ? "Nominal Pembayaran" : "Total Sisa Pembayaran"}
            </p>
            {canUseCustomAmount ? (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  className="input mt-2 text-xl font-bold text-slate-900 sm:text-2xl"
                  value={formatCurrency(paymentAmount)}
                  onChange={(event) => setPaymentAmount(normalizeAmountInput(event.target.value))}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Masukkan nominal yang akan Bapak/Ibu transfer untuk tagihan fleksibel. Nominal ini hanya berlaku untuk satu siswa/santri dan akan dicocokkan dengan bukti pembayaran yang diunggah.
                </p>
              </>
            ) : (
              <p className="mt-2 text-xl font-bold text-slate-900 sm:text-2xl">
                {formatCurrency(totalPayment)}
              </p>
            )}
          </div>

          {blockedSelectedBills.length ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {blockedSelectedBills[0].blocked_reason}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Rekening Bank
            </p>
            <div className="mt-3 space-y-3">
              {bankAccounts.length ? (
                bankAccounts.map((account) => (
                  (() => {
                    const brand = getBankBrand(account.bankName);
                    return (
                      <div
                        key={account.id}
                        className="grid min-h-[72px] grid-cols-[40px_minmax(0,1fr)_36px] items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:flex"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl p-1">
                          {brand.logoSrc ? (
                            <img
                              src={brand.logoSrc}
                              alt={account.bankName}
                              className={`${brand.logoClassName || "max-h-6 max-w-full"} object-contain`}
                            />
                          ) : (
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                              {brand.shortName}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 pt-0.5 sm:flex-1">
                          <p className="break-words text-sm font-bold uppercase tracking-[0.08em] text-slate-900">
                            {account.accountNumber || "-"}
                          </p>
                          <p className="mt-1 break-words text-xs font-medium text-slate-500">
                            {account.accountHolder || account.bankName}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                          disabled={copyingAccountId === account.id}
                          onClick={() => copyBankAccount(account)}
                          aria-label={`Salin rekening ${account.bankName}`}
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    );
                  })()
                ))
              ) : (
                <p className="text-sm text-slate-500">Rekening bank belum tersedia.</p>
              )}
            </div>
          </div>

          {qrisPayload ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  QRIS MPM Statis
                </p>
                <QrCode size={16} className="text-emerald-700" />
              </div>
              <div className="mt-3 flex justify-center rounded-lg bg-white p-3">
                {qrisPayloadError ? (
                  <p className="text-center text-xs text-rose-600">{qrisPayloadError}</p>
                ) : qrisImageUrl ? (
                  <img
                    src={qrisImageUrl}
                    alt="QRIS MPM Statis"
                    className="h-48 w-48 object-contain [image-rendering:pixelated] sm:h-56 sm:w-56"
                  />
                ) : (
                  <p className="text-xs text-slate-500">Gagal menampilkan QRIS</p>
                )}
              </div>
              <p className="mt-3 text-xs text-emerald-800">
                Scan QRIS di atas, lalu transfer sesuai total tagihan.
              </p>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            <label className="label">Upload bukti pembayaran</label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="input"
              disabled={
                saving ||
                !payableSelectedBills.length ||
                blockedSelectedBills.length > 0 ||
                (canUseCustomAmount && effectivePaymentAmount <= 0)
              }
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <p className="text-xs text-slate-500">
              {file?.name || "Format file: JPG, PNG, atau PDF"}
            </p>
          </div>

          <button
            type="button"
            className="btn-primary mt-4 w-full justify-center"
            disabled={
              saving ||
              !payableSelectedBills.length ||
              blockedSelectedBills.length > 0 ||
              (canUseCustomAmount && effectivePaymentAmount <= 0)
            }
            onClick={submitProof}
          >
            {saving ? "Mengirim bukti..." : "Kirim bukti pembayaran"}
          </button>
        </div>
      </div>
    </Layout>
  );
}
