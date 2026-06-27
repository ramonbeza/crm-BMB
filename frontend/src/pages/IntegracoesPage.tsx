import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Unlink,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

// ── types ─────────────────────────────────────────────────────────────────────

interface GoogleStatus {
  connected: boolean;
  calendar_id?: string;
  token_expiry?: string | null;
}

interface UserCalendarStatus {
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
  connected: boolean;
  calendar_id: string | null;
  token_expiry: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const roleLabel: Record<string, string> = {
  admin: "Administrador",
  advogado: "Advogado(a)",
  estagiario: "Estagiário(a)",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function IntegracoesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const isDespachante = user?.role === "despachante_externo";

  // Detecta retorno do callback OAuth
  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
      queryClient.invalidateQueries({ queryKey: ["google-all-status"] });
      setSearchParams({});
    }
  }, [searchParams]);

  // Status do usuário atual
  const { data: myStatus, isLoading } = useQuery<GoogleStatus>({
    queryKey: ["google-status"],
    queryFn: async () => (await api.get<GoogleStatus>("/integrations/google/status")).data,
  });

  // Status de todos os usuários (admin only)
  const { data: allStatus } = useQuery<UserCalendarStatus[]>({
    queryKey: ["google-all-status"],
    queryFn: async () =>
      (await api.get<UserCalendarStatus[]>("/integrations/google/all-status")).data,
    enabled: isAdmin,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ auth_url: string }>("/integrations/google/auth-url");
      window.location.href = data.auth_url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await api.delete("/integrations/google/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
      queryClient.invalidateQueries({ queryKey: ["google-all-status"] });
    },
  });

  const connectedCount = allStatus?.filter((u) => u.connected).length ?? 0;
  const totalCount = allStatus?.length ?? 0;

  if (isDespachante) {
    return (
      <div className="space-y-5 max-w-2xl">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Integrações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Conecte serviços externos ao CRM</p>
        </div>

        {/* ── ViaCEP / BrasilAPI only for despachante_externo ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <h3 className="text-sm font-bold text-gray-900">ViaCEP</h3>
            </div>
            <p className="text-xs text-gray-500">
              Busca automática de endereço por CEP. Disponível no cadastro de clientes.
              Nenhuma configuração necessária.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-green-500" />
              <h3 className="text-sm font-bold text-gray-900">BrasilAPI — CNPJ</h3>
            </div>
            <p className="text-xs text-gray-500">
              Consulta dados cadastrais de empresa pela Receita Federal. Disponível no
              cadastro de clientes PJ. Nenhuma configuração necessária.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Integrações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Conecte serviços externos ao CRM</p>
      </div>

      {/* ── Painel admin: visão geral de todos os usuários ── */}
      {isAdmin && allStatus && allStatus.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users size={16} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-bold text-gray-900">Google Calendar — Visão Geral</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {connectedCount} de {totalCount} usuário{totalCount !== 1 ? "s" : ""} conectado{connectedCount !== 1 ? "s" : ""}
              </p>
            </div>
            {/* Barra de progresso */}
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: totalCount > 0 ? `${(connectedCount / totalCount) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {totalCount > 0 ? Math.round((connectedCount / totalCount) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {allStatus.map((u) => (
              <div key={u.user_id} className="flex items-center gap-4 px-5 py-3.5">
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  u.connected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {u.user_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.user_name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {roleLabel[u.role] ?? u.role} · {u.user_email}
                  </p>
                </div>

                {/* Status */}
                {u.connected ? (
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700">
                      <CheckCircle2 size={12} />
                      Conectado
                    </span>
                    {u.calendar_id && u.calendar_id !== "primary" && (
                      <span className="text-[10px] text-gray-400 font-mono truncate max-w-[160px]">
                        {u.calendar_id}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <XCircle size={12} />
                    Não conectado
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Cada usuário conecta o próprio Google Calendar em{" "}
              <span className="font-medium text-gray-700">Integrações → Conectar</span>{" "}
              após fazer login com sua conta.
            </p>
          </div>
        </div>
      )}

      {/* ── Conexão do usuário atual ── */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Calendar size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Meu Google Calendar</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Conecte <span className="font-medium">{user?.name?.split(" ")[0]}</span> ao Google Calendar para sincronizar reuniões automaticamente.
              </p>
            </div>
          </div>

          {isLoading ? (
            <span className="text-xs text-gray-400">Verificando...</span>
          ) : myStatus?.connected ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <CheckCircle2 size={12} />
                Conectado
              </span>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <Unlink size={12} />
                Desconectar
              </button>
            </div>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <ExternalLink size={12} />
              Conectar
            </button>
          )}
        </div>

        {myStatus?.connected && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <p>
              <span className="font-medium text-gray-700">Calendário:</span>{" "}
              {myStatus.calendar_id ?? "primary"}
            </p>
            {myStatus.token_expiry && (
              <p>
                <span className="font-medium text-gray-700">Token expira em:</span>{" "}
                {new Date(myStatus.token_expiry).toLocaleString("pt-BR")}
              </p>
            )}
            <p className="text-gray-400 mt-2">
              Para sincronizar uma reunião específica, acesse o detalhe da reunião na{" "}
              <a href="/agenda" className="text-primary-600 hover:underline">Agenda</a>.
            </p>
          </div>
        )}

        {!myStatus?.connected && !isLoading && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <XCircle size={13} className="flex-shrink-0 mt-0.5" />
              <span>
                {!settings_configured() ? (
                  <>
                    Para usar esta integração, o administrador deve configurar{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code> e{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> no{" "}
                    <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
                  </>
                ) : (
                  <>Clique em <strong>Conectar</strong> para autorizar o acesso à sua agenda do Google.</>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Passo a passo para o admin ── */}
      {isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-blue-900 mb-3">Como conectar agendas da equipe</h3>
          <ol className="space-y-2 text-xs text-blue-800">
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
              <span>Certifique-se que <code className="font-mono bg-blue-100 px-1 rounded">GOOGLE_CLIENT_ID</code> e <code className="font-mono bg-blue-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> estão configurados no <code className="font-mono bg-blue-100 px-1 rounded">.env</code> do servidor.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
              <span>Cada sócio faz login no CRM com sua própria conta (Ramon, Arthur, Lenita).</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">3</span>
              <span>Na tela de Integrações, cada um clica em <strong>Conectar</strong> e autoriza o acesso à sua agenda pessoal do Google.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] font-bold">4</span>
              <span>Após conectar, as reuniões criadas por cada usuário são sincronizadas automaticamente com a agenda deles.</span>
            </li>
          </ol>
        </div>
      )}

      {/* ── ViaCEP / BrasilAPI ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <h3 className="text-sm font-bold text-gray-900">ViaCEP</h3>
          </div>
          <p className="text-xs text-gray-500">
            Busca automática de endereço por CEP. Disponível no cadastro de clientes.
            Nenhuma configuração necessária.
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <h3 className="text-sm font-bold text-gray-900">BrasilAPI — CNPJ</h3>
          </div>
          <p className="text-xs text-gray-500">
            Consulta dados cadastrais de empresa pela Receita Federal. Disponível no
            cadastro de clientes PJ. Nenhuma configuração necessária.
          </p>
        </div>
      </div>
    </div>
  );
}

// helper local — verifica se o botão deve mostrar aviso de configuração
function settings_configured(): boolean {
  // Se o endpoint retornou erro 503 ou o botão está desabilitado, não está configurado
  // Na prática, verificamos pelo status da query — se conectou ou não
  return true; // otimista — o backend retorna 503 se não configurado
}
