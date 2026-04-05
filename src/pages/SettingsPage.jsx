import { useEffect, useState } from "react";
import { Download, HardDriveDownload, Trash2 } from "lucide-react";
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
  payment_gateway_enabled: false,
  payment_gateway_provider: "",
  payment_gateway_key: "",
  whatsapp_gateway_enabled: false,
  whatsapp_gateway_url: "",
  whatsapp_gateway_token: "",
  whatsapp_test_target: "",
  payment_proof_retention_days: "730",
};

export default function SettingsPage() {
  const [form, setForm] = useState(defaults);
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
        setForm({
          ...defaults,
          ...data,
          payment_gateway_enabled:
            data?.payment_gateway_enabled === true ||
            data?.payment_gateway_enabled === 1 ||
            data?.payment_gateway_enabled === "1",
          whatsapp_gateway_enabled:
            data?.whatsapp_gateway_enabled === true ||
            data?.whatsapp_gateway_enabled === 1 ||
            data?.whatsapp_gateway_enabled === "1",
        });
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
    setSaving(true);
    try {
      await fetchRoute("admin/settings", {
        method: "PUT",
        data: {
          ...form,
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
              <label className="label">Rekening bank</label>
              <textarea
                className="textarea"
                value={form.bank_account}
                disabled={loading || saving}
                onChange={(e) =>
                  setForm({ ...form, bank_account: e.target.value })
                }
              />
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
                  <input
                    className="input"
                    value={form.payment_gateway_provider}
                    disabled={loading || saving}
                    onChange={(e) =>
                      setForm({ ...form, payment_gateway_provider: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="label">API key gateway</label>
                  <input
                    className="input"
                    value={form.payment_gateway_key}
                    disabled={loading || saving}
                    onChange={(e) =>
                      setForm({ ...form, payment_gateway_key: e.target.value })
                    }
                  />
                </div>
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
