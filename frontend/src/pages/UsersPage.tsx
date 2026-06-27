import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCog,
  Plus,
  Pencil,
  Power,
  X,
  Eye,
  EyeOff,
  Shield,
  Scale,
  GraduationCap,
  Truck,
} from "lucide-react";
import { api } from "@/lib/api";
import type { User, UserRole } from "@/types";
import { useAuthStore } from "@/store/authStore";

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "advogado", label: "Advogado(a)" },
  { value: "estagiario", label: "Estagiário(a)" },
  { value: "despachante_externo", label: "Despachante Externo" },
];

const roleIcon: Record<UserRole, typeof Shield> = {
  admin: Shield,
  advogado: Scale,
  estagiario: GraduationCap,
  despachante_externo: Truck,
};

const roleCls: Record<UserRole, string> = {
  admin: "bg-red-50 text-red-700 border-red-200",
  advogado: "bg-blue-50 text-blue-700 border-blue-200",
  estagiario: "bg-yellow-50 text-yellow-700 border-yellow-200",
  despachante_externo: "bg-purple-50 text-purple-700 border-purple-200",
};

const roleLabel: Record<UserRole, string> = {
  admin: "Administrador",
  advogado: "Advogado(a)",
  estagiario: "Estagiário(a)",
  despachante_externo: "Despachante Externo",
};

// ── UserForm modal ────────────────────────────────────────────────────────────

interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  password: string;
  cnpj_empresa: string;
}

const EMPTY_FORM: UserFormData = {
  name: "",
  email: "",
  role: "estagiario",
  password: "",
  cnpj_empresa: "",
};

interface UserFormModalProps {
  user: User | null;  // null = criar novo
  onClose: () => void;
}

function UserFormModal({ user, onClose }: UserFormModalProps) {
  const qc = useQueryClient();
  const isEdit = !!user;
  const [form, setForm] = useState<UserFormData>(
    user
      ? {
          name: user.name,
          email: user.email,
          role: user.role,
          password: "",
          cnpj_empresa: user.cnpj_empresa ?? "",
        }
      : EMPTY_FORM
  );
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (form.password && form.password.length < 6) {
        throw new Error("A senha deve ter pelo menos 6 caracteres.");
      }
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      if (form.cnpj_empresa) payload.cnpj_empresa = form.cnpj_empresa;
      if (form.role === "despachante_externo" && form.cnpj_empresa)
        payload.cnpj_empresa = form.cnpj_empresa;

      if (isEdit) {
        return (await api.put(`/users/${user.id}`, payload)).data;
      } else {
        if (!form.password) throw new Error("Senha é obrigatória para novos usuários.");
        return (await api.post("/users", payload)).data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Erro ao salvar usuário.");
    },
  });

  const field = (
    label: string,
    key: keyof UserFormData,
    type: string = "text",
    placeholder?: string
  ) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? "Editar usuário" : "Novo usuário"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {field("Nome completo", "name", "text", "João da Silva")}
          {field("E-mail", "email", "email", "joao@bezamiranda.com.br")}

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Perfil</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* CNPJ — só para despachante */}
          {form.role === "despachante_externo" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                CNPJ da empresa despachante
              </label>
              <input
                type="text"
                value={form.cnpj_empresa}
                onChange={(e) => setForm({ ...form, cnpj_empresa: e.target.value })}
                placeholder="00.000.000/0001-00"
                maxLength={18}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          )}

          {/* Senha */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {isEdit ? "Nova senha (deixe em branco para não alterar)" : "Senha *"}
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={isEdit ? "••••••••" : "mínimo 6 caracteres"}
                className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password.length > 0 && form.password.length < 6 && (
              <p className="mt-1 text-xs text-red-600">Mínimo 6 caracteres</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || (form.password.length > 0 && form.password.length < 6)}
            className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
          >
            {save.isPending ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UsersPage ─────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();
  const [modal, setModal] = useState<User | null | "new">(null);
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: async () => (await api.get<User[]>("/users?include_inactive=true")).data,
  });

  const toggleActive = useMutation({
    mutationFn: async (u: User) =>
      (await api.put(`/users/${u.id}`, { is_active: !u.is_active })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  // Só admin acessa esta página
  if (me?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Shield className="text-gray-300" size={40} />
        <p className="text-gray-500 text-sm">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const active = users.filter((u) => u.is_active);
  const inactive = users.filter((u) => !u.is_active);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserCog className="text-primary-600" size={24} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
            <p className="text-sm text-gray-500">
              {active.length} ativo{active.length !== 1 ? "s" : ""}
              {inactive.length > 0 && ` · ${inactive.length} desativado${inactive.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <button
          onClick={() => setModal("new")}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Novo usuário
        </button>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-gray-400 text-sm">Carregando...</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Usuário</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Perfil</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">CNPJ</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-400">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const RoleIcon = roleIcon[u.role] ?? Shield;
                return (
                  <tr
                    key={u.id}
                    className={`border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50 ${
                      !u.is_active ? "opacity-50" : ""
                    }`}
                  >
                    {/* Nome + email */}
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>

                    {/* Role badge */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${
                          roleCls[u.role]
                        }`}
                      >
                        <RoleIcon size={11} />
                        {roleLabel[u.role]}
                      </span>
                    </td>

                    {/* CNPJ */}
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {u.cnpj_empresa ?? "—"}
                    </td>

                    {/* Status */}
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {u.is_active ? "Ativo" : "Desativado"}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModal(u)}
                          className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => {
                              if (u.is_active) {
                                setConfirmDeactivateId(u.id);
                              } else {
                                toggleActive.mutate(u);
                              }
                            }}
                            disabled={toggleActive.isPending}
                            className={`p-1.5 rounded transition-colors ${
                              u.is_active
                                ? "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                            }`}
                            title={u.is_active ? "Desativar" : "Reativar"}
                          >
                            <Power size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legenda de perfis */}
      <div className="mt-6 flex flex-wrap gap-3">
        {ROLE_OPTIONS.map(({ value, label }) => {
          const Icon = roleIcon[value];
          return (
            <span
              key={value}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${roleCls[value]}`}
            >
              <Icon size={11} />
              {label}
            </span>
          );
        })}
      </div>

      {/* Confirmação de desativação */}
      {confirmDeactivateId && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <p className="text-base font-semibold text-gray-900 mb-2">Desativar usuário?</p>
            <p className="text-sm text-gray-500 mb-6">O usuário perderá o acesso ao sistema. Esta ação pode ser revertida.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeactivateId(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const u = users.find((u) => u.id === confirmDeactivateId);
                  if (u) toggleActive.mutate(u);
                  setConfirmDeactivateId(null);
                }}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal !== null && (
        <UserFormModal
          user={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
