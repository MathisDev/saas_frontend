import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  ShieldCheck,
  LogOut,
  Box,
  TerminalSquare,
  Settings as SettingsIcon,
  Activity,
  Users,
  Menu,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { APP_VERSION } from "../version";

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
          isActive
            ? "bg-slate-900 text-white font-medium"
            : "text-slate-600 hover:bg-slate-100"
        }`
      }
    >
      <Icon size={16} strokeWidth={2} />
      {label}
    </NavLink>
  );
}

function Avatar({ email, className = "w-8 h-8 text-xs" }) {
  return (
    <div className={`rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-medium shrink-0 ${className}`}>
      {email?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// Sur téléphone (< md) la sidebar disparaît au profit d'une barre d'onglets en
// bas d'écran (zone du pouce) + une feuille "Menu" pour le reste (compte, admin,
// déconnexion). Les routes /environnements (/, /new, /namespaces/...) doivent
// toutes allumer l'onglet Environnements, d'où `match` plutôt que NavLink seul.
function TabItem({ to, icon: Icon, label, active, onClick }) {
  const content = (
    <>
      <span
        className={`flex items-center justify-center h-7 w-12 rounded-full transition-colors ${
          active ? "bg-slate-900 text-white" : "text-slate-500"
        }`}
      >
        <Icon size={18} strokeWidth={active ? 2.25 : 2} />
      </span>
      <span className={`text-[10px] leading-none ${active ? "font-semibold text-slate-900" : "text-slate-500"}`}>
        {label}
      </span>
    </>
  );
  const className = "flex-1 flex flex-col items-center gap-1 pt-2 pb-1.5 active:scale-95 transition-transform";
  return onClick ? (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  ) : (
    <NavLink to={to} className={className}>
      {content}
    </NavLink>
  );
}

function SheetLink({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition active:bg-slate-100 ${
          isActive ? "bg-slate-100 font-medium text-slate-900" : "text-slate-700"
        }`
      }
    >
      <Icon size={18} strokeWidth={2} className="text-slate-500" />
      <span className="flex-1">{label}</span>
      <ChevronRight size={16} className="text-slate-300" />
    </NavLink>
  );
}

function MobileMenuSheet({ open, onClose }) {
  const { me, isAdmin, logout } = useAuth();
  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50 flex items-end bg-slate-900/40 animate-fade-in" onClick={onClose}>
      <div
        className="w-full bg-white rounded-t-3xl shadow-xl px-4 pt-3 animate-sheet-up"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

        <div className="flex items-center gap-3 px-3 pb-4 mb-2 border-b border-slate-100">
          <Avatar email={me?.email} className="w-10 h-10 text-sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{me?.email || "…"}</p>
            <p className="text-xs text-slate-400 capitalize">{me?.tier || ""}</p>
          </div>
        </div>

        <nav className="space-y-0.5">
          <SheetLink to="/settings" icon={SettingsIcon} label="Paramètres" />
          {isAdmin && <SheetLink to="/admin" icon={ShieldCheck} label="Admin" />}
          {isAdmin && <SheetLink to="/admin/organisation" icon={Users} label="Organisation" />}
        </nav>

        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-3 mt-2 rounded-xl text-sm text-red-600 active:bg-red-50 transition"
        >
          <LogOut size={18} strokeWidth={2} />
          Déconnexion
        </button>

        <p className="text-xs text-slate-300 text-center mt-3">v{APP_VERSION}</p>
      </div>
    </div>
  );
}

export default function Layout() {
  const { me, isAdmin, logout } = useAuth();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Ferme la feuille dès qu'on navigue depuis elle.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const inEnvironments = pathname === "/" || pathname === "/new" || pathname.startsWith("/namespaces");
  const inMenu = pathname.startsWith("/settings") || pathname.startsWith("/admin");

  return (
    <div className="min-h-[100dvh] md:h-screen md:flex bg-slate-50">
      <aside className="hidden md:flex w-60 shrink-0 border-r border-slate-200 bg-white flex-col overflow-y-auto">
        <div className="flex items-center gap-2 px-5 h-16 border-b border-slate-200">
          <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center">
            <Box size={16} />
          </div>
          <span className="font-semibold text-sm">SaaS Platform</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          <p className="px-3 text-xs font-medium text-slate-400 uppercase tracking-wide mb-1">
            Workspace
          </p>
          <NavItem to="/" end icon={LayoutGrid} label="Environnements" />
          <NavItem to="/console" icon={TerminalSquare} label="Console" />
          <NavItem to="/monitoring" icon={Activity} label="Monitoring" />
          {isAdmin && <NavItem to="/admin" icon={ShieldCheck} label="Admin" />}
          {isAdmin && <NavItem to="/admin/organisation" icon={Users} label="Organisation" />}

          <p className="px-3 text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 mt-4">
            Compte
          </p>
          <NavItem to="/settings" icon={SettingsIcon} label="Paramètres" />
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar email={me?.email} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{me?.email || "…"}</p>
              <p className="text-xs text-slate-400 capitalize">{me?.tier || ""}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2 py-2 mt-1 rounded-md text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
          >
            <LogOut size={16} strokeWidth={2} />
            Déconnexion
          </button>
          <p className="text-xs text-slate-300 text-center mt-2">v{APP_VERSION}</p>
        </div>
      </aside>

      <header
        className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/70"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Box size={15} />
            </div>
            <span className="font-semibold text-sm">SaaS Platform</span>
          </div>
          <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu du compte" className="active:scale-95 transition-transform">
            <Avatar email={me?.email} />
          </button>
        </div>
      </header>

      <main className="md:flex-1 md:min-w-0 md:overflow-y-auto">
        <div className="px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:py-8 md:h-full">
          <Outlet />
        </div>
      </main>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-md border-t border-slate-200/70 flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <TabItem to="/" icon={LayoutGrid} label="Environnements" active={inEnvironments} />
        <TabItem to="/console" icon={TerminalSquare} label="Console" active={pathname.startsWith("/console")} />
        <TabItem to="/monitoring" icon={Activity} label="Monitoring" active={pathname.startsWith("/monitoring")} />
        <TabItem icon={Menu} label="Menu" active={inMenu || menuOpen} onClick={() => setMenuOpen(true)} />
      </nav>

      <MobileMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
