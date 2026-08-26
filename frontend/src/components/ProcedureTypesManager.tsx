import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, ListOrdered } from "lucide-react";
import { api } from "@/lib/api";
import type { ProcedureTypeCatalogItem } from "@/types";
import { StageTemplateModal } from "@/components/StageTemplateModal";

function extractError(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? fallback;
}

export function ProcedureTypesManagerModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: types, isLoading } = useQuery({
    queryKey: ["procedure-types-admin"],
    queryFn: async () => (await api.get<ProcedureTypeCatalogItem[]>("/procedure-types")).data,
  });

  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stagesFor, setStagesFor] = useState<ProcedureTypeCatalogItem | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["procedure-types-admin"] });
    qc.invalidateQueries({ queryKey: ["procedure-types"] });
  };

  const create = useMutation({
    mutationFn: async (label: string) => (await api.post("/procedure-types", { label })).data,
    onSuccess: () => {
      setNewLabel("");
      setError(null);
      invalidate();
    },
    onError: (err: unknown) => setError(extractError(err, "Erro ao criar tipo de procedimento.")),
  });

  const update = useMutation({
    mutationFn: async (vars: { id: string; label?: string; is_active?: boolean }) =>
      (await api.put(`/procedure-types/${vars.id}`, {
        ...(vars.label !== undefined ? { label: vars.label } : {}),
        ...(vars.is_active !== undefined ? { is_active: vars.is_active } : {}),
      })).data,
    onSuccess: () => {
      setEditingId(null);
      setError(null);
      invalidate();
    },
    onError: (err: unknown) => setError(extractError(err, "Erro ao atualizar tipo de procedimento.")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => api.delete(`/procedure-types/${id}`),
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err: unknown) => setError(extractError(err, "Erro ao excluir tipo de procedimento.")),
  });

  const startEdit = (t: ProcedureTypeCatalogItem) => {
    setEditingId(t.id);
    setEditLabel(t.label);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">Tipos de procedimento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Cadastre, renomeie ou desative os tipos disponíveis ao abrir um novo procedimento.
        </p>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newLabel.trim()) create.mutate(newLabel.trim());
          }}
          className="flex gap-2 mb-4"
        >
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nome do novo tipo (ex: Vistoria Especial)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={create.isPending || !newLabel.trim()}
            className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus size={15} />
            Adicionar
          </button>
        </form>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {isLoading ? (
            <p className="text-sm text-gray-400 text-center py-6">Carregando...</p>
          ) : !types || types.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhum tipo cadastrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {types.map((t) => (
                <li key={t.id} className="flex items-center gap-2 py-2.5">
                  {editingId === t.id ? (
                    <>
                      <input
                        autoFocus
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="flex-1 px-2 py-1 border border-primary-300 rounded text-sm"
                      />
                      <button
                        onClick={() => editLabel.trim() && update.mutate({ id: t.id, label: editLabel.trim() })}
                        disabled={update.isPending || !editLabel.trim()}
                        className="text-green-600 hover:bg-green-50 p-1.5 rounded disabled:opacity-40"
                        title="Salvar"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-gray-400 hover:bg-gray-50 p-1.5 rounded"
                        title="Cancelar"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm ${t.is_active ? "text-gray-800" : "text-gray-400 line-through"}`}>
                          {t.label}
                        </span>
                        {t.in_use && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                            em uso
                          </span>
                        )}
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={t.is_active}
                          onChange={(e) => update.mutate({ id: t.id, is_active: e.target.checked })}
                          className="accent-primary-600"
                        />
                        Ativo
                      </label>
                      <button
                        onClick={() => setStagesFor(t)}
                        className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded"
                        title="Editar etapas do procedimento"
                      >
                        <ListOrdered size={14} />
                      </button>
                      <button
                        onClick={() => startEdit(t)}
                        className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded"
                        title="Renomear"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (t.in_use) return;
                          if (window.confirm(`Excluir o tipo "${t.label}"?`)) remove.mutate(t.id);
                        }}
                        disabled={t.in_use || remove.isPending}
                        className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                        title={t.in_use ? "Em uso — desative em vez de excluir" : "Excluir"}
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {stagesFor && (
        <StageTemplateModal type={stagesFor} onClose={() => setStagesFor(null)} />
      )}
    </div>
  );
}
