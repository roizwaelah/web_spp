import {
  Bell,
  BookOpenCheck,
  CalendarRange,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileSpreadsheet,
  Home,
  Layers3,
  ReceiptText,
  Settings,
  UserCog,
  Users,
} from "lucide-react";

export const staffMenuItems = [
  { accessKey: "dashboard", to: "/admin", label: "Dashboard", icon: Home, matchPrefixes: ["/admin"], exact: true },
  { accessKey: "students", to: "/admin/siswa/list", label: "Data Siswa", icon: Users, matchPrefixes: ["/admin/siswa"] },
  { accessKey: "classes", to: "/admin/kelas/list", label: "Data Kelas", icon: Layers3, matchPrefixes: ["/admin/kelas"] },
  { accessKey: "academic_years", to: "/admin/tahun-ajaran/list", label: "Tahun Ajaran", icon: CalendarRange, matchPrefixes: ["/admin/tahun-ajaran"] },
  { accessKey: "finance_posts", to: "/admin/pos-keuangan/list", label: "Pos Keuangan", icon: CreditCard, matchPrefixes: ["/admin/pos-keuangan"] },
  { accessKey: "bills", to: "/admin/tagihan/list", label: "Tagihan", icon: ReceiptText, matchPrefixes: ["/admin/tagihan"] },
  { accessKey: "bills", to: "/admin/pembayaran-manual", label: "Pembayaran Manual", icon: CreditCard, matchPrefixes: ["/admin/pembayaran-manual"] },
  { accessKey: "payment_proofs", to: "/admin/bukti-pembayaran", label: "Bukti Pembayaran", icon: FileCheck2, matchPrefixes: ["/admin/bukti-pembayaran"] },
  { accessKey: "reports", to: "/admin/laporan", label: "Laporan", icon: FileSpreadsheet, matchPrefixes: ["/admin/laporan"] },
  { accessKey: "backups", to: "/admin/backup", label: "Backup", icon: DatabaseBackup, matchPrefixes: ["/admin/backup"] },
  { accessKey: "settings", to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, matchPrefixes: ["/admin/pengaturan"] },
  { accessKey: "users", to: "/admin/users/list", label: "Users", icon: UserCog, matchPrefixes: ["/admin/users"] },
];

export const parentMenuItems = [
  { to: "/orang-tua", label: "Ringkasan", icon: Home, matchPrefixes: ["/orang-tua"], exact: true },
  { to: "/orang-tua/tagihan", label: "Tagihan", icon: BookOpenCheck, matchPrefixes: ["/orang-tua/tagihan"] },
  { to: "/orang-tua/transaksi", label: "Riwayat", icon: CreditCard, matchPrefixes: ["/orang-tua/transaksi"] },
  { to: "/orang-tua/notifikasi", label: "Notifikasi", icon: Bell, matchPrefixes: ["/orang-tua/notifikasi"] },
];

export const canAccessMenu = (user, accessKey) => {
  if (!user || user.role === "parent") return false;
  return Array.isArray(user.menu_access) && user.menu_access.includes(accessKey);
};

export const getHomePath = (user) => (user?.role === "parent" ? "/orang-tua" : "/admin");

export const getMenuSections = (user) => {
  if (user?.role === "parent") {
    return [{ section: "Menu Utama", items: parentMenuItems }];
  }

  return [
    {
      section: "Menu Utama",
      items: staffMenuItems.filter((item) => canAccessMenu(user, item.accessKey)),
    },
  ];
};

export const isMenuItemActive = (item, pathname) => {
  const prefixes = Array.isArray(item.matchPrefixes) ? item.matchPrefixes : [item.to];
  return prefixes.some((prefix) =>
    item.exact ? pathname === prefix : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
};

export const getDefaultRouteForUser = (user) => {
  if (!user) return "/";
  if (user.role === "parent") return "/orang-tua";
  const firstMenu = staffMenuItems.find((item) => canAccessMenu(user, item.accessKey));
  return firstMenu?.to || "/";
};
