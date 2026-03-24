import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fetchRoute } from '../api'

export default function ParentNotificationsPage() {
  const [rows, setRows] = useState([])
  useEffect(() => { fetchRoute('parent/notifications').then(({ data }) => setRows(data)) }, [])

  return (
    <Layout title="Notifikasi Orang Tua" subtitle="Riwayat pengingat jatuh tempo dan notifikasi transaksi via WhatsApp / sistem.">
      <Table
        columns={[
          { key: 'title', title: 'Judul' },
          { key: 'message', title: 'Pesan' },
          { key: 'channel', title: 'Channel' },
          { key: 'status', title: 'Status', render: (row) => <span className={row.status === 'sent' ? 'badge-green' : row.status === 'failed' ? 'badge-red' : 'badge-amber'}>{row.status}</span> },
          { key: 'created_at', title: 'Dibuat' },
        ]}
        rows={rows}
      />
    </Layout>
  )
}
