"""
Módulo 3 — Imóveis
Módulo 7 — Checklist de documentos por procedimento
"""
from __future__ import annotations

import enum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


# ── Enums ─────────────────────────────────────────────────────────────────────

class PropertyType(str, enum.Enum):
    urbano = "urbano"
    rural = "rural"
    rural_urbano = "rural_urbano"


PROPERTY_TYPE_LABELS: dict[str, str] = {
    "urbano": "Urbano",
    "rural": "Rural",
    "rural_urbano": "Rural-Urbano",
}

class ChecklistItemStatus(str, enum.Enum):
    pendente = "pendente"
    recebido = "recebido"
    em_analise = "em_analise"
    aprovado = "aprovado"
    rejeitado = "rejeitado"

class ChecklistResponsavel(str, enum.Enum):
    cliente = "cliente"
    escritorio = "escritorio"


# ── Checklist templates (seed) ────────────────────────────────────────────────

CHECKLIST_TEMPLATES: dict[str, list[dict]] = {
    "usucapiao_extrajudicial": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Planta do imóvel assinada por engenheiro/arquiteto com ART/RRT", "responsavel": "cliente"},
        {"name": "Memorial descritivo georreferenciado", "responsavel": "cliente"},
        {"name": "Ata de assembleia com vizinhos / declaração de anuência dos confrontantes", "responsavel": "escritorio"},
        {"name": "Certidão negativa de débitos (municipal, estadual, federal)", "responsavel": "cliente"},
        {"name": "Documentos pessoais do(s) requerente(s) (RG, CPF, comprovante de residência)", "responsavel": "cliente"},
        {"name": "Declaração de tempo de posse (testemunhas)", "responsavel": "escritorio"},
        {"name": "Fotografias do imóvel", "responsavel": "cliente"},
        {"name": "Comprovantes de pagamento de IPTU (últimos 5 anos)", "responsavel": "cliente"},
    ],
    "usucapiao_judicial": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Planta e memorial descritivo do imóvel", "responsavel": "cliente"},
        {"name": "Documentos pessoais do(s) requerente(s)", "responsavel": "cliente"},
        {"name": "Comprovantes de posse (contas, declarações, fotos)", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos tributários", "responsavel": "cliente"},
        {"name": "Rol de testemunhas", "responsavel": "escritorio"},
        {"name": "Procuração para o advogado", "responsavel": "escritorio"},
    ],
    "retificacao_administrativa": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Planta do imóvel com ART/RRT do responsável técnico", "responsavel": "cliente"},
        {"name": "Memorial descritivo atualizado", "responsavel": "cliente"},
        {"name": "Notificação aos confrontantes (anuência ou silêncio)", "responsavel": "escritorio"},
        {"name": "Documentos pessoais do proprietário", "responsavel": "cliente"},
        {"name": "Certidão de ônus reais", "responsavel": "cliente"},
    ],
    "loteamento": [
        {"name": "Título de propriedade / certidão de matrícula", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos do imóvel", "responsavel": "cliente"},
        {"name": "Projeto de loteamento aprovado pela Prefeitura", "responsavel": "escritorio"},
        {"name": "Licença ambiental (Ibama/órgão estadual)", "responsavel": "escritorio"},
        {"name": "Planta de situação e localização", "responsavel": "cliente"},
        {"name": "Memorial descritivo do loteamento", "responsavel": "escritorio"},
        {"name": "Documentos pessoais do proprietário/sócios", "responsavel": "cliente"},
    ],
    "desmembramento_rural": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "CCIR (Certificado de Cadastro de Imóvel Rural)", "responsavel": "cliente"},
        {"name": "ITR quitado (últimos 5 anos)", "responsavel": "cliente"},
        {"name": "Planta georreferenciada com ART", "responsavel": "cliente"},
        {"name": "Memorial descritivo georreferenciado", "responsavel": "escritorio"},
        {"name": "Documentos pessoais do proprietário", "responsavel": "cliente"},
        {"name": "Certidão negativa do INCRA", "responsavel": "escritorio"},
    ],
    "desmembramento_urbano": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Planta do imóvel aprovada pela Prefeitura", "responsavel": "escritorio"},
        {"name": "Certidão de uso do solo", "responsavel": "escritorio"},
        {"name": "Certidão negativa de débitos municipais", "responsavel": "cliente"},
        {"name": "Documentos pessoais do proprietário", "responsavel": "cliente"},
    ],
    "notificacao_extrajudicial": [
        {"name": "Documentos pessoais do notificante (RG, CPF)", "responsavel": "cliente"},
        {"name": "Comprovante de endereço do notificado", "responsavel": "cliente"},
        {"name": "Documentação que fundamenta a notificação (contrato, recibo, fotos, etc.)", "responsavel": "cliente"},
        {"name": "Minuta da notificação", "responsavel": "escritorio"},
    ],
    "incorporacao_imobiliaria": [
        {"name": "Certidão de matrícula do terreno atualizada", "responsavel": "cliente"},
        {"name": "Projeto arquitetônico aprovado pela Prefeitura", "responsavel": "escritorio"},
        {"name": "Licença de construção", "responsavel": "escritorio"},
        {"name": "Quadro de áreas (NBR 12.721)", "responsavel": "escritorio"},
        {"name": "Minuta da convenção de condomínio", "responsavel": "escritorio"},
        {"name": "Certidão negativa de débitos do incorporador", "responsavel": "cliente"},
        {"name": "Documentos pessoais dos sócios/incorporadores", "responsavel": "cliente"},
    ],
    "instituicao_imobiliaria": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Habite-se / Auto de vistoria do Corpo de Bombeiros", "responsavel": "cliente"},
        {"name": "Projeto aprovado pela Prefeitura", "responsavel": "cliente"},
        {"name": "Quadro de áreas (NBR 12.721)", "responsavel": "escritorio"},
        {"name": "Convenção de condomínio e regimento interno", "responsavel": "escritorio"},
        {"name": "CND de INSS da obra (Certidão Negativa de Débito)", "responsavel": "cliente"},
        {"name": "Certidão de conclusão de obra", "responsavel": "cliente"},
        {"name": "Documentos pessoais do incorporador/proprietário", "responsavel": "cliente"},
    ],
    "inventario_extrajudicial": [
        {"name": "Certidão de óbito do falecido", "responsavel": "cliente"},
        {"name": "Documentos pessoais de todos os herdeiros", "responsavel": "cliente"},
        {"name": "Certidão de casamento / nascimento dos herdeiros", "responsavel": "cliente"},
        {"name": "Certidões de matrícula dos imóveis do espólio", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos dos imóveis", "responsavel": "cliente"},
        {"name": "Declaração de inexistência de testamento (RCPN)", "responsavel": "escritorio"},
        {"name": "Certidão negativa da Receita Federal do falecido", "responsavel": "escritorio"},
        {"name": "Avaliação dos bens imóveis (ITCMD)", "responsavel": "escritorio"},
    ],
    "divorcio": [
        {"name": "Certidão de casamento atualizada (≤ 90 dias)", "responsavel": "cliente"},
        {"name": "Documentos pessoais de ambos os cônjuges (RG, CPF, comprovante de residência)", "responsavel": "cliente"},
        {"name": "Certidões de nascimento dos filhos menores (se houver)", "responsavel": "cliente"},
        {"name": "Documentos dos bens a partilhar (matrículas, CRVs, extratos bancários)", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos dos imóveis", "responsavel": "cliente"},
        {"name": "Declaração de que não há filhos menores ou incapazes", "responsavel": "escritorio"},
        {"name": "Minuta do acordo de partilha e alimentos (se houver)", "responsavel": "escritorio"},
    ],
    "transferencia_imovel": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Contrato de compra e venda (original ou cópia autenticada)", "responsavel": "cliente"},
        {"name": "Documentos pessoais do vendedor e comprador (RG, CPF, comprovante de residência)", "responsavel": "cliente"},
        {"name": "Certidão de estado civil dos envolvidos", "responsavel": "cliente"},
        {"name": "Guia de ITBI paga", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos municipais do imóvel", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos do vendedor (municipal, estadual, federal)", "responsavel": "cliente"},
        {"name": "Escritura pública de compra e venda lavrada", "responsavel": "escritorio"},
        {"name": "Registro da escritura no Cartório de Registro de Imóveis", "responsavel": "escritorio"},
    ],
    "compra_venda": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Documentos pessoais do vendedor e comprador (RG, CPF, comprovante de residência)", "responsavel": "cliente"},
        {"name": "Certidão de estado civil dos envolvidos", "responsavel": "cliente"},
        {"name": "Guia de ITBI paga", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos municipais do imóvel", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos do vendedor", "responsavel": "cliente"},
        {"name": "Certidão de ônus reais (≤ 30 dias)", "responsavel": "escritorio"},
        {"name": "Minuta da escritura de compra e venda", "responsavel": "escritorio"},
        {"name": "Escritura lavrada e assinada", "responsavel": "escritorio"},
        {"name": "Registro no CRI", "responsavel": "escritorio"},
    ],
    "doacao_imovel": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Documentos pessoais do doador e donatário (RG, CPF, comprovante de residência)", "responsavel": "cliente"},
        {"name": "Certidão de estado civil dos envolvidos", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos do imóvel", "responsavel": "cliente"},
        {"name": "Guia de ITCMD paga (imposto estadual sobre doação)", "responsavel": "cliente"},
        {"name": "Minuta da escritura de doação", "responsavel": "escritorio"},
        {"name": "Escritura de doação lavrada", "responsavel": "escritorio"},
        {"name": "Registro no CRI", "responsavel": "escritorio"},
    ],
    "permuta": [
        {"name": "Certidão de matrícula dos dois imóveis (≤ 30 dias cada)", "responsavel": "cliente"},
        {"name": "Documentos pessoais de todos os permutantes (RG, CPF, estado civil)", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos dos imóveis", "responsavel": "cliente"},
        {"name": "Avaliação dos imóveis (para fins de ITBI/ITCMD se houver torna)", "responsavel": "escritorio"},
        {"name": "Guia de ITBI sobre a torna (se houver)", "responsavel": "cliente"},
        {"name": "Minuta da escritura de permuta", "responsavel": "escritorio"},
        {"name": "Escritura de permuta lavrada", "responsavel": "escritorio"},
        {"name": "Registro nos CRIs competentes", "responsavel": "escritorio"},
    ],
    "divisao_amigavel": [
        {"name": "Certidão de matrícula do imóvel (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Documentos pessoais de todos os condôminos (RG, CPF, estado civil)", "responsavel": "cliente"},
        {"name": "Planta de divisão elaborada por engenheiro/arquiteto com ART/RRT", "responsavel": "cliente"},
        {"name": "Memorial descritivo das frações resultantes", "responsavel": "escritorio"},
        {"name": "Certidão negativa de débitos do imóvel", "responsavel": "cliente"},
        {"name": "Anuência de todos os condôminos (escritura ou termo)", "responsavel": "escritorio"},
        {"name": "Minuta da escritura de divisão", "responsavel": "escritorio"},
        {"name": "Escritura de divisão amigável lavrada", "responsavel": "escritorio"},
        {"name": "Abertura de novas matrículas no CRI", "responsavel": "escritorio"},
    ],
    "unificacao_matriculas": [
        {"name": "Certidões de matrícula de todos os imóveis a unificar (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Documentos pessoais do proprietário (RG, CPF, estado civil)", "responsavel": "cliente"},
        {"name": "Planta de situação dos imóveis unificados (confirmando confrontância)", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos de todos os imóveis", "responsavel": "cliente"},
        {"name": "Requerimento de unificação ao CRI", "responsavel": "escritorio"},
        {"name": "Registro da unificação no CRI", "responsavel": "escritorio"},
    ],
    "averbacao": [
        {"name": "Certidão de matrícula atualizada (≤ 30 dias)", "responsavel": "cliente"},
        {"name": "Documentos pessoais do requerente (RG, CPF)", "responsavel": "cliente"},
        {"name": "Documento a ser averbado (habite-se, auto de vistoria, cancelamento de hipoteca, etc.)", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos (se exigida pelo tipo de averbação)", "responsavel": "cliente"},
        {"name": "Requerimento de averbação ao CRI", "responsavel": "escritorio"},
        {"name": "Registro da averbação confirmado", "responsavel": "escritorio"},
    ],
    "regularizacao_imovel": [
        {"name": "Certidão de matrícula ou certidão de transcrição do imóvel", "responsavel": "cliente"},
        {"name": "Documentos pessoais do proprietário ou posseiro (RG, CPF)", "responsavel": "cliente"},
        {"name": "Planta e memorial descritivo elaborados por profissional habilitado (ART/RRT)", "responsavel": "cliente"},
        {"name": "Certidão negativa de débitos municipais (IPTU) do imóvel", "responsavel": "cliente"},
        {"name": "Certidão de uso e ocupação do solo (Prefeitura)", "responsavel": "escritorio"},
        {"name": "Licença ambiental (se área de preservação ou rural)", "responsavel": "escritorio"},
        {"name": "Certidão negativa de débitos federais do proprietário", "responsavel": "cliente"},
        {"name": "Requerimento de regularização fundiária (Reurb) ou administrativa", "responsavel": "escritorio"},
        {"name": "Registro da regularização no CRI", "responsavel": "escritorio"},
    ],
}


# ── Models ────────────────────────────────────────────────────────────────────

class Property(UUIDMixin, TimestampMixin, Base):
    """Imóvel — pode ter múltiplos procedimentos ao longo do tempo."""
    __tablename__ = "properties"

    matricula: Mapped[str | None] = mapped_column(sa.String(100), nullable=True, index=True)
    inscricao_imobiliaria: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    incra_code: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    property_type: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="urbano")
    subtipo: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    endereco: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    area_total: Mapped[float | None] = mapped_column(sa.Numeric(12, 4), nullable=True)
    area_unit: Mapped[str] = mapped_column(sa.String(10), nullable=False, default="m2")  # m2 | ha
    cartorio: Mapped[str | None] = mapped_column(sa.String(300), nullable=True)
    confrontantes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    proprietarios: Mapped[list | None] = mapped_column(JSONB, nullable=True, default=list)
    quadro_areas_nbr: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    analise_juridica: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(sa.Boolean, nullable=False, default=True)
    created_by_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    owner_links: Mapped[list["PropertyClient"]] = relationship(
        "PropertyClient", back_populates="property", cascade="all, delete-orphan"
    )
    procedures: Mapped[list["Procedure"]] = relationship(  # type: ignore[name-defined]
        "Procedure", back_populates="property", foreign_keys="Procedure.property_id"
    )


class PropertyClient(UUIDMixin, TimestampMixin, Base):
    """Vínculo entre imóvel e clientes (proprietários, condôminos, etc.)."""
    __tablename__ = "property_clients"

    property_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True
    )
    client_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(sa.String(60), nullable=False, default="proprietario")  # proprietario|condômino|representante

    property: Mapped["Property"] = relationship("Property", back_populates="owner_links")


class ChecklistItem(UUIDMixin, TimestampMixin, Base):
    """Item do checklist de documentos vinculado a um procedimento."""
    __tablename__ = "checklist_items"

    procedure_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("procedures.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order: Mapped[int] = mapped_column(sa.Integer, nullable=False)
    name: Mapped[str] = mapped_column(sa.String(300), nullable=False)
    responsavel: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="cliente")
    status: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="pendente")
    notas: Mapped[str | None] = mapped_column(sa.Text, nullable=True)
    received_at: Mapped[str | None] = mapped_column(sa.DateTime(timezone=True), nullable=True)
