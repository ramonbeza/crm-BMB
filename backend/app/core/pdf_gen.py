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
