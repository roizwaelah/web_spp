import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { useAuth } from "../context/AuthContext";
import { useToastMessage } from "../hooks/useToastMessage";

const initialForm = {
  name: "",
  email: "",
  password: "",
};

export default function StaffAccountPage() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useToastMessage(message, setMessage);

  useEffect(() => {
    fetchRoute("me")
      .then(({ data }) => {
        setForm({
          name: data?.user?.name || "",
          email: data?.user?.email || "",
          password: "",
        });
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat akun");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await fetchRoute("me", {
        method: "PUT",
        data: form,
      });
      if (response?.data?.user) {
        localStorage.setItem("user", JSON.stringify(response.data.user));
        setUser(response.data.user);
      }
      setForm((current) => ({ ...current, password: "" }));
      setMessage(response?.data?.message || "Akun berhasil diperbarui");
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal memperbarui akun");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Edit Akun Saya"
      subtitle="Perbarui nama, email, dan password akun Anda sendiri."
    >
      <div className="card p-5">
        <h3 className="section-title">Profil login</h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {loading && (
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
              Memuat akun...
            </div>
          )}

          <div>
            <label className="label">Role</label>
            <input className="input" value={user?.role === "bendahara" ? "Bendahara / TU" : "Admin"} disabled />
          </div>

          <div>
            <label className="label">Nama user</label>
            <input
              className="input"
              value={form.name}
              disabled={loading || saving}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Email</label>
            <input
              className="input"
              value={form.email}
              disabled={loading || saving}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Password baru</label>
            <input
              type="password"
              className="input"
              placeholder="Kosongkan jika tidak ingin diubah"
              value={form.password}
              disabled={loading || saving}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button className="btn-primary w-full" disabled={loading || saving}>
            {saving ? "Menyimpan..." : "Simpan perubahan"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
