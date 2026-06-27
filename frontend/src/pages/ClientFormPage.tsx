import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api";
import type { ClientDetail } from "@/types";

// ── schemas ──────────────────────────────────────────────────────────────────

const pfSchema = z.object({
  client_type: z.literal("PF"),
  phone: z.string().min(8, "Telefone obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
  pf_data: z.object({
    name: z.string().min(2, "Nome obrigatório"),
    cpf: z.string().min(11, "CPF obrigatório"),
    birth_date: z.string().optional(),
    civil_status: z.string().optional(),
    rg: z.string().optional(),
    cnh: z.string().optional(),
    address: z.string().optional(),
  }),
});

const pjSchema = z.object({
  client_type: z.literal("PJ"),
  phone: z.string().min(8, "Telefone obrigatório"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().optional(),
  pj_data: z.object({
    company_name: z.string().min(2, "Razão social obrigatória"),
    cnpj: z.string().min(14, "CNPJ obrigatório"),
    address: z.string().optional(),
  }),
});

type PFForm = z.infer<typeof pfSchema>;
type PJForm = z.infer<typeof pjSchema>;

// ── components ───────────────────────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500";

// ── CEP lookup ────────────────────────────────────────────────────────────────

interface CepResult {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
}

function CepInput({ onFill }: { onFill: (res: CepResult) => void }) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) { setError("CEP deve ter 8 dígitos"); return; }
    setError("");
    setLoading(true);
    try {
      const { data } = await api.get(`/integrations/viacep/${clean}`);
      onFill(data);
    } catch {
      setError("CEP não encontrado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por CEP</label>
      <div className="flex gap-2">
        <input
          value={cep}
          onChange={(e) => setCep(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
          placeholder="00000-000"
          maxLength={9}
          className={inputCls}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg text-sm text-gray-700 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── CNPJ lookup ───────────────────────────────────────────────────────────────

interface CnpjResult {
  razao_social: string;
  nome_fantasia: string;
  email: string;
  telefone: string;
  endereco: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

function CnpjLookupButton({
  cnpj,
  onFill,
}: {
  cnpj: string;
  onFill: (res: CnpjResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    const clean = cnpj.replace(/\D/g, "");
    if (clean.length !== 14) { setError("CNPJ deve ter 14 dígitos"); return; }
    setError("");
    setLoading(true);
    try {
      const { data } = await api.get(`/integrations/cnpj/${clean}`);
      onFill(data);
    } catch {
      setError("CNPJ não encontrado na Receita Federal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={handleSearch}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm text-blue-700 transition-colors disabled:opacity-50 mt-6 self-start"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Consultar Receita Federal
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Document extraction box ───────────────────────────────────────────────────

function ExtractDocumentBox({
  clientType,
  onExtracted,
}: {
  clientType: "PF" | "PJ";
  onExtracted: (data: Record<string, string | null>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setExtracting(true);
    setError(null);
    setDocType(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("client_type", clientType);
      const { data } = await api.post(
        `/clients/extract-document?client_type=${clientType}`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      setDocType(data.doc_type ?? null);
      onExtracted(data);
    } catch {
      setError("Não foi possível ler o documento. Verifique a qualidade da imagem e tente novamente.");
    } finally {
      setExtracting(false);
    }
  };

  const hint = clientType === "PF"
    ? "CNH, RG ou RNE (frente e verso em uma imagem ou PDF)"
    : "Contrato Social, Estatuto ou Cartão CNPJ (PDF ou imagem)";

  return (
    <div className="rounded-lg border border-dashed border-primary-300 bg-primary-50 p-4 mb-2">
      <p className="text-sm font-medium text-primary-800 mb-1">Preencher automaticamente com documento</p>
      <p className="text-xs text-primary-600 mb-3">{hint}</p>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={extracting}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg"
      >
        {extracting ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
        {extracting ? "Lendo documento..." : "Carregar documento"}
      </button>
      {docType && !error && (
        <p className="text-xs text-primary-700 mt-2 font-medium">✓ {docType} lido — campos preenchidos abaixo</p>
      )}
      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = Boolean(id);

  const [clientType, setClientType] = useState<"PF" | "PJ">("PF");

  const { data: existing, isLoading: loadingExisting } = useQuery<ClientDetail>({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${id}`);
      return data;
    },
    enabled: isEdit,
  });

  const pfForm = useForm<PFForm>({
    resolver: zodResolver(pfSchema),
    defaultValues: { client_type: "PF" },
  });

  const pjForm = useForm<PJForm>({
    resolver: zodResolver(pjSchema),
    defaultValues: { client_type: "PJ" },
  });

  // Preenche o formulário com os dados existentes ao editar
  useEffect(() => {
    if (!existing) return;
    if (existing.client_type === "PF") {
      pfForm.reset({
        client_type: "PF",
        phone: existing.phone,
        email: existing.email ?? "",
        notes: existing.notes ?? "",
        pf_data: {
          name: existing.pf_data?.name ?? "",
          cpf: existing.pf_data?.cpf ?? "",
          birth_date: existing.pf_data?.birth_date ?? "",
          civil_status: existing.pf_data?.civil_status ?? "",
          rg: existing.pf_data?.rg ?? "",
          cnh: existing.pf_data?.cnh ?? "",
          address: existing.pf_data?.address ?? "",
        },
      });
    } else {
      pjForm.reset({
        client_type: "PJ",
        phone: existing.phone,
        email: existing.email ?? "",
        notes: existing.notes ?? "",
        pj_data: {
          company_name: existing.pj_data?.company_name ?? "",
          cnpj: existing.pj_data?.cnpj ?? "",
          address: existing.pj_data?.address ?? "",
        },
      });
    }
  }, [existing]);

  // Converte strings vazias em null (o backend espera null, não "")
  const cleanPayload = <T,>(obj: T): T => {
    const walk = (v: unknown): unknown => {
      if (v === "") return null;
      if (Array.isArray(v)) return v.map(walk);
      if (v && typeof v === "object") {
        return Object.fromEntries(
          Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, walk(val)])
        );
      }
      return v;
    };
    return walk(obj) as T;
  };

  const [saveError, setSaveError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (raw: PFForm | PJForm) => {
      const payload = cleanPayload(raw);
      if (isEdit) {
        const type = existing?.client_type ?? clientType;
        const endpoint = type === "PF" ? `/clients/${id}/pf` : `/clients/${id}/pj`;
        const { data } = await api.put(endpoint, payload);
        return data;
      }
      const endpoint = payload.client_type === "PF" ? "/clients/pf" : "/clients/pj";
      const { data } = await api.post(endpoint, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      navigate("/clientes");
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(detail ?? "Erro ao salvar. Verifique os dados e tente novamente.");
    },
  });

  if (isEdit && loadingExisting) {
    return <p className="text-gray-500 text-sm">Carregando...</p>;
  }

  const activeCt = isEdit ? (existing?.client_type ?? "PF") : clientType;

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => navigate("/clientes")}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
      >
        <ArrowLeft size={15} />
        Voltar
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {isEdit ? "Editar Cliente" : "Novo Cliente"}
      </h1>

      {!isEdit && (
        <div className="flex gap-3 mb-6">
          {(["PF", "PJ"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setClientType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                clientType === t
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-primary-400"
              }`}
            >
              {t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}
            </button>
          ))}
        </div>
      )}

      {activeCt === "PF" ? (
        <form
          onSubmit={pfForm.handleSubmit((d) => { setSaveError(null); mutation.mutate(d); })}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <ExtractDocumentBox
            clientType="PF"
            onExtracted={(d) => {
              if (d.name) pfForm.setValue("pf_data.name", d.name);
              if (d.cpf) pfForm.setValue("pf_data.cpf", d.cpf);
              if (d.rg) pfForm.setValue("pf_data.rg", d.rg);
              if (d.cnh) pfForm.setValue("pf_data.cnh", d.cnh);
              if (d.birth_date) pfForm.setValue("pf_data.birth_date", d.birth_date);
              if (d.civil_status) pfForm.setValue("pf_data.civil_status", d.civil_status);
              if (d.address) pfForm.setValue("pf_data.address", d.address);
              if (d.phone) pfForm.setValue("phone", d.phone);
            }}
          />

          <h2 className="font-semibold text-gray-700 border-b pb-2">Dados Pessoais</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nome completo *" error={pfForm.formState.errors.pf_data?.name?.message}>
              <input {...pfForm.register("pf_data.name")} className={inputCls} />
            </Field>
            <Field label="CPF *" error={pfForm.formState.errors.pf_data?.cpf?.message}>
              <input {...pfForm.register("pf_data.cpf")} placeholder="000.000.000-00" className={inputCls} />
            </Field>
            <Field label="Telefone *" error={pfForm.formState.errors.phone?.message}>
              <input {...pfForm.register("phone")} placeholder="(11) 99999-9999" className={inputCls} />
            </Field>
            <Field label="E-mail">
              <input type="email" {...pfForm.register("email")} className={inputCls} />
            </Field>
            <Field label="Data de nascimento">
              <input type="date" {...pfForm.register("pf_data.birth_date")} className={inputCls} />
            </Field>
            <Field label="Estado civil">
              <select {...pfForm.register("pf_data.civil_status")} className={inputCls}>
                <option value="">—</option>
                <option>Solteiro(a)</option>
                <option>Casado(a)</option>
                <option>Divorciado(a)</option>
                <option>Viúvo(a)</option>
                <option>União estável</option>
              </select>
            </Field>
            <Field label="RG">
              <input {...pfForm.register("pf_data.rg")} className={inputCls} />
            </Field>
            <Field label="CNH">
              <input {...pfForm.register("pf_data.cnh")} className={inputCls} />
            </Field>
          </div>

          {/* Busca de CEP */}
          <div className="border-t pt-4 space-y-3">
            <CepInput
              onFill={(res) => {
                const addr = [res.logradouro, res.bairro, res.cidade, res.estado]
                  .filter(Boolean)
                  .join(", ");
                pfForm.setValue("pf_data.address", addr);
              }}
            />
            <Field label="Endereço">
              <input {...pfForm.register("pf_data.address")} placeholder="Rua, número, bairro, cidade - UF" className={inputCls} />
            </Field>
          </div>

          <Field label="Observações">
            <textarea {...pfForm.register("notes")} rows={3} className={inputCls} />
          </Field>

          {saveError && (
            <p className="text-red-600 text-sm">{saveError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/clientes")}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <form
          onSubmit={pjForm.handleSubmit((d) => { setSaveError(null); mutation.mutate(d); })}
          className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
        >
          <ExtractDocumentBox
            clientType="PJ"
            onExtracted={(d) => {
              if (d.company_name) pjForm.setValue("pj_data.company_name", d.company_name);
              if (d.cnpj) pjForm.setValue("pj_data.cnpj", d.cnpj);
              if (d.address) pjForm.setValue("pj_data.address", d.address);
              if (d.phone) pjForm.setValue("phone", d.phone);
              if (d.email) pjForm.setValue("email", d.email);
            }}
          />

          <h2 className="font-semibold text-gray-700 border-b pb-2">Dados da Empresa</h2>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Razão Social *" error={pjForm.formState.errors.pj_data?.company_name?.message}>
              <input {...pjForm.register("pj_data.company_name")} className={inputCls} />
            </Field>
            <div className="space-y-0">
              <Field label="CNPJ *" error={pjForm.formState.errors.pj_data?.cnpj?.message}>
                <input
                  {...pjForm.register("pj_data.cnpj")}
                  placeholder="00.000.000/0000-00"
                  className={inputCls}
                />
              </Field>
              <CnpjLookupButton
                cnpj={pjForm.watch("pj_data.cnpj") ?? ""}
                onFill={(res) => {
                  if (res.razao_social) pjForm.setValue("pj_data.company_name", res.razao_social);
                  if (res.endereco) pjForm.setValue("pj_data.address", res.endereco);
                  if (res.email) pjForm.setValue("email", res.email);
                  if (res.telefone) pjForm.setValue("phone", res.telefone);
                }}
              />
            </div>
            <Field label="Telefone *" error={pjForm.formState.errors.phone?.message}>
              <input {...pjForm.register("phone")} placeholder="(11) 99999-9999" className={inputCls} />
            </Field>
            <Field label="E-mail">
              <input type="email" {...pjForm.register("email")} className={inputCls} />
            </Field>
          </div>

          {/* Busca de CEP */}
          <div className="border-t pt-4 space-y-3">
            <CepInput
              onFill={(res) => {
                const addr = [res.logradouro, res.bairro, res.cidade, res.estado]
                  .filter(Boolean)
                  .join(", ");
                pjForm.setValue("pj_data.address", addr);
              }}
            />
            <Field label="Endereço">
              <input {...pjForm.register("pj_data.address")} placeholder="Rua, número, bairro, cidade - UF" className={inputCls} />
            </Field>
          </div>

          <Field label="Observações">
            <textarea {...pjForm.register("notes")} rows={3} className={inputCls} />
          </Field>

          {saveError && (
            <p className="text-red-600 text-sm">{saveError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors"
            >
              {mutation.isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/clientes")}
              className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
