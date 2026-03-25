import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { downloadRouteFile, fetchRoute } from '../api'
import { formatCurrency } from '../utils'

export default function ParentTransactionsPage() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  useEffect(() => { fetchRoute('parent/transactions').then(({ data }) => setRows(Array.isArray(data) ? data : [])) }, [])

  const downloadReceipt = async (transactionId) => {
    try {
      await downloadRouteFile('parent/receipt', { transaction_id: transactionId }, 'bukti-pembayaran.html')
      setMessage('')
    } catch (error) {
      setMessage(error?.response?.data?.message || 'Gagal mengunduh bukti pembayaran')
    }
  }

  return (
    <Layout title="Riwayat Pembayaran" subtitle="Seluruh transaksi yang pernah dilakukan orang tua / wali siswa.">
      {message && <div className="mb-4 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700">{message}</div>}
      <Table
        columns={[
          { key: 'payment_date', title: 'Tanggal' },
          { key: 'bill_name', title: 'Tagihan' },
          { key: 'payment_channel', title: 'Kanal' },
          { key: 'amount_paid', title: 'Nominal', render: (row) => formatCurrency(row.amount_paid) },
          { key: 'reference_no', title: 'Referensi' },
          { key: 'status', title: 'Status', render: (row) => <span className={row.status === 'paid' ? 'badge-green' : 'badge-amber'}>{row.status === 'paid' ? 'Lunas' : 'Belum Lunas'}</span> },
          { key: 'receipt', title: 'Bukti', render: (row) => <button className="btn-secondary" onClick={() => downloadReceipt(row.id)}>Download</button> },
        ]}
        rows={rows}
      />
    </Layout>
  )
}
