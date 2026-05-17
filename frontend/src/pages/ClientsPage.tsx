import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, User, Building2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PaginatedClients, ClientType } from "@/types";
import { formatDate } from "@/lib/utils";

async function fetchClients(page: number, search: string, clientType: ClientType | "") {
  const params = new URLSearchParams({ page: String(page), page_size: "20" });
  if (search) params.set("search", search);
  if (clientType) params.set("client_type", clientType);
  const { data } = await api.get<PaginatedClients>(`/clients?${params}`);
  return data;
}

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientType, setClientType] = useState<ClientType | "">("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["clients", page, debouncedSearch, clientType],
    queryFn: () => fetchClients(page, debouncedSearch, clientType),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as unknown as { _st?: ReturnType<typeof setTimeout> })._st);
    (window as unknown as { _st?: ReturnType<typeof setTimeout> })._st = setTimeout(() => {
      setDebouncedSearch(v);
      setPage(1);
    }, 350);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} cliente${data.total !== 1 ? "s" : ""} cadastrado${data.total !== 1 ? "s" : ""}` : "Carregando..."}
          </p>
        </div>
        <Link
          to="/clientes/novo"
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Novo Cliente
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nome, CPF, CNPJ..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={clientType}
          onChange={(e) => { setClientType(e.target.value as ClientType | ""); setPage(1); }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
        >
          <option value="">Todos os tipos</option>
          <option value="PF">Pessoa Física</option>
          <option value="PJ">Pessoa Jurídica</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Carregando...
          </div>
        ) : isError ? (
          <div className="flex items-center justify-center py-16 text-red-500 text-sm">
            Erro ao carregar clientes.
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            Nenhum cliente encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nome / Razão Social</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Documento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Telefone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Cadastrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.items.map((client) => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      to={`/clientes/${client.id}`}
                      className="flex items-center gap-2 text-primary-700 hover:text-primary-900 font-medium"
                    >
                      {client.client_type === "PF" ? (
                        <User size={15} className="flex-shrink-0 text-primary-400" />
                      ) : (
                        <Building2 size={15} className="flex-shrink-0 text-primary-400" />
                      )}
                      {client.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{client.document}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      client.client_type === "PF"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-purple-50 text-purple-700"
                    }`}>
                      {client.client_type === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{client.phone}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(client.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Página {data.page} de {data.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40 transition-colors"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page === data.pages}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
