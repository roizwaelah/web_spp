import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
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
};

export default function SettingsPage() {
  const [form, setForm] = useState(defaults);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useToastMessage(message, setMessage);

  useEffect(() => {
    fetchRoute("admin/settings")
      .then(({ data }) => {
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

  return (
    <Layout
      title="Pengaturan Sistem"
      subtitle="Atur profil madrasah, rekening pembayaran, payment gateway, dan WhatsApp gateway."
    >
      <form className="grid gap-6 xl:grid-cols-2" onSubmit={submit}>
        <div className="card p-6">
          <h3 className="section-title">Profil madrasah</h3>
          <div className="mt-4 space-y-4">
            {loading && (
              <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
                Memuat pengaturan...
              </div>
            )}
            <div>
              <label className="label">Nama madrasah</label>
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
                <label className="label">Kepala Madrasah</label>
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
        </div>

        <div className="card p-6">
          <h3 className="section-title">Integrasi</h3>
          <div className="mt-4 space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">Aktifkan payment gateway</p>
                <p className="text-slate-500">Jika aktif, panel pembayaran otomatis akan tampil di portal Orang Tua.</p>
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
            <div>
              <label className="label">WhatsApp gateway URL</label>
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
            <button className="btn-primary w-full" disabled={loading || saving}>
              {saving ? "Menyimpan..." : "Simpan pengaturan"}
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
