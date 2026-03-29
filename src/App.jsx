import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const StudentListPage = lazy(() => import('./pages/StudentListPage'))
const StudentEditPage = lazy(() => import('./pages/StudentEditPage'))
const ClassesListPage = lazy(() => import('./pages/ClassesListPage'))
const ClassesEditPage = lazy(() => import('./pages/ClassesEditPage'))
const AcademicListPage = lazy(() => import('./pages/AcademicListPage'))
const AcademicEditPage = lazy(() => import('./pages/AcademicEditPage'))
const FinanceListPage = lazy(() => import('./pages/FinanceListPage'))
const FinanceEditPage = lazy(() => import('./pages/FinanceEditPage'))
const BillsListPage = lazy(() => import('./pages/BillsListPage'))
const BillsEditPage = lazy(() => import('./pages/BillsEditPage'))
const PaymentListPage = lazy(() => import('./pages/PaymentListPage'))
const PaymentEditPage = lazy(() => import('./pages/PaymentEditPage'))
const ExpensesListPage = lazy(() => import('./pages/ExpensesListPage'))
const ExpensesEditPage = lazy(() => import('./pages/ExpensesEditPage'))
const PaymentProofsPage = lazy(() => import('./pages/PaymentProofsPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'))
const ParentBillsPage = lazy(() => import('./pages/ParentBillsPage'))
const ParentPaymentPage = lazy(() => import('./pages/ParentPaymentPage'))
const ParentManualPaymentPage = lazy(() => import('./pages/ParentManualPaymentPage'))
const ParentGatewayPaymentPage = lazy(() => import('./pages/ParentGatewayPaymentPage'))
const ParentTransactionsPage = lazy(() => import('./pages/ParentTransactionsPage'))
const ParentNotificationsPage = lazy(() => import('./pages/ParentNotificationsPage'))
const UsersListPage = lazy(() => import('./pages/UsersListPage'))
const UsersEditPage = lazy(() => import('./pages/UsersEditPage'))
const StaffAccountPage = lazy(() => import('./pages/StaffAccountPage'))

export default function App() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-600">Memuat halaman...</div>}>
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
        <Route path="/admin/pengeluaran" element={<Navigate to="/admin/pengeluaran/list" replace />} />
        <Route path="/admin/pengeluaran/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="expenses"><ExpensesListPage /></ProtectedRoute>} />
        <Route path="/admin/pengeluaran/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="expenses"><ExpensesEditPage /></ProtectedRoute>} />
        <Route path="/admin/pengeluaran/edit/:id" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="expenses"><ExpensesEditPage /></ProtectedRoute>} />
        <Route path="/admin/tagihan" element={<Navigate to="/admin/tagihan/list" replace />} />
        <Route path="/admin/tagihan/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><BillsListPage /></ProtectedRoute>} />
        <Route path="/admin/tagihan/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><BillsEditPage /></ProtectedRoute>} />
        <Route path="/admin/pembayaran-manual" element={<Navigate to="/admin/pembayaran/list" replace />} />
        <Route path="/admin/pembayaran" element={<Navigate to="/admin/pembayaran/list" replace />} />
        <Route path="/admin/pembayaran/list" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><PaymentListPage /></ProtectedRoute>} />
        <Route path="/admin/pembayaran/edit" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="bills"><PaymentEditPage /></ProtectedRoute>} />
        <Route path="/admin/bukti-pembayaran" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="payment_proofs"><PaymentProofsPage /></ProtectedRoute>} />
        <Route path="/admin/laporan" element={<ProtectedRoute role={['admin', 'bendahara']} menuKey="reports"><ReportsPage /></ProtectedRoute>} />
        <Route path="/admin/akun" element={<ProtectedRoute role={['admin', 'bendahara']}><StaffAccountPage /></ProtectedRoute>} />
        <Route path="/admin/backup" element={<Navigate to="/admin/pengaturan" replace />} />
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
    </Suspense>
  )
}
