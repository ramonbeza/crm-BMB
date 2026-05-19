import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, FileText, Home, X } from "lucide-react";
import { api } from "../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClientResult {
  id: string;
  client_type: "PF" | "PJ";
  name: string;
  document: string;
  phone: string;
  email: string | null;
}

interface ProcedureResult {
  id: string;
  protocol_number: number;
  protocol_label: string;
  procedure_type: string;
  procedure_type_label: string;
  client_name: string;
  status: string;
}

interface PropertyResult {
  id: string;
  endereco: string | null;
  matricula: string | null;
  property_type: string;
}

interface SearchResponse {
  clients: ClientResult[];
  procedures: ProcedureResult[];
  properties: PropertyResult[];
  total: number;
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CLS: Record<string, string> = {
  em_andamento: "bg-blue-100 text-blue-700",
  concluido: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

const STATUS_LABEL: Record<string, string> = {
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Debounce 350 ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  // Cmd/Ctrl + K → focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const enabled = debouncedQ.length >= 2;

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ["global-search", debouncedQ],
    queryFn: async () => {
      const r = await api.get("/search/", { params: { q: debouncedQ, limit: 5 } });
      return r.data;
    },
    enabled,
    staleTime: 30_000,
  });

  const hasResults = data && data.total > 0;

  function go(path: string) {
    navigate(path);
    setOpen(false);
    setQuery("");
  }

  function handleFocus() {
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative flex-1 max-w-md">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          placeholder="Buscar… (⌘K)"
          className="w-full pl-9 pr-8 py-1.5 text-sm bg-gray-100 border border-transparent rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors placeholder-gray-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setDebouncedQ(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && query.length >= 2 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-[480px] overflow-y-auto">
          {isFetching && !data && (
            <p className="text-sm text-gray-500 px-4 py-3">Buscando…</p>
          )}

          {!isFetching && enabled && !hasResults && (
            <p className="text-sm text-gray-500 px-4 py-3">Nenhum resultado para "{query}"</p>
          )}

          {/* Clientes */}
          {data && data.clients.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                <Users className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Clientes
                </span>
              </div>
              {data.clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => go(`/clientes/${c.id}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-start gap-3"
                >
                  <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    c.client_type === "PF"
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {c.client_type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.document} · {c.phone}</p>
                  </div>
                </button>
              ))}
            </section>
          )}

          {/* Procedimentos */}
          {data && data.procedures.length > 0 && (
            <section className={data.clients.length > 0 ? "border-t border-gray-100" : ""}>
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                <FileText className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Procedimentos
                </span>
              </div>
              {data.procedures.map((p) => (
                <button
                  key={p.id}
                  onClick={() => go(`/procedimentos/${p.id}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {p.protocol_label} — {p.procedure_type_label}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{p.client_name}</p>
                  </div>
                  <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    STATUS_CLS[p.status] ?? "bg-gray-100 text-gray-600"
                  }`}>
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </button>
              ))}
            </section>
          )}

          {/* Imóveis */}
          {data && data.properties.length > 0 && (
            <section className={
              (data.clients.length > 0 || data.procedures.length > 0)
                ? "border-t border-gray-100"
                : ""
            }>
              <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
                <Home className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Imóveis
                </span>
              </div>
              {data.properties.map((prop) => (
                <button
                  key={prop.id}
                  onClick={() => go(`/imoveis/${prop.id}`)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {prop.endereco ?? "Sem endereço"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {prop.matricula ? `Mat. ${prop.matricula}` : "Sem matrícula"} · {prop.property_type}
                  </p>
                </button>
              ))}
            </section>
          )}

          {/* Atalho hint */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center gap-3 text-xs text-gray-400">
            <span><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navegar</span>
            <span><kbd className="bg-gray-100 px-1 rounded">↵</kbd> abrir</span>
            <span><kbd className="bg-gray-100 px-1 rounded">Esc</kbd> fechar</span>
          </div>
        </div>
      )}
    </div>
  );
}
