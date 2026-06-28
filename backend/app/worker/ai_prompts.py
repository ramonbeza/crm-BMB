"""
Prompts para geração de documentos jurídicos via Claude API.
Escritório: Beza, Miranda e Bonetti — Advocacia Imobiliária.
"""
from __future__ import annotations

SYSTEM_PROMPT = """Você é um assistente jurídico especializado em direito imobiliário do escritório Beza, Miranda e Bonetti Advogados.

Você redige documentos jurídicos em português brasileiro, com linguagem formal e precisa, seguindo as normas da ABNT para formatação e as boas práticas do Conselho Federal da OAB.

Diretrizes obrigatórias:
- Use linguagem jurídica formal e técnica
- Estruture o documento com cabeçalho, corpo e rodapé adequados
- Inclua os dados fornecidos no contexto sem inventar informações
- Use "____________________" para campos que precisam de assinatura
- Use "[DATA]", "[LOCAL]", "[CPF/CNPJ]" para lacunas que o usuário deve preencher se não fornecidas
- Nunca invente nomes, datas, valores ou dados processuais
- Responda APENAS com o texto do documento, sem comentários adicionais
"""


def _base(context: dict) -> tuple[str, str, str, str, str, str, str, str, str]:
    """Extrai os campos base do contexto."""
    client_name = context.get("client_name", "[NOME DO CLIENTE]")
    client_doc = context.get("client_document", "[CPF/CNPJ]")
    client_address = context.get("client_address", "[ENDEREÇO]")
    proc_type_label = context.get("procedure_type_label", "[TIPO DE PROCEDIMENTO]")
    proc_number = context.get("procedure_number", "[NÚMERO]")
    property_desc = context.get("property_description", "[DESCRIÇÃO DO IMÓVEL]")
    matricula = context.get("matricula", "")
    responsible_name = context.get("responsible_name", "Advogado Responsável")
    extra = context.get("extra_instructions", "")
    return client_name, client_doc, client_address, proc_type_label, proc_number, property_desc, matricula, responsible_name, extra


def _mat(matricula: str) -> str:
    return f"\n- Matrícula do imóvel: {matricula}" if matricula else ""


def _extra_line(extra: str) -> str:
    return f"\n- Instruções adicionais: {extra}" if extra else ""


def _docs_ctx(context: dict) -> str:
    """Formata o contexto dos documentos extraídos para enriquecer o prompt."""
    extracted = context.get("extracted_docs_summary", "")
    proprietarios = context.get("proprietarios_summary", "")
    lines = []
    if proprietarios:
        lines.append(f"\n--- PROPRIETÁRIOS REGISTRAIS ---\n{proprietarios}")
    if extracted:
        lines.append(f"\n--- DOCUMENTOS EXTRAÍDOS DO PROCESSO ---\n{extracted}")
    return "\n".join(lines)


