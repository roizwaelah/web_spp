import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import LandingPage from './pages/LandingPage'
import AdminDashboard from './pages/AdminDashboard'
import StudentListPage from './pages/StudentListPage'
import StudentEditPage from './pages/StudentEditPage'
import ClassesListPage from './pages/ClassesListPage'
import ClassesEditPage from './pages/ClassesEditPage'
import AcademicListPage from './pages/AcademicListPage'
import AcademicEditPage from './pages/AcademicEditPage'
import FinanceListPage from './pages/FinanceListPage'
import FinanceEditPage from './pages/FinanceEditPage'
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
      <Route path="/admin/siswa" element={<Navigate to="/admin/siswa/list" replace />} />
      <Route path="/admin/siswa/list" element={<ProtectedRoute role={['admin', 'bendahara']}><StudentListPage /></ProtectedRoute>} />
      <Route path="/admin/siswa/edit" element={<ProtectedRoute role="admin"><StudentEditPage /></ProtectedRoute>} />
      <Route path="/admin/siswa/edit/:id" element={<ProtectedRoute role="admin"><StudentEditPage /></ProtectedRoute>} />
      <Route path="/admin/kelas" element={<Navigate to="/admin/kelas/list" replace />} />
      <Route path="/admin/kelas/list" element={<ProtectedRoute role={['admin', 'bendahara']}><ClassesListPage /></ProtectedRoute>} />
      <Route path="/admin/kelas/edit" element={<ProtectedRoute role={['admin', 'bendahara']}><ClassesEditPage /></ProtectedRoute>} />
      <Route path="/admin/kelas/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']}><ClassesEditPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran" element={<Navigate to="/admin/tahun-ajaran/list" replace />} />
      <Route path="/admin/tahun-ajaran/list" element={<ProtectedRoute role={['admin', 'bendahara']}><AcademicListPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran/edit" element={<ProtectedRoute role={['admin', 'bendahara']}><AcademicEditPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']}><AcademicEditPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan" element={<Navigate to="/admin/pos-keuangan/list" replace />} />
      <Route path="/admin/pos-keuangan/list" element={<ProtectedRoute role={['admin', 'bendahara']}><FinanceListPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan/edit" element={<ProtectedRoute role={['admin', 'bendahara']}><FinanceEditPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']}><FinanceEditPage /></ProtectedRoute>} />
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
