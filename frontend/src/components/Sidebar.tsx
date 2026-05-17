import { NavLink, useNavigate } from "react-router-dom";
import { Users, LayoutDashboard, LogOut, UserCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
];

export function Sidebar() {
  const { user, refreshToken, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      if (refreshToken) await api.post("/auth/logout", { refresh_token: refreshToken });
    } finally {
      logout();
      navigate("/login");
    }
  };

  return (
    <aside className="w-60 flex flex-col bg-primary-900 text-white flex-shrink-0">
      <div className="px-5 py-5 border-b border-primary-700">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary-300">CRM</p>
        <h1 className="text-sm font-bold leading-tight mt-0.5">Beza, Miranda e Bonetti</h1>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-primary-700 text-white"
                  : "text-primary-200 hover:bg-primary-800 hover:text-white"
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-primary-700">
        <div className="flex items-center gap-2 mb-3">
          <UserCircle2 size={20} className="text-primary-300 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user?.name ?? "—"}</p>
            <p className="text-xs text-primary-300 truncate capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded text-sm text-primary-200 hover:bg-primary-800 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}
