"""
Sprint 18 — Geração de PDF.
Gera PDFs profissionais de orçamentos e contratos usando fpdf2.
Sem dependências de sistema (puro Python).
"""
from __future__ import annotations

from datetime import date
from io import BytesIO

from fpdf import FPDF

# ── Helpers Unicode → ASCII (fontes built-in do fpdf2 não suportam Unicode) ────

_UNICODE_MAP = str.maketrans({
    "—": "-",   # em dash —
    "–": "-",   # en dash –
    "‘": "'",   # left single quote '
    "’": "'",   # right single quote '
    "“": '"',   # left double quote "
    "”": '"',   # right double quote "
    "ç": "c",   # ç
    "ã": "a",   # ã
    "á": "a",   # á
    "â": "a",   # â
    "à": "a",   # à
    "é": "e",   # é
    "ê": "e",   # ê
    "í": "i",   # í
    "ó": "o",   # ó
    "ô": "o",   # ô
    "õ": "o",   # õ
    "ú": "u",   # ú
    "ü": "u",   # ü
    "ñ": "n",   # ñ
    "Ç": "C",   # Ç
    "Ã": "A",   # Ã
    "Á": "A",   # Á
    "Â": "A",   # Â
    "É": "E",   # É
    "Ê": "E",   # Ê
    "Í": "I",   # Í
    "Ó": "O",   # Ó
    "Ô": "O",   # Ô
    "Õ": "O",   # Õ
    "Ú": "U",   # Ú
    "Ü": "U",   # Ü
    "°": "o",   # °
    "…": "...", # …
    "®": "(R)", # ®
})


def _s(text: str | None) -> str:
    """Converte para ASCII seguro para as fontes built-in do fpdf2."""
    if not text:
        return ""
    return text.translate(_UNICODE_MAP)


# ── Constantes de layout ───────────────────────────────────────────────────────

FIRM_NAME = "Beza, Miranda e Bonetti"
FIRM_SUBTITLE = "Advocacia e Assessoria Imobiliaria"
MARGIN = 18
LINE_H = 6
COLOR_PRIMARY = (30, 80, 160)    # azul escuro
COLOR_GRAY = (100, 100, 100)
COLOR_LIGHT = (240, 242, 246)
COLOR_BLACK = (30, 30, 30)
COLOR_GREEN = (22, 120, 60)

_fmt_brl = lambda v: f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _today() -> str:
    return date.today().strftime("%d/%m/%Y")


# ── Base PDF ───────────────────────────────────────────────────────────────────

