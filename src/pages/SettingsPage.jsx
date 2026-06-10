import { useEffect, useState } from "react";
import { Download, HardDriveDownload, Plus, Trash2 } from "lucide-react";
import Layout from "../components/Layout";
import Table from "../components/Table";
import { downloadRouteFile, fetchRoute } from "../api";
import { useUI } from "../context/UIContext";
import { useToastMessage } from "../hooks/useToastMessage";

const defaults = {
  school_name: "",
  school_address: "",
  principal_name: "",
  treasurer_name: "",
  bank_account: "",
  qris_mpm_statis_payload: "",
  payment_gateway_enabled: false,
  payment_gateway_provider: "",
  payment_gateway_mode: "redirect",
  payment_gateway_key: "",
  ipaymu_va: "",
  ipaymu_environment: "production",
  midtrans_server_key: "",
  midtrans_client_key: "",
  midtrans_environment: "production",
  doku_client_id: "",
  doku_secret_key: "",
  doku_environment: "production",
  tripay_api_key: "",
  tripay_private_key: "",
  tripay_merchant_code: "",
  tripay_environment: "production",
  whatsapp_gateway_enabled: false,
  whatsapp_gateway_url: "",
  whatsapp_gateway_token: "",
  whatsapp_test_target: "",
  payment_proof_retention_days: "730",
  support_whatsapp: "",
  support_email: "",
  support_hours: "",
};

const emptyBankAccount = () => ({
  bank_name: "",
  account_number: "",
  account_holder: "",
});

function parseBankAccounts(value) {
  const text = String(value || "").trim();
  if (!text) return [emptyBankAccount()];

  const items = text
    .split(/\n\s*\n/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length)
    .map((lines) => ({
      bank_name: lines[0] || "",
      account_number: lines[1] || "",
      account_holder: lines.slice(2).join(" ") || "",
    }));

  return items.length ? items : [emptyBankAccount()];
}

