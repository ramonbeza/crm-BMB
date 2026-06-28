import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Edit2,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  FileText,
  FolderOpen,
  Receipt,
  FileCheck,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  ClientDetail,
  PaginatedProcedures,
  PaginatedQuotes,
  ProcedureStatus,
  QuoteStatus,
  ContractStatus,
} from "@/types";

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const procStatusCls: Record<ProcedureStatus, string> = {
  em_andamento: "bg-blue-50 text-blue-700",
  concluido: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};
const procStatusLabel: Record<ProcedureStatus, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const quoteStatusCls: Record<QuoteStatus, string> = {
  rascunho: "bg-gray-100 text-gray-500",
  enviado: "bg-blue-50 text-blue-700",
  aguardando_assinatura: "bg-amber-50 text-amber-700",
  assinado: "bg-green-50 text-green-700",
  expirado: "bg-orange-50 text-orange-700",
  cancelado: "bg-gray-100 text-gray-400",
};

const contractStatusCls: Record<ContractStatus, string> = {
  rascunho: "bg-gray-100 text-gray-500",
  enviado: "bg-blue-50 text-blue-700",
  aguardando_assinatura: "bg-amber-50 text-amber-700",
  assinado: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-400",
};

// ── Tab button ─────────────────────────────────────────────────────────────────

function Tab({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary-600 text-primary-700"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      <Icon size={15} />
      {label}
      {count !== undefined && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

// ── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  );
}

// ── ClientDetailPage ──────────────────────────────────────────────────────────

type TabId = "procedimentos" | "orcamentos" | "contratos";

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("procedimentos");

  const { data: client, isLoading } = useQuery<ClientDetail>({
    queryKey: ["client", id],
    queryFn: async () => (await api.get(`/clients/${id}`)).data,
    enabled: Boolean(id),
  });

  const { data: procedures } = useQuery<PaginatedProcedures>({
    queryKey: ["client-procedures", id],
    queryFn: async () =>
      (await api.get<PaginatedProcedures>(`/procedures?page_size=100&client_id=${id}`)).data,
    enabled: Boolean(id),
  });

  const { data: quotes } = useQuery<PaginatedQuotes>({
    queryKey: ["client-quotes", id],
    queryFn: async () =>
      (await api.get<PaginatedQuotes>(`/quotes?page_size=100&client_id=${id}`)).data,
    enabled: Boolean(id),
  });

  const { data: contracts } = useQuery<{ items: import("@/types").ContractListItem[]; total: number }>({
    queryKey: ["client-contracts", id],
    queryFn: async () =>
      (await api.get(`/quotes/contratos?page_size=100&client_id=${id}`)).data,
    enabled: Boolean(id),
  });

  if (isLoading || !client) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-gray-400 text-sm">Carregando cliente...</p>
      </div>
    );
  }

  const isPF = client.client_type === "PF";
  const name = isPF ? client.pf_data?.name : client.pj_data?.company_name;
  const doc = isPF ? client.pf_data?.cpf : client.pj_data?.cnpj;
  const address = isPF ? client.pf_data?.address : client.pj_data?.address;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate("/clientes")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={15} />
          Voltar
        </button>
        <Link
          to={`/clientes/${id}/editar`}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
        >
          <Edit2 size={13} />
          Editar
        </Link>
      </div>

      {/* Client card */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-xl flex-shrink-0 ${isPF ? "bg-blue-50 text-blue-600" : "bg-indigo-50 text-indigo-600"}`}>
            {isPF ? <User size={22} /> : <Building2 size={22} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{name ?? "—"}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                {isPF ? "Pessoa Física" : "Pessoa Jurídica"}
              </span>
              {!client.is_active && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">Inativo</span>
              )}
            </div>
            {doc && <p className="text-sm text-gray-400 mt-0.5 font-mono">{doc}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoRow icon={Phone} label="Telefone" value={client.phone} />
          <InfoRow icon={Mail} label="E-mail" value={client.email} />
          <InfoRow icon={MapPin} label="Endereço" value={address} />
          {isPF && client.pf_data?.civil_status && (
            <InfoRow icon={User} label="Estado civil" value={client.pf_data.civil_status} />
          )}
          {client.notes && (
            <div className="sm:col-span-2">
              <InfoRow icon={FileText} label="Observações" value={client.notes} />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-200 px-2 overflow-x-auto">
          <Tab
            active={tab === "procedimentos"}
            onClick={() => setTab("procedimentos")}
            icon={FolderOpen}
            label="Procedimentos"
            count={procedures?.total}
          />
          <Tab
            active={tab === "orcamentos"}
            onClick={() => setTab("orcamentos")}
            icon={Receipt}
            label="Orçamentos"
            count={quotes?.total}
          />
          <Tab
            active={tab === "contratos"}
            onClick={() => setTab("contratos")}
            icon={FileCheck}
            label="Contratos"
            count={contracts?.total}
          />
        </div>

        {/* Procedimentos */}
        {tab === "procedimentos" && (
          <div>
            {!procedures?.items.length ? (
              <p className="text-sm text-gray-400 text-center py-10">Nenhum procedimento vinculado.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {procedures.items.map((p) => (
                  <Link
                    key={p.id}
                    to={`/procedimentos/${p.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 group"
                  >
                    <span className="font-mono text-xs text-gray-400 w-28 flex-shrink-0">
                      #{String(p.protocol_number).padStart(4, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{p.procedure_type_label}</p>
                      <p className="text-xs text-gray-400">{p.stages_done}/{p.stages_total} etapas</p>
                    </div>
                    {p.deadline && (
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(p.deadline)}</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${procStatusCls[p.status]}`}>
                      {procStatusLabel[p.status]}
                    </span>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orçamentos */}
        {tab === "orcamentos" && (
          <div>
            {!quotes?.items.length ? (
              <p className="text-sm text-gray-400 text-center py-10">Nenhum orçamento vinculado.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {quotes.items.map((q) => (
                  <Link
                    key={q.id}
                    to={`/orcamentos/${q.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 group"
                  >
                    <span className="font-mono text-xs text-gray-400 w-36 flex-shrink-0">{q.formatted_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{q.procedure_type_label ?? "—"}</p>
                      {q.valid_until && (
                        <p className="text-xs text-gray-400">Válido até {formatDate(q.valid_until)}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{fmt(q.total)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${quoteStatusCls[q.status]}`}>
                      {q.status_label}
                    </span>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contratos */}
        {tab === "contratos" && (
          <div>
            {!contracts?.items.length ? (
              <p className="text-sm text-gray-400 text-center py-10">Nenhum contrato vinculado.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {contracts.items.map((c) => (
                  <Link
                    key={c.id}
                    to={`/contratos/${c.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 group"
                  >
                    <span className="font-mono text-xs text-gray-400 w-36 flex-shrink-0">{c.formatted_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800">{c.payment_model_label}</p>
                      <p className="text-xs text-gray-400">{formatDate(c.created_at)}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 flex-shrink-0">{fmt(c.total_value)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${contractStatusCls[c.status]}`}>
                      {c.status_label}
                    </span>
                    <ChevronRight size={14} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
