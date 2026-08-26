import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, ArrowDown, Trash2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import type { ProcedureTypeCatalogItem } from "@/types";

function extractError(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? fallback;
}

export function StageTemplateModal({
  type,
  onClose,
}: {
  type: ProcedureTypeCatalogItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [stages, setStages] = useState<string[]>(type.stage_template);
  const [newStage, setNewStage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= stages.length) return;
    const next = [...stages];
    [next[idx], next[target]] = [next[target], next[idx]];
    setStages(next);
  };

  const rename = (idx: number, value: string) => {
    const next = [...stages];
    next[idx] = value;
    setStages(next);
  };

  const remove = (idx: number) => {
    setStages(stages.filter((_, i) => i !== idx));
  };

  const addStage = () => {
    if (!newStage.trim()) return;
    setStages([...stages, newStage.trim()]);
    setNewStage("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = stages.map((s) => s.trim()).filter(Boolean);
      return (await api.put(`/procedure-types/${type.id}`, { stage_template: cleaned })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["procedure-types-admin"] });
      qc.invalidateQueries({ queryKey: ["procedure-types"] });
      onClose();
    },
    onError: (err: unknown) => setError(extractError(err, "Erro ao salvar as etapas.")),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold">Etapas — {type.label}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Vale só para novos procedimentos criados com este tipo. Procedimentos já abertos não mudam.
        </p>

        {error && (
          <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2">
          {stages.map((stage, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <span className="text-xs font-mono text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
              <input
                value={stage}
                onChange={(e) => rename(idx, e.target.value)}
                className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
              <button
                onClick={() => move(idx, -1)}
                disabled={idx === 0}
                className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded disabled:opacity-25 disabled:hover:bg-transparent"
                title="Mover para cima"
              >
                <ArrowUp size={14} />
              </button>
              <button
                onClick={() => move(idx, 1)}
                disabled={idx === stages.length - 1}
                className="text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-1.5 rounded disabled:opacity-25 disabled:hover:bg-transparent"
                title="Mover para baixo"
              >
                <ArrowDown size={14} />
              </button>
              <button
                onClick={() => remove(idx)}
                className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded"
                title="Excluir etapa"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {stages.length === 0 && (
            <p className="text-xs text-gray-300 text-center py-4">Nenhuma etapa — adicione ao menos uma.</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addStage();
          }}
          className="flex gap-2 mt-4 pt-4 border-t border-gray-100"
        >
          <input
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            placeholder="Nova etapa..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <button
            type="submit"
            disabled={!newStage.trim()}
            className="flex items-center gap-1 border border-gray-300 hover:bg-gray-50 disabled:opacity-40 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg"
          >
            <Plus size={15} />
            Adicionar
          </button>
        </form>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || stages.length === 0}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
          >
            {save.isPending ? "Salvando..." : "Salvar etapas"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
