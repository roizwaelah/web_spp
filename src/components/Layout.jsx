import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  BookOpenCheck,
  CalendarPlus2,
  CalendarRange,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FilePlus2,
  FileSpreadsheet,
  Home,
  Layers3,
  LogOut,
  ReceiptText,
  Settings,
  SquarePlus,
  Users,
  UserPlus,
  WalletCards,
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
        { to: "/admin/kelas", label: "Kelas", icon: Layers3 },
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
    {
      section: "Tambah / Buat",
      items: [
        { to: "/admin/siswa", label: "Tambah Siswa", icon: UserPlus },
        { to: "/admin/kelas", label: "Tambah Kelas", icon: SquarePlus },
        { to: "/admin/tahun-ajaran", label: "Buat Tahun Ajaran", icon: CalendarPlus2 },
        { to: "/admin/pos-keuangan", label: "Tambah Pos Keuangan", icon: WalletCards },
        { to: "/admin/tagihan", label: "Buat Tagihan", icon: FilePlus2 },
      ],
    },
  ],
  bendahara: [
    {
      section: "Menu Utama",
      items: [
        { to: "/admin", label: "Dashboard", icon: Home },
        { to: "/admin/siswa", label: "Data Siswa", icon: Users },
        { to: "/admin/kelas", label: "Kelas", icon: Layers3 },
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
    {
      section: "Tambah / Buat",
      items: [
        { to: "/admin/siswa", label: "Tambah Siswa", icon: UserPlus },
        { to: "/admin/kelas", label: "Tambah Kelas", icon: SquarePlus },
        { to: "/admin/tahun-ajaran", label: "Buat Tahun Ajaran", icon: CalendarPlus2 },
        { to: "/admin/pos-keuangan", label: "Tambah Pos Keuangan", icon: WalletCards },
        { to: "/admin/tagihan", label: "Buat Tagihan", icon: FilePlus2 },
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

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[1500px] px-3 py-4 xl:px-4">
        <aside className="glass p-3 xl:fixed xl:left-4 xl:top-4 xl:h-[calc(100vh-2rem)] xl:w-[250px] xl:overflow-y-auto">
          <h1 className="p-4 text-[1.2rem] font-bold text-sky-700">SPP Online</h1>

          <div className="mt-3 space-y-2">
            {items.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[0.95rem] font-medium transition ${
                    active
                      ? "bg-slate-800 text-slate-100 shadow-sm"
                      : "text-slate-700 hover:bg-slate-200/60"
                  }`}
                >
                  <Icon size={17} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[0.92rem] text-slate-500">Masuk sebagai</p>
            <p className="mt-1 font-semibold text-slate-900">{user?.name}</p>
            <p className="text-[0.92rem] text-slate-500">{user?.email}</p>
            <div className="mt-3 badge-green">{roleLabel(user?.role)}</div>
            <button onClick={logout} className="btn-secondary mt-4 w-full">
              <LogOut size={16} /> Keluar
            </button>
          </div>
        </aside>

        <main className="mt-4 space-y-4 xl:ml-[270px] xl:mt-0">
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
