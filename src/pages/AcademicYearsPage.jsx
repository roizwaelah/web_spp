import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fetchRoute } from '../api'
import { formatDate } from '../utils'

const initialForm = { id: null, name: '', start_date: '', end_date: '', is_active: true }

export default function AcademicYearsPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')

  const load = () => fetchRoute('admin/academic-years').then(({ data }) => setRows(Array.isArray(data) ? data : []))
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (form.id) {
      await fetchRoute('admin/academic-years', { method: 'PUT', data: form })
      setMessage('Tahun ajaran diperbarui')
    } else {
      await fetchRoute('admin/academic-years', { method: 'POST', data: form })
      setMessage('Tahun ajaran ditambahkan')
    }
    setForm(initialForm)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Hapus tahun ajaran ini?')) return
    await fetchRoute('admin/academic-years', { method: 'DELETE', data: { id } })
    setMessage('Tahun ajaran dihapus')
    load()
  }

  return (
    <Layout title="Master Tahun Ajaran" subtitle="Kelola periode akademik aktif dan riwayat tahun ajaran.">
      <div className="page-grid">
        <div className="card p-6">
          <h3 className="section-title">{form.id ? 'Edit tahun ajaran' : 'Tambah tahun ajaran'}</h3>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
            <div>
              <label className="label">Nama tahun ajaran</label>
              <input className="input" placeholder="2026/2027" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="label">Tanggal mulai</label>
                <input type="date" className="input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="label">Tanggal selesai</label>
                <input type="date" className="input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Jadikan tahun ajaran aktif
            </label>
            <div className="flex gap-3">
              <button className="btn-primary flex-1">{form.id ? 'Update tahun ajaran' : 'Simpan tahun ajaran'}</button>
              {form.id && <button type="button" className="btn-secondary" onClick={() => setForm(initialForm)}>Batal</button>}
            </div>
          </form>
        </div>

        <Table
          columns={[
            { key: 'name', title: 'Tahun Ajaran' },
            { key: 'start_date', title: 'Mulai', render: (row) => formatDate(row.start_date) },
            { key: 'end_date', title: 'Selesai', render: (row) => formatDate(row.end_date) },
            { key: 'total_students', title: 'Jumlah siswa' },
            { key: 'is_active', title: 'Status', render: (row) => <span className={row.is_active ? 'badge-green' : 'badge-slate'}>{row.is_active ? 'aktif' : 'arsip'}</span> },
            {
              key: 'actions',
              title: 'Aksi',
              render: (row) => (
                <div className="flex gap-2">
                  <button className="btn-secondary px-3 py-2" onClick={() => setForm({
                    id: row.id,
                    name: row.name,
                    start_date: row.start_date || '',
                    end_date: row.end_date || '',
                    is_active: !!row.is_active,
                  })}><Pencil size={16} /></button>
                  <button className="btn-danger px-3 py-2" onClick={() => remove(row.id)}><Trash2 size={16} /></button>
                </div>
              ),
            },
          ]}
          rows={rows}
        />
      </div>
    </Layout>
  )
}
