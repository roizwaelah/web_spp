import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fetchRoute } from "../api";
import { roleLabel } from "../utils";
import { useToastMessage } from "../hooks/useToastMessage";

const initialForm = {
  id: null,
  name: "",
  email: "",
  password: "",
  role: "bendahara",
  menu_access: ["dashboard"],
};

export default function UsersEditPage() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ roles: [], students: [], menuOptions: [] });
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();

  useToastMessage(message, setMessage);

  const selectedUser = useMemo(
    () => rows.find((item) => String(item.id) === String(id)),
    [rows, id],
  );

  const load = () =>
    (setLoading(true),
    Promise.all([fetchRoute("admin/users"), fetchRoute("admin/meta")])
      .then(([usersRes, metaRes]) => {
        setRows(Array.isArray(usersRes.data) ? usersRes.data : []);
        setMeta(metaRes.data || { roles: [], students: [], menuOptions: [] });
      })
      .catch((error) => {
        setMessage(error?.response?.data?.message || "Gagal memuat data user");
      })
      .finally(() => {
        setLoading(false);
      }));

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!id || !selectedUser) {
      setForm(initialForm);
      return;
    }

    setForm({
      id: selectedUser.id,
      name: selectedUser.name || "",
      email: selectedUser.email || "",
      password: "",
      role: selectedUser.role || "bendahara",
      menu_access: selectedUser.menu_access?.length
        ? selectedUser.menu_access
        : ["dashboard"],
    });
  }, [id, selectedUser]);

  const isBendahara = form.role === "bendahara";
  const effectiveMenuAccess = Array.from(
    new Set(
      ["dashboard", ...(form.menu_access || [])].filter(
        (menuKey) =>
          !(
            isBendahara &&
            ["backups", "settings", "users"].includes(menuKey)
          ),
      ),
    ),
  );

  const toggleMenu = (menuKey) => {
    setForm((current) => {
      const hasMenu = current.menu_access.includes(menuKey);
      return {
        ...current,
        menu_access: hasMenu
          ? current.menu_access.filter((item) => item !== menuKey)
          : [...current.menu_access, menuKey],
      };
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      student_id: null,
      menu_access: effectiveMenuAccess,
    };

    try {
      setSaving(true);
      if (payload.id) {
        await fetchRoute("admin/users", { method: "PUT", data: payload });
        setMessage("User berhasil diperbarui");
      } else {
        await fetchRoute("admin/users", { method: "POST", data: payload });
        setMessage("User berhasil ditambahkan");
        setForm(initialForm);
      }
      load();
    } catch (error) {
      setMessage(error?.response?.data?.message || "Gagal menyimpan data user");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout
      title="Tambah/Edit User"
      subtitle="Atur akun login dan menu apa saja yang dapat dibuka oleh user staff."
      actions={
        <button
          className="btn-accent"
          onClick={() => navigate("/admin/users/list")}
        >
          <ArrowLeft size={16} />
          Kembali ke Daftar
        </button>
      }
    >
      <div className="card p-5">
        <h3 className="section-title">{form.id ? "Edit user" : "Tambah user"}</h3>
        <form className="mt-4 space-y-4" onSubmit={submit}>
          {loading && (
            <div className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-500">
              Memuat data user...
            </div>
          )}

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
            <label className="label">
              Password {form.id ? "(kosongkan jika tidak diubah)" : ""}
            </label>
            <input
              type="password"
              className="input"
              value={form.password}
              disabled={loading || saving}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              disabled={loading || saving}
              onChange={(e) =>
                setForm({
                  ...form,
                  role: e.target.value,
                  menu_access: effectiveMenuAccess,
                })
              }
            >
              {(meta.roles || []).map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label || roleLabel(role.value)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3 rounded-3xl border border-slate-200 p-4">
            <div>
              <p className="label">Akses menu staff</p>
              <p className="text-sm text-slate-500">
                Menu `Dashboard` selalu aktif untuk akun staff.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(meta.menuOptions || []).map((menu) => {
                const checked = effectiveMenuAccess.includes(menu.key);
                const locked =
                  menu.key === "dashboard" ||
                  (isBendahara &&
                    ["backups", "settings", "users"].includes(menu.key));
                return (
                  <label
                    key={menu.key}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked || loading || saving}
                      onChange={() => toggleMenu(menu.key)}
                    />
                    <span>{menu.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn-primary flex-1">
              {saving ? "Menyimpan..." : form.id ? "Update user" : "Simpan user"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={loading || saving}
              onClick={() =>
                setForm(
                  selectedUser
                    ? {
                        id: selectedUser.id,
                        name: selectedUser.name || "",
                        email: selectedUser.email || "",
                        password: "",
                        role: selectedUser.role || "bendahara",
                        menu_access: selectedUser.menu_access?.length
                          ? selectedUser.menu_access
                          : ["dashboard"],
                      }
                    : initialForm,
                )
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
