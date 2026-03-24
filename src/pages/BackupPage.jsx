import { useEffect, useState } from 'react'
import { Download, HardDriveDownload } from 'lucide-react'
import Layout from '../components/Layout'
import Table from '../components/Table'
import { fileUrl, fetchRoute } from '../api'

export default function BackupPage() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')

  const load = () => fetchRoute('admin/backups').then(({ data }) => setRows(data))
  useEffect(() => { load() }, [])

  const createBackup = async () => {
    await fetchRoute('admin/backups', { method: 'POST' })
    setMessage('Backup database berhasil dibuat')
    load()
  }

  return (
    <Layout title="Backup Database" subtitle="Buat backup manual dan unduh file cadangan database untuk keamanan data." actions={<button className="btn-primary" onClick={createBackup}><HardDriveDownload size={18} /> Buat backup</button>}>
      {message && <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      <Table
        columns={[
          { key: 'filename', title: 'Nama file' },
          { key: 'size_kb', title: 'Ukuran (KB)' },
          { key: 'created_at', title: 'Dibuat pada' },
          { key: 'download', title: 'Unduh', render: (row) => <a className="btn-secondary" href={fileUrl('admin/backups/download', { id: row.id })} target="_blank" rel="noreferrer"><Download size={16} /> Download</a> },
        ]}
        rows={rows}
      />
    </Layout>
  )
}
