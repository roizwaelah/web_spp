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
import BillsListPage from './pages/BillsListPage'
import BillsEditPage from './pages/BillsEditPage'
import ManualPaymentPage from './pages/ManualPaymentPage'
import PaymentProofsPage from './pages/PaymentProofsPage'
import ReportsPage from './pages/ReportsPage'
import BackupPage from './pages/BackupPage'
import SettingsPage from './pages/SettingsPage'
import ParentDashboard from './pages/ParentDashboard'
import ParentBillsPage from './pages/ParentBillsPage'
import ParentPaymentPage from './pages/ParentPaymentPage'
import ParentManualPaymentPage from './pages/ParentManualPaymentPage'
import ParentGatewayPaymentPage from './pages/ParentGatewayPaymentPage'
import ParentTransactionsPage from './pages/ParentTransactionsPage'
import ParentNotificationsPage from './pages/ParentNotificationsPage'
import UsersListPage from './pages/UsersListPage'
import UsersEditPage from './pages/UsersEditPage'
import StaffAccountPage from './pages/StaffAccountPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="dashboard"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/siswa" element={<Navigate to="/admin/siswa/list" replace />} />
      <Route path="/admin/siswa/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="students"><StudentListPage /></ProtectedRoute>} />
      <Route path="/admin/siswa/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="students"><StudentEditPage /></ProtectedRoute>} />
      <Route path="/admin/siswa/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="students"><StudentEditPage /></ProtectedRoute>} />
      <Route path="/admin/kelas" element={<Navigate to="/admin/kelas/list" replace />} />
      <Route path="/admin/kelas/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="classes"><ClassesListPage /></ProtectedRoute>} />
      <Route path="/admin/kelas/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="classes"><ClassesEditPage /></ProtectedRoute>} />
      <Route path="/admin/kelas/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="classes"><ClassesEditPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran" element={<Navigate to="/admin/tahun-ajaran/list" replace />} />
      <Route path="/admin/tahun-ajaran/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="academic_years"><AcademicListPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="academic_years"><AcademicEditPage /></ProtectedRoute>} />
      <Route path="/admin/tahun-ajaran/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="academic_years"><AcademicEditPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan" element={<Navigate to="/admin/pos-keuangan/list" replace />} />
      <Route path="/admin/pos-keuangan/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="finance_posts"><FinanceListPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="finance_posts"><FinanceEditPage /></ProtectedRoute>} />
      <Route path="/admin/pos-keuangan/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="finance_posts"><FinanceEditPage /></ProtectedRoute>} />
      <Route path="/admin/tagihan" element={<Navigate to="/admin/tagihan/list" replace />} />
      <Route path="/admin/tagihan/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><BillsListPage /></ProtectedRoute>} />
      <Route path="/admin/tagihan/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><BillsEditPage /></ProtectedRoute>} />
      <Route path="/admin/pembayaran-manual" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><ManualPaymentPage /></ProtectedRoute>} />
      <Route path="/admin/bukti-pembayaran" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="payment_proofs"><PaymentProofsPage /></ProtectedRoute>} />
      <Route path="/admin/laporan" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="reports"><ReportsPage /></ProtectedRoute>} />
      <Route path="/admin/akun" element={<ProtectedRoute role={['admin', 'bendahara']}><StaffAccountPage /></ProtectedRoute>} />
      <Route path="/admin/backup" element={<ProtectedRoute role="admin" menuKey="backups"><BackupPage /></ProtectedRoute>} />
      <Route path="/admin/pengaturan" element={<ProtectedRoute role="admin" menuKey="settings"><SettingsPage /></ProtectedRoute>} />
      <Route path="/admin/users" element={<Navigate to="/admin/users/list" replace />} />
      <Route path="/admin/users/list" element={<ProtectedRoute role="admin" menuKey="users"><UsersListPage /></ProtectedRoute>} />
      <Route path="/admin/users/edit" element={<ProtectedRoute role="admin" menuKey="users"><UsersEditPage /></ProtectedRoute>} />
      <Route path="/admin/users/edit/:id" element={<ProtectedRoute role="admin" menuKey="users"><UsersEditPage /></ProtectedRoute>} />
      <Route path="/orang-tua" element={<ProtectedRoute role="parent"><ParentDashboard /></ProtectedRoute>} />
      <Route path="/orang-tua/tagihan" element={<ProtectedRoute role="parent"><ParentBillsPage /></ProtectedRoute>} />
      <Route path="/orang-tua/tagihan/pembayaran" element={<ProtectedRoute role="parent"><ParentPaymentPage /></ProtectedRoute>} />
      <Route path="/orang-tua/tagihan/pembayaran/manual" element={<ProtectedRoute role="parent"><ParentManualPaymentPage /></ProtectedRoute>} />
      <Route path="/orang-tua/tagihan/pembayaran/otomatis" element={<ProtectedRoute role="parent"><ParentGatewayPaymentPage /></ProtectedRoute>} />
      <Route path="/orang-tua/transaksi" element={<ProtectedRoute role="parent"><ParentTransactionsPage /></ProtectedRoute>} />
      <Route path="/orang-tua/notifikasi" element={<ProtectedRoute role="parent"><ParentNotificationsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
