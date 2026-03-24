import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fetchRoute } from '../api'

const initialForm = { id: null, name: '', grade_level: '', is_active: true }

export default function ClassesPage() {
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(initialForm)
  const [message, setMessage] = useState('')

  const load = () => fetchRoute('admin/classes').then(({ data }) => setRows(data))
  useEffect(() => { load() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (form.id) {
      await fetchRoute('admin/classes', { method: 'PUT', data: form })
      setMessage('Kelas diperbarui')
    } else {
      await fetchRoute('admin/classes', { method: 'POST', data: form })
      setMessage('Kelas ditambahkan')
    }
    setForm(initialForm)
    load()
  }

  const remove = async (id) => {
    if (!confirm('Hapus kelas ini?')) return
    await fetchRoute('admin/classes', { method: 'DELETE', data: { id } })
    setMessage('Kelas dihapus')
    load()
  }

  return (
    <Layout title="Master Kelas" subtitle="Kelola struktur kelas madrasah secara terpisah dari data siswa.">
      <div className="page-grid">
        <div className="card p-6">
          <h3 className="section-title">{form.id ? 'Edit kelas' : 'Tambah kelas'}</h3>
          <form className="mt-4 space-y-4" onSubmit={submit}>
            {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
            <div>
              <label className="label">Nama kelas</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Jenjang / level</label>
              <input className="input" value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })} />
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm">
              <input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              Kelas aktif
            </label>
            <div className="flex gap-3">
              <button className="btn-primary flex-1">{form.id ? 'Update kelas' : 'Simpan kelas'}</button>
              {form.id && <button type="button" className="btn-secondary" onClick={() => setForm(initialForm)}>Batal</button>}
            </div>
          </form>
        </div>

        <Table
          columns={[
            { key: 'name', title: 'Nama kelas' },
            { key: 'grade_level', title: 'Jenjang' },
            { key: 'total_students', title: 'Jumlah siswa' },
            { key: 'is_active', title: 'Status', render: (row) => <span className={row.is_active ? 'badge-green' : 'badge-red'}>{row.is_active ? 'aktif' : 'nonaktif'}</span> },
            {
              key: 'actions',
              title: 'Aksi',
              render: (row) => (
                <div className="flex gap-2">
                  <button className="btn-secondary px-3 py-2" onClick={() => setForm({ id: row.id, name: row.name, grade_level: row.grade_level || '', is_active: !!row.is_active })}><Pencil size={16} /></button>
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
