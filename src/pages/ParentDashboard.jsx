import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import StatCard from '../components/StatCard'
import { fetchRoute } from '../api'
import { formatCurrency } from '../utils'

export default function ParentDashboard() {
  const [data, setData] = useState({ summary: {}, student: {}, settings: {} })
  useEffect(() => { fetchRoute('parent/dashboard').then(({ data }) => setData(data)) }, [])

  return (
    <Layout title="Portal Orang Tua" subtitle="Pantau tagihan anak, pembayaran, dan notifikasi sekolah secara mandiri.">
      <div className="card p-6">
        <h3 className="text-xl font-bold text-slate-900">{data.student?.name}</h3>
        <p className="mt-1 text-sm text-slate-500">{data.student?.class_name} • Wali: {data.student?.parent_name}</p>
        <p className="mt-3 text-sm text-slate-600">Madrasah: <span className="font-semibold">{data.settings?.school_name}</span></p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Tagihan Aktif" value={data.summary.activeBills || 0} helper="Belum lunas" />
        <StatCard title="Total Tunggakan" value={formatCurrency(data.summary.outstanding || 0)} helper="Harap dibayarkan sebelum jatuh tempo" />
        <StatCard title="Pembayaran Tahun Ini" value={formatCurrency(data.summary.paidThisYear || 0)} helper="Transaksi sukses" />
        <StatCard title="Bukti Pending" value={data.summary.pendingProofs || 0} helper="Sedang direview admin" />
      </div>
      <div className="card p-6">
        <h3 className="section-title">Instruksi pembayaran utama</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Rekening madrasah</p>
            <p className="mt-2 font-semibold text-slate-900">{data.settings?.bank_account || '-'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">QRIS</p>
            <p className="mt-2 font-semibold text-slate-900">{data.settings?.qris_text || '-'}</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
