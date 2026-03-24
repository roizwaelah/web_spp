import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  CalendarRange,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileSpreadsheet,
  Home,
  Landmark,
  Layers3,
  LogOut,
  ReceiptText,
  Settings,
  Users,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { roleLabel } from '../utils'

const menus = {
  admin: [
    { to: '/admin', label: 'Dashboard', icon: Home },
    { to: '/admin/siswa', label: 'Data Siswa', icon: Users },
    { to: '/admin/kelas', label: 'Kelas', icon: Layers3 },
    { to: '/admin/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarRange },
    { to: '/admin/pos-keuangan', label: 'Pos Keuangan', icon: CreditCard },
    { to: '/admin/tagihan', label: 'Tagihan', icon: ReceiptText },
    { to: '/admin/bukti-pembayaran', label: 'Bukti Pembayaran', icon: FileCheck2 },
    { to: '/admin/laporan', label: 'Laporan', icon: FileSpreadsheet },
    { to: '/admin/backup', label: 'Backup', icon: DatabaseBackup },
    { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
  ],
  bendahara: [
    { to: '/admin', label: 'Dashboard', icon: Home },
    { to: '/admin/siswa', label: 'Data Siswa', icon: Users },
    { to: '/admin/kelas', label: 'Kelas', icon: Layers3 },
    { to: '/admin/tahun-ajaran', label: 'Tahun Ajaran', icon: CalendarRange },
    { to: '/admin/pos-keuangan', label: 'Pos Keuangan', icon: CreditCard },
    { to: '/admin/tagihan', label: 'Tagihan', icon: ReceiptText },
    { to: '/admin/bukti-pembayaran', label: 'Bukti Pembayaran', icon: FileCheck2 },
    { to: '/admin/laporan', label: 'Laporan', icon: FileSpreadsheet },
  ],
  parent: [
    { to: '/orang-tua', label: 'Ringkasan', icon: Home },
    { to: '/orang-tua/tagihan', label: 'Tagihan', icon: BookOpenCheck },
    { to: '/orang-tua/transaksi', label: 'Riwayat', icon: CreditCard },
    { to: '/orang-tua/notifikasi', label: 'Notifikasi', icon: Bell },
  ],
}

export default function Layout({ title, subtitle, actions, children }) {
  const { user, logout } = useAuth()
  const location = useLocation()
  const items = menus[user?.role || 'admin']

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[280px_1fr]">
        <aside className="glass h-fit p-4">
          <div className="rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-sky-500 p-5 text-white shadow-lg">
            <div className="mb-5 inline-flex rounded-2xl bg-white/15 p-3">
              <Landmark size={24} />
            </div>
            <h1 className="text-xl font-bold">SPP Madrasah Enterprise</h1>
            <p className="mt-2 text-sm text-emerald-50">Portal keuangan sekolah modern untuk admin, bendahara, dan orang tua.</p>
          </div>

          <div className="mt-4 space-y-2">
            {items.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition ${
                    active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Icon size={18} />
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="mt-5 rounded-3xl border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Masuk sebagai</p>
            <p className="mt-1 font-semibold text-slate-900">{user?.name}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="mt-3 badge-green">{roleLabel(user?.role)}</div>
            <button onClick={logout} className="btn-secondary mt-4 w-full"><LogOut size={16} /> Keluar</button>
          </div>
        </aside>

        <main className="space-y-6">
          <header className="glass p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">Sistem SPP</p>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">{title}</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-500">{subtitle}</p>
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
  )
}
