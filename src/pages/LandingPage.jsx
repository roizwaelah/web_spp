import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { fetchRoute } from "../api";
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
  const [contact, setContact] = useState({
    school_name: "DARUSSALAM PANUSUPAN",
    school_address: "-",
    support_whatsapp: "-",
    support_email: "-",
  });
  const [role, setRole] = useState("parent");
  const [form, setForm] = useState({
    email: "",
    password: "",
    nisn: "",
  });
  const [showPassword, setShowPassword] = useState(false);
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

  useEffect(() => {
    fetchRoute("public/legal-contact", { skipLoading: true })
      .then(({ data }) => {
        setContact((prev) => ({
          ...prev,
          ...data,
          school_name: data?.school_name || prev.school_name,
          school_address: data?.school_address || prev.school_address,
          support_whatsapp: data?.support_whatsapp || prev.support_whatsapp,
          support_email: data?.support_email || prev.support_email,
        }));
      })
      .catch(() => {});
  }, []);

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
              <h1 className="mt-2.5 hidden text-[2.1rem] font-black leading-tight text-white sm:block lg:text-[2.8rem]">
                Portal pembayaran SPP yang lebih tertata, jelas, nyaman, dan
                transparan.
              </h1>
            </div>
          </section>

          <section className="landing-login-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xl font-extrabold leading-tight text-sky-800">
                  {role === "parent" ? "Akses Portal Orang Tua" : "Akses Portal Admin"}
                </p>
              </div>

              <button
                type="button"
                className="rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
                onClick={() => setRole(role === "parent" ? "staff" : "parent")}
              >
                {role === "parent" ? "Staf" : "Orang Tua"}
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
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="label">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        className="input pr-10"
                        placeholder="Masukkan Password"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:text-slate-700"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={
                          showPassword
                            ? "Sembunyikan password"
                            : "Tampilkan password"
                        }
                      >
                        {showPassword ? (
                          <EyeOff size={16} />
                        ) : (
                          <Eye size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
              <button className="btn-primary w-full" disabled={loading}>
                {loading ? (
                  "Memproses..."
                ) : (
                  <>
                    {role === "parent" ? "Masuk" : "Masuk"}{" "}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                <Link className="font-medium text-slate-600 hover:text-slate-800" to="/syarat-ketentuan">
                  Syarat & Ketentuan
                </Link>
                <Link className="font-medium text-slate-600 hover:text-slate-800" to="/refund-policy">
                  Refund Policy
                </Link>
                <Link className="font-medium text-slate-600 hover:text-slate-800" to="/faq">
                  FAQ
                </Link>
              </div>
            </div>
          </section>

          <section className="lg:col-span-2">
            <div className="rounded-md border border-white/15 bg-slate-950/45 px-5 py-2 text-center backdrop-blur">
              <p className="text-xs leading-relaxed text-slate-200">
                Copyright © 2026. <a href="https://madarussalamcilongok.sch.id" target="_blank" rel="noopener noreferrer" className="font-semibold tracking-wide text-white hover:underline">{contact.school_name}</a>
                {" | "}
                Office - <a href="https://maps.app.goo.gl/BsSp3VniM9TZSTf99" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
                  {contact.school_address}</a>
                {" | "}
                WA - <a href={"https://wa.me/" + contact.support_whatsapp} target="_blank" rel="noopener noreferrer" className="text-white hover:underline">
                  {contact.support_whatsapp}</a>
                {" | "}
                Email - <a href={`mailto:${contact.support_email}`} className="text-white hover:underline">{contact.support_email}</a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
