import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  CalendarRange,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileSpreadsheet,
  Home,
  Layers3,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../utils";

const menus = {
  admin: [
    {
      section: "Menu Utama",
      items: [
        { to: "/admin", label: "Dashboard", icon: Home },
        { to: "/admin/siswa", label: "Data Siswa", icon: Users },
        { to: "/admin/kelas", label: "Data Kelas", icon: Layers3 },
        { to: "/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarRange },
        { to: "/admin/pos-keuangan", label: "Pos Keuangan", icon: CreditCard },
        { to: "/admin/tagihan", label: "Tagihan", icon: ReceiptText },
        {
          to: "/admin/bukti-pembayaran",
          label: "Bukti Pembayaran",
          icon: FileCheck2,
        },
        { to: "/admin/laporan", label: "Laporan", icon: FileSpreadsheet },
        { to: "/admin/backup", label: "Backup", icon: DatabaseBackup },
        { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings },
      ],
    },
  ],
  bendahara: [
    {
      section: "Menu Utama",
      items: [
        { to: "/admin", label: "Dashboard", icon: Home },
        { to: "/admin/siswa", label: "Data Siswa", icon: Users },
        { to: "/admin/kelas", label: "Data Kelas", icon: Layers3 },
        { to: "/admin/tahun-ajaran", label: "Tahun Ajaran", icon: CalendarRange },
        { to: "/admin/pos-keuangan", label: "Pos Keuangan", icon: CreditCard },
        { to: "/admin/tagihan", label: "Tagihan", icon: ReceiptText },
        {
          to: "/admin/bukti-pembayaran",
          label: "Bukti Pembayaran",
          icon: FileCheck2,
        },
        { to: "/admin/laporan", label: "Laporan", icon: FileSpreadsheet },
      ],
    },
  ],
  parent: [
    {
      section: "Menu Utama",
      items: [
        { to: "/orang-tua", label: "Ringkasan", icon: Home },
        { to: "/orang-tua/tagihan", label: "Tagihan", icon: BookOpenCheck },
        { to: "/orang-tua/transaksi", label: "Riwayat", icon: CreditCard },
        { to: "/orang-tua/notifikasi", label: "Notifikasi", icon: Bell },
      ],
    },
  ],
};

export default function Layout({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const sections = menus[user?.role] || menus.admin;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#eff2f6]">
      <div className="dp-navbar">
        <div className="dp-navbar__inner">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-200 transition hover:bg-slate-700 hover:text-white xl:hidden"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label={isSidebarOpen ? "Tutup menu" : "Buka menu"}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="dp-brand">
              <span className="dp-brand__dp">dp</span>Panel
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="text-emerald-400">Halo, <span className="font-semibold text-white">{user?.name}</span></p>
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <button onClick={logout} className="dp-logout-btn">
              <LogOut size={15} /> Keluar
            </button>
          </div>
        </div>
      </div>

      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 top-[50px] z-20 bg-slate-900/45 xl:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Tutup sidebar"
        />
      )}

      <aside className={`dp-sidebar ${isSidebarOpen ? "is-open" : "is-closed"}`}>
        <div className="space-y-4 pt-2">
          <Link
            to={user?.role === "parent" ? "/orang-tua" : "/admin"}
            onClick={() => setIsSidebarOpen(false)}
            className={`dp-nav-link ${location.pathname === (user?.role === "parent" ? "/orang-tua" : "/admin") ? "is-active" : ""}`}
          >
            <Home size={17} />
            Dashboard
          </Link>
        </div>

        <div className="mt-4 space-y-4">
          {sections.map((section) => (
            <div key={section.section} className="space-y-2">
              {section.items
                .filter((item) => item.label !== "Dashboard" && item.label !== "Ringkasan")
                .map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.to;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`dp-nav-link ${active ? "is-active" : ""}`}
                    >
                      <Icon size={17} />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          ))}
        </div>
      </aside>

      <div className="dp-content">
        <main className="space-y-4">
          <header className="glass p-4 xl:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">
                  Sistem SPP
                </p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900 xl:text-3xl">
                  {title}
                </h2>
                <p className="mt-1 max-w-4xl text-sm text-slate-500">{subtitle}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="badge-green">Sistem aktif</span>
                {actions}
              </div>
            </div>
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
