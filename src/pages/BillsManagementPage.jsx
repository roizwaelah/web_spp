import { useEffect, useMemo, useState } from 'react'
import { CalendarCheck2 } from 'lucide-react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fetchRoute } from '../api'
import { formatCurrency, formatDate } from '../utils'

export default function BillsManagementPage() {
  const [rows, setRows] = useState([])
  const [meta, setMeta] = useState({ students: [] })
  const [filter, setFilter] = useState({ status: '', student_id: '', period: new Date().toISOString().slice(0, 7), due_date: '' })
  const [message, setMessage] = useState('')

  const load = async () => {
    const [metaRes, rowsRes] = await Promise.all([
      fetchRoute('admin/meta'),
      fetchRoute(`admin/bills${filter.status || filter.student_id ? `?${new URLSearchParams({ status: filter.status, student_id: filter.student_id }).toString()}` : ''}`),
    ])
    setMeta({
      students: Array.isArray(metaRes.data?.students) ? metaRes.data.students : [],
    })
    setRows(Array.isArray(rowsRes.data) ? rowsRes.data : [])
  }

  useEffect(() => { load() }, [filter.status, filter.student_id])

  const generate = async () => {
    await fetchRoute('admin/bills/generate', { method: 'POST', data: { period: filter.period, due_date: filter.due_date || undefined, student_id: filter.student_id || undefined } })
    setMessage('Generate tagihan berhasil')
    load()
  }

  const filteredRows = useMemo(() => rows, [rows])

  return (
    <Layout title="Manajemen Tagihan" subtitle="Generate tagihan otomatis per periode, filter status, dan pantau bukti pembayaran tiap tagihan.">
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="card p-6">
          {message && <div className="mb-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700"><CalendarCheck2 size={20} /></div>
            <div>
              <h3 className="section-title">Generate tagihan</h3>
              <p className="text-sm text-slate-500">Buat tagihan massal untuk satu periode.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Periode</label>
              <input type="month" className="input" value={filter.period} onChange={(e) => setFilter({ ...filter, period: e.target.value })} />
            </div>
            <div>
              <label className="label">Jatuh tempo</label>
              <input type="date" className="input" value={filter.due_date} onChange={(e) => setFilter({ ...filter, due_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Siswa tertentu (opsional)</label>
              <select className="input" value={filter.student_id} onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}>
                <option value="">Semua siswa</option>
                {meta.students.map((item) => <option key={item.id} value={item.id}>{item.name} • {item.nis}</option>)}
              </select>
            </div>
            <button className="btn-primary w-full" onClick={generate}>Generate sekarang</button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <select className="input" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
                <option value="">Semua status</option>
                <option value="unpaid">Belum lunas</option>
                <option value="paid">Lunas</option>
              </select>
              <select className="input" value={filter.student_id} onChange={(e) => setFilter({ ...filter, student_id: e.target.value })}>
                <option value="">Semua siswa</option>
                {meta.students.map((item) => <option key={item.id} value={item.id}>{item.name} • {item.nis}</option>)}
              </select>
            </div>
          </div>

          <Table
            columns={[
              { key: 'student_name', title: 'Siswa' },
              { key: 'class_name', title: 'Kelas' },
              { key: 'bill_name', title: 'Tagihan' },
              { key: 'period', title: 'Periode' },
              { key: 'due_date', title: 'Jatuh tempo', render: (row) => formatDate(row.due_date) },
              { key: 'amount', title: 'Nominal', render: (row) => formatCurrency(row.amount) },
              { key: 'status', title: 'Status', render: (row) => <span className={row.status === 'paid' ? 'badge-green' : 'badge-amber'}>{row.status}</span> },
              { key: 'proof_status', title: 'Bukti Bayar', render: (row) => row.proof_status ? <span className={row.proof_status === 'approved' ? 'badge-green' : row.proof_status === 'rejected' ? 'badge-red' : 'badge-amber'}>{row.proof_status}</span> : <span className="badge-slate">-</span> },
            ]}
            rows={filteredRows}
          />
        </div>
      </div>
    </Layout>
  )
}