class _BasePDF(FPDF):
    def __init__(self, title: str):
        super().__init__()
        self.title_str = title
        self.set_margins(MARGIN, MARGIN, MARGIN)
        self.set_auto_page_break(auto=True, margin=MARGIN)
        self.add_page()
        self._header_block()

    def _header_block(self) -> None:
        # Barra colorida no topo
        self.set_fill_color(*COLOR_PRIMARY)
        self.rect(0, 0, 210, 28, "F")

        self.set_y(6)
        self.set_font("Helvetica", "B", 14)
        self.set_text_color(255, 255, 255)
        self.cell(0, 7, FIRM_NAME, align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_font("Helvetica", "", 8)
        self.cell(0, 5, FIRM_SUBTITLE, align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(32)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*COLOR_PRIMARY)
        self.cell(0, 8, self.title_str, align="C", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*COLOR_GRAY)
        self.cell(0, 5,
                  f"{FIRM_NAME} - {FIRM_SUBTITLE}   |   Pagina {self.page_no()}/{{nb}}",
                  align="C")

    def section_title(self, text: str) -> None:
        self.set_fill_color(*COLOR_LIGHT)
        self.set_text_color(*COLOR_PRIMARY)
        self.set_font("Helvetica", "B", 9)
        self.cell(0, 7, f"  {_s(text)}", fill=True, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def key_val(self, key: str, val: str, bold_val: bool = False) -> None:
        self.set_text_color(*COLOR_GRAY)
        self.set_font("Helvetica", "", 8)
        self.cell(50, LINE_H, _s(key), new_x="RIGHT", new_y="TOP")
        self.set_text_color(*COLOR_BLACK)
        self.set_font("Helvetica", "B" if bold_val else "", 8)
        self.cell(0, LINE_H, _s(val), new_x="LMARGIN", new_y="NEXT")

    def value_row(self, label: str, value: float, bold: bool = False, color=None) -> None:
        font_style = "B" if bold else ""
        col = color or COLOR_BLACK
        self.set_font("Helvetica", font_style, 8)
        self.set_text_color(*col)
        effective_w = self.w - 2 * MARGIN
        self.cell(effective_w * 0.75, LINE_H, _s(label), new_x="RIGHT", new_y="TOP")
        self.cell(effective_w * 0.25, LINE_H, _fmt_brl(value), align="R", new_x="LMARGIN", new_y="NEXT")

    def divider(self) -> None:
        self.set_draw_color(*COLOR_LIGHT)
        self.set_line_width(0.3)
        self.line(MARGIN, self.get_y(), self.w - MARGIN, self.get_y())
        self.ln(2)

    def signature_block(self, label: str) -> None:
        self.ln(4)
        x = self.get_x()
        y = self.get_y()
        self.set_draw_color(*COLOR_GRAY)
        self.set_line_width(0.3)
        line_w = (self.w - 2 * MARGIN - 10) / 2
        # Linha assinante 1
        self.line(MARGIN, y + 12, MARGIN + line_w, y + 12)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*COLOR_GRAY)
        self.set_xy(MARGIN, y + 14)
        self.cell(line_w, 4, label, align="C")
        # Linha assinante 2
        x2 = self.w - MARGIN - line_w
        self.line(x2, y + 12, x2 + line_w, y + 12)
        self.set_xy(x2, y + 14)
        self.cell(line_w, 4, "Contratante", align="C")
        self.ln(20)


# ── Quote PDF ──────────────────────────────────────────────────────────────────

def generate_quote_pdf(
    *,
    formatted_number: str,
    client_name: str,
    procedure_type_label: str | None,
    honorarios_escritorio: float,
    honorarios_despachante: float,
    custas_list: list[dict],   # [{"name": str, "value": float}]
    desconto: float,
    desconto_motivo: str | None,
    total: float,
    valid_until: date | None,
    notas: str | None,
    status_label: str,
) -> bytes:
    # Sanitize strings for ASCII-only fpdf2 fonts
    formatted_number = _s(formatted_number)
    client_name = _s(client_name)
    procedure_type_label = _s(procedure_type_label) if procedure_type_label else None
    desconto_motivo = _s(desconto_motivo) if desconto_motivo else None
    notas = _s(notas) if notas else None
    status_label = _s(status_label)
    custas_list = [{"name": _s(c["name"]), "value": c["value"]} for c in custas_list]

    pdf = _BasePDF(f"PROPOSTA DE HONORARIOS - {formatted_number}")
    pdf.alias_nb_pages()

    # ── Identificacao ──────────────────────────────────────────────────────────
    pdf.section_title("Identificacao")
    pdf.key_val("Numero:", formatted_number)
    pdf.key_val("Cliente:", client_name)
    if procedure_type_label:
        pdf.key_val("Tipo de procedimento:", procedure_type_label)
    pdf.key_val("Data de emissao:", _today())
    if valid_until:
        pdf.key_val("Valido ate:", valid_until.strftime("%d/%m/%Y"))
    pdf.key_val("Status:", status_label)
    pdf.ln(3)

    # ── Composicao de valores ──────────────────────────────────────────────────
    pdf.section_title("Composicao de Valores")
    pdf.value_row("Honorarios do escritorio", honorarios_escritorio)
    pdf.value_row("Honorarios do despachante", honorarios_despachante)

    custas_total = sum(c["value"] for c in custas_list)
    if custas_list:
        pdf.ln(2)
        pdf.set_font("Helvetica", "I", 7)
        pdf.set_text_color(*COLOR_GRAY)
        pdf.cell(0, LINE_H, "Custas estimadas:", new_x="LMARGIN", new_y="NEXT")
        for c in custas_list:
            pdf.value_row(f"   - {c['name']}", c["value"], color=COLOR_GRAY)
        pdf.value_row("Subtotal custas", custas_total, bold=True)

    subtotal = honorarios_escritorio + honorarios_despachante + custas_total
    pdf.divider()
    pdf.value_row("Subtotal", subtotal)

    if desconto > 0:
        motivo = f" ({desconto_motivo})" if desconto_motivo else ""
        pdf.value_row(f"Desconto{motivo}", -desconto, color=(180, 30, 30))

    pdf.divider()
    pdf.set_fill_color(*COLOR_LIGHT)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(*COLOR_PRIMARY)
    effective_w = pdf.w - 2 * MARGIN
    pdf.cell(effective_w * 0.75, 8, "TOTAL", fill=True, new_x="RIGHT", new_y="TOP")
    pdf.cell(effective_w * 0.25, 8, _fmt_brl(total), align="R", fill=True,
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # ── Observacoes ────────────────────────────────────────────────────────────
    if notas:
        pdf.section_title("Observacoes")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_BLACK)
        pdf.multi_cell(0, LINE_H, notas)
        pdf.ln(2)

    # ── Assinatura ─────────────────────────────────────────────────────────────
    pdf.section_title("Aceite")
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*COLOR_GRAY)
    pdf.multi_cell(0, LINE_H,
        "Ao assinar este documento, o contratante declara ter lido, compreendido e "
        "concordado com todos os termos desta proposta de honorarios.")
    pdf.signature_block(FIRM_NAME)

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ── Contract PDF ───────────────────────────────────────────────────────────────

