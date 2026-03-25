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
  const [search, setSearch] = useState('')

  const load = async () => {
    const qs = new URLSearchParams(filter).toString()
    const { data } = await fetchRoute(`admin/reports?${qs}`)
    setRows(Array.isArray(data?.rows) ? data.rows : [])
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
      <div className="space-y-4">
          <div className="card p-4">
            <div className="grid gap-4 xl:grid-cols-1"> {/* Ubah ke 1 kolom agar grid dalam mengambil ruang penuh */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_180px_180px_auto_auto]"> 
                {/* Pencarian (1fr agar fleksibel), 2 Tanggal (fixed), 2 Tombol (auto) */}
                
                <div>
                  <label className="label">Pencarian</label>
                  <input className="input" placeholder="Cari tanggal / siswa / kelas / tagihan / kanal / referensi / status" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>

                <div>
                  <label className="label">Tanggal mulai</label>
                  <input type="date" className="input" value={filter.start_date} onChange={(e) => setFilter({ ...filter, start_date: e.target.value })} />
                </div>

                <div>
                  <label className="label">Tanggal akhir</label>
                  <input type="date" className="input" value={filter.end_date} onChange={(e) => setFilter({ ...filter, end_date: e.target.value })} />
                </div>

                <button className="btn-primary self-end" onClick={load}>Terapkan</button>
                
                <a className="btn-secondary self-end justify-center" href={fileUrl('admin/reports/export', filter)} target="_blank" rel="noreferrer">
                  <Download size={18} /> Export
                </a>
              </div>
            </div>
          </div>
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
    </Layout>
  )
}
