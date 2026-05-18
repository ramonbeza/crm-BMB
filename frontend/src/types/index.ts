export type UserRole = "admin" | "advogado" | "estagiario";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export type ClientType = "PF" | "PJ";

export interface ClientPFData {
  name: string;
  cpf: string;
  birth_date?: string | null;
  civil_status?: string | null;
  rg?: string | null;
  cnh?: string | null;
  address?: string | null;
}

export interface ClientPJData {
  company_name: string;
  cnpj: string;
  address?: string | null;
}

export interface ClientPF {
  id: string;
  client_type: "PF";
  phone: string;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pf_data: ClientPFData | null;
}

export interface ClientPJ {
  id: string;
  client_type: "PJ";
  phone: string;
  email?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pj_data: ClientPJData | null;
}

export type ClientDetail = ClientPF | ClientPJ;

export interface ClientListItem {
  id: string;
  client_type: ClientType;
  phone: string;
  email?: string | null;
  is_active: boolean;
  created_at: string;
  display_name: string;
  document: string;
}

export interface PaginatedClients {
  items: ClientListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Sprint 2: Agenda & Atendimentos ──────────────────────────────────────────

export type ReceptionType = "presencial" | "email" | "whatsapp";
export type MeetingStatus = "agendada" | "realizada" | "cancelada";

export interface Meeting {
  id: string;
  client_id: string;
  user_id: string | null;
  scheduled_at: string;
  reception_type: ReceptionType;
  subject: string;
  summary: string | null;
  status: MeetingStatus;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  user_name: string | null;
}

export interface PaginatedMeetings {
  items: Meeting[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Attendance {
  id: string;
  meeting_id: string | null;
  client_id: string;
  user_id: string | null;
  decisions: string | null;
  pending_items: string | null;
  converted_to_procedure: boolean;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  user_name: string | null;
  meeting_subject: string | null;
}

export interface PaginatedAttendances {
  items: Attendance[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Sprint 3: Procedimentos + Etapas + Protocolo ─────────────────────────────

export type ProcedureStatus = "em_andamento" | "concluido" | "cancelado";
export type StageStatus = "pendente" | "em_andamento" | "concluida";

export interface ProcedureTypeOption {
  value: string;
  label: string;
}

export interface Stage {
  id: string;
  procedure_id: string;
  order: number;
  name: string;
  status: StageStatus;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
}

export interface Procedure {
  id: string;
  protocol_number: number;
  client_id: string;
  procedure_type: string;
  procedure_type_label: string | null;
  opened_at: string;
  description: string | null;
  property_description: string | null;
  matricula: string | null;
  incra: string | null;
  inscricao_imobiliaria: string | null;
  requerente: string | null;
  deadline: string | null;
  tags: string[];
  status: ProcedureStatus;
  responsible_user_id: string | null;
  responsible_name: string | null;
  attendance_id: string | null;
  property_id: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  stages: Stage[];
  checklist_items: ChecklistItem[];
}

export interface ProcedureListItem {
  id: string;
  protocol_number: number;
  client_name: string | null;
  procedure_type: string;
  procedure_type_label: string;
  status: ProcedureStatus;
  opened_at: string;
  deadline: string | null;
  tags: string[];
  responsible_name: string | null;
  stages_done: number;
  stages_total: number;
}

export interface PaginatedProcedures {
  items: ProcedureListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Sprint 4: Imóveis + Checklist ─────────────────────────────────────────────

export type PropertyType = "urbano" | "rural" | "rural_urbano";
export type ChecklistStatus = "pendente" | "recebido" | "em_analise" | "aprovado" | "rejeitado";
export type ChecklistResponsavel = "cliente" | "escritorio";

export interface PropertyOwner {
  id: string;
  client_id: string;
  role: string;
  client_name: string | null;
  client_document: string | null;
}

export interface PropertyListItem {
  id: string;
  matricula: string | null;
  inscricao_imobiliaria: string | null;
  property_type: PropertyType;
  property_type_label: string;
  endereco: string | null;
  area_total: number | null;
  area_unit: string;
  cartorio: string | null;
  is_active: boolean;
  procedure_count: number;
  owner_names: string[];
}

export interface Property {
  id: string;
  matricula: string | null;
  inscricao_imobiliaria: string | null;
  incra_code: string | null;
  property_type: PropertyType;
  property_type_label: string;
  endereco: string | null;
  area_total: number | null;
  area_unit: string;
  cartorio: string | null;
  confrontantes: string | null;
  notas: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owners: PropertyOwner[];
  procedure_count: number;
}

export interface PaginatedProperties {
  items: PropertyListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ChecklistItem {
  id: string;
  procedure_id: string;
  order: number;
  name: string;
  responsavel: ChecklistResponsavel;
  status: ChecklistStatus;
  notas: string | null;
  received_at: string | null;
}

// ── Sprint 5: Orçamentos + Contratos ─────────────────────────────────────────

export type QuoteStatus =
  | "rascunho"
  | "enviado"
  | "aguardando_assinatura"
  | "assinado"
  | "cancelado"
  | "expirado";

export type ContractStatus =
  | "rascunho"
  | "enviado"
  | "aguardando_assinatura"
  | "assinado"
  | "cancelado";

export type PaymentModel =
  | "fixo"
  | "parcelado"
  | "exito"
  | "fixo_mais_exito"
  | "a_definir";

export interface CustaItem {
  name: string;
  value: number;
}

export interface InstallmentItem {
  due_date: string;
  value: number;
  status: "pendente" | "pago";
}

export interface QuoteListItem {
  id: string;
  formatted_number: string;
  version: number;
  client_id: string;
  client_name: string | null;
  procedure_id: string | null;
  procedure_type_label: string | null;
  status: QuoteStatus;
  status_label: string;
  total: number;
  valid_until: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  quote_number: number;
  quote_year: number;
  version: number;
  formatted_number: string;
  procedure_id: string | null;
  client_id: string;
  client_name: string | null;
  procedure_type: string | null;
  procedure_type_label: string | null;
  status: QuoteStatus;
  status_label: string;
  honorarios_escritorio: number;
  honorarios_despachante: number;
  custas_estimadas: CustaItem[];
  custas_total: number;
  desconto: number;
  desconto_motivo: string | null;
  subtotal: number;
  total: number;
  valid_until: string | null;
  notas: string | null;
  sent_at: string | null;
  signed_at: string | null;
  created_by_id: string | null;
  parent_quote_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedQuotes {
  items: QuoteListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ContractListItem {
  id: string;
  formatted_number: string;
  client_id: string;
  client_name: string | null;
  procedure_id: string | null;
  status: ContractStatus;
  status_label: string;
  payment_model_label: string;
  total_value: number;
  created_at: string;
}

export interface Contract {
  id: string;
  contract_number: number;
  contract_year: number;
  formatted_number: string;
  quote_id: string | null;
  procedure_id: string | null;
  client_id: string;
  client_name: string | null;
  status: ContractStatus;
  status_label: string;
  payment_model: PaymentModel;
  payment_model_label: string;
  total_value: number;
  installments: InstallmentItem[];
  exito_percentual: number | null;
  signed_at: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedContracts {
  items: ContractListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PriceTableEntry {
  id: string;
  procedure_type: string;
  procedure_type_label: string;
  base_honorarios: number;
  base_despachante: number;
  custas_tipicas: CustaItem[];
  notas: string | null;
}

// ── Módulo 8 — Financeiro ──────────────────────────────────────────────────

export type EntryTipo = "custa_real" | "repasse_despachante" | "honorario_recebido";
export type EntryStatus = "pendente" | "pago" | "cancelado";
export type EntryCategory =
  | "cartorio"
  | "imposto"
  | "taxa"
  | "diligencia"
  | "despachante"
  | "honorario"
  | "outro";

export interface FinancialEntryListItem {
  id: string;
  formatted_number: string | null;
  tipo: EntryTipo;
  tipo_label: string;
  category: EntryCategory;
  category_label: string;
  description: string;
  value: number;
  status: EntryStatus;
  status_label: string;
  due_date: string | null;
  paid_at: string | null;
  procedure_id: string | null;
  procedure_number: string | null;
  contract_id: string | null;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
}

export interface FinancialEntry extends FinancialEntryListItem {
  entry_number: number | null;
  entry_year: number | null;
  contract_number: string | null;
  notas: string | null;
  created_by_id: string;
  updated_at: string;
}

export interface PaginatedFinancialEntries {
  items: FinancialEntryListItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ProcedureFinancialSummary {
  procedure_id: string;
  quote_id: string | null;
  honorarios_escritorio_orcado: number;
  honorarios_despachante_orcado: number;
  custas_estimadas_total: number;
  total_orcado: number;
  custas_reais_pagas: number;
  custas_reais_pendentes: number;
  repasses_pagos: number;
  repasses_pendentes: number;
  honorarios_recebidos: number;
  contract_id: string | null;
  total_contrato: number;
  parcelas_pagas: number;
  parcelas_pendentes: number;
  variacao_custas: number;
}

export interface FinancialDashboard {
  honorarios_a_receber: number;
  honorarios_recebidos_mes: number;
  custas_pendentes: number;
  custas_pagas_mes: number;
  repasses_pendentes: number;
  repasses_pagos_mes: number;
  vencimentos_proximos: FinancialEntryListItem[];
  em_atraso: FinancialEntryListItem[];
}
