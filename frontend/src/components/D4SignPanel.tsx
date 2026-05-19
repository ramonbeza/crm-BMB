/**
 * Sprint 17 — Painel D4Sign
 * Exibido em QuoteDetailPage e ContractsPage.
 * Permite: upload de PDF + envio para assinatura, consulta de status, cancelamento.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileSignature,
  RefreshCw,
  X,
  ExternalLink,
  CheckCircle,
  Clock,
  AlertTriangle,
  Upload,
} from "lucide-react";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface D4SignStatus {
  document_uuid: string | null;
  d4sign_status: string | null;
  sign_url: string | null;
  signed_at: string | null;
}

interface Props {
  entityType: "quotes" | "contracts";
  entityId: string;
  entityStatus: string;
  signerEmail?: string;   // pré-popula o campo
  signerName?: string;
  onSigned?: () => void;  // callback quando documento é assinado
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  aguardando_signatarios: "Aguardando assinatura",
  em_assinatura:          "Em assinatura",
  concluido:              "Concluído / Assinado",
  cancelado:              "Cancelado",
  processando:            "Processando",
};

const STATUS_CLS: Record<string, string> = {
  aguardando_signatarios: "border-amber-300 bg-amber-50 text-amber-800",
  em_assinatura:          "border-blue-300 bg-blue-50 text-blue-800",
  concluido:              "border-green-300 bg-green-50 text-green-800",
  cancelado:              "border-red-300 bg-red-50 text-red-700",
  processando:            "border-gray-300 bg-gray-50 text-gray-700",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  aguardando_signatarios: <Clock className="w-4 h-4" />,
  em_assinatura:          <Clock className="w-4 h-4" />,
  concluido:              <CheckCircle className="w-4 h-4" />,
  cancelado:              <AlertTriangle className="w-4 h-4" />,
  processando:            <RefreshCw className="w-4 h-4 animate-spin" />,
};

// ── Component ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function D4SignPanel({ entityType, entityId, entityStatus, signerEmail = "", signerName = "", onSigned: _onSigned }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  void fileRef; // used via input ref prop
  const [email, setEmail] = useState(signerEmail);
  const [name, setName] = useState(signerName);
  const [message, setMessage] = useState("Por favor, assine o documento.");
  const [authMethod, setAuthMethod] = useState("email");
  const [file, setFile] = useState<File | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusKey = ["d4sign-status", entityType, entityId];

  // Consulta status
  const { data: statusData, isFetching: fetchingStatus, refetch } = useQuery<D4SignStatus>({
    queryKey: statusKey,
    queryFn: async () =>
      (await api.get<D4SignStatus>(`/d4sign/${entityType}/${entityId}/status`)).data,
    enabled: !!entityId,
    refetchInterval: (q) => {
      const s = q.state.data?.d4sign_status;
      // Polling automático enquanto em aguardando/processando
      return s === "aguardando_signatarios" || s === "processando" || s === "em_assinatura"
        ? 30_000
        : false;
    },
    staleTime: 20_000,
  });

  // Envio para assinatura
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Selecione o PDF do documento");
      if (!email) throw new Error("Informe o e-mail do signatário");
      if (!name) throw new Error("Informe o nome do signatário");
      const fd = new FormData();
      fd.append("pdf_file", file);
      fd.append("signer_email", email);
      fd.append("signer_name", name);
      fd.append("message", message);
      fd.append("auth_method", authMethod);
      return (await api.post(`/d4sign/${entityType}/${entityId}/send`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: statusKey });
      qc.invalidateQueries({ queryKey: [entityType.replace("s", ""), entityId] });
      setShowForm(false);
      setFile(null);
      setError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? String(err);
      setError(msg);
    },
  });

  // Cancelar
  const cancelMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/d4sign/${entityType}/${entityId}/cancel`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: statusKey });
      setError(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail ?? String(err);
      setError(msg);
    },
  });

  const d4Status = statusData?.d4sign_status;
  const isSigned = entityStatus === "assinado" || d4Status === "concluido";
  const canSend = !d4Status || d4Status === "cancelado" || d4Status === "concluido";
  const canCancel = d4Status === "aguardando_signatarios" || d4Status === "em_assinatura";

  if (isSigned && !d4Status) {
    // Assinado manualmente (sem D4Sign)
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-bold text-gray-900">Assinatura Digital (D4Sign)</h2>
        </div>
        <button
          onClick={() => refetch()}
          disabled={fetchingStatus}
          className="text-gray-400 hover:text-gray-700 transition-colors"
          title="Atualizar status"
        >
          <RefreshCw className={`w-4 h-4 ${fetchingStatus ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Status badge */}
      {d4Status && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 text-sm font-medium ${STATUS_CLS[d4Status] ?? "border-gray-200 bg-gray-50 text-gray-700"}`}>
          {STATUS_ICON[d4Status]}
          <span>{STATUS_LABEL[d4Status] ?? d4Status}</span>
          {statusData?.signed_at && d4Status === "concluido" && (
            <span className="ml-auto text-xs font-normal">
              {new Date(statusData.signed_at).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {/* Link de assinatura */}
      {statusData?.sign_url && d4Status !== "concluido" && d4Status !== "cancelado" && (
        <a
          href={statusData.sign_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline mb-4"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir link de assinatura
        </a>
      )}

      {/* Error */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2 flex-wrap">
        {canSend && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            {d4Status === "cancelado" ? "Reenviar para assinatura" : "Enviar para assinatura"}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => {
              if (confirm("Cancelar o envio no D4Sign?")) cancelMutation.mutate();
            }}
            disabled={cancelMutation.isPending}
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Cancelar envio
          </button>
        )}
      </div>

      {/* Formulário de envio */}
      {showForm && (
        <div className="mt-4 space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700">Configurar envio para assinatura</h3>

          {/* Upload PDF */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">
              PDF do documento *
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
            />
            {file && (
              <p className="text-xs text-gray-500 mt-0.5">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
            )}
          </div>

          {/* Signatário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">E-mail do signatário *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Nome do signatário *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João da Silva"
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Método de autenticação */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Método de autenticação</label>
            <select
              value={authMethod}
              onChange={(e) => setAuthMethod(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="email">E-mail</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          {/* Mensagem */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Mensagem para o signatário</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending}
              className="text-sm font-medium bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {sendMutation.isPending ? "Enviando…" : "Confirmar envio"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="text-sm font-medium text-gray-600 px-4 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Sem D4Sign configurado */}
      {!d4Status && !showForm && (
        <p className="text-xs text-gray-400 mt-3">
          Envie o PDF do documento para assinatura digital via D4Sign (ICP-Brasil).
        </p>
      )}
    </div>
  );
}