function serializeBankAccounts(accounts) {
  return accounts
    .map((account) => [
      String(account.bank_name || "").trim(),
      String(account.account_number || "").trim(),
      String(account.account_holder || "").trim(),
    ].filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function validateBankAccounts(accounts) {
  const nonEmptyAccounts = accounts.filter(
    (account) =>
      String(account.bank_name || "").trim() ||
      String(account.account_number || "").trim() ||
      String(account.account_holder || "").trim(),
  );

  if (!nonEmptyAccounts.length) {
    return "Minimal 1 rekening harus diisi.";
  }

  for (const account of nonEmptyAccounts) {
    const bankName = String(account.bank_name || "").trim();
    const accountNumber = String(account.account_number || "").trim();
    const accountHolder = String(account.account_holder || "").trim();

    if (!bankName || !accountNumber || !accountHolder) {
      return "Setiap rekening harus berisi nama bank, nomor rekening, dan nama pemilik.";
    }

    if (!/^[0-9 ]+$/.test(accountNumber)) {
      return "Nomor rekening hanya boleh berisi angka dan spasi.";
    }
  }

  return "";
}

const PAYMENT_GATEWAY_OPTIONS = [
  { value: "iPaymu", label: "iPaymu" },
  { value: "Midtrans", label: "Midtrans" },
  { value: "DOKU", label: "DOKU" },
  { value: "Tripay", label: "Tripay" },
];

const PAYMENT_GATEWAY_MODE_OPTIONS = {
  iPaymu: [
    { value: "redirect", label: "Redirect" },
    { value: "popup", label: "Popup (Direct Payment)" },
  ],
  Midtrans: [
    { value: "redirect", label: "Redirect" },
    { value: "popup", label: "Popup" },
  ],
  DOKU: [
    { value: "redirect", label: "Redirect" },
    { value: "popup", label: "Popup" },
  ],
  Tripay: [
    { value: "redirect", label: "Redirect" },
    { value: "popup", label: "Popup (Direct Channel)" },
  ],
};

function normalizeGatewayProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  if (!provider) return "";
  if (provider.includes("ipaymu")) return "iPaymu";
  if (provider.includes("midtrans")) return "Midtrans";
  if (provider.includes("doku")) return "DOKU";
  if (provider.includes("tripay")) return "Tripay";
  return value;
}

export default function SettingsPage() {
  const [form, setForm] = useState(defaults);
  const [bankAccounts, setBankAccounts] = useState([emptyBankAccount()]);
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [cleaningProofs, setCleaningProofs] = useState(false);
  const { confirm } = useUI();

  useToastMessage(message, setMessage);

  const loadBackups = () => {
    setLoadingBackups(true);
    return fetchRoute("admin/backups")
      .then(({ data }) => {
        setBackups(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat data backup");
      })
      .finally(() => {
        setLoadingBackups(false);
      });
  };

  useEffect(() => {
    Promise.all([fetchRoute("admin/settings"), loadBackups()])
      .then(([{ data }]) => {
        const payload = data?.settings || data?.data || data || {};
        const provider = normalizeGatewayProvider(payload?.payment_gateway_provider || "");
        const allowedModes = PAYMENT_GATEWAY_MODE_OPTIONS[provider] || [];
        const incomingMode = String(payload?.payment_gateway_mode || defaults.payment_gateway_mode || "redirect").toLowerCase();
        const normalizedMode = allowedModes.some((item) => item.value === incomingMode)
          ? incomingMode
          : (allowedModes[0]?.value || "redirect");

        setForm({
          ...defaults,
          ...payload,
          payment_gateway_enabled:
            payload?.payment_gateway_enabled === true ||
            payload?.payment_gateway_enabled === 1 ||
            payload?.payment_gateway_enabled === "1",
          payment_gateway_provider: provider,
          payment_gateway_mode: normalizedMode,
          whatsapp_gateway_enabled:
            payload?.whatsapp_gateway_enabled === true ||
            payload?.whatsapp_gateway_enabled === 1 ||
            payload?.whatsapp_gateway_enabled === "1",
        });
        setBankAccounts(parseBankAccounts(payload?.bank_account || ""));
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat pengaturan");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const createBackup = async () => {
    try {
      await fetchRoute("admin/backups", { method: "POST" });
      setMessage("Backup database berhasil dibuat");
      loadBackups();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal membuat backup database");
    }
  };

  const downloadBackup = async (id) => {
    try {
      await downloadRouteFile("admin/backups/download", { id }, "backup.sql");
      setMessage("");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal mengunduh file backup");
    }
  };

  const removeBackup = async (id) => {
    const confirmed = await confirm({
      title: "Hapus file backup",
      description: "File backup yang dihapus tidak bisa dipulihkan dari aplikasi.",
      confirmLabel: "Ya, hapus",
      variant: "danger",
    });
    if (!confirmed) return;

    try {
      await fetchRoute("admin/backups", {
        method: "DELETE",
        data: { id },
      });
      setMessage("Backup berhasil dihapus");
      loadBackups();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menghapus backup");
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const bankAccountsError = validateBankAccounts(bankAccounts);
    if (bankAccountsError) {
      setMessage(bankAccountsError);
      return;
    }
    setSaving(true);
    try {
      await fetchRoute("admin/settings", {
        method: "PUT",
        data: {
          ...form,
          bank_account: serializeBankAccounts(bankAccounts),
          payment_gateway_enabled: form.payment_gateway_enabled ? "1" : "0",
          whatsapp_gateway_enabled: form.whatsapp_gateway_enabled ? "1" : "0",
        },
      });
      setMessage("Pengaturan berhasil disimpan");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const sendWhatsappTest = async () => {
    if (!form.whatsapp_test_target?.trim()) {
      setMessage("Nomor WA tujuan tes wajib diisi");
      return;
    }

    setSendingTest(true);
    try {
      const { data } = await fetchRoute("admin/settings/whatsapp-test", {
        method: "POST",
        data: { target: form.whatsapp_test_target },
      });
      setMessage(data?.message || "Tes WhatsApp berhasil dikirim");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Tes WhatsApp gagal dikirim");
    } finally {
      setSendingTest(false);
    }
  };

  const cleanupApprovedProofFiles = async () => {
    const confirmed = await confirm({
      title: "Cleanup bukti approved",
      description:
        "File fisik bukti pembayaran dengan status approved yang melewati masa retensi akan dihapus dari server, tetapi metadata bukti tetap disimpan.",
      confirmLabel: "Jalankan cleanup",
      variant: "danger",
    });
    if (!confirmed) return;

    setCleaningProofs(true);
    try {
      const { data } = await fetchRoute("admin/settings/payment-proof-cleanup", {
        method: "POST",
      });
      setMessage(data?.message || "Cleanup bukti pembayaran selesai");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Cleanup bukti pembayaran gagal");
    } finally {
      setCleaningProofs(false);
    }
  };

  const updateBankAccount = (index, field, value) => {
    setBankAccounts((current) =>
      current.map((account, accountIndex) =>
        accountIndex === index ? { ...account, [field]: value } : account,
      ),
    );
  };

  const addBankAccount = () => {
    setBankAccounts((current) => [...current, emptyBankAccount()]);
  };

  const removeBankAccount = (index) => {
    setBankAccounts((current) => {
      if (current.length === 1) return [emptyBankAccount()];
      return current.filter((_, accountIndex) => accountIndex !== index);
    });
  };

  const gatewayModeOptions = PAYMENT_GATEWAY_MODE_OPTIONS[form.payment_gateway_provider] || [];

  return (
    <Layout
      title="Pengaturan Sistem"
      subtitle="Atur profil lembaga, rekening pembayaran, payment gateway, dan WhatsApp gateway."
    >
      <form className="space-y-6" onSubmit={submit}>
        <div className="card p-6">
          <h3 className="section-title">Profil Lembaga</h3>
          <div className="mt-4 space-y-4">
            {loading && (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                Memuat pengaturan...
              </div>
            )}
            <div>
              <label className="label">Nama Lembaga</label>
              <input
                className="input"
                value={form.school_name}
                disabled={loading || saving}
                onChange={(e) =>
                  setForm({ ...form, school_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Alamat</label>
              <textarea
                className="textarea"
                value={form.school_address}
                disabled={loading || saving}
                onChange={(e) =>
                  setForm({ ...form, school_address: e.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Kepala Lembaga</label>
                <input
                  className="input"
                  value={form.principal_name}
                  disabled={loading || saving}
                  onChange={(e) =>
                    setForm({ ...form, principal_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Bendahara</label>
                <input
                  className="input"
                  value={form.treasurer_name}
                  disabled={loading || saving}
                  onChange={(e) =>
                    setForm({ ...form, treasurer_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="label mb-0">Rekening bank</label>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={loading || saving}
                  onClick={addBankAccount}
                >
                  <Plus size={16} /> Tambah Rekening
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {bankAccounts.map((account, index) => (
                  <div key={`bank-account-${index}`} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">Rekening {index + 1}</p>
                      <button
                        type="button"
                        className="btn-danger px-3 py-2"
                        disabled={loading || saving}
                        onClick={() => removeBankAccount(index)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div>
                        <label className="label">Nama Bank</label>
                        <input
                          className="input"
                          placeholder="BANK BRI"
                          value={account.bank_name}
                          disabled={loading || saving}
                          onChange={(e) => updateBankAccount(index, "bank_name", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Nomor Rekening</label>
                        <input
                          className="input"
                          placeholder="1234567890"
                          value={account.account_number}
                          disabled={loading || saving}
                          onChange={(e) => updateBankAccount(index, "account_number", e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Nama Pemilik</label>
                        <input
                          className="input"
                          placeholder="MA DARUSSALAM CILONGOK"
                          value={account.account_holder}
                          disabled={loading || saving}
                          onChange={(e) => updateBankAccount(index, "account_holder", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Tambahkan satu atau lebih rekening. Data akan dipakai pada halaman pembayaran manual orang tua.
              </p>
            </div>
            <div>
              <label className="label">Payload QRIS MPM Statis</label>
              <textarea
                className="textarea font-mono text-xs"
                placeholder="000201010211..."
                value={form.qris_mpm_statis_payload || ""}
                disabled={loading || saving}
                onChange={(e) =>
                  setForm({ ...form, qris_mpm_statis_payload: e.target.value })
                }
              />
              <p className="mt-1 text-xs text-slate-500">
                Isi dengan payload QRIS MPM statis dari penyedia QRIS. Digunakan pada pembayaran manual.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="label">WhatsApp Bantuan</label>
                <input
                  className="input"
                  placeholder="628xxxxxxxxxx"
                  value={form.support_whatsapp || ""}
                  disabled={loading || saving}
                  onChange={(e) =>
                    setForm({ ...form, support_whatsapp: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Email Bantuan</label>
                <input
                  className="input"
                  placeholder="admin@domain.sch.id"
                  value={form.support_email || ""}
                  disabled={loading || saving}
                  onChange={(e) =>
                    setForm({ ...form, support_email: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label">Jam Layanan</label>
                <input
                  className="input"
                  placeholder="Senin-Sabtu 08.00-15.00 WIB"
                  value={form.support_hours || ""}
                  disabled={loading || saving}
                  onChange={(e) =>
                    setForm({ ...form, support_hours: e.target.value })
                  }
                />
              </div>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-200 pt-6">
            <h3 className="section-title">Integrasi</h3>
            <div className="mt-4 space-y-4">
              <label className="label">Payment Gateway</label>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">Aktifkan payment gateway</p>
                </div>
                <button
                  type="button"
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                    form.payment_gateway_enabled ? "bg-sky-600" : "bg-slate-300"
                  }`}
                  disabled={loading || saving}
                  aria-pressed={form.payment_gateway_enabled}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      payment_gateway_enabled: !current.payment_gateway_enabled,
                    }))
                  }
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                      form.payment_gateway_enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Provider payment gateway</label>
                  <select
                    className="input"
                    value={form.payment_gateway_provider}
                    disabled={loading || saving}
                    onChange={(e) => {
                      const provider = e.target.value;
                      const nextModes = PAYMENT_GATEWAY_MODE_OPTIONS[provider] || [];
                      setForm({
                        ...form,
                        payment_gateway_provider: provider,
                        payment_gateway_mode: nextModes[0]?.value || "redirect",
                      });
                    }}
                  >
                    <option value="">Pilih provider</option>
                    {PAYMENT_GATEWAY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Mode gateway</label>
                  <select
                    className="input"
                    value={form.payment_gateway_mode || "redirect"}
                    disabled={loading || saving || gatewayModeOptions.length <= 1}
                    onChange={(e) =>
                      setForm({ ...form, payment_gateway_mode: e.target.value })
                    }
                  >
                    {gatewayModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {form.payment_gateway_provider === "iPaymu"
                      ? "iPaymu mendukung Redirect Payment Page dan Popup Direct Payment pada web ini."
                      : form.payment_gateway_provider === "Midtrans"
                        ? "Midtrans Snap mendukung redirect dan popup. Popup memerlukan Client Key."
                        : form.payment_gateway_provider === "DOKU"
                          ? "DOKU Checkout mendukung redirect dan popup melalui Jokul Checkout JS."
                          : form.payment_gateway_provider === "Tripay"
                            ? "Tripay mendukung redirect checkout dan direct channel. Mode popup di web ini dipakai untuk kanal direct seperti VA/QRIS/retail."
                          : "Pilih provider terlebih dahulu."}
                  </p>
                </div>

                {form.payment_gateway_provider === "iPaymu" && (
                  <>
                    <div>
                      <label className="label">API Key iPaymu</label>
                      <input
                        className="input"
                        value={form.payment_gateway_key}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, payment_gateway_key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">VA iPaymu</label>
                      <input
                        className="input"
                        value={form.ipaymu_va}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, ipaymu_va: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Mode iPaymu</label>
                      <select
                        className="input"
                        value={form.ipaymu_environment || "production"}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, ipaymu_environment: e.target.value })
                        }
                      >
                        <option value="production">Production</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      iPaymu mendukung Redirect Payment API dan Direct Payment Popup. Mode popup akan memakai kanal spesifik di halaman orang tua, lalu menampilkan VA / QR langsung di web ini.
                    </div>
                  </>
                )}

                {form.payment_gateway_provider === "Midtrans" && (
                  <>
                    <div>
                      <label className="label">Server Key Midtrans</label>
                      <input
                        className="input"
                        value={form.midtrans_server_key || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, midtrans_server_key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Client Key Midtrans</label>
                      <input
                        className="input"
                        value={form.midtrans_client_key || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, midtrans_client_key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Mode Midtrans</label>
                      <select
                        className="input"
                        value={form.midtrans_environment || "production"}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, midtrans_environment: e.target.value })
                        }
                      >
                        <option value="production">Production</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Midtrans memakai Snap Redirect. Server Key wajib. Notification URL tetap perlu diatur di MAP sesuai dokumentasi Midtrans.
                    </div>
                  </>
                )}

                {form.payment_gateway_provider === "DOKU" && (
                  <>
                    <div>
                      <label className="label">Client ID DOKU</label>
                      <input
                        className="input"
                        value={form.doku_client_id || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, doku_client_id: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Secret Key DOKU</label>
                      <input
                        className="input"
                        value={form.doku_secret_key || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, doku_secret_key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Mode DOKU</label>
                      <select
                        className="input"
                        value={form.doku_environment || "production"}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, doku_environment: e.target.value })
                        }
                      >
                        <option value="production">Production</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      DOKU memakai Checkout Redirect. Client ID dan Secret Key wajib. Notification URL perlu disetel di DOKU Back Office.
                    </div>
                  </>
                )}

                {form.payment_gateway_provider === "Tripay" && (
                  <>
                    <div>
                      <label className="label">API Key Tripay</label>
                      <input
                        className="input"
                        value={form.tripay_api_key || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, tripay_api_key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Private Key Tripay</label>
                      <input
                        className="input"
                        value={form.tripay_private_key || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, tripay_private_key: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Merchant Code Tripay</label>
                      <input
                        className="input"
                        value={form.tripay_merchant_code || ""}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, tripay_merchant_code: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="label">Mode Tripay</label>
                      <select
                        className="input"
                        value={form.tripay_environment || "production"}
                        disabled={loading || saving}
                        onChange={(e) =>
                          setForm({ ...form, tripay_environment: e.target.value })
                        }
                      >
                        <option value="production">Production</option>
                        <option value="sandbox">Sandbox</option>
                      </select>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 md:col-span-2">
                      Tripay closed payment memakai API Key, Private Key, dan Merchant Code. Notification URL Tripay nanti diarahkan ke route callback aplikasi ini, sedangkan mode popup di web ini dipakai untuk kanal direct yang mengembalikan kode bayar, QR, dan instruksi pembayaran.
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="label">WhatsApp Gateway</label>
                <label className="mb-2 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">Aktifkan WhatsApp gateway</p>
                    <p className="text-slate-500">Jika nonaktif, antrean notifikasi WA tidak akan dikirim.</p>
                  </div>
                  <button
                    type="button"
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${
                      form.whatsapp_gateway_enabled ? "bg-sky-600" : "bg-slate-300"
                    }`}
                    disabled={loading || saving}
                    aria-pressed={form.whatsapp_gateway_enabled}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        whatsapp_gateway_enabled: !current.whatsapp_gateway_enabled,
                      }))
                    }
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-white transition ${
                        form.whatsapp_gateway_enabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </label>
                <div className="grid gap-4 lg:grid-cols-3 lg:items-end">
                  <div>
                    <label className="label">WhatsApp gateway URL</label>
                    <input
                      className="input"
                      value={form.whatsapp_gateway_url}
                      disabled={loading || saving}
                      onChange={(e) =>
                        setForm({ ...form, whatsapp_gateway_url: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">WhatsApp token</label>
                    <input
                      className="input"
                      value={form.whatsapp_gateway_token}
                      disabled={loading || saving}
                      onChange={(e) =>
                        setForm({ ...form, whatsapp_gateway_token: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Nomor WA tujuan tes</label>
                    <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                      <input
                        className="input"
                        placeholder="628xxxxxxxxxx"
                        value={form.whatsapp_test_target}
                        disabled={loading || saving || sendingTest}
                        onChange={(e) =>
                          setForm({ ...form, whatsapp_test_target: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="btn-secondary w-full md:w-auto"
                        onClick={sendWhatsappTest}
                        disabled={loading || saving || sendingTest}
                      >
                        {sendingTest ? "Mengirim tes..." : "Tes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div>
                  <label className="label">Retensi bukti pembayaran approved (hari)</label>
                  <input
                    type="number"
                    min="30"
                    max="3650"
                    className="input"
                    value={form.payment_proof_retention_days}
                    disabled={loading || saving || cleaningProofs}
                    onChange={(e) =>
                      setForm({ ...form, payment_proof_retention_days: e.target.value })
                    }
                  />
                </div>
                <div className="md:self-end">
                  <button
                    type="button"
                    className="btn-danger h-[42px] w-full md:w-auto"
                    onClick={cleanupApprovedProofFiles}
                    disabled={loading || saving || cleaningProofs}
                  >
                    {cleaningProofs ? "Memproses..." : "Cleanup Bukti Approved"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                File fisik bukti approved yang lebih lama dari nilai ini bisa dibersihkan otomatis.
              </p>
              <button className="btn-primary w-full" disabled={loading || saving}>
                {saving ? "Menyimpan..." : "Simpan pengaturan"}
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="section-title">Backup Database</h3>
          <button type="button" className="btn-primary" onClick={createBackup}>
            <HardDriveDownload size={18} /> Buat backup
          </button>
        </div>
        <div className="mt-4">
          <Table
            columns={[
              { key: "filename", title: "Nama file" },
              { key: "size_kb", title: "Ukuran (KB)" },
              { key: "created_at", title: "Dibuat pada" },
              {
                key: "actions",
                title: "Aksi",
                render: (row) => (
                  <div className="flex gap-2">
                    <button type="button" className="btn-secondary" onClick={() => downloadBackup(row.id)}>
                      <Download size={16} /> Download
                    </button>
                    <button type="button" className="btn-danger" onClick={() => removeBackup(row.id)}>
                      <Trash2 size={16} /> Hapus
                    </button>
                  </div>
                ),
              },
            ]}
            rows={backups}
            emptyText={loadingBackups ? "Memuat data backup..." : "Belum ada data backup"}
          />
        </div>
      </div>
    </Layout>
  );
}
