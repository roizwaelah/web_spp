import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getDefaultRouteForUser } from "../access";
import {
  prefetchParentCore,
  prefetchRoute,
  prefetchStaffCore,
  schedulePrefetch,
} from "../prefetch";

export default function LandingPage() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("staff");
  const [form, setForm] = useState({
    email: "",
    password: "",
    nisn: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    schedulePrefetch(() => {
      if (role === "parent") {
        prefetchParentCore();
      } else {
        prefetchStaffCore();
      }
    });
  }, [role]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const user =
        role === "parent"
          ? await login({ role: "parent", nisn: form.nisn })
          : await login({ email: form.email, password: form.password });
      const nextRoute = getDefaultRouteForUser(user);
      prefetchRoute(nextRoute);
      navigate(nextRoute);
    } catch (err) {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ||
        (status ? `Login gagal (HTTP ${status})` : "Login gagal");
      setError(message);
    }
  };

  return (
    <div className="landing-shell text-slate-100">
      <div className="landing-shell__backdrop" />
      <div className="landing-shell__image" />
      <div className="landing-shell__overlay" />

      <div className="landing-shell__content">
        <div className="landing-layout">
          <section className="landing-hero">
            <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-100/90 backdrop-blur">
              MADSC Payment Platform
            </div>

            <div className="mt-5 max-w-3xl">
              <p className="text-[0.8rem] font-semibold uppercase tracking-[0.22em] text-amber-200/90">
                Sistem Pembayaran Terintegrasi
              </p>
              <h1 className="mt-2.5 text-[2.1rem] font-black leading-tight text-white lg:text-[2.8rem]">
                Portal pembayaran SPP yang lebih tertata, jelas, nyaman, dan transparan.
              </h1>
              <p className="mt-4 max-w-2xl text-[0.95rem] leading-6 text-slate-100/88 lg:text-[1rem]">
                Kelola tagihan siswa, verifikasi pembayaran, dan akses portal orang tua
                dalam satu sistem yang rapi untuk Bendahara/TU, dan wali siswa
                MA Darussalam Cilongok.
              </p>
            </div>
          </section>

          <section className="landing-login-card">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                Akses Portal
              </p>
              <h2 className="mt-2 text-[1.75rem] font-bold text-slate-900">Masuk ke sistem</h2>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-2xl bg-slate-200 p-1.5">
              <button
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${role === "staff" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                onClick={() => setRole("staff")}
              >
                Staf
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${role === "parent" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
                onClick={() => setRole("parent")}
              >
                Orang Tua
              </button>
            </div>

            <form className="mt-6 space-y-4" onSubmit={submit}>
              {error && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
              {role === "parent" ? (
                <div>
                  <label className="label">NISN Siswa</label>
                  <input
                    className="input"
                    placeholder="Masukkan NISN"
                    value={form.nisn}
                    onChange={(e) => setForm({ ...form, nisn: e.target.value })}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Login orang tua menggunakan NISN Siswa.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="label">Username</label>
                    <input
                      className="input"
                      placeholder="Masukkan Username"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <input
                      type="password"
                      className="input"
                      placeholder="Masukkan Password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                    />
                  </div>
                </>
              )}
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  "Memproses..."
                ) : (
                  <>
                    {role === "parent" ? "Masuk dengan NISN" : "Masuk"} <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
