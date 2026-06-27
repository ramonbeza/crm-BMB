import { NavLink, useNavigate } from "react-router-dom";
import { Users, LayoutDashboard, LogOut, UserCircle2, Calendar, ClipboardList, FolderOpen, Building2, Receipt, FileCheck, Wallet, MessageSquare, BarChart2, Clock, Plug, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import type { UserRole } from "@/types";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  /** roles that can see this item; undefined = everyone */
  allowedRoles?: UserRole[];
}

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/agenda", label: "Agenda", icon: Calendar, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/atendimentos", label: "Atendimentos", icon: ClipboardList, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/procedimentos", label: "Procedimentos", icon: FolderOpen },
  { to: "/imoveis", label: "Imóveis", icon: Building2, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/orcamentos", label: "Orçamentos", icon: Receipt, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/contratos", label: "Contratos", icon: FileCheck, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/comunicacoes", label: "Comunicações", icon: MessageSquare, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/prazos", label: "Prazos", icon: Clock, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/relatorios", label: "Relatórios", icon: BarChart2, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/integracoes", label: "Integrações", icon: Plug, allowedRoles: ["admin", "advogado", "estagiario"] },
  { to: "/usuarios", label: "Usuários", icon: UserCog, allowedRoles: ["admin"] },
];

const roleLabel: Record<UserRole, string> = {
  admin: "Administrador",
  advogado: "Advogado(a)",
  estagiario: "Estagiário(a)",
  despachante_externo: "Despachante Externo",
};

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

  const visibleItems = navItems.filter(({ allowedRoles }) => {
    if (!allowedRoles) return true;
    return user?.role && allowedRoles.includes(user.role);
  });

  return (
    <aside className="w-60 flex flex-col bg-primary-900 text-white flex-shrink-0">
      <div className="flex flex-col items-center px-5 py-5 border-b border-primary-700 gap-3">
        <img
          src="/logo-beza.png"
          alt="Beza, Miranda e Bonetti Advogados"
          className="w-full h-10 object-contain"
        />
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 h-px bg-primary-600" />
          <span className="text-[9px] text-primary-400 uppercase tracking-widest flex-shrink-0">Parceria</span>
          <div className="flex-1 h-px bg-primary-600" />
        </div>
        <div className="bg-white rounded-md w-full flex items-center justify-center px-3 py-2">
          <img
            src="/logo-agilis.png"
            alt="Ágilis Despachante Imobiliário"
            className="w-full h-10 object-contain"
          />
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map(({ to, label, icon: Icon, end }) => (
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
            <p className="text-xs text-primary-300 truncate">
              {user?.role ? roleLabel[user.role] : "—"}
            </p>
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
