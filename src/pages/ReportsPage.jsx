import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fileUrl, fetchRoute } from '../api'
import { formatCurrency } from '../utils'

export default function ReportsPage() {
  const [filter, setFilter] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
  })
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState({})
  const [byChannel, setByChannel] = useState({})
  const [search, setSearch] = useState('')

  const load = async () => {
    const qs = new URLSearchParams(filter).toString()
    const { data } = await fetchRoute(`admin/reports?${qs}`)
    setRows(Array.isArray(data?.rows) ? data.rows : [])
    setSummary(data?.summary || {})
    setByChannel(data?.byChannel || {})
  }

  useEffect(() => { load() }, [])

  const filteredRows = useMemo(() => (
    rows.filter((row) => (
      `${row.payment_date || ''} ${row.student_name || ''} ${row.class_name || ''} ${row.bill_name || ''} ${row.payment_channel || ''} ${row.reference_no || ''} ${row.status || ''}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ))
  ), [rows, search])

  return (
    <Layout
      title="Laporan Keuangan Real-Time"
      subtitle="Filter laporan harian, bulanan, atau tahunan, lalu unduh hasilnya dalam format CSV."
    >
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="card p-6">
          <h3 className="section-title">Filter laporan</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label">Tanggal mulai</label>
              <input type="date" className="input" value={filter.start_date} onChange={(e) => setFilter({ ...filter, start_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Tanggal akhir</label>
              <input type="date" className="input" value={filter.end_date} onChange={(e) => setFilter({ ...filter, end_date: e.target.value })} />
            </div>
            <div className="flex flex-col gap-3 md:flex-row">
              <button className="btn-primary w-full md:w-auto" onClick={load}>Terapkan filter</button>
              <a className="btn-secondary w-full justify-center md:w-auto" href={fileUrl('admin/reports/export', filter)} target="_blank" rel="noreferrer">
                <Download size={18} /> Export CSV
              </a>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Jumlah transaksi</p>
              <p className="mt-2 text-2xl font-bold">{summary.count || 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total pemasukan</p>
              <p className="mt-2 text-2xl font-bold">{formatCurrency(summary.total || 0)}</p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="font-semibold text-slate-800">Per kanal pembayaran</h4>
            <div className="mt-3 space-y-2">
              {Object.entries(byChannel).length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Belum ada data kanal.</div>
              ) : Object.entries(byChannel).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                  <span className="text-sm font-medium">{key}</span>
                  <span className="badge-green">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <input
            className="input"
            placeholder="Cari tanggal / siswa / kelas / tagihan / kanal / referensi / status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Table
            columns={[
              { key: 'payment_date', title: 'Tanggal' },
              { key: 'student_name', title: 'Siswa' },
              { key: 'class_name', title: 'Kelas' },
              { key: 'bill_name', title: 'Tagihan' },
              { key: 'payment_channel', title: 'Kanal' },
              { key: 'amount_paid', title: 'Nominal', render: (row) => formatCurrency(row.amount_paid) },
              { key: 'reference_no', title: 'Referensi' },
              { key: 'status', title: 'Status', render: (row) => <span className={row.status === 'paid' ? 'badge-green' : 'badge-amber'}>{row.status}</span> },
            ]}
            rows={filteredRows}
          />
        </div>
      </div>
    </Layout>
  )
}
