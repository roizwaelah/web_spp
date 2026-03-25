import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";

const defaults = {
  school_name: "",
  school_address: "",
  bank_account: "",
  qris_text: "",
  payment_gateway_provider: "",
  payment_gateway_key: "",
  whatsapp_gateway_url: "",
  whatsapp_gateway_token: "",
  receipt_footer: "",
};

export default function SettingsPage() {
  const [form, setForm] = useState(defaults);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchRoute("admin/settings").then(({ data }) =>
      setForm({ ...defaults, ...data }),
    );
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    await fetchRoute("admin/settings", { method: "PUT", data: form });
    setMessage("Pengaturan berhasil disimpan");
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
            {message && (
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">
                {message}
              </div>
            )}
            <div>
              <label className="label">Nama madrasah</label>
              <input
                className="input"
                value={form.school_name}
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
                onChange={(e) =>
                  setForm({ ...form, school_address: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Rekening bank</label>
              <textarea
                className="textarea"
                value={form.bank_account}
                onChange={(e) =>
                  setForm({ ...form, bank_account: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Text QRIS</label>
              <textarea
                className="textarea"
                value={form.qris_text}
                onChange={(e) =>
                  setForm({ ...form, qris_text: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="section-title">Integrasi</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Provider payment gateway</label>
              <input
                className="input"
                value={form.payment_gateway_provider}
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
                onChange={(e) =>
                  setForm({ ...form, payment_gateway_key: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">WhatsApp gateway URL</label>
              <input
                className="input"
                value={form.whatsapp_gateway_url}
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
                onChange={(e) =>
                  setForm({ ...form, whatsapp_gateway_token: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label">Footer kuitansi</label>
              <textarea
                className="textarea"
                value={form.receipt_footer}
                onChange={(e) =>
                  setForm({ ...form, receipt_footer: e.target.value })
                }
              />
            </div>
            <button className="btn-primary w-full">Simpan pengaturan</button>
          </div>
        </div>
      </form>
    </Layout>
  );
}
