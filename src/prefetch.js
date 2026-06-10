const prefetchers = {
  "/": () => import("./pages/LandingPage"),
  "/admin": () => import("./pages/AdminDashboard"),
  "/admin/siswa/list": () => import("./pages/StudentListPage"),
  "/admin/siswa/edit": () => import("./pages/StudentEditPage"),
  "/admin/kelas/list": () => import("./pages/ClassesListPage"),
  "/admin/kelas/edit": () => import("./pages/ClassesEditPage"),
  "/admin/tahun-ajaran/list": () => import("./pages/AcademicListPage"),
  "/admin/tahun-ajaran/edit": () => import("./pages/AcademicEditPage"),
  "/admin/pos-keuangan/list": () => import("./pages/FinanceListPage"),
  "/admin/pos-keuangan/edit": () => import("./pages/FinanceEditPage"),
  "/admin/pengeluaran/list": () => import("./pages/ExpensesListPage"),
  "/admin/pengeluaran/edit": () => import("./pages/ExpensesEditPage"),
  "/admin/pembayaran/list": () => import("./pages/PaymentListPage"),
  "/admin/pembayaran/edit": () => import("./pages/PaymentEditPage"),
  "/admin/tagihan/list": () => import("./pages/BillsListPage"),
  "/admin/tagihan/edit": () => import("./pages/BillsEditPage"),
  "/admin/bukti-pembayaran": () => import("./pages/PaymentProofsPage"),
  "/admin/laporan": () => import("./pages/ReportsPage"),
  "/admin/pengaturan": () => import("./pages/SettingsPage"),
  "/admin/users/list": () => import("./pages/UsersListPage"),
  "/admin/users/edit": () => import("./pages/UsersEditPage"),
  "/admin/akun": () => import("./pages/StaffAccountPage"),
  "/orang-tua": () => import("./pages/ParentDashboard"),
  "/orang-tua/tagihan": () => import("./pages/ParentBillsPage"),
  "/orang-tua/tagihan/pembayaran": () => import("./pages/ParentPaymentPage"),
  "/orang-tua/tagihan/pembayaran/manual": () => import("./pages/ParentManualPaymentPage"),
  "/orang-tua/tagihan/pembayaran/otomatis": () => import("./pages/ParentGatewayPaymentPage"),
  "/orang-tua/tagihan/pembayaran/popup-v2": () => import("./pages/ParentGatewayPopupV2Page"),
  "/orang-tua/transaksi": () => import("./pages/ParentTransactionsPage"),
  "/orang-tua/notifikasi": () => import("./pages/ParentNotificationsPage"),
};

const prefetched = new Set();

const resolvePrefetcher = (path) => {
  if (!path) return null;
  if (prefetchers[path]) return prefetchers[path];

  const entry = Object.entries(prefetchers).find(([key]) =>
    path === key || path.startsWith(`${key}/`),
  );
  return entry?.[1] || null;
};

export const prefetchRoute = (path) => {
  const run = resolvePrefetcher(path);
  if (!run || prefetched.has(path)) return;
  prefetched.add(path);
  run().catch(() => {
    prefetched.delete(path);
  });
};

export const prefetchStaffCore = () => {
  ["/admin", "/admin/pembayaran/list", "/admin/tagihan/list", "/admin/laporan"].forEach(prefetchRoute);
};

export const prefetchParentCore = () => {
  ["/orang-tua", "/orang-tua/tagihan", "/orang-tua/transaksi"].forEach(prefetchRoute);
};

export const schedulePrefetch = (cb) => {
  if (typeof window === "undefined") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(cb, { timeout: 1200 });
    return;
  }
  window.setTimeout(cb, 250);
};