def generate_contract_pdf(
    *,
    formatted_number: str,
    client_name: str,
    payment_model_label: str,
    total_value: float,
    installments: list[dict],   # [{"due_date": str, "value": float, "status": str}]
    exito_percentual: float | None,
    notas: str | None,
    status_label: str,
    quote_number: str | None,
) -> bytes:
    # Sanitize strings for ASCII-only fpdf2 fonts
    formatted_number = _s(formatted_number)
    client_name = _s(client_name)
    payment_model_label = _s(payment_model_label)
    notas = _s(notas) if notas else None
    status_label = _s(status_label)
    quote_number = _s(quote_number) if quote_number else None

    pdf = _BasePDF(f"CONTRATO DE HONORARIOS - {formatted_number}")
    pdf.alias_nb_pages()

    # ── Identificacao ──────────────────────────────────────────────────────────
    pdf.section_title("Identificacao")
    pdf.key_val("Numero:", formatted_number)
    pdf.key_val("Cliente (Contratante):", client_name)
    pdf.key_val("Escritorio (Contratado):", FIRM_NAME)
    pdf.key_val("Data de emissao:", _today())
    if quote_number:
        pdf.key_val("Orcamento de referencia:", quote_number)
    pdf.key_val("Status:", status_label)
    pdf.ln(3)

    # ── Condicoes de pagamento ─────────────────────────────────────────────────
    pdf.section_title("Condicoes de Pagamento")
    pdf.key_val("Modelo:", payment_model_label)
    pdf.key_val("Valor total:", _fmt_brl(total_value), bold_val=True)
    if exito_percentual:
        pdf.key_val("% de exito:", f"{exito_percentual:.1f}%")
    pdf.ln(3)

    # ── Parcelas ───────────────────────────────────────────────────────────────
    if installments:
        pdf.section_title("Cronograma de Parcelas")
        effective_w = pdf.w - 2 * MARGIN

        # Cabecalho da tabela
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(10, 7, "#", fill=True, align="C", new_x="RIGHT", new_y="TOP")
        pdf.cell(effective_w * 0.35, 7, "Vencimento", fill=True, align="C", new_x="RIGHT", new_y="TOP")
        pdf.cell(effective_w * 0.35, 7, "Valor", fill=True, align="C", new_x="RIGHT", new_y="TOP")
        pdf.cell(effective_w * 0.25, 7, "Status", fill=True, align="C", new_x="LMARGIN", new_y="NEXT")

        # Linhas
        for i, inst in enumerate(installments):
            fill_color = COLOR_LIGHT if i % 2 == 0 else (255, 255, 255)
            pdf.set_fill_color(*fill_color)
            pdf.set_text_color(*COLOR_BLACK)
            pdf.set_font("Helvetica", "", 8)

            # Formata data
            raw_date = inst.get("due_date", "")
            try:
                d = date.fromisoformat(raw_date)
                due = d.strftime("%d/%m/%Y")
            except Exception:
                due = raw_date

            status_str = "Pago" if inst.get("status") == "pago" else "Pendente"
            status_color = COLOR_GREEN if inst.get("status") == "pago" else (160, 100, 0)

            pdf.cell(10, LINE_H, str(i + 1), fill=True, align="C", new_x="RIGHT", new_y="TOP")
            pdf.cell(effective_w * 0.35, LINE_H, due, fill=True, align="C", new_x="RIGHT", new_y="TOP")
            pdf.cell(effective_w * 0.35, LINE_H, _fmt_brl(inst.get("value", 0)),
                     fill=True, align="C", new_x="RIGHT", new_y="TOP")
            pdf.set_text_color(*status_color)
            pdf.cell(effective_w * 0.25, LINE_H, status_str,
                     fill=True, align="C", new_x="LMARGIN", new_y="NEXT")

        # Total
        pdf.set_text_color(*COLOR_BLACK)
        pdf.set_font("Helvetica", "B", 8)
        inst_total = sum(inst.get("value", 0) for inst in installments)
        pdf.cell(10 + effective_w * 0.35, LINE_H, "Total", align="R", new_x="RIGHT", new_y="TOP")
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(effective_w * 0.35, LINE_H, _fmt_brl(inst_total),
                 align="C", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # ── Clausulas ──────────────────────────────────────────────────────────────
    pdf.section_title("Clausulas Gerais")
    clauses = [
        "1. O presente contrato e celebrado entre o Escritorio de Advocacia Beza, Miranda e Bonetti "
        "(Contratado) e o(a) cliente identificado(a) acima (Contratante).",
        "2. O Contratado prestara os servicos juridicos relacionados ao procedimento descrito "
        "no orcamento de referencia, conforme escopo acordado entre as partes.",
        "3. Os honorarios serao pagos nas datas e valores estipulados no cronograma acima, "
        "mediante transferencia bancaria ou outro meio acordado.",
        "4. O atraso no pagamento sujeitara o Contratante a multa de 2% mais juros de 1% ao mes.",
        "5. O presente instrumento e regido pelas normas da OAB e pelo Codigo Civil Brasileiro.",
    ]
    for clause in clauses:
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_BLACK)
        pdf.multi_cell(0, LINE_H, clause)
        pdf.ln(1)
    pdf.ln(2)

    # ── Observacoes ────────────────────────────────────────────────────────────
    if notas:
        pdf.section_title("Observacoes")
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*COLOR_BLACK)
        pdf.multi_cell(0, LINE_H, notas)
        pdf.ln(2)

    # ── Local e data ───────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(*COLOR_GRAY)
    pdf.cell(0, LINE_H, f"Assinado eletronicamente em _________________, {_today()}.",
             new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # ── Assinatura ─────────────────────────────────────────────────────────────
    pdf.signature_block(f"{FIRM_NAME}")

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()


# ── Property PDF ───────────────────────────────────────────────────────────────

_SITUACAO_LABEL = {
    "regular": "Regular",
    "com_onus": "Com onus",
    "irregular": "Irregular",
    "requer_investigacao": "Requer investigacao",
}
_RISCO_LABEL = {"baixo": "Baixo", "medio": "Medio", "alto": "Alto"}
_TIPO_UNIDADE_LABEL = {
    "apartamento": "Apto",
    "sala_comercial": "Sala comercial",
    "vaga_garagem": "Vaga",
    "deposito": "Deposito",
    "loja": "Loja",
    "outro": "Outro",
}


def generate_property_pdf(
    *,
    matricula: str | None,
    inscricao_imobiliaria: str | None,
    incra_code: str | None,
    property_type_label: str,
    subtipo: str | None,
    endereco: str | None,
    area_total: float | None,
    area_unit: str,
    cartorio: str | None,
    confrontantes: str | None,
    proprietarios: list[dict],
    analise_juridica: dict | None,
    quadro_areas_nbr: dict | None,
    procedures: list[dict],
    notas: str | None,
) -> bytes:
    title = f"RELATORIO DO IMOVEL{(' - Mat. ' + matricula) if matricula else ''}"
    pdf = _BasePDF(_s(title))
    pdf.alias_nb_pages()

    # ── Dados do Imovel ────────────────────────────────────────────────────────
    pdf.section_title("Dados do Imovel")
    if matricula:
        pdf.key_val("Matricula:", matricula, bold_val=True)
    if inscricao_imobiliaria:
        pdf.key_val("Inscricao Imobiliaria:", inscricao_imobiliaria)
    if incra_code:
        pdf.key_val("Codigo INCRA:", incra_code)
    tipo_str = property_type_label + (f" - {_s(subtipo)}" if subtipo else "")
    pdf.key_val("Tipo:", tipo_str)
    if endereco:
        pdf.key_val("Endereco:", endereco)
    if area_total is not None:
        unit_str = "ha" if area_unit == "ha" else "m2"
        pdf.key_val("Area total:", f"{area_total:,.4f} {unit_str}".replace(",", "."))
    if cartorio:
        pdf.key_val("Cartorio:", cartorio)
    pdf.key_val("Data do relatorio:", _today())
    if confrontantes:
        pdf.ln(2)
        pdf.set_text_color(*COLOR_GRAY)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(50, LINE_H, "Confrontantes:", new_x="RIGHT", new_y="TOP")
        pdf.set_text_color(*COLOR_BLACK)
        pdf.set_font("Helvetica", "", 8)
        pdf.multi_cell(0, LINE_H, _s(confrontantes))
    if notas:
        pdf.ln(1)
        pdf.set_text_color(*COLOR_GRAY)
        pdf.set_font("Helvetica", "", 8)
        pdf.cell(50, LINE_H, "Observacoes:", new_x="RIGHT", new_y="TOP")
        pdf.set_text_color(*COLOR_BLACK)
        pdf.multi_cell(0, LINE_H, _s(notas))
    pdf.ln(3)

    # ── Proprietarios registrais ───────────────────────────────────────────────
    if proprietarios:
        pdf.section_title(f"Proprietarios Registrais ({len(proprietarios)})")
        for i, p in enumerate(proprietarios, 1):
            nome = _s(p.get("nome") or "")
            if not nome:
                continue
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*COLOR_BLACK)
            pdf.cell(0, LINE_H, f"{i}. {nome}", new_x="LMARGIN", new_y="NEXT")
            details = []
            if p.get("cpf"):
                details.append(f"CPF: {p['cpf']}")
            if p.get("cnpj"):
                details.append(f"CNPJ: {p['cnpj']}")
            if p.get("nacionalidade"):
                details.append(_s(p["nacionalidade"]))
            if p.get("estado_civil"):
                ec = _s(p["estado_civil"])
                if p.get("regime_bens"):
                    ec += f" / {_s(p['regime_bens'])}"
                details.append(ec)
            if p.get("profissao"):
                details.append(_s(p["profissao"]))
            if details:
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*COLOR_GRAY)
                pdf.set_x(MARGIN + 4)
                pdf.cell(0, 5, "   ".join(details), new_x="LMARGIN", new_y="NEXT")
            if p.get("endereco"):
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*COLOR_GRAY)
                pdf.set_x(MARGIN + 4)
                pdf.cell(0, 5, _s(p["endereco"]), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(1)
        pdf.ln(2)

    # ── Analise Juridica ───────────────────────────────────────────────────────
    if analise_juridica:
        aj = analise_juridica
        situacao = _SITUACAO_LABEL.get(aj.get("situacao_geral", ""), "Nao informada")
        risco = _RISCO_LABEL.get(aj.get("nivel_risco", ""), "Nao informado")
        pdf.section_title("Analise Juridica da Matricula")
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*COLOR_PRIMARY)
        pdf.cell(0, 7, f"Situacao: {_s(situacao)}   |   Risco: {_s(risco)}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(1)
        if aj.get("resumo"):
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*COLOR_BLACK)
            pdf.multi_cell(0, LINE_H, _s(aj["resumo"]))
            pdf.ln(2)
        onus = aj.get("onus_reais") or []
        if onus:
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*COLOR_GRAY)
            pdf.cell(0, 6, f"Onus e Gravames ({len(onus)}):", new_x="LMARGIN", new_y="NEXT")
            for o in onus:
                tipo_o = _s(o.get("tipo", "")).replace("_", " ").title()
                sit_o = _s(o.get("situacao", ""))
                pdf.set_font("Helvetica", "B", 7)
                pdf.set_text_color(*COLOR_BLACK)
                pdf.set_x(MARGIN + 4)
                pdf.cell(0, 5, f"- {tipo_o} [{sit_o}]", new_x="LMARGIN", new_y="NEXT")
                if o.get("descricao"):
                    pdf.set_font("Helvetica", "", 7)
                    pdf.set_text_color(*COLOR_GRAY)
                    pdf.set_x(MARGIN + 8)
                    pdf.multi_cell(0, 4, _s(o["descricao"]))
                if o.get("credor_beneficiario"):
                    pdf.set_font("Helvetica", "I", 7)
                    pdf.set_x(MARGIN + 8)
                    pdf.cell(0, 4, f"Credor: {_s(o['credor_beneficiario'])}", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)
        incs = aj.get("inconsistencias") or []
        if incs:
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*COLOR_GRAY)
            pdf.cell(0, 6, f"Inconsistencias ({len(incs)}):", new_x="LMARGIN", new_y="NEXT")
            for inc in incs:
                grav = _s(inc.get("gravidade", "")).upper()
                tipo_i = _s(inc.get("tipo", "")).replace("_", " ").title()
                pdf.set_font("Helvetica", "B", 7)
                pdf.set_text_color(*COLOR_BLACK)
                pdf.set_x(MARGIN + 4)
                pdf.cell(0, 5, f"- [{grav}] {tipo_i}", new_x="LMARGIN", new_y="NEXT")
                if inc.get("descricao"):
                    pdf.set_font("Helvetica", "", 7)
                    pdf.set_text_color(*COLOR_GRAY)
                    pdf.set_x(MARGIN + 8)
                    pdf.multi_cell(0, 4, _s(inc["descricao"]))
            pdf.ln(2)
        recs = aj.get("recomendacoes") or []
        docs_rec = aj.get("documentos_recomendados") or []
        if recs or docs_rec:
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*COLOR_GRAY)
            pdf.cell(0, 6, "Recomendacoes:", new_x="LMARGIN", new_y="NEXT")
            for r in recs:
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*COLOR_BLACK)
                pdf.set_x(MARGIN + 4)
                pdf.multi_cell(0, 4, f"-> {_s(r)}")
            for d in docs_rec:
                pdf.set_font("Helvetica", "", 7)
                pdf.set_text_color(*COLOR_GRAY)
                pdf.set_x(MARGIN + 4)
                pdf.cell(0, 4, f"- {_s(d)}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    # ── Quadro de Areas NBR 12721 ──────────────────────────────────────────────
    quadro = quadro_areas_nbr
    if quadro and quadro.get("unidades"):
        unidades = quadro["unidades"]
        pdf.section_title(f"Quadro de Areas NBR 12.721 ({len(unidades)} unidade(s))")
        if quadro.get("nome_empreendimento"):
            pdf.key_val("Empreendimento:", quadro["nome_empreendimento"])
        if quadro.get("endereco"):
            pdf.key_val("Endereco do empreendimento:", quadro["endereco"])
        pdf.ln(2)

        col_w = [14, 18, 40, 23, 23, 23, 16]
        headers = ["Unid.", "Tipo", "Descricao", "A.Priv.(m2)", "A.Com.(m2)", "A.Tot.(m2)", "Fracao"]
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 6)
        for i, h in enumerate(headers):
            pdf.cell(col_w[i], 6, h, align="R" if i >= 3 else "L", fill=True, new_x="RIGHT", new_y="TOP")
        pdf.ln(6)

        def _fa(v):
            if v is None: return "-"
            try: return f"{float(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            except: return "-"

        for idx, u in enumerate(unidades):
            fill = idx % 2 == 0
            if fill:
                pdf.set_fill_color(*COLOR_LIGHT)
            pdf.set_text_color(*COLOR_BLACK)
            pdf.set_font("Helvetica", "", 6)
            row = [
                _s(u.get("id_unidade") or ""),
                _s(_TIPO_UNIDADE_LABEL.get(u.get("tipo", ""), u.get("tipo", ""))),
                _s(u.get("descricao") or ""),
                _fa(u.get("area_privativa_real")),
                _fa(u.get("area_comum_real")),
                _fa(u.get("area_total_real")),
                _s(u.get("fracao_ideal_terreno") or "-"),
            ]
            aligns = ["L", "L", "L", "R", "R", "R", "C"]
            for i, val in enumerate(row):
                pdf.cell(col_w[i], 5, val, align=aligns[i], fill=fill, new_x="RIGHT", new_y="TOP")
            pdf.ln(5)

        totais = quadro.get("totais") or {}
        pdf.set_fill_color(*COLOR_PRIMARY)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 6)
        tot_row = ["", "", "TOTAIS", _fa(totais.get("area_privativa_real")),
                   _fa(totais.get("area_comum_real")), _fa(totais.get("area_total_real")), ""]
        for i, val in enumerate(tot_row):
            pdf.cell(col_w[i], 6, val, fill=True, align="R" if i >= 3 else "L", new_x="RIGHT", new_y="TOP")
        pdf.ln(8)

    # ── Procedimentos vinculados ───────────────────────────────────────────────
    if procedures:
        pdf.section_title(f"Procedimentos Vinculados ({len(procedures)})")
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*COLOR_GRAY)
        pdf.cell(42, 6, "Protocolo", new_x="RIGHT", new_y="TOP")
        pdf.cell(90, 6, "Tipo", new_x="RIGHT", new_y="TOP")
        pdf.cell(0, 6, "Status", new_x="LMARGIN", new_y="NEXT")
        pdf.divider()
        for proc in procedures:
            pdf.set_font("Helvetica", "", 7)
            pdf.set_text_color(*COLOR_BLACK)
            pdf.cell(42, 5, _s(proc.get("protocol") or ""), new_x="RIGHT", new_y="TOP")
            pdf.cell(90, 5, _s(proc.get("type_label") or ""), new_x="RIGHT", new_y="TOP")
            pdf.cell(0, 5, _s(proc.get("status_label") or ""), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(3)

    prop_pdf_buf = BytesIO()
    pdf.output(prop_pdf_buf)
    return prop_pdf_buf.getvalue()
