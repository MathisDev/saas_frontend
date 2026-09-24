import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, ShieldCheck, LogOut, Box, TerminalSquare, Settings as SettingsIcon, Activity } from "lucide-react";
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

export default function Layout() {
  const { me, isAdmin, logout } = useAuth();

  return (
    <div className="h-screen flex bg-slate-50">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto">
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

          <p className="px-3 text-xs font-medium text-slate-400 uppercase tracking-wide mb-1 mt-4">
            Compte
          </p>
          <NavItem to="/settings" icon={SettingsIcon} label="Paramètres" />
        </nav>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-medium shrink-0">
              {me?.email?.[0]?.toUpperCase() || "?"}
            </div>
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

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-8 py-8 h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
