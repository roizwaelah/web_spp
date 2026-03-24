import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import AdminDashboard from './pages/AdminDashboard'
import StudentsPage from './pages/StudentsPage'
import ClassesPage from './pages/ClassesPage'
import AcademicYearsPage from './pages/AcademicYearsPage'
import FinancePostsPage from './pages/FinancePostsPage'
import BillsManagementPage from './pages/BillsManagementPage'
import PaymentProofsPage from './pages/PaymentProofsPage'
import ReportsPage from './pages/ReportsPage'
import BackupPage from './pages/BackupPage'
import SettingsPage from './pages/SettingsPage'
import ParentDashboard from './pages/ParentDashboard'
import ParentBillsPage from './pages/ParentBillsPage'
import ParentTransactionsPage from './pages/ParentTransactionsPage'
import ParentNotificationsPage from './pages/ParentNotificationsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<ProtectedRoute role={['admin', 'bendahara']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/siswa" element={<ProtectedRoute role={['admin', 'bendahara']}><StudentsPage /></ProtectedRoute>} />
      <Route path="/admin/kelas" element={<ProtectedRoute role={['admin', 'bendahara']}><ClassesPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran" element={<ProtectedRoute role={['admin', 'bendahara']}><AcademicYearsPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan" element={<ProtectedRoute role={['admin', 'bendahara']}><FinancePostsPage /></ProtectedRoute>} />
      <Route path="/admin/tagihan" element={<ProtectedRoute role={['admin', 'bendahara']}><BillsManagementPage /></ProtectedRoute>} />
      <Route path="/admin/bukti-pembayaran" element={<ProtectedRoute role={['admin', 'bendahara']}><PaymentProofsPage /></ProtectedRoute>} />
      <Route path="/admin/laporan" element={<ProtectedRoute role={['admin', 'bendahara']}><ReportsPage /></ProtectedRoute>} />
      <Route path="/admin/backup" element={<ProtectedRoute role="admin"><BackupPage /></ProtectedRoute>} />
      <Route path="/admin/pengaturan" element={<ProtectedRoute role="admin"><SettingsPage /></ProtectedRoute>} />
      <Route path="/orang-tua" element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />
      <Route path="/orang-tua/tagihan" element={<ProtectedRoute role="parent"><ParentBillsPage /></ProtectedRoute>} />
      <Route path="/orang-tua/transaksi" element={<ProtectedRoute role="parent"><ParentTransactionsPage /></ProtectedRoute>} />
      <Route path="/orang-tua/notifikasi" element={<ProtectedRoute role="parent"><ParentNotificationsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
