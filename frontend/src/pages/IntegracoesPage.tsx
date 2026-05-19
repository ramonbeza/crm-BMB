import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { Calendar, CheckCircle2, XCircle, ExternalLink, Unlink } from "lucide-react";
import { api } from "@/lib/api";

interface GoogleStatus {
  connected: boolean;
  calendar_id?: string;
  token_expiry?: string | null;
}

export function IntegracoesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Detecta retorno do callback OAuth
  useEffect(() => {
    if (searchParams.get("google") === "connected") {
      queryClient.invalidateQueries({ queryKey: ["google-status"] });
      setSearchParams({});
    }
  }, [searchParams]);

  const { data: googleStatus, isLoading } = useQuery<GoogleStatus>({
    queryKey: ["google-status"],
    queryFn: async () => (await api.get<GoogleStatus>("/integrations/google/status")).data,
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
    },
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Integrações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Conecte serviços externos ao CRM</p>
      </div>

      {/* Google Calendar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl">
              <Calendar size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Google Calendar</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Sincronize reuniões com seu Google Calendar automaticamente.
              </p>
            </div>
          </div>

          {isLoading ? (
            <span className="text-xs text-gray-400">Verificando...</span>
          ) : googleStatus?.connected ? (
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

        {googleStatus?.connected && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
            <p>
              <span className="font-medium text-gray-700">Calendário:</span>{" "}
              {googleStatus.calendar_id ?? "primary"}
            </p>
            {googleStatus.token_expiry && (
              <p>
                <span className="font-medium text-gray-700">Token expira em:</span>{" "}
                {new Date(googleStatus.token_expiry).toLocaleString("pt-BR")}
              </p>
            )}
            <p className="text-gray-400 mt-2">
              Para sincronizar uma reunião específica, acesse o detalhe da reunião na{" "}
              <a href="/agenda" className="text-primary-600 hover:underline">Agenda</a>.
            </p>
          </div>
        )}

        {!googleStatus?.connected && !isLoading && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <XCircle size={13} className="flex-shrink-0" />
              <span>
                Para usar esta integração, o administrador deve configurar{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_CLIENT_ID</code> e{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">GOOGLE_CLIENT_SECRET</code> no{" "}
                <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ViaCEP / BrasilAPI — info cards */}
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
