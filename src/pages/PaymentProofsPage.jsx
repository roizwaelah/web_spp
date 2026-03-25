import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fetchRoute } from '../api'
import { formatCurrency } from '../utils'

export default function PaymentProofsPage() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')

  const load = () => fetchRoute('admin/payment-proofs').then(({ data }) => setRows(Array.isArray(data) ? data : []))
  useEffect(() => { load() }, [])

  const review = async (proof_id, status) => {
    const notes = prompt(status === 'approved' ? 'Catatan approval (opsional)' : 'Alasan penolakan')
    await fetchRoute('admin/payment-proofs/review', { method: 'POST', data: { proof_id, status, notes } })
    setMessage(`Bukti pembayaran ${status === 'approved' ? 'disetujui' : 'ditolak'}`)
    load()
  }

  return (
    <Layout title="Verifikasi Bukti Pembayaran" subtitle="Review upload bukti transfer manual dari orang tua dan setujui / tolak secara cepat.">
      {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      <Table
        columns={[
          { key: 'student_name', title: 'Siswa' },
          { key: 'bill_name', title: 'Tagihan' },
          { key: 'period', title: 'Periode' },
          { key: 'amount', title: 'Nominal', render: (row) => formatCurrency(row.amount) },
          { key: 'proof_file_name', title: 'File Bukti' },
          { key: 'status', title: 'Status', render: (row) => <span className={row.status === 'approved' ? 'badge-green' : row.status === 'rejected' ? 'badge-red' : 'badge-amber'}>{row.status}</span> },
          {
            key: 'actions',
            title: 'Aksi',
            render: (row) => row.status === 'pending' ? (
              <div className="flex gap-2">
                <button className="btn-primary px-3 py-2" onClick={() => review(row.id, 'approved')}><CheckCircle2 size={16} /> Setujui</button>
                <button className="btn-danger px-3 py-2" onClick={() => review(row.id, 'rejected')}><XCircle size={16} /> Tolak</button>
              </div>
            ) : <span className="text-sm text-slate-500">Sudah direview</span>,
          },
        ]}
        rows={rows}
      />
    </Layout>
  )
}
