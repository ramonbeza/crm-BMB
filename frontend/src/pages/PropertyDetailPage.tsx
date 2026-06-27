import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertCircle, Building2, FolderOpen } from "lucide-react";
import { api } from "@/lib/api";
import type { Property, PaginatedProcedures } from "@/types";

const typeLabel: Record<string, string> = {
  urbano: "Urbano",
  rural: "Rural",
  rural_urbano: "Rural-Urbano",
};

const typeCls: Record<string, string> = {
  urbano: "bg-blue-50 text-blue-700",
  rural: "bg-green-50 text-green-700",
  rural_urbano: "bg-amber-50 text-amber-700",
};

const procStatusCls: Record<string, string> = {
  em_andamento: "bg-blue-50 text-blue-700",
  concluido: "bg-green-50 text-green-700",
  cancelado: "bg-gray-100 text-gray-500",
};
const procStatusLabel: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: prop, isLoading } = useQuery<Property>({
    queryKey: ["property", id],
    queryFn: async () => (await api.get<Property>(`/properties/${id}`)).data,
    enabled: !!id,
  });

  const { data: procedures } = useQuery<PaginatedProcedures>({
    queryKey: ["procedures-by-property", id],
    queryFn: async () =>
      (await api.get<PaginatedProcedures>(`/procedures?page_size=100&property_id=${id}`)).data,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!prop) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="text-red-400" size={32} />
        <p className="text-gray-500 text-sm">Imóvel não encontrado.</p>
        <Link to="/imoveis" className="text-primary-600 text-sm hover:underline">← Voltar</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        to="/imoveis"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-5"
      >
        <ArrowLeft size={16} />
        Imóveis
      </Link>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Building2 size={22} className="text-gray-400" />
            <h1 className="text-xl font-bold text-gray-900 font-mono">
              {prop.matricula ?? <span className="text-gray-400 font-sans font-normal italic">Sem matrícula registrada</span>}
            </h1>
            <span className={`inline-flex px-2.5 py-1 rounded text-xs font-semibold ${typeCls[prop.property_type]}`}>
              {typeLabel[prop.property_type]}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3">
          {prop.inscricao_imobiliaria && (
            <InfoField label="Inscrição Imobiliária" value={prop.inscricao_imobiliaria} />
          )}
          {prop.incra_code && (
            <InfoField label="Código INCRA" value={prop.incra_code} />
          )}
          {prop.endereco && (
            <InfoField label="Endereço / Localização" value={prop.endereco} />
          )}
          {prop.area_total != null && (
            <InfoField
              label="Área total"
              value={`${prop.area_total.toLocaleString("pt-BR")} ${prop.area_unit === "ha" ? "ha" : "m²"}`}
            />
          )}
          {prop.cartorio && (
            <InfoField label="Cartório de Registro" value={prop.cartorio} />
          )}
          <InfoField label="Procedimentos" value={String(prop.procedure_count)} />
        </div>

        {prop.confrontantes && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Confrontantes (lindeiros)</p>
            <p className="text-sm text-gray-700">{prop.confrontantes}</p>
          </div>
        )}

        {prop.notas && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1">Observações</p>
            <p className="text-sm text-gray-700">{prop.notas}</p>
          </div>
        )}
      </div>

      {/* Procedures linked to this property */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen size={18} className="text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Procedimentos vinculados</h2>
          <span className="ml-auto text-xs text-gray-400">{procedures?.total ?? 0} total</span>
        </div>

        {!procedures || procedures.items.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">
            Nenhum procedimento vinculado a este imóvel.
            <br />
            <span className="text-xs">Ao criar um procedimento, selecione este imóvel para vinculá-lo.</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {procedures.items.map((p) => {
              const year = new Date(p.opened_at).getFullYear();
              const proto = `BMB-${year}-${String(p.protocol_number).padStart(4, "0")}`;
              return (
                <div key={p.id} className="flex items-center gap-4 py-3">
                  <Link
                    to={`/procedimentos/${p.id}`}
                    className="font-mono text-sm font-medium text-primary-700 hover:text-primary-900 w-36 flex-shrink-0"
                  >
                    {proto}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.procedure_type_label}</p>
                    <p className="text-xs text-gray-400">{p.client_name ?? "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      {p.stages_done}/{p.stages_total} etapas
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${procStatusCls[p.status]}`}>
                      {procStatusLabel[p.status]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}
