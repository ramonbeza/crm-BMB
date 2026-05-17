import { useAuthStore } from "@/store/authStore";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const roleLabel: Record<string, string> = {
    admin: "Administrador",
    advogado: "Advogado(a)",
    estagiario: "Estagiário(a)",
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">
        Bem-vindo(a), <strong>{user?.name}</strong> — {roleLabel[user?.role ?? ""] ?? user?.role}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Módulo", value: "Sprint 2", sub: "Agenda & Atendimentos" },
          { label: "Módulo", value: "Sprint 3", sub: "Procedimentos & Etapas" },
          { label: "Módulo", value: "Sprint 4", sub: "Orçamentos & Documentos" },
        ].map((card, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{card.label}</p>
            <p className="text-2xl font-bold text-primary-700 mt-1">{card.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-800 mb-2">Sprint 1 — Concluído</h2>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>✓ Docker + FastAPI + PostgreSQL + Redis + Nginx</li>
          <li>✓ Autenticação JWT com Refresh Tokens</li>
          <li>✓ RBAC — Admin / Advogado / Estagiário</li>
          <li>✓ CRUD completo de Clientes PF e PJ</li>
        </ul>
      </div>
    </div>
  );
}
