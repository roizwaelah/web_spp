import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fileUrl, fetchRoute } from '../api'
import { formatCurrency } from '../utils'

export default function ParentTransactionsPage() {
  const [rows, setRows] = useState([])
  useEffect(() => { fetchRoute('parent/transactions').then(({ data }) => setRows(Array.isArray(data) ? data : [])) }, [])

  return (
    <Layout title="Riwayat Pembayaran" subtitle="Seluruh transaksi yang pernah dilakukan orang tua / wali siswa.">
      <Table
        columns={[
          { key: 'payment_date', title: 'Tanggal' },
          { key: 'bill_name', title: 'Tagihan' },
          { key: 'payment_channel', title: 'Kanal' },
          { key: 'amount_paid', title: 'Nominal', render: (row) => formatCurrency(row.amount_paid) },
          { key: 'reference_no', title: 'Referensi' },
          { key: 'status', title: 'Status', render: (row) => <span className={row.status === 'paid' ? 'badge-green' : 'badge-amber'}>{row.status}</span> },
          { key: 'receipt', title: 'Bukti', render: (row) => <a className="btn-secondary" href={fileUrl('parent/receipt', { transaction_id: row.id })} target="_blank" rel="noreferrer">Download</a> },
        ]}
        rows={rows}
      />
    </Layout>
  )
}