def build_prompt(doc_type: str, context: dict) -> str:
    """Monta o prompt específico para cada tipo de documento."""

    n, doc, addr, proc_lbl, proto, prop, mat, resp, extra = _base(context)
    mat_line = _mat(mat)
    extra_line = _extra_line(extra)
    docs_ctx = _docs_ctx(context)

    # ── GERAL ─────────────────────────────────────────────────────────────────

    if doc_type == "requerimento":
        return f"""Redija um REQUERIMENTO para {proc_lbl} com base nas seguintes informações:

- Requerente: {n} (CPF/CNPJ: {doc})
- Endereço do requerente: {addr}
- Tipo de procedimento: {proc_lbl}
- Número do protocolo interno: {proto}
- Descrição do imóvel: {prop}{mat_line}
- Advogado responsável: {resp}{extra_line}
{docs_ctx}

O requerimento deve ser dirigido ao Oficial do Cartório de Registro de Imóveis competente.
Inclua: qualificação completa do requerente, objeto do pedido, fundamentação legal (Lei 6.015/73 e legislação aplicável), pedido final e local/data/assinatura."""

    if doc_type == "contrato_honorarios":
        fee = context.get("fee_total", "[VALOR DOS HONORÁRIOS]")
        payment_model = context.get("payment_model", "fixo")
        return f"""Redija um CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS:

- Contratante: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Contratada: Beza, Miranda e Bonetti Sociedade de Advogados
- Objeto: Serviços advocatícios para {proc_lbl}
- Protocolo: {proto}
- Honorários: {fee} — Modalidade: {payment_model}
- Advogado responsável: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação das partes, objeto, honorários e forma de pagamento, obrigações das partes, prazo, rescisão, foro (comarca de [CIDADE]), cláusula de sigilo e espaço para assinaturas com testemunhas."""

    if doc_type == "notificacao_extrajudicial":
        notified = context.get("notified_name", "[NOME DO NOTIFICADO]")
        notified_address = context.get("notified_address", "[ENDEREÇO DO NOTIFICADO]")
        subject = context.get("notification_subject", "[ASSUNTO DA NOTIFICAÇÃO]")
        return f"""Redija uma NOTIFICAÇÃO EXTRAJUDICIAL:

- Notificante: {n} (CPF/CNPJ: {doc})
- Notificado: {notified}, residente em {notified_address}
- Assunto: {subject}
- Procedimento: {proc_lbl} — Protocolo: {proto}
- Advogado responsável: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação das partes, objeto com clareza, prazo para resposta (15 dias), advertência sobre consequências jurídicas e encerramento formal."""

    if doc_type == "declaracao":
        subject = context.get("declaration_subject", "[OBJETO DA DECLARAÇÃO]")
        return f"""Redija uma DECLARAÇÃO:

- Declarante: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Objeto: {subject}
- Procedimento: {proc_lbl} — Protocolo: {proto}
- Imóvel: {prop}{mat_line}{extra_line}
{docs_ctx}

Inclua: qualificação do declarante, objeto declarado com clareza, afirmação de veracidade sob penas da lei, local/data e assinatura com firma reconhecida."""

    if doc_type == "procuracao":
        powers = context.get("powers", "praticar todos os atos necessários ao procedimento indicado")
        return f"""Redija uma PROCURAÇÃO AD JUDICIA ET EXTRA:

- Outorgante: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Outorgado: {resp} — OAB/[UF] [NÚMERO]
- Poderes: {powers}
- Finalidade: {proc_lbl} — Protocolo: {proto}
- Imóvel: {prop}{mat_line}{extra_line}
{docs_ctx}

Inclua poderes para representar em cartórios, prefeituras, registros de imóveis, INCRA e demais órgãos, substabelecer com ou sem reservas."""

    if doc_type == "minuta_contrato":
        parties = context.get("other_parties", "[OUTRAS PARTES]")
        object_desc = context.get("contract_object", "[OBJETO DO CONTRATO]")
        return f"""Redija uma MINUTA DE CONTRATO:

- Parte 1: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Parte 2: {parties}
- Objeto: {object_desc}
- Procedimento: {proc_lbl} — Protocolo: {proto}
- Imóvel: {prop}{mat_line}{extra_line}
{docs_ctx}

Inclua: qualificação completa das partes, objeto detalhado, preço e condições de pagamento, obrigações, prazo, penalidades, rescisão, foro e assinaturas."""

    if doc_type == "parecer":
        question = context.get("legal_question", "[QUESTÃO JURÍDICA A SER ANALISADA]")
        return f"""Redija um PARECER JURÍDICO:

- Consulente: {n}
- Questão: {question}
- Procedimento: {proc_lbl} — Protocolo: {proto}
- Imóvel: {prop}{mat_line}
- Advogado parecerista: {resp}{extra_line}
{docs_ctx}

Estruture em: Ementa, Relatório dos Fatos, Análise Jurídica (com legislação e jurisprudência), Conclusão e Assinatura."""

    if doc_type == "resumo_procedimento":
        stages = context.get("stages_summary", "")
        return f"""Redija um RESUMO EXECUTIVO DO PROCEDIMENTO:

- Cliente: {n}
- Tipo: {proc_lbl} — Protocolo: {proto}
- Imóvel: {prop}{mat_line}
- Responsável: {resp}
- Status das etapas: {stages or "conforme sistema interno"}{extra_line}
{docs_ctx}

Conteúdo: identificação do procedimento, situação atual, etapas concluídas, pendentes com prazo estimado, documentos ainda necessários e próximos passos. Linguagem clara, adequada para apresentação ao cliente."""

    if doc_type == "oficio_cartorio":
        return f"""Redija um OFÍCIO ao Cartório de Registro de Imóveis:

- Remetente: Beza, Miranda e Bonetti Advogados — {resp}
- Destinatário: Oficial do Cartório de Registro de Imóveis de [COMARCA]
- Assunto: {proc_lbl} — Protocolo: {proto}
- Requerente/Cliente: {n} (CPF/CNPJ: {doc})
- Imóvel: {prop}{mat_line}{extra_line}
{docs_ctx}

O ofício deve ser formal, indicar o objeto da comunicação com precisão, fazer referência ao protocolo, listar documentos anexos se houver e solicitar a providência esperada do cartório."""

    if doc_type == "oficio_prefeitura":
        return f"""Redija um OFÍCIO à Prefeitura Municipal:

- Remetente: Beza, Miranda e Bonetti Advogados — {resp}
- Destinatário: Secretaria de [SECRETARIA] — Prefeitura de [MUNICÍPIO]
- Assunto: {proc_lbl} — Protocolo: {proto}
- Requerente: {n} (CPF/CNPJ: {doc})
- Imóvel: {prop}{mat_line}{extra_line}
{docs_ctx}

Inclua: identificação do remetente, destinatário, objeto do ofício, fundamentação, pedido expresso, relação de documentos anexos e assinatura do advogado."""

    if doc_type == "recibo_pagamento":
        value = context.get("fee_total", "[VALOR]")
        payment_model = context.get("payment_model", "")
        return f"""Redija um RECIBO DE PAGAMENTO:

- Recebedor: Beza, Miranda e Bonetti Sociedade de Advogados
- Pagador: {n} (CPF/CNPJ: {doc})
- Valor: {value}
- Referente: Honorários advocatícios — {proc_lbl} — Protocolo: {proto}
- Forma de pagamento: {payment_model or "[FORMA DE PAGAMENTO]"}{extra_line}

Inclua: qualificação das partes, valor em algarismos e por extenso, descrição dos serviços, data, local e assinatura do recebedor com carimbo."""

    if doc_type == "contrato_cessao":
        parties = context.get("other_parties", "[CESSIONÁRIO]")
        value = context.get("fee_total", "[VALOR]")
        return f"""Redija um CONTRATO DE CESSÃO DE DIREITOS SOBRE IMÓVEL:

- Cedente: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Cessionário: {parties}
- Imóvel: {prop}{mat_line}
- Valor da cessão: {value}
- Protocolo: {proto}{extra_line}
{docs_ctx}

Inclua: qualificação completa das partes, descrição do imóvel, direitos cedidos, valor e condições de pagamento, obrigações, declarações do cedente quanto à inexistência de ônus, entrega da posse, foro e assinaturas."""

    # ── USUCAPIÃO ─────────────────────────────────────────────────────────────

    if doc_type == "requerimento_usucapiao":
        proc_type = context.get("procedure_type", "usucapiao_extrajudicial")
        via = "Cartório de Notas" if "extrajudicial" in proc_type else "Juízo da Vara de Registros Públicos"
        return f"""Redija um REQUERIMENTO DE USUCAPIÃO dirigido ao {via}:

- Requerente/Possuidor: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Imóvel objeto: {prop}{mat_line}
- Protocolo interno: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação do requerente, descrição detalhada do imóvel com confrontantes, modalidade de usucapião (ordinária/extraordinária/especial urbana/rural — conforme os fatos), tempo de posse, animus domini, justo título e boa-fé se aplicável, fundamentação legal (art. 1.238 a 1.244 CC e Lei 6.015/73 art. 216-A), documentos que instruem o pedido e requerimento final."""

    if doc_type == "ata_notarial":
        return f"""Redija uma ATA NOTARIAL DE TEMPO DE POSSE para fins de Usucapião Extrajudicial:

- Interessado: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Imóvel: {prop}{mat_line}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

A ata notarial deve conter: qualificação do interessado, descrição pormenorizada do imóvel, declaração sobre o tempo e natureza da posse, atos de posse praticados (benfeitorias, pagamento de tributos, uso efetivo), declaração de que não há litígio sobre o imóvel, rol de testemunhas que confirmam a posse, e encerramento com assinatura do Tabelião. Base legal: art. 384 do CPC e art. 216-A da Lei 6.015/73."""

    if doc_type == "edital_usucapiao":
        return f"""Redija um EDITAL DE USUCAPIÃO EXTRAJUDICIAL para publicação:

- Requerente: {n} (CPF/CNPJ: {doc})
- Imóvel: {prop}{mat_line}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

O edital deve conter: título "EDITAL DE USUCAPIÃO EXTRAJUDICIAL", identificação do Cartório de Notas, qualificação do requerente, descrição do imóvel com confrontantes, modalidade de usucapião pleiteada, prazo para impugnação (15 dias), local onde os interessados podem obter informações, data e assinatura do Tabelião. Conforme art. 216-A, §4º da Lei 6.015/73."""

    if doc_type == "anuencia_confrontantes":
        return f"""Redija uma DECLARAÇÃO DE ANUÊNCIA E CONCORDÂNCIA DOS CONFRONTANTES/LINDEIROS:

- Imóvel em discussão (do possuidor/requerente): {prop}{mat_line}
- Requerente: {n}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

O documento deve ser redigido na primeira pessoa do declarante (confrontante), com espaço para qualificação de cada confrontante (Nome, CPF, Endereço), descrição do lado de confrontação com o imóvel, declaração expressa de conhecimento da posse pelo requerente e anuência ao pedido de usucapião, sem discordâncias ou litígios. Espaço para assinatura com firma reconhecida. Conforme art. 216-A, §2º da Lei 6.015/73."""

    # ── RETIFICAÇÃO ───────────────────────────────────────────────────────────

    if doc_type == "requerimento_retificacao":
        return f"""Redija um REQUERIMENTO DE RETIFICAÇÃO DE ÁREA E DESCRIÇÃO DE IMÓVEL dirigido ao Oficial do CRI:

- Requerente: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Imóvel: {prop}{mat_line}
- Protocolo interno: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação do requerente, identificação do imóvel (matrícula, cartório, comarca), descrição atual constante na matrícula, nova descrição proposta com base na planta e memorial descritivo, divergência identificada, fundamentação legal (art. 212 e 213 da Lei 6.015/73), rol de confrontantes notificados, documentos anexos (planta, memorial, ART) e requerimento final."""

    if doc_type == "auto_declaratorio":
        return f"""Redija um AUTO DECLARATÓRIO para instrução de Retificação Administrativa:

- Declarante/Requerente: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Imóvel: {prop}{mat_line}
- Protocolo: {proto}{extra_line}
{docs_ctx}

O auto declaratório deve conter: qualificação do declarante, histórico de aquisição do imóvel, descrição detalhada das benfeitorias e confrontantes, afirmação de que a discrepância de área é meramente descritiva (não envolvendo alienação de área), declaração de responsabilidade pelas informações prestadas, compromisso de responder por eventuais ações de terceiros e assinatura com firma reconhecida."""

    # ── LOTEAMENTO / DESMEMBRAMENTO ───────────────────────────────────────────

    if doc_type == "requerimento_loteamento":
        proc_type = context.get("procedure_type", "loteamento")
        tipo_str = "Desmembramento" if "desmembramento" in proc_type else "Loteamento"
        return f"""Redija um REQUERIMENTO DE APROVAÇÃO DE {tipo_str.upper()} dirigido à Prefeitura Municipal:

- Requerente: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Imóvel/Gleba: {prop}{mat_line}
- Protocolo interno: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação do requerente, descrição da gleba original, proposta de {tipo_str.lower()} com número de lotes/frações e áreas, destinação dos lotes, infraestrutura prevista (para loteamento), fundamentação legal (Lei 6.766/79 e legislação municipal), documentos anexos e requerimento de aprovação do projeto."""

    if doc_type == "memorial_loteamento":
        return f"""Redija um MEMORIAL DESCRITIVO DE LOTEAMENTO/DESMEMBRAMENTO:

- Proprietário: {n} (CPF/CNPJ: {doc})
- Imóvel/Gleba: {prop}{mat_line}
- Protocolo: {proto}
- Responsável técnico: {resp}{extra_line}
{docs_ctx}

O memorial deve conter: identificação da gleba original, descrição técnica da subdivisão proposta (lote a lote com medidas e área), confrontantes de cada lote, vias públicas resultantes, áreas de lazer e institucionais (se loteamento), sistema de esgotamento e drenagem previstos, e declaração do responsável técnico. Utilize linguagem técnica precisa."""

    # ── INCORPORAÇÃO / INSTITUIÇÃO ────────────────────────────────────────────

    if doc_type == "requerimento_incorporacao":
        proc_type = context.get("procedure_type", "incorporacao_imobiliaria")
        tipo_str = "Instituição de Condomínio" if "instituicao" in proc_type else "Incorporação Imobiliária"
        return f"""Redija um REQUERIMENTO DE {tipo_str.upper()} dirigido ao Oficial do CRI:

- Incorporador/Requerente: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Terreno/Imóvel: {prop}{mat_line}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação do incorporador, identificação do imóvel, descrição do empreendimento (número de unidades, quadro NBR 12.721 resumido se disponível), documentos que instrui o pedido (matrícula, projeto aprovado, licença, convenção de condomínio, quadro de áreas), fundamentação legal (Lei 4.591/64 e NBR 12.721), e requerimento de averbação da incorporação/instituição."""

    if doc_type == "ata_assembleia":
        return f"""Redija uma ATA DE ASSEMBLEIA GERAL DE CONSTITUIÇÃO DO CONDOMÍNIO:

- Empreendimento: {prop}{mat_line}
- Incorporador/Instituidor: {n} (CPF/CNPJ: {doc})
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

A ata deve conter: identificação do empreendimento, data/hora/local da assembleia, lista de presentes (com frações ideais), abertura e declaração de quórum, aprovação da convenção de condomínio e regimento interno, eleição do síndico e conselho consultivo (com mandato), deliberações gerais, encerramento e assinaturas. Formato de ata notarial."""

    if doc_type == "convencao_condominio":
        return f"""Redija uma MINUTA DE CONVENÇÃO DE CONDOMÍNIO:

- Empreendimento: {prop}{mat_line}
- Incorporador/Instituidor: {n} (CPF/CNPJ: {doc})
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

A convenção deve conter: denominação e localização do condomínio; discriminação das áreas privativas e comuns; frações ideais por unidade; destinação (residencial/comercial); direitos e deveres dos condôminos; taxa de condomínio e rateio; administração (síndico, conselho fiscal, assembleia); penalidades e multas; normas de uso das áreas comuns; obras; seguro; base legal (Lei 4.591/64 e CC arts. 1.331 a 1.358-A)."""

    if doc_type == "regimento_interno":
        return f"""Redija um REGIMENTO INTERNO DE CONDOMÍNIO:

- Empreendimento: {prop}{mat_line}
- Protocolo: {proto}{extra_line}
{docs_ctx}

O regimento deve regulamentar: uso das áreas comuns (piscina, academia, salão de festas, garagem); horários de silêncio e de obras; mudanças e entregas; uso e circulação de animais de estimação; normas de segurança e acesso de visitantes; locação por temporada; penalidades e aplicação de multas. Linguagem clara e objetiva, complementar à convenção de condomínio."""

    # ── INVENTÁRIO / DIVÓRCIO ─────────────────────────────────────────────────

    if doc_type == "formal_partilha":
        return f"""Redija um FORMAL DE PARTILHA para Inventário Extrajudicial:

- Inventariante: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

O formal de partilha deve conter: qualificação do falecido (nome, data do óbito, estado civil, último domicílio), qualificação de todos os herdeiros, descrição detalhada dos bens imóveis (com matrícula, área, valor de ITCMD), meação do cônjuge sobrevivente se aplicável, quinhão de cada herdeiro especificado por bem, valor total do espólio, ITCMD recolhido, e declaração de quitação. Base legal: art. 610 do CPC e Lei Estadual de ITCMD."""

    if doc_type == "declaracao_meacao":
        return f"""Redija uma DECLARAÇÃO DE MEAÇÃO para instrução de inventário ou divórcio:

- Declarante (cônjuge sobrevivente ou divorciando): {n} (CPF/CNPJ: {doc}), residente em {addr}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

Inclua: qualificação do declarante e do(a) falecido(a)/ex-cônjuge, regime de bens do casamento (data de celebração, cartório), descrição dos bens que compõem a meação (com matrícula e valor), declaração expressa do direito de meação sobre cada bem, e reserva ao declarante da sua meação antes da partilha aos herdeiros. Assinatura com firma reconhecida."""

    if doc_type == "minuta_escritura":
        escritura_type = context.get("contract_object", "Escritura Pública de Inventário e Partilha")
        return f"""Redija uma MINUTA DE ESCRITURA PÚBLICA — {escritura_type}:

- Outorgante/Parte: {n} (CPF/CNPJ: {doc}), residente em {addr}
- Objeto: {prop}{mat_line}
- Protocolo: {proto}
- Advogado: {resp}{extra_line}
{docs_ctx}

A minuta deve conter: qualificação completa de todas as partes, preâmbulo com identificação do Tabelionato de Notas, objeto da escritura com descrição pormenorizada do imóvel, valor declarado, forma de pagamento (se compra/venda), declarações legais obrigatórias (CND, matrícula livre, ITBI/ITCMD recolhido), cláusulas gerais e encerramento. Esta é uma minuta para revisão antes da lavratura definitiva."""

    # ── Fallback ──────────────────────────────────────────────────────────────
    return f"""Redija um documento jurídico do tipo "{doc_type}" para o procedimento {proc_lbl} (Protocolo {proto}), envolvendo o cliente {n}.
Imóvel: {prop}{mat_line}
Responsável: {resp}{extra_line}
{docs_ctx}"""
