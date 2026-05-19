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


def build_prompt(doc_type: str, context: dict) -> str:
    """Monta o prompt específico para cada tipo de documento com base no contexto do procedimento."""

    client_name = context.get("client_name", "[NOME DO CLIENTE]")
    client_doc = context.get("client_document", "[CPF/CNPJ]")
    client_address = context.get("client_address", "[ENDEREÇO]")
    proc_type_label = context.get("procedure_type_label", "[TIPO DE PROCEDIMENTO]")
    proc_number = context.get("procedure_number", "[NÚMERO]")
    property_desc = context.get("property_description", "[DESCRIÇÃO DO IMÓVEL]")
    matricula = context.get("matricula", "")
    responsible_name = context.get("responsible_name", "Advogado Responsável")
    extra = context.get("extra_instructions", "")

    mat_line = f"\n- Matrícula do imóvel: {matricula}" if matricula else ""

    if doc_type == "requerimento":
        return f"""Redija um REQUERIMENTO para {proc_type_label} com base nas seguintes informações:

- Requerente: {client_name} (CPF/CNPJ: {client_doc})
- Endereço do requerente: {client_address}
- Tipo de procedimento: {proc_type_label}
- Número do protocolo interno: {proc_number}
- Descrição do imóvel: {property_desc}{mat_line}
- Advogado responsável: {responsible_name}
{f"- Instruções adicionais: {extra}" if extra else ""}

O requerimento deve ser dirigido ao Oficial do Cartório de Registro de Imóveis competente.
Inclua: qualificação completa do requerente, objeto do pedido, fundamentação legal (Lei 6.015/73 e legislação aplicável), pedido final e local/data/assinatura."""

    elif doc_type == "contrato_honorarios":
        fee = context.get("fee_total", "[VALOR DOS HONORÁRIOS]")
        payment_model = context.get("payment_model", "fixo")
        return f"""Redija um CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS com as seguintes informações:

- Contratante: {client_name} (CPF/CNPJ: {client_doc}), residente em {client_address}
- Contratada: Beza, Miranda e Bonetti Sociedade de Advogados
- Objeto: Serviços advocatícios para {proc_type_label}
- Protocolo: {proc_number}
- Honorários: {fee} — Modalidade: {payment_model}
- Advogado responsável: {responsible_name}
{f"- Instruções adicionais: {extra}" if extra else ""}

Inclua: qualificação das partes, objeto, honorários e forma de pagamento, obrigações das partes, prazo, rescisão, foro (comarca de [CIDADE]), cláusula de sigilo e espaço para assinaturas com testemunhas."""

    elif doc_type == "notificacao_extrajudicial":
        notified = context.get("notified_name", "[NOME DO NOTIFICADO]")
        notified_address = context.get("notified_address", "[ENDEREÇO DO NOTIFICADO]")
        subject = context.get("notification_subject", "[ASSUNTO DA NOTIFICAÇÃO]")
        return f"""Redija uma NOTIFICAÇÃO EXTRAJUDICIAL com as seguintes informações:

- Notificante: {client_name} (CPF/CNPJ: {client_doc})
- Notificado: {notified}, residente em {notified_address}
- Assunto: {subject}
- Procedimento: {proc_type_label} — Protocolo: {proc_number}
- Advogado responsável: {responsible_name}
{f"- Instruções adicionais: {extra}" if extra else ""}

A notificação deve conter: qualificação das partes, objeto da notificação com clareza, prazo para resposta/providência (15 dias), advertência sobre consequências jurídicas, e encerramento formal com assinatura do advogado e do notificante."""

    elif doc_type == "declaracao":
        subject = context.get("declaration_subject", "[OBJETO DA DECLARAÇÃO]")
        return f"""Redija uma DECLARAÇÃO com as seguintes informações:

- Declarante: {client_name} (CPF/CNPJ: {client_doc}), residente em {client_address}
- Objeto da declaração: {subject}
- Procedimento: {proc_type_label} — Protocolo: {proc_number}
- Imóvel: {property_desc}{mat_line}
{f"- Instruções adicionais: {extra}" if extra else ""}

A declaração deve incluir: qualificação do declarante, objeto declarado de forma clara e objetiva, afirmação de veracidade sob penas da lei, local/data e assinatura com firma reconhecida."""

    elif doc_type == "procuracao":
        powers = context.get("powers", "praticar todos os atos necessários ao procedimento indicado")
        return f"""Redija uma PROCURAÇÃO AD JUDICIA ET EXTRA com as seguintes informações:

- Outorgante: {client_name} (CPF/CNPJ: {client_doc}), residente em {client_address}
- Outorgado: {responsible_name} — OAB/[UF] [NÚMERO]
- Poderes: {powers}
- Finalidade: {proc_type_label} — Protocolo: {proc_number}
- Imóvel: {property_desc}{mat_line}
{f"- Instruções adicionais: {extra}" if extra else ""}

Inclua poderes para representar em cartórios, prefeituras, registros de imóveis, INCRA, e demais órgãos públicos e privados, bem como para receber e dar quitação, firmar contratos e substabelecer com ou sem reservas de poderes."""

    elif doc_type == "minuta_contrato":
        parties = context.get("other_parties", "[OUTRAS PARTES]")
        object_desc = context.get("contract_object", "[OBJETO DO CONTRATO]")
        return f"""Redija uma MINUTA DE CONTRATO com as seguintes informações:

- Parte 1: {client_name} (CPF/CNPJ: {client_doc}), residente em {client_address}
- Parte 2: {parties}
- Objeto: {object_desc}
- Procedimento relacionado: {proc_type_label} — Protocolo: {proc_number}
- Imóvel: {property_desc}{mat_line}
{f"- Instruções adicionais: {extra}" if extra else ""}

A minuta deve conter: qualificação completa das partes, objeto detalhado, preço e condições de pagamento, obrigações de cada parte, prazo, penalidades, rescisão, disposições gerais, foro eleito e assinaturas com testemunhas."""

    elif doc_type == "parecer":
        question = context.get("legal_question", "[QUESTÃO JURÍDICA A SER ANALISADA]")
        return f"""Redija um PARECER JURÍDICO com as seguintes informações:

- Consulente: {client_name}
- Questão: {question}
- Procedimento: {proc_type_label} — Protocolo: {proc_number}
- Imóvel envolvido: {property_desc}{mat_line}
- Advogado parecerista: {responsible_name}
{f"- Instruções adicionais: {extra}" if extra else ""}

Estruture o parecer em: Ementa, Relatório dos Fatos, Análise Jurídica (com citação de legislação e jurisprudência pertinentes), Conclusão e Assinatura. O parecer deve ser objetivo, fundamentado e indicar o caminho jurídico mais adequado."""

    elif doc_type == "resumo_procedimento":
        stages = context.get("stages_summary", "")
        return f"""Redija um RESUMO EXECUTIVO DO PROCEDIMENTO com as seguintes informações:

- Cliente: {client_name}
- Tipo de procedimento: {proc_type_label}
- Número do protocolo: {proc_number}
- Imóvel: {property_desc}{mat_line}
- Responsável: {responsible_name}
- Status das etapas: {stages if stages else "conforme sistema interno"}
{f"- Instruções adicionais: {extra}" if extra else ""}

O resumo deve conter: identificação do procedimento, situação atual, etapas concluídas, etapas pendentes com prazo estimado, documentos ainda necessários e próximos passos recomendados. Linguagem clara, direta, adequada para apresentação ao cliente."""

    else:
        return f"""Redija um documento jurídico do tipo "{doc_type}" para o procedimento {proc_type_label} (Protocolo {proc_number}), envolvendo o cliente {client_name}.
Imóvel: {property_desc}{mat_line}
Responsável: {responsible_name}
{f"Instruções: {extra}" if extra else ""}"""
