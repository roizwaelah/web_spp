import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  LogOut,
  Menu,
  UserCog,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { getHomePath, getMenuSections, isMenuItemActive } from "../access";
import { useUI } from "../context/UIContext";

export default function Layout({ title, subtitle, actions, children, showHeader = true, onNavigateAttempt }) {
  const { user, logout } = useAuth();
  const { confirm } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const sections = getMenuSections(user);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const homePath = getHomePath(user);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const canLeavePage = async () => {
    if (!onNavigateAttempt) return true;
    return onNavigateAttempt();
  };

  const handleLogout = async () => {
    const canProceed = await canLeavePage();
    if (!canProceed) return;

    const confirmed = await confirm({
      title: "Keluar dari aplikasi",
      description: "Sesi login Anda akan diakhiri dan Anda akan kembali ke halaman masuk.",
      confirmLabel: "Ya, keluar",
      variant: "danger",
    });
    if (!confirmed) return;
    logout();
  };

  const handleMenuNavigation = async (event, to) => {
    event.preventDefault();
    const canProceed = await canLeavePage();
    if (!canProceed) return;
    setIsSidebarOpen(false);
    navigate(to);
  };

  return (
    <div className="min-h-screen bg-[#eff2f6]">
      <div className="dp-navbar">
        <div className="dp-navbar__inner">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md p-1.5 text-slate-200 transition hover:bg-slate-700 hover:text-white xl:hidden"
              onClick={() => setIsSidebarOpen((prev) => !prev)}
              aria-label={isSidebarOpen ? "Tutup menu" : "Buka menu"}
            >
              {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <h1 className="dp-brand">
              <span className="dp-brand__dp">spp</span>Panel
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p className="hidden text-emerald-400 sm:block">Halo, <span className="font-semibold text-white">{user?.name}</span></p>
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-600 text-[11px] font-semibold text-white">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <button onClick={handleLogout} className="dp-logout-btn" aria-label="Keluar">
              <LogOut size={15} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {isSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 top-[50px] z-20 bg-slate-900/45 xl:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Tutup sidebar"
        />
      )}

      <aside className={`dp-sidebar ${isSidebarOpen ? "is-open" : "is-closed"}`}>
        <div className="space-y-4 pt-2">
          <Link
            to={homePath}
            onClick={(event) => handleMenuNavigation(event, homePath)}
            className={`dp-nav-link ${location.pathname === homePath ? "is-active" : ""}`}
          >
            <Home size={17} />
            Dashboard
          </Link>
        </div>

        <div className="mt-1 space-y-4">
          {sections.map((section) => (
            <div key={section.section} className="space-y-1">
              {section.items
                .filter((item) => item.label !== "Dashboard" && item.label !== "Ringkasan")
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={(event) => handleMenuNavigation(event, item.to)}
                      className={`dp-nav-link ${isMenuItemActive(item, location.pathname) ? "is-active" : ""}`}
                    >
                      <Icon size={17} />
                      {item.label}
                    </Link>
                  );
                })}
            </div>
          ))}

          {user?.role !== "parent" && (
            <div className="space-y-1">
              <Link
                to="/admin/akun"
                onClick={(event) => handleMenuNavigation(event, "/admin/akun")}
                className={`dp-nav-link ${location.pathname === "/admin/akun" ? "is-active" : ""}`}
              >
                <UserCog size={17} />
                Edit Akun Saya
              </Link>
            </div>
          )}
        </div>
      </aside>

      <div className="dp-content">
        <main className="space-y-4">
          {showHeader && (
            <header className="glass p-3 xl:p-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="mt-1 text-2xl font-bold text-slate-900 xl:text-3xl">
                    {title}
                  </h2>
                  <p className="mt-1 max-w-4xl text-sm text-slate-500">{subtitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {actions}
                </div>
              </div>
            </header>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
