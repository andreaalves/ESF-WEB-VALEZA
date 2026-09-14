import React from "react";
import { Box, Flex, Text, Icon, Spinner, HStack, Stack, IconButton, Input, Textarea, Button, useToast, Menu, MenuButton, MenuList, MenuOptionGroup, MenuItemOption, Popover, PopoverTrigger, PopoverContent, PopoverBody, PopoverArrow, useDisclosure } from "@chakra-ui/react";
import { useEffect, useState, useCallback, useRef } from "react";
import {
    FaSyncAlt, FaClipboardList, FaWifi,
    FaExclamationCircle, FaChevronLeft, FaChevronRight,
    FaTimes, FaSave, FaPen, FaTrashAlt, FaPlus,
    FaTv, FaCompress,
    FaRegClock, FaRegStickyNote, FaRegAddressCard, FaRegCalendarAlt,
    FaBoxOpen, FaFileInvoiceDollar, FaTruck, FaRoute, FaClipboardCheck, FaUndoAlt,
    FaHashtag, FaStore, FaHourglassHalf,
} from "react-icons/fa";
import { useLocation } from "react-router-dom";
import { Header } from "../../components/Header";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import api from "../../service/api";
import { listarStatusEntregaPorPedido } from "../../service/entregas";
import { useAuth } from "../../context/AuthContext";
import { useThemeMode } from "../../context/ThemeModeContext";
import { useSidebar } from "../../context/SidebarContext";
import { DateTime } from "luxon";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type StatusWorkflow =
    | "AGENDADO"
    | "NOTA_FISCAL"
    | "EM_ROTA"
    | "ENTREGUE"
    | "APONTADO_REALIZADO"
    | "AGUARDANDO_DEVOLUCAO"
    | "FINALIZADO";

type TipoCirurgia = "URGENCIA" | "ELETIVA" | "CONSIGNADO" | "VENDA";

interface Scheduling {
    id: string;
    pedidoId?: string;
    dataAgendamento: string; // data mostrada na coluna DATA PROCEDIMENTO: a da cirurgia quando há agendamento, senão a de emissão do pedido
    dataCirurgia?: string;   // data REAL da cirurgia (agendamentos.data_agendamento). Só urgência/eletiva geram agendamento — nos demais fica indefinida
    horaCirurgia?: string;
    tipo: TipoCirurgia;
    cliente: { razaoSocial: string };
    colaborador: { nome: string };
    paciente?: string;
    medico?: string;
    valorPedido?: number;        // pedido.valor_pedido — total do pedido no TOTVS
    condicaoPagamento?: string;  // pedido.condicao_pagamento, ex "30/60/90 DD"
    mensagens?: PedidoMensagem[]; // mensagens/comentários do pedido (backend, mais recente primeiro)
    pedidoProtheus?: string;
    statusWorkflow: StatusWorkflow;
    statusTotvs?: StatusWorkflow; // status-base do ERP, antes do override manual
    numeroNF?: string;
    convenio?: string;
    procedimento?: string;
    statusPedido?: string; // <- status real do pedido (ex: CANCELADO_ERP)
    erpExtractStatus?: ErpExtractStatus;
    origem: OrigemPedido; // APP (payload_enviado preenchido) ou PROTHEUS (ERP)
    filialCodigo?: string; // filial REAL do pedido: pedido.filial_erp (TOTVS e app) ou, na falta, o código da empresa dona — chave do filtro de Filial
    filialNome?: string; // rótulo p/ exibição, ex "SUPLEN MEDICAL MATRIZ"; cai no próprio código quando não há empresa cadastrada (ex: 0301)
    regiao?: string; // código da região do hospital (clientes.regiao) — rótulo via rotuloRegiao()
    dataEmissao?: string; // data de entrada do pedido (pedido.data_emissao) — vem SEMPRE com hora zerada (00:00:00), ver horaEmissao
    horaEmissao?: string; // hora local real da entrada, ex "15:31:58" (pedido.hora_emissao) — só pedidos novos (payload ajustado pelo Murilo em ~2026-08-19); pedidos antigos vêm sem esse campo
    ultimaAlteracao?: string; // timestamp ISO da última atualização do registro (pedido.ultima_alteracao)
    dataFaturamento?: string; // data (sem hora) da NF, gravada pelo backend desde ~2026-08 (pedido.data_faturamento)
    horaFaturamento?: string; // hora local da NF, ex "14:38:56" (pedido.hora_faturamento)
    faturamentoObservadoEm?: string; // fallback Fase 1 (localStorage): 1ª vez que o polling do front viu numeroNF preenchido, usado só quando dataFaturamento/horaFaturamento ainda não vêm do backend
    finalizadoObservadoEm?: string; // Fase 1 (localStorage): 1ª vez que o polling percebeu statusWorkflow === FINALIZADO, usado pro corte de visibilidade (ver aplicaCorteVisibilidade)
}

type OrigemPedido = "APP" | "PROTHEUS";

// `clientes.regiao` é um código solto vindo do TOTVS ("006", "009"...) e não
// existe tabela de catálogo que o traduza — sozinho ele não diz nada a quem lê
// a tela. As siglas abaixo saem do cruzamento de `clientes.regiao` com
// `endereco.uf` no banco (2026-09-11) e apontam o estado-SEDE de cada praça
// comercial (o de maior volume), não a totalidade dela:
//   009 -> DF  143 clientes, 100% Brasília/DF
//   006 -> GO  Goiânia (50 GO) + MS 17, MT 14, AM 1
//   008 -> MG  Belo Horizonte (40 MG) + SP 4, RJ 2
//   001 -> RO  Porto Velho (3 RO) + TO 2
//   007 -> PI  1 cliente
// Atenção: a sigla é a SEDE, não a cobertura — a 006 atende MS e MT, e a 008
// atende SP e RJ. Para recortar por estado de verdade seria preciso o `uf` do
// endereço do cliente, que hoje não vem na listagem de pedidos.
// Região desconhecida (código novo criado no ERP) cai no próprio código, em
// vez de exibir uma sigla errada.
const REGIAO_UF: Record<string, string> = {
    "001": "RO",
    "006": "GO",
    "007": "PI",
    "008": "MG",
    "009": "DF",
};
const rotuloRegiao = (codigo?: string): string => {
    const cod = (codigo ?? "").trim();
    if (!cod) return "—";
    const uf = REGIAO_UF[cod];
    return uf ? `${cod} — ${uf}` : cod;
};

// Uma "filial" é uma EMPRESA no cadastro (não há tabela própria de filial), e
// cada empresa tem um CÓDIGO de filial (empresas.filial, ex "0101").
//
// O filtro é chaveado pelo CÓDIGO, não pelo empresa_id, por um motivo de dados:
// todo pedido nativo do TOTVS fica pendurado na empresa MATRIZ — o que diz a
// filial de verdade dele é `pedido.filial_erp`. Chavear por empresa faria o
// filtro devolver zero pedido do ERP em qualquer filial que não a matriz
// (verificado no banco em 2026-08-19: 6.314 pedidos TOTVS, todos em MATRIZ,
// com filial_erp 0101 e 0301). Existem códigos sem empresa cadastrada — 0301
// (Neurovasc, para onde o backend desmembra itens Penumbra) é o caso real —
// então o rótulo cai no próprio código quando não há empresa correspondente.
interface Filial {
    codigo: string; // empresas.filial / pedido.filial_erp, ex "0101"
    nome: string;   // empresas.fantasia; cai no código quando não há empresa
    empresaId?: string; // usado só para buscar os pedidos daquela empresa
}

// Mensagem/comentário do pedido (CRUD real em /api-essencial/v1/pedidos-mensagem,
// substitui o antigo placeholder de Observações em localStorage).
interface PedidoMensagem {
    id: string;
    pedidoId: string;
    usuarioId: string;
    mensagem: string;
    criadoEm?: string;
    autor?: string;
    autorEmail?: string;
}

// Material (item) do pedido — o que o vendedor pediu. Vem do GET /pedidos/:id,
// único endpoint que devolve item_pedido junto com o produto (nome/código); a
// listagem que alimenta o mapa (/pedidos/:id_empresa/empresa) não traz itens.
interface MaterialPedido {
    id: string;
    descricao: string;
    codigo?: string;
    quantidade: number;
}

function normalizaMateriais(pedido: any): MaterialPedido[] {
    const itens: any[] = Array.isArray(pedido?.item_pedido) ? pedido.item_pedido : [];
    return itens
        .filter((i) => !i?.excluido)
        .map((i, idx) => ({
            id: (i?.item_pedido_id ?? `${i?.produto_id ?? "item"}-${idx}`).toString(),
            descricao: (i?.produtos?.nome || i?.produtos?.apelido || i?.produtos?.referencia || "Produto sem descrição").toString().trim(),
            codigo: (i?.produtos?.codigo ?? "").toString().trim() || undefined,
            quantidade: Number(i?.quantidade ?? 0) || 0,
        }))
        // Maior quantidade primeiro: é o que a logística confere antes.
        .sort((a, b) => b.quantidade - a.quantidade || a.descricao.localeCompare(b.descricao));
}

type ErpExtractKind = "CONSIGNADO" | "CIRURGIA";

interface ErpExtractStatus {
    kind: ErpExtractKind;
    code: string;
    label: string;
    colorName: string;
    color: string;
    workflow: StatusWorkflow;
}

// ─── Config visual ────────────────────────────────────────────────────────────
// A ordem daqui é a ordem das baias no Kanban E o ranking do fluxo: o status do
// pedido é sempre o de MAIOR índice entre as fontes (situacao, extrato do ERP,
// entrega em rota, override manual). NOTA FISCAL vem ANTES de ENTREGUE — a nota
// sai antes da carga chegar, então o pedido entregue não pode regredir pra baia
// da NF.
const STATUS_LIST: StatusWorkflow[] = [
    "AGENDADO", "EM_ROTA", "NOTA_FISCAL", "ENTREGUE",
    "APONTADO_REALIZADO", "AGUARDANDO_DEVOLUCAO", "FINALIZADO",
];

const TIPOS: TipoCirurgia[] = ["URGENCIA", "ELETIVA", "CONSIGNADO", "VENDA"];

// Situações que o backend grava quando o pedido deixa de valer no TOTVS.
// São DUAS strings, não uma: excluir o pedido no Protheus grava EXCLUIDO_ERP e
// cancelar grava CANCELADO_ERP (ver STATUS_BAIXA_ERP no webhook do ESF-API).
// Comparar só com CANCELADO_ERP — o que estas telas faziam — deixava o pedido
// EXCLUÍDO passar como ativo: card colorido, opacidade cheia e ainda piscando
// como pedido novo, mesmo já apagado no ERP.
const SITUACOES_PEDIDO_BAIXADO = ["EXCLUIDO_ERP", "CANCELADO_ERP"];

const ehPedidoBaixadoNoErp = (situacao?: string): boolean =>
    SITUACOES_PEDIDO_BAIXADO.includes(String(situacao ?? "").trim().toUpperCase());

// Opções do filtro de tipo (multi-select) — rótulos com acento, como no select antigo.
const TIPO_FILTER_OPTIONS: [TipoCirurgia, string][] = [
    ["URGENCIA", "URGÊNCIA"], ["ELETIVA", "ELETIVA"], ["CONSIGNADO", "CONSIGNADO"], ["VENDA", "VENDA"],
];

// Baias que só existem na consignação OPME: o material vai ao hospital, parte é
// utilizada (apontada) e o resto volta. Num laticínio o produto é vendido,
// faturado e entregue — não há apontamento nem devolução. Elas seguem no código
// porque a SUPLEN usa o mesmo componente, mas só aparecem (baia do Kanban e
// opção do filtro de status) quando há pedido nelas.
const BAIAS_OPME: StatusWorkflow[] = ["APONTADO_REALIZADO", "AGUARDANDO_DEVOLUCAO"];

const STATUS_CFG: Record<StatusWorkflow, { label: string; dotColor: string; textColor: string; textDark: string; icon?: any; empty: string }> = {
    AGENDADO:             { label: "AGENDADO",              dotColor: "#ED8936", textColor: "#ED8936", textDark: "#C05621", icon: FaRegCalendarAlt,    empty: "Pedidos agendados aparecerão aqui." },
    NOTA_FISCAL:          { label: "NOTA FISCAL",           dotColor: "#4299E1", textColor: "#4299E1", textDark: "#2B6CB0", icon: FaFileInvoiceDollar, empty: "Pedidos faturados aparecerão aqui." },
    EM_ROTA:              { label: "EM ROTA",               dotColor: "#ECC94B", textColor: "#ECC94B", textDark: "#B7791F", icon: FaRoute,             empty: "Pedidos enviados para entrega aparecerão aqui." },
    ENTREGUE:             { label: "ENTREGUE",              dotColor: "#48BB78", textColor: "#48BB78", textDark: "#276749", icon: FaTruck,             empty: "Pedidos entregues aparecerão aqui." },
    APONTADO_REALIZADO:   { label: "APONTADO / REALIZADO",  dotColor: "#B794F4", textColor: "#B794F4", textDark: "#553C9A", icon: FaClipboardCheck,    empty: "Itens apontados ou realizados aparecerão aqui." },
    AGUARDANDO_DEVOLUCAO: { label: "AGUARDANDO DEVOLUÇÃO",  dotColor: "#FC8181", textColor: "#FC8181", textDark: "#C53030", icon: FaUndoAlt,           empty: "Itens aguardando devolução aparecerão aqui." },
    FINALIZADO:           { label: "AGUARDANDO FATURAMENTO", dotColor: "#68D391", textColor: "#68D391", textDark: "#22543D",                          empty: "Pedidos aguardando faturamento aparecerão aqui." },
};

const ERP_COLOR_HEX: Record<string, string> = {
    GREEN: "#48BB78",
    YELLOW: "#ECC94B",
    RED: "#FC8181",
    BLACK: "#1A202C",
    WHITE: "#F7FAFC",
    BLUE: "#4299E1",
    GRAY: "#A0AEC0",
};

const ERP_EXTRACT_STATUS_CFG: Record<ErpExtractKind, Record<string, { label: string; colorName: string; workflow: StatusWorkflow }>> = {
    CONSIGNADO: {
        "1": { label: "Aberto", colorName: "GREEN", workflow: "AGENDADO" },
        "2": { label: "Parcial", colorName: "YELLOW", workflow: "AGUARDANDO_DEVOLUCAO" },
        "3": { label: "Finalizado", colorName: "RED", workflow: "FINALIZADO" },
        "4": { label: "Outros pedidos", colorName: "BLACK", workflow: "AGENDADO" },
    },
    CIRURGIA: {
        // "Todos disponíveis": material entregue, cirurgia ainda não apontou. Não
        // avança a coluna (Em Separação/Entregue vêm de outra fonte). workflow=AGENDADO
        // faz o max() manter a baia atual do pedido.
        "1": { label: "TODOS DISPONIVEIS", colorName: "GREEN", workflow: "AGENDADO" },
        "2": { label: "UTILIZADO PARCIAL", colorName: "WHITE", workflow: "AGUARDANDO_DEVOLUCAO" },
        "3": { label: "SOMENTE UTILIZADOS", colorName: "BLUE", workflow: "APONTADO_REALIZADO" },
        "4": { label: "MISTO", colorName: "GRAY", workflow: "AGUARDANDO_DEVOLUCAO" },
        "5": { label: "TODOS FINALIZADOS", colorName: "RED", workflow: "FINALIZADO" },
        // "Não encontrados": pendência do ERP, não é fluxo normal. Não avança a
        // coluna (mesma regra do código 1).
        "6": { label: "TODOS NAO ENCONTRADOS", colorName: "BLACK", workflow: "AGENDADO" },
    },
};

const ITEMS_PER_PAGE = 10;

// Bug confirmado no sync do botão "Atualizar ERP" (ver memória
// erp-sync-status-cirurgia): o endpoint que consulta o Protheus lê a
// NOTA_FISCAL da resposta mas só grava status_cirurgia/status_consignado no
// banco — a NF nunca chega em nota_erp. O pedido fica com situacao=INTEGRADO
// pra sempre (o webhook que promoveria pra FATURADO+nota_erp não dispara pra
// esses) e trava no mapa como "pendente" mesmo já faturado no TOTVS.
// Sinal: já foi sincronizado ao menos uma vez (status_consignado OU
// status_cirurgia preenchido) mas nunca saiu de INTEGRADO. Regra geral
// (2026-08-28, pedido do usuário) — substitui a lista fixa pontual de
// 2026-08-27 (105 pedidos), que não cobria casos futuros na mesma situação e
// já tinha voltado a acontecer 1 dia depois. Trade-off aceito pelo usuário:
// uma fração pequena (~4%, ver erp-sync-status-cirurgia) desses casos pode
// ser bloqueio real no TOTVS ainda não faturado (ex.: pedido 074754,
// estoque) — a regra geral de corte deixa pedido sem NF visível de propósito
// pra não esconder bloqueio real (ver totvs-legenda-bloqueio-pendencia), e
// essa exceção aqui abre mão dessa visibilidade pros casos que batem o
// padrão do bug.
function pedidoTravadoSyncSemNF(pedido?: {
    situacao?: string | null;
    nota_erp?: string | null;
    status_consignado?: string | null;
    status_cirurgia?: string | null;
    payload_enviado?: unknown;
} | null): boolean {
    if (!pedido) return false;
    // Pedido do app (payload_enviado preenchido) NUNCA entra neste corte
    // (2026-09-02, pedido do usuario): o bug de sync descrito acima atinge
    // pedido NATIVO do ERP, que ja tem NF no TOTVS e so nao a recebeu aqui.
    // Pedido nascido no app sem NF e o caso oposto -- cirurgia ainda por
    // faturar, que a LOGISTICA precisa enxergar pra separar o material antes
    // da nota sair. Esconde-lo deixava a cirurgia sem separacao (ex.: 003347,
    // 003374, 003375, 003395, da NeuroVasc). Na base atual o corte separa bem:
    // 202 pedidos do ERP (travados desde set/2024) contra 10 do app, todos
    // recentes e legitimos.
    if (pedido.payload_enviado) return false;
    const semNF = !pedido.nota_erp || String(pedido.nota_erp).trim() === "";
    const jaSincronizouErp = !!pedido.status_consignado || !!pedido.status_cirurgia;
    return pedido.situacao === "INTEGRADO" && semNF && jaSincronizouErp;
}

// Chave do localStorage onde guardamos os status manuais da logística.
const OVERRIDES_KEY = "surgicalMapStatusOverrides";

// Chave do localStorage onde guardamos a 1ª vez que o polling percebeu um
// pedido com NF preenchida. "V2": nome novo de propósito — a V1 (mesmo dia)
// tinha um bug que carimbava pedidos já faturados no 1º poll pós-deploy como
// se a NF tivesse acabado de sair; ver registrarFaturamentoObservado.
const FATURAMENTO_OBSERVADO_KEY = "surgicalMapFaturamentoObservadoV2";

// Chave do localStorage com os pedidos já vistos SEM NF em algum poll
// anterior — prova necessária pra confiar no carimbo acima.
const VISTOS_SEM_NF_KEY = "surgicalMapVistosSemNF";

// Mesmo mecanismo (carimbo + prova de transição), agora pra saber quando um
// pedido de fluxo cirúrgico completo (urgência/eletiva) ENTROU na baia
// FINALIZADO — usado só pelo corte de visibilidade (ver aplicaCorteVisibilidade
// e registrarFinalizadoObservado). Não existe campo do backend pra isso hoje.
const FINALIZADO_OBSERVADO_KEY = "surgicalMapFinalizadoObservadoV1";
const VISTOS_NAO_FINALIZADO_KEY = "surgicalMapVistosNaoFinalizado";

const RowFlex = Flex as React.ComponentType<any>;
const RowBox = Box as React.ComponentType<any>;
const RowText = Text as React.ComponentType<any>;

function normalizeErpStatusCode(value: any): string | undefined {
    const raw = typeof value === "object" && value !== null
        ? (value.codigo ?? value.code ?? value.status ?? value.valor ?? value.value)
        : value;
    const code = raw == null ? "" : String(raw).trim();
    const match = code.match(/\d+/);
    return match?.[0];
}

function readFirstValue(sources: any[], keys: string[]): any {
    for (const source of sources) {
        if (!source || typeof source !== "object") continue;
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(source, key) && source[key] != null) {
                return source[key];
            }
        }
    }
    return undefined;
}

function buildErpExtractStatus(kind: ErpExtractKind, code?: string): ErpExtractStatus | undefined {
    if (!code) return undefined;
    const cfg = ERP_EXTRACT_STATUS_CFG[kind][code];
    if (!cfg) return undefined;
    return {
        kind,
        code,
        label: cfg.label,
        colorName: cfg.colorName,
        color: ERP_COLOR_HEX[cfg.colorName] || "#CBD5E0",
        workflow: cfg.workflow,
    };
}

function erpExtractStatusOf(pedido: any, payload: any, tipo: TipoCirurgia): ErpExtractStatus | undefined {
    const sources = [pedido, payload, pedido?.extrato, payload?.extrato, pedido?.retorno_erp, payload?.retorno_erp];
    const consignadoCode = normalizeErpStatusCode(readFirstValue(sources, [
        "STATUS_CONSIGNADO", "status_consignado", "statusConsignado",
    ]));
    const cirurgiaCode = normalizeErpStatusCode(readFirstValue(sources, [
        "STATUS_CIRURGIA", "status_cirurgia", "statusCirurgia",
    ]));

    const preferred: ErpExtractKind[] = (tipo === "CONSIGNADO" || tipo === "VENDA")
        ? ["CONSIGNADO", "CIRURGIA"]
        : ["CIRURGIA", "CONSIGNADO"];

    for (const kind of preferred) {
        const status = buildErpExtractStatus(kind, kind === "CONSIGNADO" ? consignadoCode : cirurgiaCode);
        if (status) return status;
    }

    return undefined;
}

function situacaoParaStatus(situacao?: string, nota_erp?: string | null): StatusWorkflow {
    const map: Record<string, StatusWorkflow> = {
        AGENDAMENTO:          "AGENDADO",
        AGENDADO:             "AGENDADO",
        NOTA_FISCAL:          "NOTA_FISCAL",
        FATURADO:             "NOTA_FISCAL",
        EM_ROTA:              "EM_ROTA",
        ENTREGUE:             "ENTREGUE",
        APONTADO_REALIZADO:   "APONTADO_REALIZADO",
        AGUARDANDO_DEVOLUCAO: "AGUARDANDO_DEVOLUCAO",
        FINALIZADO:           "FINALIZADO",
    };
    // Se tem NF emitida mas o status ainda não atualizou, garante NOTA_FISCAL
    if (!map[situacao ?? ""] && nota_erp) return "NOTA_FISCAL";
    const s = map[situacao ?? ""];
    return STATUS_LIST.includes(s) ? s : "AGENDADO";
}

function normalizaTipo(v?: string): TipoCirurgia {
    if (!v) return "ELETIVA";
    const upper = v.toUpperCase();
    if (upper === "URGENCIA") return "URGENCIA";
    // VALE_PERMANENTE \u00e9 o tipo_pedido cru do TOTVS pros pedidos de consigna\u00e7\u00e3o
    // feitos direto no ERP (sem payload do app) \u2014 mesmo conceito de CONSIGNADO.
    if (upper === "CONSIGNADO" || upper === "CONSIGNACAO" || upper === "CONSIGNA\u00c7\u00c3O"
        || upper === "VALE_PERMANENTE" || upper === "VALE PERMANENTE") return "CONSIGNADO";
    if (upper === "ELETIVA" || upper === "ELETIVO") return "ELETIVA";
    if (upper === "VENDA" || upper === "VENDAS") return "VENDA";
    return "ELETIVA";
}

// Pedido feito direto no TOTVS (sem payload do app): por ora s\u00f3 entram no mapa
// os tipos ELETIVA, URGENCIA e CONSIGNADO/VALE_PERMANENTE (decis\u00e3o de neg\u00f3cio) \u2014
// VENDA feito direto no ERP fica de fora por enquanto.
function tipoErpNativoPermitido(rawTipo?: string): boolean {
    const upper = (rawTipo ?? "").toString().toUpperCase().trim();
    return upper === "ELETIVA" || upper === "ELETIVO"
        || upper === "URGENCIA"
        || upper === "VALE_PERMANENTE" || upper === "VALE PERMANENTE"
        || upper === "CONSIGNADO" || upper === "CONSIGNACAO" || upper === "CONSIGNA\u00c7\u00c3O";
}

function normalizaPayload(bruto: any): any {
    if (typeof bruto === "string") {
        try { return JSON.parse(bruto) || undefined; } catch { return undefined; }
    }
    return bruto || undefined;
}

/**
 * Dados da cirurgia (paciente, médico, convênio, data/hora do procedimento) que
 * vieram no payload do pedido.
 *
 * Duas fontes, nesta ordem:
 *
 * - `payload_enviado` — o que o APP mandou ao Protheus. Existe só em pedido
 *   nascido no app, e traz C5_PACIENT/C5_CODMEDI/C5_CODCONV preenchidos. É por
 *   isso que a cirurgia feita pelo app aparece completa no mapa.
 * - `payload_recebido` — o que o Protheus manda de volta pelo webhook. Hoje o
 *   ERP envia só o essencial de faturamento (status, nota, série, filial,
 *   pedido, data/hora), SEM paciente e SEM médico — e é exatamente por isso que
 *   pedido ELETIVA/URGENCIA lançado direto no Protheus chega ao mapa sem esses
 *   campos, mesmo o pessoal tendo preenchido no ERP.
 *
 * Ler as duas não conserta o que falta: o dado não existe no que chega. O que
 * isto faz é deixar a tela PRONTA — no dia em que o Protheus passar a incluir
 * esses campos no webhook (e o ESF-API a aceitá-los), o mapa exibe sozinho, sem
 * precisar de alteração aqui. Enquanto isso o comportamento é idêntico ao de
 * antes, porque as chaves simplesmente não vêm.
 */
/**
 * Primeiro valor não-vazio entre várias chaves possíveis do payload.
 *
 * Existe porque o campo tem nome diferente conforme a fonte: o app escreve no
 * nome da COLUNA do Protheus (C5_PACIENT), enquanto o webhook do ERP, quando
 * passar a mandar, tende a usar o nome em snake_case do próprio contrato
 * (paciente, medico_codigo...) — é assim que ele já manda pedido_erp,
 * cliente_cnpj e vendedor_codigo. Aceitar as duas grafias evita ter que voltar
 * aqui quando o formato for definido.
 */
function doPayload(payload: any, ...chaves: string[]): string {
    for (const chave of chaves) {
        const valor = (payload?.[chave] ?? "").toString().trim();
        if (valor) { return valor; }
    }
    return "";
}

function parsePayload(pedido: any): any {
    const doApp = normalizaPayload(pedido?.payload_enviado);
    const doErp = normalizaPayload(pedido?.payload_recebido);
    if (!doApp) { return doErp; }
    if (!doErp) { return doApp; }
    // O do app tem prioridade: foi ele quem escreveu a cirurgia. O do ERP entra
    // por baixo, preenchendo o que o app não mandou.
    return { ...doErp, ...doApp };
}

// Normaliza uma linha crua de /pedidos-mensagem para o formato usado na tela.
// O nome exato do campo de data/hora não é garantido pelo backend, então tenta
// os formatos mais prováveis (mesmo espírito de normalizeErpStatusCode acima).
function normalizePedidoMensagem(raw: any): PedidoMensagem | undefined {
    if (!raw) return undefined;
    const id = raw.pedido_mensagem_id ?? raw.id ?? raw.mensagem_id;
    const pedidoId = raw.pedido_id ?? raw.pedidoId;
    const mensagem = raw.mensagem ?? raw.texto;
    if (id == null || pedidoId == null || mensagem == null) return undefined;
    const usuarios = raw.usuarios ?? raw.usuario ?? {};
    // A API separa data e hora em colunas diferentes: data_mensagem vem como
    // meia-noite UTC ("2026-08-19T00:00:00.000Z", só a data importa) e
    // hora_mensagem é o horário local puro ("10:28:21") — junta os dois pra
    // formar um timestamp exibível.
    let criadoEm: string | undefined = raw.criado_em ?? raw.criadoEm ?? raw.data_hora ?? raw.dataHora ?? raw.created_at ?? undefined;
    if (!criadoEm && raw.data_mensagem) {
        const dataParte = String(raw.data_mensagem).substring(0, 10);
        criadoEm = raw.hora_mensagem ? `${dataParte}T${raw.hora_mensagem}` : String(raw.data_mensagem);
    }
    return {
        id: String(id),
        pedidoId: String(pedidoId),
        usuarioId: String(raw.usuario_id ?? raw.usuarioId ?? usuarios.usuario_id ?? usuarios.id ?? ""),
        mensagem: String(mensagem),
        criadoEm,
        autor: usuarios.name ?? usuarios.nome ?? undefined,
        autorEmail: usuarios.email ?? undefined,
    };
}

function tipoDoPedido(pedido: any): TipoCirurgia {
    const payload = parsePayload(pedido);
    return normalizaTipo(payload?.TIPO_PEDIDO || pedido?.tipo_pedido);
}

// Só eletiva e urgência têm cirurgia (rota, apontamento, devolução). Os
// demais (consignado, venda, vale permanente) vão direto ao hospital e só seguem
// AGENDADO → NOTA FISCAL → ENTREGUE — não acompanham o restante do fluxo. Decidido
// pelo TIPO_PEDIDO cru (não pelo tipo normalizado, que cai em ELETIVA quando é
// desconhecido, como "vale permanente"). Espelha o backend (`tiposComAgendamento`).
function tipoTemFluxoCirurgico(pedido: any): boolean {
    const payload = parsePayload(pedido);
    const raw = (payload?.TIPO_PEDIDO ?? pedido?.tipo_pedido ?? "").toString().toUpperCase().trim();
    return raw === "URGENCIA" || raw === "ELETIVA" || raw === "ELETIVO";
}

// Baias permitidas para os tipos sem cirurgia. EM ROTA entra aqui porque não
// depende do extrato do ERP: quem diz que a carga saiu é o módulo de entregas,
// e consignado/venda também vão para a rua.
const STATUS_REDUZIDO: StatusWorkflow[] = ["AGENDADO", "EM_ROTA", "NOTA_FISCAL", "ENTREGUE"];

// Baias que a entrega tem permissão de sobrescrever. Fora daí (apontamento,
// devolução, faturamento) o pedido já andou além da logística e não regride.
const BAIAS_ANTES_DA_ENTREGA: StatusWorkflow[] = ["AGENDADO", "EM_ROTA", "NOTA_FISCAL"];

/**
 * Baia vinda do MÓDULO DE ENTREGAS, que é a fonte de verdade de EM ROTA e
 * ENTREGUE — nenhum dos dois existe nos códigos do ERP. `statusEntrega` é o
 * status da carga (COLETADO/EM_ROTA/ENTREGUE/CANCELADO); COLETADO e CANCELADO
 * não têm baia própria hoje e deixam o pedido onde estava.
 */
function baiaDaEntrega(statusEntrega: string | undefined, base: StatusWorkflow): StatusWorkflow | null {
    if (statusEntrega === "ENTREGUE" && [...BAIAS_ANTES_DA_ENTREGA, "ENTREGUE"].includes(base)) return "ENTREGUE";
    if (statusEntrega === "EM_ROTA" && BAIAS_ANTES_DA_ENTREGA.includes(base)) return "EM_ROTA";
    return null;
}

function statusWorkflowDoPedido(pedido: any, payload: any, tipo: TipoCirurgia, statusEntrega?: string): StatusWorkflow {
    const base = situacaoParaStatus(pedido?.situacao, pedido?.nota_erp);
    const daEntrega = baiaDaEntrega(statusEntrega, base);

    // Consignado/venda/vale permanente: ignora o extrato do ERP (status_cirurgia/
    // status_consignado) e restringe às baias do fluxo reduzido. Qualquer status
    // avançado (rota/apontado/devolução/finalizado) não se aplica: com NF cai
    // em NOTA FISCAL, senão volta pra AGENDADO.
    if (!tipoTemFluxoCirurgico(pedido)) {
        // A entrega vale para TODO tipo de pedido: assim que o motorista inicia
        // a viagem (POST /entregas/iniciar-rota) ou confirma a chegada, o card
        // anda mesmo sendo consignado/venda. A NF, essa sim, perde para a rota.
        if (daEntrega) return daEntrega;
        if (STATUS_REDUZIDO.includes(base)) return base;
        return pedido?.nota_erp ? "NOTA_FISCAL" : "AGENDADO";
    }

    // A entrega vence AGENDADO/NOTA FISCAL — e isso independe da NF local: se a
    // API de entregas colocou a cirurgia na rua (ou já a deu por entregue), a
    // baia precisa acompanhar mesmo durante uma defasagem de sincronização com
    // o ERP. O que ela nunca faz é regredir um pedido que já passou da entrega.
    const comRota = daEntrega || base;

    // Sem NF não dá pra confiar no status avançado do apontamento — o pedido
    // pode estar "finalizado" no extrato mas travado no TOTVS por bloqueio de
    // crédito/estoque (ver [[totvs-legenda-bloqueio-pendencia]] na memória),
    // então sem nota o status fica no base (normalmente AGENDADO), mesmo que
    // o extrato já tenha avançado.
    if (!pedido?.nota_erp) return comRota;

    const extrato = erpExtractStatusOf(pedido, payload, tipo);
    if (!extrato) return comRota;
    return STATUS_LIST.indexOf(extrato.workflow) > STATUS_LIST.indexOf(comRota)
        ? extrato.workflow
        : comRota;
}

function normalizeHoraCirurgia(value: any): string | undefined {
    const raw = value == null ? "" : String(value).trim();
    if (!raw) return undefined;

    // ISO datetime COM fuso (Z ou +/-hh:mm): o TOTVS grava em UTC, então
    // precisamos reprojetar para o horário de Brasília — senão a hora sai
    // adiantada (ex.: 16:30Z apareceria como 16:30 em vez de 13:30).
    if (/T\d{2}:\d{2}/.test(raw) && /(Z|[+-]\d{2}:?\d{2})$/.test(raw)) {
        const dt = DateTime.fromISO(raw).setZone("America/Sao_Paulo");
        if (dt.isValid) return dt.toFormat("HH:mm");
    }

    // ISO datetime SEM fuso (ou qualquer outro T HH:MM): usa a hora literal.
    const isoTime = raw.match(/T(\d{2}):(\d{2})/);
    if (isoTime) return `${isoTime[1]}:${isoTime[2]}`;

    const compact = raw.match(/^(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}:${compact[2]}`;

    const regular = raw.match(/(\d{1,2}):(\d{2})/);
    if (regular) return `${regular[1].padStart(2, "0")}:${regular[2]}`;

    return raw;
}

/**
 * Data do procedimento vinda do payload, em ISO (AAAA-MM-DD).
 *
 * Só entra quando não há agendamento — caso do pedido lançado direto no
 * Protheus. Aceita "AAAAMMDD" (formato de data do ERP), "AAAA-MM-DD" e
 * "DD/MM/AAAA"; qualquer outra coisa é descartada em vez de virar data inválida
 * no filtro de período.
 */
function dataProcedimentoDoPayload(payload: any): string | undefined {
    const bruto = doPayload(payload, "C5_DTPROCE", "data_procedimento", "data_agendamento", "dataProcedimento");
    if (!bruto) { return undefined; }

    const soDigitos = bruto.replace(/\D/g, "");
    if (/^\d{4}-\d{2}-\d{2}/.test(bruto)) { return bruto.substring(0, 10); }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(bruto)) {
        const [dia, mes, ano] = bruto.split("/");
        return `${ano}-${mes}-${dia}`;
    }
    if (soDigitos.length === 8) {
        return `${soDigitos.slice(0, 4)}-${soDigitos.slice(4, 6)}-${soDigitos.slice(6, 8)}`;
    }
    return undefined;
}

function horaCirurgiaDoPedido(pedido: any, payload: any): string | undefined {
    const agendamento = Array.isArray(pedido?.agendamentos) ? pedido.agendamentos[0] : pedido?.agendamento;
    return normalizeHoraCirurgia(
        agendamento?.hora_agendamento ||
        pedido?.hora_agendamento ||
        pedido?.horaAgendamento ||
        payload?.C5_HRPROC ||
        payload?.horaAgendamento ||
        payload?.hora_agendamento ||
        payload?.horaProcedimento
        // NÃO cair em previsao_entrega: é coluna `date` (sem hora) e, pior, o
        // webhook do ERP a sobrescreve com a data de emissão dele
        // (ESF-API, processarWebhookPedidoUseCase). Como ela chega em meia-noite
        // UTC, o normalize devolvia "21:00" pra todo pedido sem hora real —
        // hora inventada em cima de uma data que nem é a da cirurgia.
    );
}

// ─── Tempo de permanência do pedido no sistema ─────────────────────────────────
// aberto/atencao/atrasado = ainda sem NF (contagem "ao vivo", cresce por hora e
// depois por dia); faturado = já saiu a NF, contagem parada.
type TempoState = "aberto" | "atencao" | "atrasado" | "faturado";

// Fase 1 (localStorage, mesmo padrão de OVERRIDES_KEY) — MANTIDO SÓ COMO
// FALLBACK. Motivo histórico: até ~2026-08-12 não existia timestamp real de
// emissão de NF no banco (data_faturamento sempre NULL, ver [[bi-view-mapa]])
// e ultima_alteracao é poluído por syncs em lote não relacionados à NF (ex.:
// botão "Atualizar ERP" tocando o registro meses depois) — comprovado em
// 2026-08-10, vários pedidos faturados em datas bem diferentes compartilhavam
// o EXATO mesmo ultima_alteracao (timestamp de um sync em massa), não o
// momento real da NF.
//
// Desde ~2026-08-13 o backend passou a gravar data_faturamento (date) +
// hora_faturamento (varchar) no momento real da NF (verificado no Postgres em
// 2026-08-19: ~75% dos pedidos faturados nos últimos 10 dias já vêm com os
// dois campos preenchidos, tanto pedidos do app quanto nativos do ERP). Por
// isso tempoNoSistema() usa esses campos como fonte primária (fimFaturamentoReal)
// e só cai no carimbo client-side abaixo quando o backend ainda não preencheu.
//
// O mecanismo client-side: como o front já faz polling a cada 3min
// ([[data-flow-pedidos]]), ele mesmo grava o momento em que percebe numeroNF
// preenchido pra cada pedido — vira uma aproximação (± intervalo de polling)
// do momento real da NF, sem depender do backend.
//
// CUIDADO: só pode carimbar "agora" se já tiver visto esse MESMO pedido SEM
// NF numa poll anterior (prova de que a transição aconteceu sob observação).
// Sem essa prova, "agora" só significa "1ª vez que essa versão do código
// rodou" — pega pedidos que JÁ estavam faturados há dias e carimba o
// deploy como se fosse a NF (bug real, corrigido em 2026-08-10 antes de
// qualquer marca ter sido persistida). Por isso o registro fica em 2 etapas:
// 1) marca "visto sem NF" quando pendente, 2) só carimba a NF quando a MESMA
// chave já estava marcada como "visto sem NF" antes.
function registrarFaturamentoObservado(items: Scheduling[]): Scheduling[] {
    let vistosSemNF: Record<string, true> = {};
    let faturamento: Record<string, string> = {};
    try {
        vistosSemNF = JSON.parse(localStorage.getItem(VISTOS_SEM_NF_KEY) || "{}");
    } catch { /* ignore */ }
    try {
        faturamento = JSON.parse(localStorage.getItem(FATURAMENTO_OBSERVADO_KEY) || "{}");
    } catch { /* ignore */ }

    let vistosMudou = false;
    let faturamentoMudou = false;
    const agora = DateTime.now().toISO() as string;

    const resultado = items.map(item => {
        const chave = item.pedidoProtheus || item.id;

        if (!item.numeroNF) {
            if (!vistosSemNF[chave]) {
                vistosSemNF[chave] = true;
                vistosMudou = true;
            }
            return item;
        }

        if (vistosSemNF[chave] && !faturamento[chave]) {
            faturamento[chave] = agora;
            faturamentoMudou = true;
        }
        return faturamento[chave] ? { ...item, faturamentoObservadoEm: faturamento[chave] } : item;
    });

    if (vistosMudou) {
        try { localStorage.setItem(VISTOS_SEM_NF_KEY, JSON.stringify(vistosSemNF)); } catch { /* ignore */ }
    }
    if (faturamentoMudou) {
        try { localStorage.setItem(FATURAMENTO_OBSERVADO_KEY, JSON.stringify(faturamento)); } catch { /* ignore */ }
    }

    return resultado;
}

// Mesmo algoritmo de registrarFaturamentoObservado, mas carimbando a entrada
// em FINALIZADO em vez da NF — ver comentário da chave FINALIZADO_OBSERVADO_KEY.
function registrarFinalizadoObservado(items: Scheduling[]): Scheduling[] {
    let vistosNaoFinalizado: Record<string, true> = {};
    let finalizado: Record<string, string> = {};
    try {
        vistosNaoFinalizado = JSON.parse(localStorage.getItem(VISTOS_NAO_FINALIZADO_KEY) || "{}");
    } catch { /* ignore */ }
    try {
        finalizado = JSON.parse(localStorage.getItem(FINALIZADO_OBSERVADO_KEY) || "{}");
    } catch { /* ignore */ }

    let vistosMudou = false;
    let finalizadoMudou = false;
    const agora = DateTime.now().toISO() as string;

    const resultado = items.map(item => {
        const chave = item.pedidoProtheus || item.id;

        if (item.statusWorkflow !== "FINALIZADO") {
            if (!vistosNaoFinalizado[chave]) {
                vistosNaoFinalizado[chave] = true;
                vistosMudou = true;
            }
            return item;
        }

        if (vistosNaoFinalizado[chave] && !finalizado[chave]) {
            finalizado[chave] = agora;
            finalizadoMudou = true;
        }
        return finalizado[chave] ? { ...item, finalizadoObservadoEm: finalizado[chave] } : item;
    });

    if (vistosMudou) {
        try { localStorage.setItem(VISTOS_NAO_FINALIZADO_KEY, JSON.stringify(vistosNaoFinalizado)); } catch { /* ignore */ }
    }
    if (finalizadoMudou) {
        try { localStorage.setItem(FINALIZADO_OBSERVADO_KEY, JSON.stringify(finalizado)); } catch { /* ignore */ }
    }

    return resultado;
}

// ─── Corte de visibilidade (pedidos concluídos somem do mapa/kanban) ──────────
// Motivo: o mapa/kanban não é histórico de consulta (isso é papel da Lista de
// Pedidos) — mas hoje ele acumula pra sempre todo pedido já faturado, o que só
// vai pesar mais conforme mais filiais entrarem (fetch sem corte de data no
// backend, ver ListarPedidosUseCase). Regra combinada com o usuário
// (2026-08-20): pedidos ainda em andamento (sem NF, ou em qualquer baia do
// fluxo cirúrgico antes de FINALIZADO) NUNCA são cortados — só some quem já
// não tem mais nada a acompanhar.
const JANELA_CORTE_FLUXO_REDUZIDO_HORAS = 30 * 24; // consignado/venda: não têm baia FINALIZADO (ver tipoTemFluxoCirurgico) — somem 30 dias após a NF. Era 48h, mas na prática o pedido saía da tela quase junto com a nota (venda é faturada no mesmo dia) e a operação perdia o acompanhamento; um mês cobre o ciclo de conferência sem deixar o mapa crescer pra sempre
const JANELA_CORTE_FINALIZADO_HORAS = 72; // urgência/eletiva: somem N horas após ENTRAR em FINALIZADO (não desde a NF — rota/entrega/apontamento/devolução podem levar dias)
// Rede de segurança compartilhada: pedido cujo momento de referência (NF ou
// entrada em FINALIZADO) a gente nunca chegou a OBSERVAR — nem veio do
// backend (data_faturamento só existe pra NFs emitidas depois de ~13/08) nem
// foi carimbado no client (faturamentoObservadoEm/finalizadoObservadoEm só
// gravam quando o polling VÊ a transição acontecer; um pedido que já estava
// faturado/finalizado antes deste recurso existir nunca vai ganhar o carimbo).
// Sem nenhum dos dois não dá pra medir 24h/72h de verdade — usa um ponto
// anterior confiável (criação do pedido ou NF) como piso, com uma janela BEM
// mais larga: nunca corta algo recente (30 dias não passa nem perto de "há
// pouco"), só evita que esse backlog fique acumulado pra sempre.
const JANELA_CORTE_SEM_CARIMBO_HORAS = 30 * 24;

function momentoFaturamento(item: Scheduling): DateTime | null {
    return fimFaturamentoReal(item)
        ?? (item.faturamentoObservadoEm ? DateTime.fromISO(item.faturamentoObservadoEm) : null);
}

// Mesmo momento acima, mas tolerante a hora_faturamento ausente — só pro
// corte de visibilidade (a UI de tempo, tempoNoSistema, continua exigindo
// data+hora pra não fabricar precisão ali). Uma parte dos pedidos faturados
// ainda vem só com a DATA (hora_faturamento vazio, ver [[bi-view-mapa]]);
// nesse caso usa o FIM do dia como referência — no pior caso (NF que saiu à
// noite) é "generoso demais" por até ~24h, mas nunca corta ANTES da janela
// real, e antigos sem hora deixam de ficar presos pra sempre no mapa.
function momentoFaturamentoParaCorte(item: Scheduling): DateTime | null {
    const preciso = momentoFaturamento(item);
    if (preciso) return preciso;
    const dia = dataCalendario(item.dataFaturamento);
    if (!dia) return null;
    const fimDoDia = DateTime.fromISO(dia).endOf("day");
    return fimDoDia.isValid ? fimDoDia : null;
}

function horasDesde(momento: DateTime | null): number | null {
    if (!momento || !momento.isValid) return null;
    return DateTime.now().diff(momento, "hours").hours;
}

function dentroDaJanela(momento: DateTime | null, janelaHoras: number): boolean {
    const horas = horasDesde(momento);
    // Sem momento confiável ainda: não corta (evita esconder pedido só porque
    // o timestamp de referência não chegou/foi percebido ainda).
    return horas == null || horas <= janelaHoras;
}

function aplicaCorteVisibilidade(items: Scheduling[]): Scheduling[] {
    return items.filter((item) => {
        if (!item.numeroNF) return true; // sem NF: sempre em andamento, nunca corta

        const semFluxoCirurgico = item.tipo === "CONSIGNADO" || item.tipo === "VENDA";
        if (semFluxoCirurgico) {
            const momento = momentoFaturamentoParaCorte(item);
            if (momento) return dentroDaJanela(momento, JANELA_CORTE_FLUXO_REDUZIDO_HORAS);
            // Faturado antes deste recurso existir, sem data_faturamento no banco
            // (NF anterior a ~13/08) e nunca observado pelo client: usa a criação
            // do pedido como piso (a NF sempre vem depois dela). Mesma janela de
            // 48h, não a rede de segurança larga — consignado/venda vai direto ao
            // hospital, o intervalo criação→NF é curto, então criação é uma boa
            // aproximação do momento real da NF (ao contrário do FINALIZADO
            // abaixo, onde rota/entrega/apontamento/devolução podem levar
            // dias e usar a criação cortaria cedo demais).
            const criado = item.dataEmissao ? DateTime.fromISO(item.dataEmissao) : null;
            return dentroDaJanela(criado, JANELA_CORTE_FLUXO_REDUZIDO_HORAS);
        }

        if (item.statusWorkflow === "FINALIZADO") {
            if (item.finalizadoObservadoEm) {
                return dentroDaJanela(DateTime.fromISO(item.finalizadoObservadoEm), JANELA_CORTE_FINALIZADO_HORAS);
            }
            // Backlog nunca observado transicionando: usa NF (se houver) ou
            // criação do pedido como piso, com a mesma rede de segurança.
            const momento = momentoFaturamentoParaCorte(item)
                ?? (item.dataEmissao ? DateTime.fromISO(item.dataEmissao) : null);
            return dentroDaJanela(momento, JANELA_CORTE_SEM_CARIMBO_HORAS);
        }

        return true; // ainda em rota/entrega/apontamento/devolução
    });
}

function formatTempoLabel(hours: number): string {
    return hours < 1
        ? (Math.round(hours * 60) <= 0 ? "agora" : `${Math.round(hours * 60)}min`)
        : hours < 24
            ? `${Math.floor(hours)}h`
            : `Dia ${Math.floor(hours / 24)}`;
}

// Data calendário de um campo que o backend manda como "dia", lida SEMPRE em
// UTC. Motivo (bug real, 2026-08-19): data_faturamento é `@db.Date` no Prisma,
// que serializa como MEIA-NOITE UTC ("2026-08-19T00:00:00.000Z"). Lido no fuso
// local (UTC-3) isso vira 21:00 do DIA ANTERIOR — e aplicar a hora da NF em
// cima desse dia errado fazia o fim cair antes do início, zerando o tempo
// (Math.max(0, ...)) e imprimindo "agora" em vez dos minutos/horas reais.
function dataCalendario(valor: string | undefined): string | null {
    if (!valor) return null;
    const d = DateTime.fromISO(String(valor), { zone: "utc" });
    return d.isValid ? d.toISODate() : null;
}

// Junta a data calendário (UTC, ver acima) com uma hora "HH:mm[:ss]" que o
// ERP grava já em horário de Brasília — por isso a hora é aplicada no fuso
// local, e só a data vem do UTC.
function combinarDataHora(data: string | undefined, hora: string | undefined): DateTime | null {
    const dia = dataCalendario(data);
    if (!dia || !hora) return null;
    const m = String(hora).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const combinado = DateTime.fromISO(`${dia}T${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`);
    return combinado.isValid ? combinado : null;
}

// Momento real da NF: data_faturamento (`@db.Date`) + hora_faturamento
// ("HH:mm[:ss]"). Mesmo algoritmo de parseDataFaturamento em BIView.tsx
// (PDEV-48) — mantém os dois lugares consistentes.
function fimFaturamentoReal(item: Scheduling): DateTime | null {
    return combinarDataHora(item.dataFaturamento, item.horaFaturamento);
}

// Momento real de entrada do pedido. data_emissao é `Timestamptz`, mas as duas
// origens preenchem diferente:
// - pedido do App grava o INSTANTE real da criação → usamos direto;
// - pedido nativo do Protheus grava só o dia (meia-noite UTC) e manda a hora
//   real separada em hora_emissao → aí sim precisamos colar data + hora.
// Sem isso o início virava meia-noite e a conta saía completamente errada
// (ex.: pedido faturado 46min depois de aberto aparecia como "19h").
function inicioReal(item: Scheduling): DateTime | null {
    if (!item.dataEmissao) return null;
    const dt = DateTime.fromISO(item.dataEmissao);
    if (!dt.isValid) return null;
    const utc = dt.toUTC();
    const soData = utc.hour === 0 && utc.minute === 0 && utc.second === 0 && utc.millisecond === 0;
    if (!soData) return dt;
    return combinarDataHora(item.dataEmissao, item.horaEmissao) ?? dt;
}

// Se sabemos o momento real da NF (backend ou carimbo client-side), a UI
// mostra o tempo calculado; sem nenhum dos dois, mostra só "Faturado".
function temFimConfiavel(item: Scheduling): boolean {
    return !!fimFaturamentoReal(item) || !!item.faturamentoObservadoEm;
}

// Conta da entrada do pedido (data_emissao) até a NF. Fonte primária: os
// campos reais do backend (fimFaturamentoReal). Quando o backend ainda não
// preencheu esses campos pra esse pedido, cai no carimbo client-side
// (faturamentoObservadoEm, ver registrarFaturamentoObservado acima); sem
// nenhum dos dois, mostramos "Faturado" sem número em vez de inventar um
// tempo a partir de ultima_alteracao (comprovadamente não confiável).
// Valor do pedido em reais. Pedido sem valor (ainda não veio do ERP) mostra "—"
// em vez de "R$ 0,00", que se confundiria com um pedido realmente zerado.
function formatBRL(valor?: number): string {
    if (valor == null || Number.isNaN(valor)) return "—";
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function tempoNoSistema(item: Scheduling): { hours: number; label: string; state: TempoState } | null {
    if (!item.dataEmissao) return null;
    const inicio = inicioReal(item);
    if (!inicio || !inicio.isValid) return null;

    if (item.numeroNF) {
        const fim = fimFaturamentoReal(item)
            ?? (item.faturamentoObservadoEm ? DateTime.fromISO(item.faturamentoObservadoEm) : null);
        if (!fim || !fim.isValid) return { hours: 0, label: "Faturado", state: "faturado" };
        const hours = Math.max(0, fim.diff(inicio, "hours").hours);
        return { hours, label: formatTempoLabel(hours), state: "faturado" };
    }

    const hours = Math.max(0, DateTime.now().diff(inicio, "hours").hours);
    const state: TempoState = hours >= 48 ? "atrasado" : hours >= 24 ? "atencao" : "aberto";
    return { hours, label: formatTempoLabel(hours), state };
}

// Cores do badge de tempo — par claro (linhas brancas da Lista) / escuro (cards
// navy do Kanban), mesma paleta usada no resto da tela.
const TEMPO_COLOR_LIST: Record<TempoState, string> = {
    aberto: "#4A5568", atencao: "#C05621", atrasado: "#C53030", faturado: "#2F855A",
};
// "aberto" acompanha a tinta do card (var(--sm-card-ink), branco no escuro,
// escuro no claro) — as demais são cores de alerta fixas, legíveis nos dois.
const TEMPO_COLOR_KANBAN: Record<TempoState, string> = {
    aberto: "var(--sm-card-ink)", atencao: "#F6AD55", atrasado: "#FC8181", faturado: "#68D391",
};

function tempoTitle(item: Scheduling, tempo: { state: TempoState }): string | undefined {
    if (!item.dataEmissao) return undefined;
    const inicioEntrada = inicioReal(item);
    const entrada = (inicioEntrada ?? DateTime.fromISO(item.dataEmissao)).toFormat("dd/MM/yyyy HH:mm");
    if (tempo.state !== "faturado") return `Entrada: ${entrada} · contando até a emissão da NF`;
    const fimReal = fimFaturamentoReal(item);
    if (fimReal) {
        return `Entrada: ${entrada} · NF emitida em ${fimReal.toFormat("dd/MM/yyyy HH:mm")}`;
    }
    if (!item.faturamentoObservadoEm) {
        return `Entrada: ${entrada} · já faturado antes desta tela conseguir perceber o momento — sem tempo exato`;
    }
    const percebido = DateTime.fromISO(item.faturamentoObservadoEm).toFormat("dd/MM/yyyy HH:mm");
    return `Entrada: ${entrada} · parou de contar quando o sistema percebeu a NF (${percebido})`;
}

// ─── Linha da tabela (tema escuro) ─────────────────────────────────────────────
function MapRow({ item }: { item: Scheduling }) {
    const stCfg = STATUS_CFG[item.statusWorkflow];
    const tipoColor = tipoColorOf(item.tipo); // cor do tipo (tom escuro, legível no branco)
    const dt = DateTime.fromISO(item.dataAgendamento);
    const dataLabel = dt.isValid ? dt.toFormat("dd/MM/yyyy") : "—";

    const isUrgencia = item.tipo === "URGENCIA";
    const isConsignado = item.tipo === "CONSIGNADO";
    const isEletiva = item.tipo === "ELETIVA";
    const isCancelado = ehPedidoBaixadoNoErp(item.statusPedido);
    const temNF = !!item.numeroNF;
    const vendedor = item.colaborador?.nome;

    // Pisca pra chamar atenção de pedido recém-chegado (sem NF ainda): vermelho
    // p/ urgência, laranja p/ consignado, azul p/ eletiva. Assim que sai a nota
    // fiscal, para de piscar.
    const blinkClass = isCancelado || temNF ? undefined
        : isUrgencia ? "row-urgencia"
        : isConsignado ? "row-consignado"
        : isEletiva ? "row-eletiva"
        : undefined;

    // Acento da linha (borda esquerda): urgência sem nota = vermelho (piscando);
    // já saiu nota = verde; senão a cor do tipo.
    const rowAccent: string = isCancelado ? "#A0AEC0"
        : (isUrgencia && !temNF) ? "#C53030"
        : temNF ? "#2F855A"
        : tipoColor;

    // Linha da Lista é sempre um cartão claro (branco/verde-claro), por design,
    // independente do tema do app ("linhas brancas direto sobre o fundo escuro"
    // — ver comentário mais abaixo). Por isso usa hex fixo em vez dos tokens
    // gray.*: esses tokens se invertem no tema claro (styles/light-theme.css) e,
    // se usados aqui, o texto ficaria claro sobre um cartão que já era claro.
    const DIV = "#D1d2Dc";
    const TXT_MUTED = "#9699B0";       // gray.300 original — ícones/texto apagado
    const TXT_PLACEHOLDER = "#797D9A"; // gray.400 original — "—" e origem TOTVS
    const TXT_SECONDARY = "#616480";   // gray.500 original — região/hora
    const TXT_BODY = "#4b4d63";        // gray.600 original — convênio/médico
    const TXT_STRONG = "#353646";      // gray.700 original — data/vendedor/pedido
    const TXT_DARK = "#1f2029";        // gray.800 original — paciente
    const statusColor = (isUrgencia && !temNF) ? "#C53030" : temNF ? "#2F855A" : stCfg.textDark;
    const tempo = tempoNoSistema(item);

    return (
        <RowFlex
            key={item.id}
            className={blinkClass}
            bg={isCancelado ? "#eeeef2" : temNF ? "green.50" : "white"}
            borderRadius="lg"
            boxShadow="0 1px 3px rgba(0,0,0,0.12)"
            border="1px solid"
            borderColor={temNF && !isCancelado ? "green.200" : "#b3b5c6"}
            borderLeftWidth="4px"
            borderLeftColor={rowAccent}
            align="center"
            minH="60px"
            overflow="hidden"
            opacity={isCancelado ? 0.7 : 1}
            _hover={{ bg: isCancelado ? "#eeeef2" : temNF ? "green.100" : "#eeeef2", borderColor: temNF && !isCancelado ? "green.300" : "#9699B0", borderLeftColor: rowAccent, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}
            transition="all 0.15s"
        >
            {/* STATUS — verde quando já saiu nota; vermelho na urgência sem nota */}
            <RowFlex w="168px" flexShrink={0} align="center" gap={2} px={3} py={2}>
                {stCfg.icon && <Icon as={stCfg.icon} w={4} h={4} color={statusColor} flexShrink={0} />}
                <RowText fontWeight="bold" fontSize="sm" color={statusColor} noOfLines={2} lineHeight="1.25">
                    {stCfg.label}
                </RowText>
            </RowFlex>

            {/* TEMPO NO SISTEMA — desde a entrada do pedido; para de contar na NF
                (fimFaturamentoReal: data_faturamento+hora_faturamento do backend,
                ou o carimbo client-side quando o backend ainda não preencheu).
                Faturado sem nenhuma das duas fontes = já tinha NF antes de dar
                pra saber o tempo real: mostra só o ícone (sem inventar número
                nem repetir "Faturado" — a coluna STATUS já diz isso). */}
            <RowFlex w="92px" flexShrink={0} align="center" justify="center" gap={1.5} px={2}
                borderLeft="1px solid" borderColor={DIV} title={tempo ? tempoTitle(item, tempo) : undefined}>
                <Icon as={FaHourglassHalf} w={3} h={3} color={tempo ? TEMPO_COLOR_LIST[tempo.state] : TXT_MUTED} flexShrink={0} />
                {!(tempo?.state === "faturado" && !temFimConfiavel(item)) && (
                    <RowText fontWeight="700" fontSize="xs" color={tempo ? TEMPO_COLOR_LIST[tempo.state] : TXT_PLACEHOLDER} noOfLines={1}>
                        {tempo ? tempo.label : "—"}
                    </RowText>
                )}
            </RowFlex>

            {/* TIPO (chip contornado) + ORIGEM (APP/PROTHEUS) */}
            <RowFlex w="100px" flexShrink={0} align="center" justify="center" px={2} gap={1}
                direction="column" borderLeft="1px solid" borderColor={DIV}>
                <RowBox border="1px solid" borderColor={tipoColor} borderRadius="md" px={2} py="2px">
                    <RowText fontWeight="bold" fontSize="10px" color={tipoColor} letterSpacing="wide">
                        {tipoLabelOf(item.tipo)}
                    </RowText>
                </RowBox>
                <RowText fontWeight="bold" fontSize="9px" color={item.origem === "APP" ? "blue.500" : TXT_PLACEHOLDER} letterSpacing="wide">
                    {item.origem}
                </RowText>
            </RowFlex>

            {/* CLIENTE */}
            <RowFlex flex={1.8} align="center" px={3} borderLeft="1px solid" borderColor={DIV} direction="column" gap={0} alignItems="flex-start" justify="center">
                <RowText fontWeight="700" fontSize="sm" color={tipoColor} noOfLines={1}>
                    {item.cliente?.razaoSocial}
                </RowText>
                {item.regiao && (
                    <RowText fontSize="10px" color={TXT_SECONDARY} noOfLines={1}>Região {rotuloRegiao(item.regiao)}</RowText>
                )}
            </RowFlex>

            {/* DATA DO PEDIDO — data de entrega agendada quando existe; na falta
                dela (o caso comum na expedição) mostra a emissão do pedido. */}
            <RowFlex flex={1.3} align="center" px={3} borderLeft="1px solid" borderColor={DIV} direction="column" gap={0} alignItems="flex-start" justify="center"
                title={item.dataCirurgia ? "Data de entrega agendada pelo vendedor" : "Pedido sem entrega agendada — mostrando a data de emissão do pedido"}>
                <RowText fontWeight="600" fontSize="sm" color={TXT_STRONG} noOfLines={1}>{dataLabel}</RowText>
                {item.horaCirurgia ? (
                    <RowText fontSize="11px" color={TXT_SECONDARY} noOfLines={1}>{item.horaCirurgia}</RowText>
                ) : !item.dataCirurgia && (
                    <RowText fontSize="10px" color={TXT_PLACEHOLDER} noOfLines={1}>emissão do pedido</RowText>
                )}
            </RowFlex>

            {/* VALOR */}
            <RowFlex flex={1.1} align="center" justify="flex-end" px={3} borderLeft="1px solid" borderColor={DIV}>
                <RowText fontWeight="700" fontSize="sm" color={item.valorPedido != null ? TXT_DARK : TXT_PLACEHOLDER} noOfLines={1}>
                    {formatBRL(item.valorPedido)}
                </RowText>
            </RowFlex>

            {/* COND. PAGAMENTO */}
            <RowFlex flex={1.3} align="center" px={3} borderLeft="1px solid" borderColor={DIV}>
                <RowText fontWeight="600" fontSize="xs" color={item.condicaoPagamento ? TXT_BODY : TXT_PLACEHOLDER} noOfLines={1} title={item.condicaoPagamento}>
                    {item.condicaoPagamento || "—"}
                </RowText>
            </RowFlex>

            {/* VENDEDOR */}
            <RowFlex flex={1.2} align="center" gap={2} px={3} borderLeft="1px solid" borderColor={DIV}>
                <RowText fontWeight="600" fontSize="xs" color={TXT_STRONG} noOfLines={1} flex={1}>
                    {vendedor || "—"}
                </RowText>
                {vendedor && (
                    <RowFlex w="22px" h="22px" borderRadius="full" bg={avatarColorOf(vendedor)} align="center" justify="center" flexShrink={0} title={vendedor}>
                        <RowText fontSize="9px" fontWeight="bold" color="white">{initialsOf(vendedor)}</RowText>
                    </RowFlex>
                )}
            </RowFlex>

            {/* PEDIDO / NF */}
            <RowFlex flex={1.4} align="center" px={3} borderLeft="1px solid" borderColor={DIV} direction="column" gap={0} alignItems="flex-start" justify="center">
                <RowText fontWeight="700" fontSize="xs" color={TXT_STRONG} noOfLines={1}>
                    {item.pedidoProtheus || "—"}
                </RowText>
                {item.numeroNF && (
                    <RowText fontWeight="600" fontSize="xs" color="#2F855A" noOfLines={1}>
                        NF: {item.numeroNF}
                    </RowText>
                )}
            </RowFlex>
        </RowFlex>
    );
}

// ─── Cor por tipo de cirurgia ─────────────────────────────────────────────────
// URGÊNCIA=vermelho, CONSIGNADO=laranja, VENDA=roxo, ELETIVA=azul (alinhado ao
// fundo azul das linhas de eletiva na Lista).
function tipoColorOf(tipo: TipoCirurgia): string {
    return tipo === "URGENCIA"   ? "#C53030" :
           tipo === "CONSIGNADO" ? "#C05621" :
           tipo === "VENDA"      ? "#6B46C1" : "#3182CE";
}
function tipoLabelOf(tipo: TipoCirurgia): string {
    return tipo === "URGENCIA"   ? "URGENCIA" :
           tipo === "CONSIGNADO" ? "CONSIGNADO" :
           tipo === "VENDA"      ? "VENDA" : "ELETIVO";
}
// Versão clara/viva da cor do tipo, pra "acender" sobre os fundos escuros
// (cards do kanban e linhas da lista) — igual à foto de referência.
function tipoAccentOf(tipo: TipoCirurgia): string {
    return tipo === "URGENCIA"   ? "#FC8181" :
           tipo === "CONSIGNADO" ? "#F6AD55" :
           tipo === "VENDA"      ? "#B794F4" : "#63B3ED";
}

// Cor de fundo dos cards (navy escuro pedido pelo usuário). Publicada como CSS
// variable em styles/light-theme.css: no tema escuro o valor é exatamente o hex
// original, no claro a folha sobrescreve. Precisa acompanhar o tema porque o
// texto secundário do card usa whiteAlpha.*, que se inverte junto com os tokens.
const CARD_BG = "var(--sm-card-bg)";
const CARD_BG_HOVER = "var(--sm-card-bg-hover)";
const CARD_BG_CANCEL = "var(--sm-card-bg-cancel)";
const CARD_INK = "var(--sm-card-ink)";
// O modal de detalhe tambem tem fundo proprio em hex, mas o texto dele usa
// tokens (gray.50/100/400) que se invertem — sem acompanhar o tema, ficaria
// texto escuro sobre modal escuro.
const MODAL_BG = "var(--sm-modal-bg)";
// Destaque do comentário (MensagemItem): borda/texto usam o laranja da marca
// (orange.200 = #fe8026, o mesmo de botões/ícones em todo o app — não precisa
// de par claro/escuro porque já é usado direto sobre fundos claros e escuros
// em várias telas). Só o fundo (tint translúcido) precisa acompanhar o tema.
const COMMENT_BG = "var(--sm-comment-bg)";
const COMMENT_BORDER = "orange.200";
const COMMENT_TEXT = "orange.200";
const COMMENT_AUTHOR = "var(--sm-comment-author)";

// Iniciais do nome (ex.: "Guilherme Rodrigues" -> "GR") p/ o avatar do vendedor.
function initialsOf(name?: string): string {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Cor estável do avatar a partir do nome (hash simples). Tons sóbrios (700),
// sem neon, pra não competir com as etiquetas coloridas.
const AVATAR_COLORS = ["#4A5568", "#2C7A7B", "#2B6CB0", "#553C9A", "#285E61", "#975A16", "#5A677D", "#2F855A"];
function avatarColorOf(name?: string): string {
    if (!name) return "#718096";
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Números de página a exibir na paginação, com reticências quando há muitas
// páginas (ex.: 1 2 3 4 5 … 43) — evita a fileira de dezenas de botões.
function paginationRange(current: number, total: number, siblings = 1): (number | "...")[] {
    const totalNumbers = siblings * 2 + 5; // primeira + última + atual + vizinhas + 2 reticências
    if (total <= totalNumbers) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }
    const left = Math.max(current - siblings, 1);
    const right = Math.min(current + siblings, total);
    const showLeftDots = left > 2;
    const showRightDots = right < total - 1;

    if (!showLeftDots && showRightDots) {
        const size = 3 + siblings * 2;
        return [...Array.from({ length: size }, (_, i) => i + 1), "...", total];
    }
    if (showLeftDots && !showRightDots) {
        const size = 3 + siblings * 2;
        return [1, "...", ...Array.from({ length: size }, (_, i) => total - size + i + 1)];
    }
    return [1, "...", ...Array.from({ length: right - left + 1 }, (_, i) => left + i), "...", total];
}

// ─── Card do Kanban (Trello dark mode) ─────────────────────────────────────────
function KanbanCard({ item, onClick, materiais }: { item: Scheduling; onClick: () => void; materiais?: MaterialPedido[] }) {
    const accent = tipoAccentOf(item.tipo); // cor viva do tipo (igual à foto)
    const isUrgencia = item.tipo === "URGENCIA";
    const isConsignado = item.tipo === "CONSIGNADO";
    const isEletiva = item.tipo === "ELETIVA";
    const temNF = !!item.numeroNF;
    const isCancelado = ehPedidoBaixadoNoErp(item.statusPedido);
    // Pisca pra chamar atenção de pedido recém-chegado (sem NF ainda): vermelho
    // p/ urgência, laranja p/ consignado, azul p/ eletiva. Para de piscar com a NF.
    const pulseClass = isCancelado || temNF ? undefined
        : isUrgencia ? "pulse-urgencia"
        : isConsignado ? "pulse-consignado"
        : isEletiva ? "pulse-eletiva"
        : undefined;
    const isManual = !!item.statusTotvs && item.statusWorkflow !== item.statusTotvs;
    const dt = DateTime.fromISO(item.dataAgendamento);
    const dataLabel = dt.isValid ? dt.toFormat("dd/MM") : "—";
    // Cor da data: vermelho se atrasada, laranja se vencendo (≤2 dias e ainda
    // sem NF); no resto acompanha a tinta do card (CARD_INK — branca no tema
    // escuro, escura no claro), em vez de branco fixo.
    const diasParaData = dt.isValid ? Math.floor(dt.startOf("day").diff(DateTime.now().startOf("day"), "days").days) : null;
    const dateTextColor = temNF || diasParaData === null ? CARD_INK
        : diasParaData < 0 ? "#FC8181"
        : diasParaData <= 2 ? "#F6AD55"
        : CARD_INK;
    const mensagens = item.mensagens || [];
    const ultimaMensagem = mensagens[0];
    const vendedor = item.colaborador?.nome;
    const tempo = tempoNoSistema(item);

    return (
        <RowBox
            onClick={onClick}
            className={pulseClass}
            bg={isCancelado ? CARD_BG_CANCEL : CARD_BG}
            borderRadius="lg"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderLeftWidth="3px"
            borderLeftColor={accent}
            boxShadow="0 1px 2px rgba(0,0,0,0.4)"
            cursor="pointer"
            flexShrink={0}
            opacity={isCancelado ? 0.65 : 1}
            _hover={{ bg: isCancelado ? CARD_BG_CANCEL : CARD_BG_HOVER, borderColor: "whiteAlpha.300", borderLeftColor: accent, transform: "translateY(-1px)" }}
            transition="all 0.12s"
        >
            <RowBox px={3} py={2.5}>
                {/* Marca de status manual (exceção) */}
                {isManual && (
                    <RowBox h="6px" w="22px" borderRadius="full" bg="#B794F4" mb={1.5} title="Status manual" />
                )}

                {/* Título: cliente — texto branco; só a lateral (borda) leva a cor do tipo */}
                <RowFlex align="flex-start" justify="space-between" gap={2} mb={2}>
                    <RowFlex align="flex-start" gap={2} flex="1 1 auto" minW={0} overflow="hidden">
                        <Icon as={FaStore} w={3.5} h={3.5} color="#90CDF4" flexShrink={0} mt="2px" />
                        <RowBox flex={1} minW={0} overflow="hidden">
                            <RowText fontWeight="700" fontSize="13px" color={CARD_INK} noOfLines={2} lineHeight="1.3">
                                {item.cliente?.razaoSocial || "—"}
                            </RowText>
                            {item.regiao && (
                                <RowText fontSize="10px" color="whiteAlpha.600" noOfLines={1}>Região {rotuloRegiao(item.regiao)}</RowText>
                            )}
                        </RowBox>
                    </RowFlex>
                    <RowFlex direction="column" align="flex-end" gap={1} flex="0 0 auto" maxW="72px">
                        <RowText
                            fontSize="9px" fontWeight="bold" letterSpacing="wide"
                            color={item.origem === "APP" ? "#63B3ED" : "whiteAlpha.500"}
                            title={item.origem === "APP" ? "Pedido feito pelo app" : "Pedido inserido pelo ERP/Protheus"}
                        >
                            {item.origem}
                        </RowText>
                        {tempo && (
                            <RowFlex align="center" gap={1} title={tempoTitle(item, tempo)}>
                                <Icon as={FaHourglassHalf} w={2.5} h={2.5} color={TEMPO_COLOR_KANBAN[tempo.state]} flexShrink={0} />
                                {/* faturado sem fonte de fim conhecida (nem backend nem carimbo
                                    client-side): sem tempo real, só o ícone. */}
                                {!(tempo.state === "faturado" && !temFimConfiavel(item)) && (
                                    <RowText fontSize="10px" fontWeight="bold" color={TEMPO_COLOR_KANBAN[tempo.state]}>{tempo.label}</RowText>
                                )}
                            </RowFlex>
                        )}
                    </RowFlex>
                </RowFlex>

                {/* Valor e condição de pagamento, no lugar do antigo bloco de
                    paciente/médico/convênio (campos OPME que não existem no ERP
                    de um laticínio). Sem dado, a linha some. */}
                {item.valorPedido != null && (
                    <RowFlex align="center" gap={3} mb={1}>
                        <Icon as={FaFileInvoiceDollar} w={3} h={3} color="#4FD1C5" flexShrink={0} />
                        <RowText fontSize="12px" fontWeight="700" color={CARD_INK} noOfLines={1}>{formatBRL(item.valorPedido)}</RowText>
                    </RowFlex>
                )}
                {item.condicaoPagamento && (
                    <RowFlex align="center" gap={3} mb={1}>
                        <Icon as={FaRegAddressCard} w={3} h={3} color="#F687B3" flexShrink={0} />
                        <RowText fontSize="12px" fontWeight="500" color={CARD_INK} noOfLines={1} title={item.condicaoPagamento}>{item.condicaoPagamento}</RowText>
                    </RowFlex>
                )}

                {/* Produtos do pedido (item_pedido). Carregados sob demanda pelo
                    GET /pedidos/:id — enquanto não chegam, o bloco não aparece
                    (undefined); lista vazia = pedido sem itens. */}
                {materiais && materiais.length > 0 && (
                    <RowBox mt={2} mb={1}>
                        <RowFlex align="center" gap={2} mb={1}>
                            <Icon as={FaBoxOpen} w={3} h={3} color="#F6AD55" flexShrink={0} />
                            <RowText fontSize="10px" fontWeight="bold" color="whiteAlpha.700" letterSpacing="wide">
                                PRODUTOS ({materiais.length})
                            </RowText>
                        </RowFlex>
                        <RowBox pl="12px">
                            {materiais.slice(0, 3).map((m) => (
                                <RowBox
                                    key={m.id} mb="5px"
                                    title={`${m.quantidade}x ${m.descricao}${m.codigo ? ` (${m.codigo})` : ""}`}
                                >
                                    {/* O nome acompanha o recuo curto das outras
                                        informações; quantidade e código ficam abaixo e não
                                        empurram produtos de tamanhos diferentes. */}
                                    <RowText fontSize="10px" fontWeight="500" color={CARD_INK} noOfLines={1} lineHeight="1.35">
                                        {m.descricao}
                                    </RowText>
                                    <RowFlex align="center" gap={1.5} minW={0}>
                                        <RowText fontSize="9px" fontWeight="bold" color="#F6AD55" flexShrink={0} lineHeight="1.3">
                                            {m.quantidade}x
                                        </RowText>
                                        {m.codigo && !m.descricao.toLocaleUpperCase().includes(m.codigo.toLocaleUpperCase()) && (
                                            <RowText fontSize="9px" color="whiteAlpha.500" noOfLines={1} lineHeight="1.3">
                                                · Cód. {m.codigo}
                                            </RowText>
                                        )}
                                    </RowFlex>
                                </RowBox>
                            ))}
                            {materiais.length > 3 && (
                                <RowText fontSize="10px" color="whiteAlpha.500">
                                    +{materiais.length - 3} {materiais.length - 3 === 1 ? "produto" : "produtos"}
                                </RowText>
                            )}
                        </RowBox>
                    </RowBox>
                )}

                {/* Prévia da mensagem mais recente do pedido + quem escreveu */}
                {ultimaMensagem && (
                    <RowFlex direction="column" gap={0.5} mt={1.5} bg={COMMENT_BG} border="1px solid" borderColor={COMMENT_BORDER} borderRadius="sm" px={1.5} py={1}>
                        <RowFlex align="center" gap={1.5}>
                            <Icon as={FaRegStickyNote} w={2.5} h={2.5} color={COMMENT_TEXT} flexShrink={0} />
                            <RowText fontSize="10px" fontWeight="600" color={COMMENT_TEXT} noOfLines={1}>{ultimaMensagem.mensagem}</RowText>
                        </RowFlex>
                        <RowFlex align="center" justify="space-between" gap={1.5}>
                            <RowText fontSize="9px" fontWeight="500" color={COMMENT_AUTHOR} noOfLines={1}>
                                {ultimaMensagem.autor ? `por ${ultimaMensagem.autor}` : ""}
                            </RowText>
                            {mensagens.length > 1 && (
                                <RowText fontSize="9px" fontWeight="500" color="whiteAlpha.500" flexShrink={0}>+{mensagens.length - 1}</RowText>
                            )}
                        </RowFlex>
                    </RowFlex>
                )}

                {/* Data / NF / pedido — ícones coloridos, mesmo formato das linhas acima */}
                <RowFlex align="flex-start" gap={3} mb={1} mt={2}
                    title={item.dataCirurgia ? "Data de entrega (agendada pelo vendedor)" : "Pedido sem entrega agendada — data de emissão do pedido"}>
                    <Icon as={FaRegClock} w={3} h={3} color="#F6E05E" flexShrink={0} mt="3px" />
                    <RowBox minW={0}>
                        <RowText fontSize="12px" fontWeight="600" color={dateTextColor} noOfLines={1} lineHeight="1.3">
                            {dataLabel}
                        </RowText>
                        {!item.dataCirurgia && (
                            <RowText fontSize="9px" color="whiteAlpha.500" noOfLines={1} lineHeight="1.3">
                                emissão do pedido
                            </RowText>
                        )}
                    </RowBox>
                </RowFlex>
                {item.numeroNF && (
                    <RowFlex align="center" gap={3} mb={1}>
                        <Icon as={FaFileInvoiceDollar} w={3} h={3} color="#68D391" flexShrink={0} />
                        <RowText fontSize="12px" fontWeight="600" color={CARD_INK} noOfLines={1}>NF {item.numeroNF}</RowText>
                    </RowFlex>
                )}
                {item.pedidoProtheus && (
                    <RowFlex align="center" gap={3}>
                        <Icon as={FaClipboardList} w={3} h={3} color="#63B3ED" flexShrink={0} />
                        <RowText fontSize="12px" fontWeight="600" color={CARD_INK} noOfLines={1}>{item.pedidoProtheus}</RowText>
                    </RowFlex>
                )}

                {/* Avatar do vendedor */}
                <RowFlex justify="flex-end" mt={2}>
                    <RowFlex
                        w="24px" h="24px" borderRadius="full" bg={avatarColorOf(vendedor)}
                        align="center" justify="center" flexShrink={0} title={vendedor || ""}
                    >
                        <RowText fontSize="9px" fontWeight="bold" color="white">{initialsOf(vendedor)}</RowText>
                    </RowFlex>
                </RowFlex>
            </RowBox>
        </RowBox>
    );
}

// ─── Board (raias por status) ─────────────────────────────────────────────────
// Colunas alimentadas pelo TOTVS (read-only): AGENDADO (integrado) e NOTA_FISCAL
// (faturado). As demais refletem a logística. Mover cards está desabilitado por
// ora — o avanço de status será feito de outra forma (Fase 2 / backend).
const TOTVS_STATUSES: StatusWorkflow[] = ["AGENDADO", "NOTA_FISCAL"];

// Pedido "parcial": parte dos materiais foi utilizada (apontado/realizado) e
// parte sobrou para devolver — ex.: de 10, usaram 5 e faltam 5 devolver. Esses
// pedidos aparecem NAS DUAS colunas do Kanban ao mesmo tempo: APONTADO/REALIZADO
// (o que foi usado) e AGUARDANDO DEVOLUÇÃO (o que falta voltar). Só vale para
// eletiva/urgência (os únicos com cirurgia); os códigos do extrato ERP que
// representam parcial: CIRURGIA 2 (UTILIZADO PARCIAL) e 4 (MISTO).
const COLUNAS_PARCIAL: StatusWorkflow[] = ["APONTADO_REALIZADO", "AGUARDANDO_DEVOLUCAO"];

function isPedidoParcial(item: Scheduling): boolean {
    if (item.tipo !== "ELETIVA" && item.tipo !== "URGENCIA") return false;
    const e = item.erpExtractStatus;
    return e?.kind === "CIRURGIA" && (e.code === "2" || e.code === "4");
}

// Decide se um item entra na coluna `st` do Kanban. Regra normal: status efetivo
// igual à coluna. Exceção: pedido parcial cujo status ainda esteja em uma das
// colunas de parcial aparece nas DUAS (apontado + devolução).
function itemNaColuna(item: Scheduling, st: StatusWorkflow): boolean {
    if (
        isPedidoParcial(item) &&
        COLUNAS_PARCIAL.includes(item.statusWorkflow) &&
        COLUNAS_PARCIAL.includes(st)
    ) {
        return true;
    }
    return item.statusWorkflow === st;
}

function KanbanBoard({
    items, onCardClick, colMaxH, materiaisPorPedido,
}: {
    items: Scheduling[];
    onCardClick: (s: Scheduling) => void;
    colMaxH: string;
    materiaisPorPedido: Record<string, MaterialPedido[]>;
}) {
    // `cfg.textColor` é o tom claro pensado pra ler sobre coluna navy (tema
    // escuro). No tema claro a coluna (bg="gray.800") vira quase branca e esse
    // mesmo tom claro fica ilegível — por isso o cabeçalho troca pro `textDark`
    // (mesmo par já usado na Lista) quando `ehClaro`.
    const { ehClaro } = useThemeMode();

    // Baias OPME (apontado/devolução) só entram no quadro se houver pedido nelas
    // — ver BAIAS_OPME. Na Valeza nunca há, então o Kanban fica com as 5 baias
    // do fluxo real: agendado → em rota → nota fiscal → entregue → faturamento.
    const statusVisiveis = STATUS_LIST.filter(
        (st) => !BAIAS_OPME.includes(st) || items.some((i) => itemNaColuna(i, st))
    );

    return (
        <RowFlex flex={1} overflowX="auto" overflowY="hidden" px={3} py={3} gap={3} align="stretch">
            {statusVisiveis.map((st) => {
                const cfg = STATUS_CFG[st];
                const acento = ehClaro ? cfg.textDark : cfg.textColor;
                const colItems = items.filter((i) => itemNaColuna(i, st));
                const isTotvs = TOTVS_STATUSES.includes(st);
                return (
                    <RowFlex
                        key={st}
                        direction="column"
                        minW="290px" maxW="290px"
                        bg="gray.800"
                        borderRadius="lg"
                        border="1px solid"
                        borderColor={`${cfg.dotColor}33`}
                        maxH={colMaxH}
                        transition="all 0.12s"
                    >
                        {/* Cabeçalho da coluna */}
                        <RowFlex align="center" gap={2} px={3} py={2.5} borderBottom="1px solid" borderColor="gray.700" flexShrink={0}>
                            {cfg.icon && (
                                <RowFlex
                                    align="center" justify="center" w="26px" h="26px" borderRadius="md" flexShrink={0}
                                    bg={`${cfg.dotColor}22`}
                                >
                                    <Icon as={cfg.icon} w={3.5} h={3.5} color={cfg.dotColor} />
                                </RowFlex>
                            )}
                            <RowText fontWeight="bold" fontSize="xs" color={acento} letterSpacing="wide" noOfLines={1} flex={1}>
                                {cfg.label}
                            </RowText>
                            <RowFlex align="center" justify="center" minW="22px" h="22px" px={1.5} borderRadius="full" bg={`${cfg.dotColor}22`}>
                                <RowText fontWeight="black" fontSize="10px" color={acento}>{colItems.length}</RowText>
                            </RowFlex>
                        </RowFlex>
                        <RowFlex px={3} py={1} flexShrink={0}>
                            <RowText fontSize="9px" color={isTotvs ? "blue.300" : "gray.500"} letterSpacing="wide">
                                {isTotvs ? "AUTOMÁTICO (TOTVS)" : "LOGÍSTICA"}
                            </RowText>
                        </RowFlex>

                        {/* Cards */}
                        <RowFlex direction="column" gap={2} p={2} overflowY="auto" flex={1}>
                            {colItems.length === 0 ? (
                                <RowFlex
                                    direction="column" align="center" justify="center" gap={2} flex={1} m={2} py={8} px={4}
                                    border="1px dashed" borderColor="whiteAlpha.200" borderRadius="lg" textAlign="center"
                                >
                                    {cfg.icon && <Icon as={cfg.icon} w={7} h={7} color={cfg.dotColor} opacity={0.85} />}
                                    <RowText fontSize="sm" fontWeight="bold" color={acento}>Nenhum item</RowText>
                                    <RowText fontSize="11px" color="gray.500" lineHeight="1.4">{cfg.empty}</RowText>
                                </RowFlex>
                            ) : colItems.map((c) => (
                                <KanbanCard
                                    key={c.id}
                                    item={c}
                                    onClick={() => onCardClick(c)}
                                    materiais={materiaisPorPedido[c.pedidoId || c.id]}
                                />
                            ))}
                        </RowFlex>
                    </RowFlex>
                );
            })}
        </RowFlex>
    );
}

// ─── Mensagem individual (dentro do DetailModal) ──────────────────────────────
// Edição/exclusão só ficam disponíveis pra quem escreveu a mensagem (canManage).
function MensagemItem({
    mensagem, canManage, onEdit, onDelete,
}: {
    mensagem: PedidoMensagem;
    canManage: boolean;
    onEdit: (texto: string) => Promise<boolean>;
    onDelete: () => Promise<boolean>;
}) {
    const [editing, setEditing] = useState(false);
    const [texto, setTexto] = useState(mensagem.mensagem);
    const [busy, setBusy] = useState(false);
    const dt = mensagem.criadoEm ? DateTime.fromISO(mensagem.criadoEm) : null;
    const dataLabel = dt && dt.isValid ? dt.toFormat("dd/MM/yyyy HH:mm") : undefined;

    const salvar = async () => {
        if (!texto.trim()) return;
        setBusy(true);
        const ok = await onEdit(texto.trim());
        setBusy(false);
        if (ok) setEditing(false);
    };

    const excluir = async () => {
        setBusy(true);
        await onDelete();
        setBusy(false);
    };

    return (
        <RowFlex direction="column" gap={1} bg={COMMENT_BG} border="1px solid" borderColor={COMMENT_BORDER} borderRadius="md" px={3} py={2}>
            {editing ? (
                <>
                    <Textarea
                        value={texto}
                        onChange={(e: any) => setTexto(e.target.value)}
                        size="sm" rows={3} maxLength={500}
                        bg="whiteAlpha.50" borderColor="whiteAlpha.300" fontSize="sm" color="gray.100"
                        resize="vertical"
                        _hover={{ borderColor: "whiteAlpha.400" }}
                        _focus={{ borderColor: "orange.400", boxShadow: "0 0 0 1px #ED8936" }}
                    />
                    <RowFlex justify="flex-end" gap={2} mt={1}>
                        <Button size="xs" variant="ghost" color="gray.300" onClick={() => { setEditing(false); setTexto(mensagem.mensagem); }}>
                            Cancelar
                        </Button>
                        <Button size="xs" colorScheme="orange" leftIcon={<Icon as={FaSave} />} isLoading={busy} isDisabled={!texto.trim()} onClick={salvar}>
                            Salvar
                        </Button>
                    </RowFlex>
                </>
            ) : (
                <>
                    <RowFlex justify="space-between" gap={2} align="flex-start">
                        <RowText fontSize="sm" fontWeight="600" color={COMMENT_TEXT} flex={1} whiteSpace="pre-wrap">
                            {mensagem.mensagem}
                        </RowText>
                        {canManage && (
                            <RowFlex gap={1} flexShrink={0}>
                                <IconButton
                                    aria-label="Editar mensagem" title="Editar"
                                    icon={<Icon as={FaPen} />} size="xs" variant="ghost"
                                    color={COMMENT_TEXT} _hover={{ bg: "whiteAlpha.200" }}
                                    onClick={() => setEditing(true)}
                                />
                                <IconButton
                                    aria-label="Excluir mensagem" title="Excluir"
                                    icon={<Icon as={FaTrashAlt} />} size="xs" variant="ghost"
                                    color="red.300" _hover={{ bg: "whiteAlpha.200" }}
                                    isLoading={busy} onClick={excluir}
                                />
                            </RowFlex>
                        )}
                    </RowFlex>
                    <RowFlex justify="space-between" gap={2}>
                        <RowText fontSize="11px" fontWeight="500" color={COMMENT_AUTHOR} noOfLines={1}>{mensagem.autor || "—"}</RowText>
                        {dataLabel && <RowText fontSize="10px" color="whiteAlpha.500" flexShrink={0}>{dataLabel}</RowText>}
                    </RowFlex>
                </>
            )}
        </RowFlex>
    );
}

// ─── Modal de detalhes do card ────────────────────────────────────────────────
function DetailModal({
    item, onClose, currentUserId, materiais, onAddMensagem, onEditMensagem, onDeleteMensagem,
}: {
    item: Scheduling;
    onClose: () => void;
    currentUserId?: string;
    materiais?: MaterialPedido[]; // undefined = ainda carregando (GET /pedidos/:id)
    onAddMensagem: (pedidoId: string, texto: string) => Promise<boolean>;
    onEditMensagem: (pedidoId: string, mensagemId: string, texto: string) => Promise<boolean>;
    onDeleteMensagem: (pedidoId: string, mensagemId: string) => Promise<boolean>;
}) {
    const stCfg = STATUS_CFG[item.statusWorkflow];
    const tipoColor = tipoColorOf(item.tipo);
    const dt = DateTime.fromISO(item.dataAgendamento);
    const dataLabel = `${dt.toFormat("dd/MM/yyyy")} ${item.horaCirurgia || ""}`.trim();
    const tempo = tempoNoSistema(item);
    const tempoLabel = !tempo
        ? "—"
        : tempo.state !== "faturado"
            ? `${tempo.label} no sistema`
            : temFimConfiavel(item)
                ? `${tempo.label} no sistema (parou na emissão da NF)`
                : "Faturado — tempo exato indisponível (NF anterior ao registro do momento exato)";

    const pedidoId = item.pedidoId || item.id;
    const mensagens = item.mensagens || [];
    const [novaMensagem, setNovaMensagem] = useState("");
    const [enviando, setEnviando] = useState(false);

    const handleEnviar = async () => {
        if (!novaMensagem.trim()) return;
        setEnviando(true);
        const ok = await onAddMensagem(pedidoId, novaMensagem);
        setEnviando(false);
        if (ok) setNovaMensagem("");
    };

    const rows: [string, string][] = [
        ["Status", stCfg.label],
        ["Extrato ERP", item.erpExtractStatus ? `${item.erpExtractStatus.label} (${item.erpExtractStatus.kind} ${item.erpExtractStatus.code})` : "—"],
        ["Tipo", tipoLabelOf(item.tipo)],
        ["Origem", item.origem === "APP" ? "APP" : "PROTHEUS (ERP)"],
        ["Cliente", item.cliente?.razaoSocial || "—"],
        ["Filial", item.filialNome || "—"],
        ["Região", rotuloRegiao(item.regiao)],
        [item.dataCirurgia ? "Data de entrega" : "Data do pedido (sem entrega agendada)", dataLabel || "—"],
        ["Tempo no sistema", tempoLabel],
        ["Valor do pedido", formatBRL(item.valorPedido)],
        ["Condição de pagamento", item.condicaoPagamento || "—"],
        ["Vendedor", item.colaborador?.nome || "—"],
        ["Pedido", item.pedidoProtheus || "—"],
        ["Nota fiscal", item.numeroNF || "—"],
    ];

    return (
        <RowFlex
            position="fixed" top={0} left={0} w="100vw" h="100vh"
            bg="blackAlpha.700" zIndex={2000} align="center" justify="center" p={4}
            onClick={onClose}
        >
            <RowBox
                bg={MODAL_BG} borderRadius="xl" maxW="540px" w="100%" maxH="85vh" overflowY="auto"
                border="1px solid" borderColor="whiteAlpha.200"
                boxShadow="2xl"
                onClick={(e: any) => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <RowFlex align="center" justify="space-between" px={5} py={4} borderBottom="4px solid" borderColor={tipoColor}>
                    <RowBox>
                        <RowText fontWeight="black" fontSize="10px" color={tipoColor} letterSpacing="wide">
                            {tipoLabelOf(item.tipo)}
                        </RowText>
                        <RowText fontWeight="bold" fontSize="lg" color="gray.50" noOfLines={1}>
                            {item.paciente || item.cliente?.razaoSocial || "Detalhes do pedido"}
                        </RowText>
                    </RowBox>
                    <IconButton
                        aria-label="Fechar" icon={<Icon as={FaTimes} />} onClick={onClose}
                        variant="ghost" size="sm" color="gray.400" _hover={{ bg: "whiteAlpha.200", color: "gray.100" }}
                    />
                </RowFlex>

                {/* Corpo */}
                <RowBox px={5} py={4}>
                    {rows.map(([label, value]) => (
                        <RowFlex key={label} py={2} borderBottom="1px solid" borderColor="whiteAlpha.200" gap={3}>
                            <RowText flex="0 0 140px" fontSize="xs" fontWeight="bold" color="gray.400" textTransform="uppercase" letterSpacing="wide">
                                {label}
                            </RowText>
                            <RowText flex={1} fontSize="sm" color="gray.100">{value}</RowText>
                        </RowFlex>
                    ))}
                    {/* Produtos do pedido (item_pedido do GET /pedidos/:id) */}
                    <RowBox mt={4}>
                        <RowFlex align="center" justify="space-between" mb={1.5}>
                            <RowFlex align="center" gap={2}>
                                <Icon as={FaBoxOpen} w={3} h={3} color="#F6AD55" />
                                <RowText fontSize="xs" fontWeight="bold" color="gray.400" letterSpacing="wide">PRODUTOS DO PEDIDO</RowText>
                            </RowFlex>
                            {materiais && materiais.length > 0 && (
                                <RowText fontSize="10px" color="gray.500">{materiais.length}</RowText>
                            )}
                        </RowFlex>
                        {!materiais ? (
                            <RowFlex align="center" gap={2} py={2}>
                                <Spinner size="xs" color="orange.400" />
                                <RowText fontSize="xs" color="gray.500">Carregando produtos...</RowText>
                            </RowFlex>
                        ) : materiais.length === 0 ? (
                            <RowText fontSize="xs" color="gray.500" py={2}>Nenhum produto encontrado neste pedido.</RowText>
                        ) : (
                            materiais.map((m) => (
                                <RowFlex key={m.id} align="flex-start" gap={3} py={1.5} borderBottom="1px solid" borderColor="whiteAlpha.100">
                                    <RowText flex="0 0 44px" fontSize="sm" fontWeight="bold" color="#F6AD55">{m.quantidade}x</RowText>
                                    <RowBox flex={1} minW={0}>
                                        <RowText fontSize="sm" color="gray.100">{m.descricao}</RowText>
                                        {m.codigo && (
                                            <RowText fontSize="10px" color="gray.500">Código {m.codigo}</RowText>
                                        )}
                                    </RowBox>
                                </RowFlex>
                            ))
                        )}
                    </RowBox>

                    {/* Mensagens/comentários do pedido — CRUD real em
                        /api-essencial/v1/pedidos-mensagem. Cada usuário só edita/
                        exclui as próprias mensagens (canManage). */}
                    <RowBox mt={4}>
                        <RowFlex align="center" justify="space-between" mb={1.5}>
                            <RowText fontSize="xs" fontWeight="bold" color="gray.400" letterSpacing="wide">COMENTÁRIOS DO PEDIDO</RowText>
                            {mensagens.length > 0 && (
                                <RowText fontSize="10px" color="gray.500">{mensagens.length}</RowText>
                            )}
                        </RowFlex>

                        <RowFlex direction="column" gap={2} maxH="240px" overflowY="auto" mb={2} pr={1}>
                            {mensagens.length === 0 ? (
                                <RowText fontSize="xs" color="gray.500">Nenhum comentário ainda.</RowText>
                            ) : mensagens.map((m) => (
                                <MensagemItem
                                    key={m.id}
                                    mensagem={m}
                                    canManage={!!currentUserId && m.usuarioId === currentUserId}
                                    onEdit={(texto) => onEditMensagem(pedidoId, m.id, texto)}
                                    onDelete={() => onDeleteMensagem(pedidoId, m.id)}
                                />
                            ))}
                        </RowFlex>

                        <Textarea
                            value={novaMensagem}
                            onChange={(e: any) => setNovaMensagem(e.target.value)}
                            placeholder="Escreva um comentário sobre este pedido..."
                            size="sm"
                            rows={3}
                            maxLength={500}
                            borderRadius="md"
                            bg="whiteAlpha.50"
                            borderColor="whiteAlpha.300"
                            fontSize="sm"
                            color="gray.100"
                            resize="vertical"
                            _placeholder={{ color: "gray.500" }}
                            _hover={{ borderColor: "whiteAlpha.400" }}
                            _focus={{ borderColor: "orange.400", boxShadow: "0 0 0 1px #ED8936" }}
                        />
                        <RowFlex justify="flex-end" mt={2}>
                            <Button
                                leftIcon={<Icon as={FaPlus} />}
                                size="sm"
                                colorScheme="orange"
                                onClick={handleEnviar}
                                isDisabled={!novaMensagem.trim()}
                                isLoading={enviando}
                            >
                                Adicionar comentário
                            </Button>
                        </RowFlex>
                    </RowBox>
                </RowBox>
            </RowBox>
        </RowFlex>
    );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function SurgicalMap() {
    const { user } = useAuth();
    const { ehClaro } = useThemeMode();
    const { larguraAtual } = useSidebar();
    const toast = useToast();
    // TEMPORARIO — botao de sincronizacao manual com o ERP, para recuperar as notas
    // fiscais dos pedidos que ficaram sem nota antes da correcao no backend.
    // REMOVER apos rodar.
    const [isSyncingErp, setIsSyncingErp] = useState(false);
    const [syncErpRestantes, setSyncErpRestantes] = useState(0);
    const [syncErpTotal, setSyncErpTotal] = useState(0);
    const [syncErpDe, setSyncErpDe] = useState("");
    const [syncErpAte, setSyncErpAte] = useState("");
    const popoverSyncErp = useDisclosure();
    const [scheduling, setScheduling] = useState<Scheduling[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(DateTime.now());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]); // vazio = todos
    const [filterTipos, setFilterTipos] = useState<string[]>([]); // vazio = todos
    const [filterRegioes, setFilterRegioes] = useState<string[]>([]); // vazio = todas
    const [filterOrigens, setFilterOrigens] = useState<string[]>([]); // vazio = todas
    const [filterFiliais, setFilterFiliais] = useState<string[]>([]); // código da filial; vazio = todas
    // Cadastro de filiais (GET /empresas). O menu lista TODAS elas, mesmo as
    // sem pedido, e não só as que aparecem nos dados carregados.
    const [filiaisCadastro, setFiliaisCadastro] = useState<Filial[]>([]);
    const [filterDate, setFilterDate] = useState("");      // data inicial (De)
    const [filterDateEnd, setFilterDateEnd] = useState(""); // data final (Até)
    // A visão (Lista/Kanban) é decidida pela rota, não por um botão dentro da
    // própria tela — o Kanban virou item próprio no menu lateral (ver
    // SiderbarResponsive) em vez de uma aba dentro do Mapa Cirúrgico.
    const location = useLocation();
    const viewMode: "list" | "kanban" = location.pathname === "/mapa-cirurgico/kanban" ? "kanban" : "list";
    const [selected, setSelected] = useState<Scheduling | null>(null);
    const [tvMode, setTvMode] = useState(false); // modo TV: tela cheia só com o mapa

    // Materiais (item_pedido) por pedido — ver o carregamento sob demanda mais
    // abaixo. `materiaisSolicitados` guarda o que já foi pedido ao backend pra
    // não repetir GET a cada re-render/poll (o cache vale a sessão da tela).
    const [materiaisPorPedido, setMateriaisPorPedido] = useState<Record<string, MaterialPedido[]>>({});
    const materiaisSolicitados = useRef<Set<string>>(new Set());

    // Entra/sai do modo TV (esconde cabeçalho/menu + tela cheia do navegador).
    const enterTv = () => {
        setTvMode(true);
        try { (document.documentElement.requestFullscreen?.() as Promise<void> | undefined)?.catch(() => {}); } catch { /* ignore */ }
    };
    const exitTv = () => {
        setTvMode(false);
        try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ }
    };
    // Se sair da tela cheia pelo Esc, volta o layout normal.
    useEffect(() => {
        const onFs = () => { if (!document.fullscreenElement) setTvMode(false); };
        document.addEventListener("fullscreenchange", onFs);
        return () => document.removeEventListener("fullscreenchange", onFs);
    }, []);

    // No modo TV mostra 16 linhas (cabe bem na tela); ao sair, restaura o valor.
    const prevPerPage = useRef<number | null>(null);
    useEffect(() => {
        if (tvMode) {
            prevPerPage.current = itemsPerPage;
            setItemsPerPage(16);
            setPage(1);
        } else if (prevPerPage.current != null) {
            setItemsPerPage(prevPerPage.current);
            prevPerPage.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tvMode]);
    // Status manuais (logística) gravados localmente. O TOTVS só manda até
    // FATURADO/Nota Fiscal. EM ROTA vem do módulo de entregas; os estados
    // posteriores ainda aceitam o legado de override local deste navegador.
    const [overrides, setOverrides] = useState<Record<string, StatusWorkflow>>(() => {
        try {
            const raw = localStorage.getItem(OVERRIDES_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    });

    // Aplica o status manual por cima do status do TOTVS, sempre escolhendo o
    // mais avançado no fluxo (TOTVS vence até a NF; manual vence depois dela).
    const effectiveStatus = useCallback((base: StatusWorkflow, id: string): StatusWorkflow => {
        const ov = overrides[id];
        if (!ov) return base;
        return STATUS_LIST.indexOf(ov) > STATUS_LIST.indexOf(base) ? ov : base;
    }, [overrides]);

    // Aplica uma atualização na lista de mensagens de um pedido, tanto na tabela
    // principal (scheduling) quanto no card aberto no modal (selected), pra não
    // depender de um refetch completo a cada ação.
    const patchMensagens = useCallback((pedidoId: string, updater: (list: PedidoMensagem[]) => PedidoMensagem[]) => {
        setScheduling(prev => prev.map(s =>
            (s.pedidoId || s.id) === pedidoId ? { ...s, mensagens: updater(s.mensagens || []) } : s
        ));
        setSelected(prev => (prev && (prev.pedidoId || prev.id) === pedidoId)
            ? { ...prev, mensagens: updater(prev.mensagens || []) }
            : prev);
    }, []);

    const addMensagem = useCallback(async (pedidoId: string, texto: string): Promise<boolean> => {
        if (!pedidoId || !texto.trim() || !user?.id) return false;
        try {
            await api.post("/api-essencial/v1/pedidos-mensagem", {
                pedido_id: pedidoId,
                usuario_id: user.id,
                mensagem: texto.trim(),
            });
            // Não confia no formato exato da resposta do POST — busca a lista
            // definitiva desse pedido (endpoint dedicado, já vem mais recente
            // primeiro) pra garantir que o card/modal atualizam na hora, sem
            // esperar o próximo poll de 3min.
            const { data } = await api.get(`/api-essencial/v1/pedidos-mensagem/pedido/${pedidoId}`);
            const lista = ((data || []) as any[])
                .map(normalizePedidoMensagem)
                .filter((m): m is PedidoMensagem => !!m);
            patchMensagens(pedidoId, () => lista);
            return true;
        } catch {
            toast({ title: "Erro ao enviar comentário", description: "Tente novamente em instantes.", status: "error", duration: 4000, isClosable: true });
            return false;
        }
    }, [user, toast, patchMensagens]);

    const editMensagem = useCallback(async (pedidoId: string, mensagemId: string, texto: string): Promise<boolean> => {
        if (!texto.trim()) return false;
        try {
            await api.put(`/api-essencial/v1/pedidos-mensagem/${mensagemId}`, { mensagem: texto.trim() });
            patchMensagens(pedidoId, (list) => list.map(m => m.id === mensagemId ? { ...m, mensagem: texto.trim() } : m));
            return true;
        } catch {
            toast({ title: "Erro ao editar comentário", description: "Tente novamente em instantes.", status: "error", duration: 4000, isClosable: true });
            return false;
        }
    }, [toast, patchMensagens]);

    const deleteMensagem = useCallback(async (pedidoId: string, mensagemId: string): Promise<boolean> => {
        try {
            await api.delete(`/api-essencial/v1/pedidos-mensagem/${mensagemId}`);
            patchMensagens(pedidoId, (list) => list.filter(m => m.id !== mensagemId));
            return true;
        } catch {
            toast({ title: "Erro ao excluir comentário", description: "Tente novamente em instantes.", status: "error", duration: 4000, isClosable: true });
            return false;
        }
    }, [toast, patchMensagens]);

    // Pedido excluído/cancelado no TOTVS (situacao EXCLUIDO_ERP / CANCELADO_ERP),
    // marcado como excluído no sistema, ou que falhou ao integrar no ERP
    // (situacao ERRO_INTEGRACAO). Esses não podem aparecer no mapa.
    const pedidoExcluido = (situacao?: string, excluido?: boolean): boolean =>
        excluido === true ||
        ehPedidoBaixadoNoErp(situacao) ||
        situacao === "ERRO_INTEGRACAO";

    // Pedido que falhou na integração com o ERP: foi enviado pelo app
    // (payload_enviado preenchido) mas NUNCA recebeu número de pedido do ERP
    // (pedido_erp vazio). "Se deu erro, não tem pedido" — não pode aparecer no
    // mapa nem no Kanban, pois não representa um pedido real no TOTVS.
    const semPedidoErp = (pedidoErp?: string | null): boolean =>
        !pedidoErp || String(pedidoErp).trim() === "";

    const fetchData = useCallback(() => {
        setIsRefreshing(true);

        const empresaId = user?.empresa?.id;

        // Cadastro de filiais (GET /empresas — fica na RAIZ da API, sem o
        // prefixo /api-essencial/v1). Serve para dois fins: traduzir o código
        // da filial em nome ("0101" -> "SUPLEN MEDICAL MATRIZ") e saber de
        // quais empresas buscar pedidos. Mesmo caminho que ListParams já usa
        // para enxergar todas as filiais, e não só a do usuário logado.
        const filialDaSessao: Filial[] = empresaId
            ? [{ codigo: "", nome: "Minha filial", empresaId }]
            : [];
        const filiaisPromise: Promise<Filial[]> = api.get("/empresas")
            .then((r) => {
                const lista = ((r.data || []) as any[])
                    .filter((e: any) => e?.empresa_id)
                    .map((e: any): Filial => ({
                        codigo: (e.filial || "").toString().trim(),
                        nome: e.fantasia || e.filial || e.empresa_id,
                        empresaId: e.empresa_id,
                    }));
                return lista.length > 0 ? lista : filialDaSessao;
            })
            .catch(() => filialDaSessao);

        // Pedidos de TODAS as empresas cadastradas (o endpoint é por empresa,
        // então é uma chamada por filial). Sem isso os pedidos criados pelo app
        // em outra filial nunca entrariam no mapa. `__empresa` guarda a empresa
        // que devolveu o registro, usada só como fallback de rótulo quando o
        // pedido não tem filial_erp.
        const pedidosPromise: Promise<any[]> = filiaisPromise.then((lista) =>
            Promise.all(
                lista
                    .filter((f) => !!f.empresaId)
                    .map((f) =>
                        api.get(`/api-essencial/v1/pedidos/${f.empresaId}/empresa`)
                            .then((r) => ((r.data || []) as any[]).map((p) => ({ ...p, __empresa: f })))
                            .catch(() => [] as any[])
                    )
            ).then((porFilial) => porFilial.flat())
        );

        Promise.all([
            // 1) agendamentos por vendedor
            api.get("/api-essencial/v1/colaboradores")
                .then((colabRes) => {
                    const colaboradores: any[] = colabRes.data || [];
                    return Promise.all(
                        colaboradores.map((c: any) =>
                            api.get(`/api-essencial/v1/agendamentos/${c.colaborador_id}/vendedor`)
                                .then((r) => ({ items: r.data || [], nome: c.nome || "" }))
                                .catch(() => ({ items: [], nome: c.nome || "" }))
                        )
                    );
                })
                .catch(() => [] as { items: any[]; nome: string }[]),

            // 2) pedidos de consigna\u00e7\u00e3o sem agendamento (todas as filiais)
            pedidosPromise,

            // 3) tabela de médicos (codigo -> nome)
            api.get("/api-essencial/v1/medicos")
                .then((r) => (r.data || []) as any[])
                .catch(() => [] as any[]),

            // 4) tabela de convênios (codigo -> descricao)
            api.get("/api-essencial/v1/convenios")
                .then((r) => (r.data || []) as any[])
                .catch(() => [] as any[]),

            // 5) mensagens/comentários de todos os pedidos — busca em lote (mesmo
            // padrão das outras tabelas de apoio) e agrupa por pedido_id abaixo,
            // pra alimentar tanto a prévia no card do Kanban quanto o modal.
            api.get("/api-essencial/v1/pedidos-mensagem")
                .then((r) => (r.data || []) as any[])
                .catch(() => [] as any[]),

            // 6) filiais visíveis — alimenta as opções do filtro de Filial
            // (já resolvida acima; entra aqui só para chegar no .then).
            filiaisPromise,

            // 7) status da entrega de cada pedido (módulo de entregas). É a
            // fonte das baias EM ROTA e ENTREGUE — nenhuma das duas vem do
            // ERP; falha isolada não derruba o restante do mapa.
            listarStatusEntregaPorPedido().catch(() => ({} as Record<string, string>)),
        ])
        .then(([agendResults, pedidos, medicos, convenios, mensagensRaw, filiaisVisiveis, statusEntregaPorPedido]) => {
            setFiliaisCadastro((filiaisVisiveis as Filial[]).filter((f) => !!f.codigo));
            const entregaPorPedido = statusEntregaPorPedido as Record<string, string>;
            // Traduções de filial: código ("0101") e empresa_id -> nome.
            const nomePorCodigo: Record<string, string> = {};
            const codigoPorEmpresa: Record<string, string> = {};
            (filiaisVisiveis as Filial[]).forEach((f) => {
                if (f.codigo) nomePorCodigo[f.codigo] = f.nome;
                if (f.empresaId && f.codigo) codigoPorEmpresa[f.empresaId] = f.codigo;
            });
            // Filial REAL do pedido: filial_erp é quem manda (é o único campo que
            // separa pedido do TOTVS, já que todos eles ficam na empresa matriz);
            // sem ele, usa o código da empresa dona do registro.
            const filialDoPedido = (p: any): { codigo?: string; nome?: string } => {
                const codigo = ((p?.filial_erp ?? "").toString().trim())
                    || (p?.empresa_id ? codigoPorEmpresa[p.empresa_id] : "")
                    || "";
                if (!codigo) return {};
                return { codigo, nome: nomePorCodigo[codigo] || `Filial ${codigo}` };
            };
            // Mapas de código -> nome. Os pedidos guardam só o CÓDIGO do médico
            // (C5_CODMEDI) e do convênio (C5_CODCONV); o nome vem destas tabelas.
            const medById: Record<string, string> = {};
            (medicos as any[]).forEach((m) => {
                const c = (m?.codigo ?? "").toString().trim();
                if (c) medById[c] = m.nome;
            });
            const convById: Record<string, string> = {};
            (convenios as any[]).forEach((c) => {
                const k = (c?.codigo ?? "").toString().trim();
                if (k) convById[k] = c.descricao;
            });
            // Mensagens agrupadas por pedido_id, mais recente primeiro (a lista
            // geral não garante ordenação, diferente do GET por pedido).
            const mensagensPorPedido: Record<string, PedidoMensagem[]> = {};
            (mensagensRaw as any[]).forEach((raw) => {
                const norm = normalizePedidoMensagem(raw);
                if (!norm) return;
                if (!mensagensPorPedido[norm.pedidoId]) mensagensPorPedido[norm.pedidoId] = [];
                mensagensPorPedido[norm.pedidoId].push(norm);
            });
            Object.values(mensagensPorPedido).forEach((list) =>
                list.sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))
            );
            // Índice: pedido_id -> agendamento (a CIRURGIA marcada pelo vendedor).
            //
            // Por que não montamos mais uma lista separada a partir de /agendamentos
            // (o antigo `doAgendamento`): esse endpoint devolve o pedido por um
            // `select` enxuto (pedido_id, situacao, valor, data_emissao, tipo, erp,
            // nota) — sem payload_enviado/status_consignado/status_cirurgia/excluido.
            // Como o filtro exigia `payload_enviado` preenchido, a lista saía SEMPRE
            // vazia e TODO pedido caía no ramo de /pedidos abaixo, que usava
            // data_emissao como "data procedimento" — daí a coluna mostrar o dia em
            // que o vendedor fez o pedido em vez do dia da cirurgia.
            //
            // Agora a fonte única dos pedidos é /pedidos (que traz tudo) e o
            // agendamento entra só como enriquecimento: data/hora da cirurgia,
            // paciente, médico e convênio. Só urgência/eletiva geram agendamento
            // (ver criarPedidoUseCase no ESF-API: tiposComAgendamento), então
            // consignado/venda continuam sem data de cirurgia — por isso o fallback.
            const agendamentoPorPedido: Record<string, any> = {};
            (agendResults as { items: any[]; nome: string }[]).forEach(({ items }) =>
                (items as any[]).forEach((a: any) => {
                    const pid = a?.pedido_id || a?.pedido?.pedido_id;
                    if (!pid || a?.excluido) return;
                    const atual = agendamentoPorPedido[pid];
                    // Mais de um agendamento no mesmo pedido: fica com o que tem data.
                    if (!atual || (!atual.data_agendamento && a.data_agendamento)) {
                        agendamentoPorPedido[pid] = a;
                    }
                })
            );
            // Pedidos feitos direto no TOTVS (sem payload do app) — ex.: e-mail que o
            // time lança na mão. Entram no mapa (Lista/Kanban) desde que sejam ELETIVA,
            // URGENCIA ou CONSIGNADO/VALE_PERMANENTE (VENDA direto do ERP fica de fora
            // por enquanto) e do MÊS ATUAL — ~4 mil pedidos no total no ERP, então sem
            // o corte por mês o mapa fica inundado de histórico.
            //
            // "Do mês atual" = EMISSÃO **ou** NF no mês (2026-09-02). Olhar só a
            // emissão sumia justamente com o pedido que a logística acabou de
            // faturar: emitido no fim de um mês e faturado no começo do seguinte
            // (ex.: pedido 015160 / NF 000063789 — emissão 31/08, NF 02/09) ficava
            // invisível já no dia 1º, com a esteira toda ainda por acompanhar.
            const inicioMes = DateTime.now().startOf("month").toISODate();
            const fimMes = DateTime.now().endOf("month").toISODate();
            const noMesAtual = (dia: string) => !!dia && dia >= (inicioMes ?? "") && dia <= (fimMes ?? "");
            const doPedidos: Scheduling[] = (pedidos as any[])
                .filter((p: any) => {
                    if (pedidoExcluido(p.situacao, p.excluido)) return false;
                    if (semPedidoErp(p.pedido_erp)) return false;
                    if (pedidoTravadoSyncSemNF(p)) return false;
                    // Pedido do app: sem restrição adicional (regra original).
                    if (p.payload_enviado) return true;
                    // Pedido nativo do ERP: só eletiva/consignado, só do mês atual
                    // (pela emissão OU pela NF — ver comentário do noMesAtual).
                    // data_faturamento é `@db.Date` (meia-noite UTC): lida por
                    // dataCalendario, senão no fuso local cai no dia anterior.
                    const dataEmissao = (p.data_emissao || "").substring(0, 10);
                    const dataNF = dataCalendario(p.data_faturamento) ?? "";
                    return tipoErpNativoPermitido(p.tipo_pedido)
                        && (noMesAtual(dataEmissao) || noMesAtual(dataNF));
                })
                .map((p: any): Scheduling => {
                    // Paciente, médico e convênio ficam dentro do payload_enviado que o
                    // app mandou pro TOTVS. Só vêm preenchidos em URGÊNCIA/ELETIVA;
                    // CONSIGNADO/VENDA não gravam esses dados (ficam "—"). O agendamento
                    // (quando existe) é a segunda fonte, e a única do pedido nativo do ERP.
                    const payload = parsePayload(p);
                    const tipo = tipoDoPedido(p);
                    const erpExtractStatus = erpExtractStatusOf(p, payload, tipo);
                    const codMed = doPayload(payload, "C5_CODMEDI", "medico_codigo", "codigo_medico");
                    const codConv = doPayload(payload, "C5_CODCONV", "convenio_codigo", "codigo_convenio");
                    const pac = doPayload(payload, "C5_PACIENT", "paciente");
                    // Nome do médico direto do payload: serve quando o código não
                    // casa com nenhum cadastro local (medById), o que acontece se o
                    // ERP mandar um médico que o ESF ainda não tem.
                    const nomeMed = doPayload(payload, "C5_NOMEMED", "medico_nome", "medico");
                    const agend = agendamentoPorPedido[p.pedido_id];
                    // Data da CIRURGIA (agendamentos.data_agendamento é `@db.Date`, chega
                    // como meia-noite UTC — o substring lê o dia certo, sem fuso).
                    // Não usamos pedido.previsao_entrega, que é onde o app grava a data do
                    // procedimento no POST: o webhook do ERP sobrescreve esse campo com a
                    // data de emissão do próprio ERP (ESF-API, processarWebhookPedidoUseCase).
                    // O agendamento é a fonte boa, mas pedido lançado direto no ERP não
                    // tem agendamento nenhum — daí a segunda tentativa no payload
                    // (C5_DTPROCE é a coluna do Protheus; as outras grafias cobrem o
                    // formato que o webhook usar quando passar a mandar a data).
                    const dataCirurgia = (agend?.data_agendamento || "").toString().substring(0, 10)
                        || dataProcedimentoDoPayload(payload)
                        || undefined;
                    return {
                        id: p.pedido_id,
                        pedidoId: p.pedido_id,
                        // Data exibida: a da cirurgia quando existe; consignado/venda não
                        // têm cirurgia marcada, então cai na emissão do pedido (o filtro de
                        // período e a ordenação precisam de uma data sempre preenchida).
                        dataAgendamento: dataCirurgia || (p.data_emissao || "").substring(0, 10),
                        dataCirurgia,
                        horaCirurgia: normalizeHoraCirurgia(agend?.hora_agendamento) ?? horaCirurgiaDoPedido(p, payload),
                        tipo,
                        cliente: { razaoSocial: p.clientes?.fantasia || p.clientes?.razao_social || "" },
                        colaborador: { nome: p.colaboradores?.nome || "" },
                        origem: p.payload_enviado ? "APP" : "PROTHEUS",
                        filialCodigo: filialDoPedido(p).codigo ?? p.__empresa?.codigo,
                        filialNome: filialDoPedido(p).nome ?? p.__empresa?.nome,
                        regiao: p.clientes?.regiao || undefined,
                        // Decimal do Prisma chega como string no JSON — Number() aqui
                        // para a coluna VALOR poder formatar em moeda.
                        valorPedido: p.valor_pedido != null ? Number(p.valor_pedido) : undefined,
                        condicaoPagamento: p.condicao_pagamento || undefined,
                        paciente: pac || agend?.paciente || undefined,
                        medico: (codMed ? medById[codMed] : undefined) || agend?.medico?.nome || nomeMed || undefined,
                        mensagens: mensagensPorPedido[p.pedido_id] || [],
                        pedidoProtheus: p.pedido_erp ?? undefined,
                        statusWorkflow: statusWorkflowDoPedido(
                            p,
                            payload,
                            tipo,
                            entregaPorPedido[String(p.pedido_id)]
                        ),
                        numeroNF: p.nota_erp ?? undefined,
                        statusPedido: p.situacao ?? undefined,
                        erpExtractStatus,
                        convenio: (codConv ? convById[codConv] : undefined)
                            || agend?.convenio?.descricao || agend?.convenio?.codigo || undefined,
                        procedimento: undefined,
                        dataEmissao: p.data_emissao ?? undefined,
                        horaEmissao: p.hora_emissao ?? undefined,
                        ultimaAlteracao: p.ultima_alteracao ?? undefined,
                        dataFaturamento: p.data_faturamento ?? undefined,
                        horaFaturamento: p.hora_faturamento ?? undefined,
                    };
                });

            const stamped = registrarFinalizadoObservado(
                registrarFaturamentoObservado(doPedidos)
            );
            setScheduling(aplicaCorteVisibilidade(stamped));
            setHasError(false);
        })
        .catch(() => {
            setScheduling([]);
            setHasError(true);
        })
        .finally(() => {
            setIsLoading(false);
            setIsRefreshing(false);
            setLastUpdate(DateTime.now());
        });
    }, [user]);

    // TEMPORARIO — sincronizacao manual com o ERP, um pedido por vez, para recuperar
    // as notas fiscais que ficaram para tras. Usa a rota individual ja existente
    // (POST /pedidos/:id/sincronizar-erp) em vez da rota em lote: assim o progresso
    // aparece na tela e nao ha risco de timeout numa unica requisicao longa.
    // Considera o mesmo periodo escolhido no filtro de datas da barra.
    // REMOVER depois de rodar.
    const sincronizarErp = useCallback(async () => {
        // Só os pedidos sem nota fiscal dentro do período filtrado — não faz sentido
        // reconsultar quem já tem NF.
        const alvos = scheduling.filter((p) => {
            const semNota = !p.numeroNF || String(p.numeroNF).trim() === "";
            if (!semNota || !p.pedidoProtheus) return false;
            if (!p.dataEmissao) return true;
            const dia = p.dataEmissao.slice(0, 10);
            // Data vazia = sem limite naquela ponta.
            if (syncErpDe && dia < syncErpDe) return false;
            if (syncErpAte && dia > syncErpAte) return false;
            return true;
        });

        if (alvos.length === 0) {
            toast({
                title: "Nada a sincronizar",
                description: "Todos os pedidos do período selecionado já possuem nota fiscal.",
                status: "info",
                duration: 5000,
                isClosable: true,
            });
            return;
        }

        popoverSyncErp.onClose();
        setSyncErpTotal(alvos.length);
        setSyncErpRestantes(alvos.length);
        setIsSyncingErp(true);

        let atualizados = 0;
        let falhas = 0;

        for (let i = 0; i < alvos.length; i++) {
            try {
                await api.post(`/api-essencial/v1/pedidos/${alvos[i].id}/sincronizar-erp`);
                atualizados++;
            } catch {
                falhas++;
            }
            setSyncErpRestantes(alvos.length - (i + 1));
        }

        setIsSyncingErp(false);
        toast({
            title: "Sincronização concluída",
            description: `${atualizados} pedido(s) consultado(s) no ERP${falhas > 0 ? `, ${falhas} com falha` : ""}.`,
            status: falhas > 0 ? "warning" : "success",
            duration: 8000,
            isClosable: true,
        });
        fetchData();
    }, [scheduling, syncErpDe, syncErpAte, toast, fetchData, popoverSyncErp]);

    useEffect(() => {
        fetchData();
        const timer = setInterval(fetchData, 180000);
        return () => { clearInterval(timer); };
    }, [fetchData]);

    const tipoOrder: Record<TipoCirurgia, number> = { URGENCIA: 0, ELETIVA: 1, CONSIGNADO: 2, VENDA: 3 };

    // statusTotvs = o que o ERP determinou (base); statusWorkflow = efetivo, já
    // com o status manual da logística aplicado por cima quando for mais avançado.
    const effItems: Scheduling[] = scheduling.map(s => {
        const eff = effectiveStatus(s.statusWorkflow, s.id);
        return eff === s.statusWorkflow
            ? { ...s, statusTotvs: s.statusWorkflow }
            : { ...s, statusTotvs: s.statusWorkflow, statusWorkflow: eff };
    });

    // Opções de região vêm dos próprios dados carregados (não há tabela de
    // catálogo de regiões — o campo é um código livre em clientes.regiao).
    const regioesDisponiveis = Array.from(
        new Set(effItems.map(s => s.regiao).filter((r): r is string => !!r))
    ).sort();

    // A Valeza não trabalha com urgência, eletiva nem consignado — todo pedido é
    // VENDA. Oferecer tipos que nunca retornam nada faz o filtro mentir, então a
    // lista sai dos próprios pedidos carregados (some sozinho aqui e continua
    // completa na SUPLEN, que usa o mesmo componente). Sem pedido carregado
    // ainda, cai na lista fixa para o filtro não aparecer vazio.
    const tiposPresentes = new Set(effItems.map(s => s.tipo));
    const tipoFilterOptions = tiposPresentes.size > 0
        ? TIPO_FILTER_OPTIONS.filter(([v]) => tiposPresentes.has(v))
        : TIPO_FILTER_OPTIONS;

    // Mesma regra do Kanban, para o filtro de status não oferecer baias OPME
    // (apontado/devolução) que nunca trariam resultado na Valeza.
    const statusComPedido = new Set(effItems.map(s => s.statusWorkflow));
    const statusFilterOptions = STATUS_LIST.filter(
        s => !BAIAS_OPME.includes(s) || statusComPedido.has(s)
    );

    // Todos os demais filtros, sem o de Filial. Fica separado para servir de
    // base à contagem por filial abaixo: o número ao lado de cada opção precisa
    // dizer quantos pedidos aquela filial traria com os OUTROS filtros já
    // aplicados — senão prometeria resultado que a seleção não entrega.
    const passaDemaisFiltros = (s: Scheduling) => {
        if (filterStatuses.length > 0 && !filterStatuses.includes(s.statusWorkflow)) return false;
        if (filterTipos.length > 0 && !filterTipos.includes(s.tipo)) return false;
        if (filterRegioes.length > 0 && !filterRegioes.includes(s.regiao || "")) return false;
        if (filterOrigens.length > 0 && !filterOrigens.includes(s.origem)) return false;
        // Filtro por período (dataAgendamento vem como "YYYY-MM-DD"). Comparação
        // lexicográfica funciona porque o formato ISO é ordenável como texto.
        // "De" sozinha = a partir dela; "Até" sozinha = até ela; ambas = intervalo.
        const data = (s.dataAgendamento || "").substring(0, 10);
        if (filterDate && data < filterDate) return false;
        if (filterDateEnd && data > filterDateEnd) return false;
        return true;
    };

    const antesDoFiltroFilial = effItems.filter(passaDemaisFiltros);

    // Quantos pedidos cada filial traria, para exibir ao lado do nome no menu.
    const contagemPorFilial = antesDoFiltroFilial.reduce((acc, s) => {
        const cod = s.filialCodigo || "";
        if (cod) acc[cod] = (acc[cod] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // O menu lista TODAS as filiais do cadastro (mesmo as zeradas) mais os
    // códigos que aparecem só nos pedidos — é o caso da 0301 (Neurovasc), que
    // não tem empresa cadastrada. A contagem ao lado evita a surpresa de
    // selecionar uma filial e cair em "Nenhum registro encontrado".
    const filiaisDisponiveis: Filial[] = Array.from(
        antesDoFiltroFilial
            .reduce((acc, s) => {
                if (s.filialCodigo && !acc.has(s.filialCodigo)) {
                    acc.set(s.filialCodigo, { codigo: s.filialCodigo, nome: s.filialNome || `Filial ${s.filialCodigo}` });
                }
                return acc;
            }, new Map<string, Filial>(filiaisCadastro.map((f) => [f.codigo, f])))
            .values()
    ).sort((a, b) => a.nome.localeCompare(b.nome));

    const filtered = antesDoFiltroFilial
        .filter(s => filterFiliais.length === 0 || filterFiliais.includes(s.filialCodigo || ""))
        .sort((a, b) => {
            // 1) Pendentes (sem NF) SEMPRE no topo -> caem na primeira página, pois a
            //    logística precisa enxergar tudo que ainda falta faturar.
            const aNF = !!a.numeroNF ? 1 : 0;
            const bNF = !!b.numeroNF ? 1 : 0;
            if (aNF !== bNF) return aNF - bNF;
            // 2) Dentro de cada grupo, do mais recente para o mais antigo. Assim o
            //    pedido recém-faturado vai pro topo do grupo "com NF" (continua na
            //    primeira página, não some) e só sai dali quando entrar faturado mais
            //    novo que empurre ("só se não couber mais na primeira página").
            return (b.dataAgendamento || "").localeCompare(a.dataAgendamento || "");
        });

    // ─── Materiais do pedido, sob demanda ────────────────────────────────────
    // O endpoint que alimenta o mapa (/pedidos/:id_empresa/empresa) NÃO devolve
    // item_pedido; quem devolve os itens com nome de produto é o GET /pedidos/:id,
    // um pedido por vez. Então buscamos só o necessário: os cards que estão no
    // Kanban (onde os materiais aparecem no card) e o pedido aberto no modal —
    // cada um uma única vez, em lotes pequenos pra não disparar dezenas de
    // requisições simultâneas. A Lista não dispara nada (só o modal, ao abrir).
    const idsMateriais = (viewMode === "kanban" ? filtered : [])
        .map((s) => s.pedidoId || s.id)
        .concat(selected ? [selected.pedidoId || selected.id] : [])
        .filter((id): id is string => !!id);
    const chaveMateriais = idsMateriais.join(",");

    useEffect(() => {
        const pendentes = chaveMateriais
            .split(",")
            .filter((id) => id && !materiaisSolicitados.current.has(id));
        if (pendentes.length === 0) return;
        // Marca antes de buscar: evita refazer o GET a cada poll/re-render. Uma
        // falha não é re-tentada de propósito (o card fica sem a linha de
        // materiais em vez de entrar em loop de requisição).
        pendentes.forEach((id) => materiaisSolicitados.current.add(id));
        let cancelado = false;
        (async () => {
            const LOTE = 4;
            for (let i = 0; i < pendentes.length; i += LOTE) {
                // Cancelado no meio da fila (re-render entre lotes, e cada lote
                // provoca um ao gravar o estado): os que ainda NÃO foram
                // buscados voltam a ficar pendentes. Sem isso eles seguiam
                // marcados como solicitados e o efeito seguinte os pulava --
                // card preso em "Carregando materiais..." pra sempre.
                if (cancelado) {
                    pendentes.slice(i).forEach((id) => materiaisSolicitados.current.delete(id));
                    return;
                }
                const lote = pendentes.slice(i, i + LOTE);
                const respostas = await Promise.all(
                    lote.map((id) =>
                        api.get(`/api-essencial/v1/pedidos/${id}`)
                            .then((r) => [id, normalizaMateriais(r.data)] as [string, MaterialPedido[]])
                            .catch(() => [id, [] as MaterialPedido[]] as [string, MaterialPedido[]])
                    )
                );
                if (cancelado) {
                    pendentes.slice(i + LOTE).forEach((id) => materiaisSolicitados.current.delete(id));
                    return;
                }
                setMateriaisPorPedido((prev) => {
                    const next = { ...prev };
                    respostas.forEach(([id, itens]) => { next[id] = itens; });
                    return next;
                });
            }
        })();
        return () => { cancelado = true; };
    }, [chaveMateriais]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const firstRow = filtered.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const lastRow = Math.min(currentPage * itemsPerPage, filtered.length);
    // Colunas da expedição. Paciente/Convênio/Médico saíram: vinham dos campos
    // OPME do Protheus (C5_PACIENT, C5_CODMEDI, C5_CODCONV), que não existem no
    // ERP de um laticínio e chegavam sempre vazios. No lugar entram dados que o
    // pedido já traz do TOTVS: valor e condição de pagamento.
    const TABLE_COLS = [
        { label: "CLIENTE",           flex: 1.8 },
        { label: "DATA DO PEDIDO",    flex: 1.3 },
        { label: "VALOR",             flex: 1.1 },
        { label: "COND. PAGAMENTO",   flex: 1.3 },
        { label: "VENDEDOR",          flex: 1.2 },
        { label: "PEDIDO / NF",       flex: 1.4 },
    ];

    if (isLoading) {
        const loadingContent = (
            // @ts-ignore
            <Flex ml={larguraAtual} mt="80px" h="calc(100vh - 80px)" align="center" justify="center" bg="gray.700">
                <Stack align="center" spacing={4}>
                    <Spinner size="xl" color="orange.500" thickness="4px" />
                    <Text color="gray.50">Carregando mapa...</Text>
                </Stack>
            </Flex>
        ) as React.ReactElement;
        return (
            <>
                <Header />
                <SiderbarResponsive />
                {loadingContent}
            </>
        );
    }

    return (
        <>
            {!tvMode && <Header />}
            {!tvMode && <SiderbarResponsive />}

            <Flex direction="column" ml={tvMode ? "0" : larguraAtual} mt={tvMode ? "0" : "80px"} minH={tvMode ? "100vh" : "calc(100vh - 80px)"} bg="gray.700">

                {/* ── Título (oculto no modo TV) ── */}
                {!tvMode && (
                <Box
                    bg="gray.800"
                    py={4}
                    px={6}
                    textAlign="center"
                    flexShrink={0}
                    borderBottom="2px solid"
                    borderColor="orange.500"
                >
                    <Text fontWeight="semibold" fontSize="xl" color="gray.50">
                        MAPA DE EXPEDIÇÃO{viewMode === "kanban" ? " — KANBAN" : ""}
                    </Text>
                </Box>
                )}

                {/* ── Barra de ferramentas (oculta no modo TV) ── */}
                {!tvMode && (
                <Flex
                    direction="column" gap={2} px={3} py={2.5}
                    bg="gray.800" borderBottom="2px solid" borderColor="orange.500"
                    flexShrink={0}
                >
                    <Flex align="center" justify="space-between" gap={3} w="100%" flexWrap="wrap">
                        <HStack spacing={2} flexWrap="wrap" flex={1} minW={0}>
                            {/* Período: ícone + duas datas num painel único (menos poluição) */}
                            <RowFlex
                                align="center" h="34px" px={2} gap={1} flexShrink={0}
                                bg="gray.900" border="1px solid" borderColor="gray.700" borderRadius="md"
                                _hover={{ borderColor: "gray.600" }}
                            >
                                <Icon as={FaRegCalendarAlt} color="gray.500" w={3.5} h={3.5} flexShrink={0} />
                                <Input
                                    type="date" aria-label="Data inicial"
                                    variant="unstyled" size="sm" w="112px" fontSize="sm"
                                    value={filterDate}
                                    max={filterDateEnd || undefined}
                                    onChange={e => { setFilterDate(e.target.value); setPage(1); }}
                                    color="gray.50"
                                    // O ícone do calendário nativo e os segmentos (dd/mm/aaaa) só
                                    // ficam legíveis se o colorScheme do input acompanhar o tema —
                                    // fixo em "dark" o navegador desenha um miolo escuro sobre o
                                    // campo já branco do tema claro (feio, "caixa escura" no meio).
                                    sx={{ colorScheme: ehClaro ? "light" : "dark" }}
                                />
                                <Box w="1px" h="16px" bg="gray.700" flexShrink={0} />
                                <Input
                                    type="date" aria-label="Data final"
                                    variant="unstyled" size="sm" w="112px" fontSize="sm"
                                    value={filterDateEnd}
                                    min={filterDate || undefined}
                                    onChange={e => { setFilterDateEnd(e.target.value); setPage(1); }}
                                    color="gray.50"
                                    sx={{ colorScheme: ehClaro ? "light" : "dark" }}
                                />
                                {(filterDate || filterDateEnd) && (
                                    <IconButton
                                        aria-label="Limpar período" size="xs" variant="ghost"
                                        icon={<Icon as={FaTimes} />}
                                        onClick={() => { setFilterDate(""); setFilterDateEnd(""); setPage(1); }}
                                        color="gray.400" _hover={{ bg: "whiteAlpha.200", color: "gray.100" }}
                                    />
                                )}
                            </RowFlex>

                            {/* Status: multi-select (checkbox), mesmo padrão da Região */}
                            <Menu closeOnSelect={false}>
                                <MenuButton
                                    as={Button}
                                    size="sm"
                                    h="34px"
                                    className="map-select"
                                    variant="unstyled"
                                    px={3}
                                    fontWeight="normal"
                                    textAlign="left"
                                >
                                    {filterStatuses.length > 0 ? `Status (${filterStatuses.length})` : "Todos os Status"}
                                </MenuButton>
                                <MenuList bg="gray.800" borderColor="gray.700" minW="200px" maxH="260px" overflowY="auto">
                                    <MenuOptionGroup
                                        type="checkbox"
                                        value={filterStatuses}
                                        onChange={(vals) => { setFilterStatuses(vals as string[]); setPage(1); }}
                                    >
                                        {statusFilterOptions.map(s => (
                                            <MenuItemOption key={s} value={s} color="gray.100" bg="gray.800" _hover={{ bg: "gray.700" }} _focus={{ bg: "gray.700" }}>
                                                {STATUS_CFG[s].label}
                                            </MenuItemOption>
                                        ))}
                                    </MenuOptionGroup>
                                    {filterStatuses.length > 0 && (
                                        <Box px={3} pt={2} borderTop="1px solid" borderColor="gray.700">
                                            <RowText
                                                as="button"
                                                fontSize="xs"
                                                color="orange.300"
                                                fontWeight="bold"
                                                onClick={() => { setFilterStatuses([]); setPage(1); }}
                                            >
                                                Limpar seleção
                                            </RowText>
                                        </Box>
                                    )}
                                </MenuList>
                            </Menu>

                            {/* Tipo: multi-select (checkbox) */}
                            <Menu closeOnSelect={false}>
                                <MenuButton
                                    as={Button}
                                    size="sm"
                                    h="34px"
                                    className="map-select"
                                    variant="unstyled"
                                    px={3}
                                    fontWeight="normal"
                                    textAlign="left"
                                >
                                    {filterTipos.length > 0 ? `Tipo (${filterTipos.length})` : "Todos os Tipos"}
                                </MenuButton>
                                <MenuList bg="gray.800" borderColor="gray.700" minW="180px" maxH="260px" overflowY="auto">
                                    <MenuOptionGroup
                                        type="checkbox"
                                        value={filterTipos}
                                        onChange={(vals) => { setFilterTipos(vals as string[]); setPage(1); }}
                                    >
                                        {tipoFilterOptions.map(([v, label]) => (
                                            <MenuItemOption key={v} value={v} color="gray.100" bg="gray.800" _hover={{ bg: "gray.700" }} _focus={{ bg: "gray.700" }}>
                                                {label}
                                            </MenuItemOption>
                                        ))}
                                    </MenuOptionGroup>
                                    {filterTipos.length > 0 && (
                                        <Box px={3} pt={2} borderTop="1px solid" borderColor="gray.700">
                                            <RowText
                                                as="button"
                                                fontSize="xs"
                                                color="orange.300"
                                                fontWeight="bold"
                                                onClick={() => { setFilterTipos([]); setPage(1); }}
                                            >
                                                Limpar seleção
                                            </RowText>
                                        </Box>
                                    )}
                                </MenuList>
                            </Menu>

                            {/* Origem: multi-select (checkbox) */}
                            <Menu closeOnSelect={false}>
                                <MenuButton
                                    as={Button}
                                    size="sm"
                                    h="34px"
                                    className="map-select"
                                    variant="unstyled"
                                    px={3}
                                    fontWeight="normal"
                                    textAlign="left"
                                >
                                    {filterOrigens.length > 0 ? `Origem (${filterOrigens.length})` : "Todas as Origens"}
                                </MenuButton>
                                <MenuList bg="gray.800" borderColor="gray.700" minW="180px" maxH="260px" overflowY="auto">
                                    <MenuOptionGroup
                                        type="checkbox"
                                        value={filterOrigens}
                                        onChange={(vals) => { setFilterOrigens(vals as string[]); setPage(1); }}
                                    >
                                        <MenuItemOption value="APP" color="gray.100" bg="gray.800" _hover={{ bg: "gray.700" }} _focus={{ bg: "gray.700" }}>
                                            Só do APP
                                        </MenuItemOption>
                                        <MenuItemOption value="PROTHEUS" color="gray.100" bg="gray.800" _hover={{ bg: "gray.700" }} _focus={{ bg: "gray.700" }}>
                                            Só do TOTVS
                                        </MenuItemOption>
                                    </MenuOptionGroup>
                                    {filterOrigens.length > 0 && (
                                        <Box px={3} pt={2} borderTop="1px solid" borderColor="gray.700">
                                            <RowText
                                                as="button"
                                                fontSize="xs"
                                                color="orange.300"
                                                fontWeight="bold"
                                                onClick={() => { setFilterOrigens([]); setPage(1); }}
                                            >
                                                Limpar seleção
                                            </RowText>
                                        </Box>
                                    )}
                                </MenuList>
                            </Menu>

                            {/* Região: multi-select (checkbox) — as opções vêm dos dados
                                carregados, pois não há tabela de catálogo de regiões. */}
                            <Menu closeOnSelect={false}>
                                <MenuButton
                                    as={Button}
                                    size="sm"
                                    h="34px"
                                    className="map-select"
                                    variant="unstyled"
                                    px={3}
                                    fontWeight="normal"
                                    textAlign="left"
                                >
                                    {filterRegioes.length > 0 ? `Região (${filterRegioes.length})` : "Todas as Regiões"}
                                </MenuButton>
                                <MenuList bg="gray.800" borderColor="gray.700" minW="180px" maxH="260px" overflowY="auto">
                                    {regioesDisponiveis.length === 0 ? (
                                        <Text px={3} py={2} fontSize="sm" color="gray.500">Nenhuma região disponível</Text>
                                    ) : (
                                        <MenuOptionGroup
                                            type="checkbox"
                                            value={filterRegioes}
                                            onChange={(vals) => { setFilterRegioes(vals as string[]); setPage(1); }}
                                        >
                                            {regioesDisponiveis.map(r => (
                                                <MenuItemOption key={r} value={r} color="gray.100" bg="gray.800" _hover={{ bg: "gray.700" }} _focus={{ bg: "gray.700" }}>
                                                    {`Região ${rotuloRegiao(r)}`}
                                                </MenuItemOption>
                                            ))}
                                        </MenuOptionGroup>
                                    )}
                                    {filterRegioes.length > 0 && (
                                        <Box px={3} pt={2} borderTop="1px solid" borderColor="gray.700">
                                            <RowText
                                                as="button"
                                                fontSize="xs"
                                                color="orange.300"
                                                fontWeight="bold"
                                                onClick={() => { setFilterRegioes([]); setPage(1); }}
                                            >
                                                Limpar seleção
                                            </RowText>
                                        </Box>
                                    )}
                                </MenuList>
                            </Menu>

                            {/* Filial: multi-select (checkbox). Agrupa pela filial REAL do
                                pedido (filial_erp), então traz junto o que veio do TOTVS e
                                o que veio do app. Lista o cadastro inteiro de filiais mais
                                os códigos vistos nos pedidos — ver filiaisDisponiveis. */}
                            {filiaisDisponiveis.length > 0 && (
                                <Menu closeOnSelect={false}>
                                    <MenuButton
                                        as={Button}
                                        size="sm"
                                        h="34px"
                                        className="map-select"
                                        variant="unstyled"
                                        px={3}
                                        fontWeight="normal"
                                        textAlign="left"
                                    >
                                        {filterFiliais.length > 0 ? `Filial (${filterFiliais.length})` : "Todas as Filiais"}
                                    </MenuButton>
                                    <MenuList bg="gray.800" borderColor="gray.700" minW="220px" maxH="260px" overflowY="auto">
                                        <MenuOptionGroup
                                            type="checkbox"
                                            value={filterFiliais}
                                            onChange={(vals) => { setFilterFiliais(vals as string[]); setPage(1); }}
                                        >
                                            {filiaisDisponiveis.map(f => {
                                                const qtd = contagemPorFilial[f.codigo] || 0;
                                                return (
                                                    <MenuItemOption key={f.codigo} value={f.codigo} color={qtd > 0 ? "gray.100" : "gray.500"} bg="gray.800" _hover={{ bg: "gray.700" }} _focus={{ bg: "gray.700" }}>
                                                        {`${f.nome} (${qtd})`}
                                                    </MenuItemOption>
                                                );
                                            })}
                                        </MenuOptionGroup>
                                        {filterFiliais.length > 0 && (
                                            <Box px={3} pt={2} borderTop="1px solid" borderColor="gray.700">
                                                <RowText
                                                    as="button"
                                                    fontSize="xs"
                                                    color="orange.300"
                                                    fontWeight="bold"
                                                    onClick={() => { setFilterFiliais([]); setPage(1); }}
                                                >
                                                    Limpar seleção
                                                </RowText>
                                            </Box>
                                        )}
                                    </MenuList>
                                </Menu>
                            )}
                        </HStack>

                        <HStack spacing={1.5} flexShrink={0}>
                            {/* Status do sistema: registros + relógio do último polling */}
                            <HStack spacing={2}>
                                <HStack bg="whiteAlpha.100" border="1px solid" borderColor="whiteAlpha.200" borderRadius="full" px={2.5} h="26px" spacing={1.5}>
                                    <Icon as={FaClipboardList} color="gray.300" w={3} h={3} />
                                    <Text fontWeight="black" color="gray.200" fontSize="xs" whiteSpace="nowrap">{filtered.length} registros</Text>
                                </HStack>
                                <HStack spacing={1}>
                                    <Icon as={FaWifi} color="green.400" w={3} h={3} />
                                    <Text fontSize="xs" color="gray.300">{lastUpdate.toFormat("HH:mm:ss")}</Text>
                                </HStack>
                                {isRefreshing && <Icon as={FaSyncAlt} color="orange.400" w={4} h={4} />}
                            </HStack>

                            {/* TEMPORARIO — sincronizacao manual com o ERP, para recuperar as
                                notas fiscais antigas. REMOVER depois de rodar. */}
                            <Popover
                                isOpen={popoverSyncErp.isOpen}
                                onOpen={popoverSyncErp.onOpen}
                                onClose={popoverSyncErp.onClose}
                                placement="bottom-end"
                            >
                                <PopoverTrigger>
                                    <Button
                                        size="sm"
                                        h="34px"
                                        colorScheme="orange"
                                        variant="outline"
                                        fontSize="xs"
                                        leftIcon={<Icon as={FaSyncAlt} w={3} h={3} />}
                                        isLoading={isSyncingErp}
                                        loadingText={`Faltam ${syncErpRestantes} de ${syncErpTotal}...`}
                                        flexShrink={0}
                                        title="Consulta o ERP e grava as notas fiscais que faltam"
                                    >
                                        Atualizar ERP
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent bg="gray.800" borderColor="gray.700" w="260px">
                                    <PopoverArrow bg="gray.800" />
                                    <PopoverBody>
                                        <Text fontSize="xs" color="gray.400" mb={2}>
                                            Período de emissão dos pedidos a sincronizar. Em branco = sem limite.
                                        </Text>
                                        <HStack spacing={2} mb={3}>
                                            <Box flex={1}>
                                                <Text fontSize="10px" color="gray.500" mb={1}>De</Text>
                                                <Input
                                                    type="date" size="sm" fontSize="xs"
                                                    bg="gray.900" borderColor="gray.700" color="gray.100"
                                                    value={syncErpDe}
                                                    onChange={(e) => setSyncErpDe(e.target.value)}
                                                />
                                            </Box>
                                            <Box flex={1}>
                                                <Text fontSize="10px" color="gray.500" mb={1}>Até</Text>
                                                <Input
                                                    type="date" size="sm" fontSize="xs"
                                                    bg="gray.900" borderColor="gray.700" color="gray.100"
                                                    value={syncErpAte}
                                                    onChange={(e) => setSyncErpAte(e.target.value)}
                                                />
                                            </Box>
                                        </HStack>
                                        <Button
                                            size="sm" w="100%" colorScheme="orange" fontSize="xs"
                                            leftIcon={<Icon as={FaSyncAlt} w={3} h={3} />}
                                            onClick={sincronizarErp}
                                        >
                                            Atualizar
                                        </Button>
                                    </PopoverBody>
                                </PopoverContent>
                            </Popover>

                            {/* Ação TV (tela cheia). A troca Lista ⇄ Kanban saiu daqui e virou
                                item próprio no menu lateral — ver SiderbarResponsive. */}
                            <RowFlex bg="gray.900" borderRadius="md" p="3px" border="1px solid" borderColor="gray.700" flexShrink={0} gap={1}>
                                {/* Botão TV: tela cheia só com o mapa (sem backend) */}
                                <RowFlex
                                    onClick={tvMode ? exitTv : enterTv}
                                    align="center" gap={2} px={3} py={1.5} borderRadius="sm" cursor="pointer"
                                    bg={tvMode ? "orange.500" : "transparent"}
                                    _hover={{ bg: tvMode ? "orange.500" : "gray.800" }}
                                    transition="all 0.15s"
                                    title={tvMode ? "Sair da tela cheia" : "Modo TV (tela cheia)"}
                                >
                                    <Icon as={tvMode ? FaCompress : FaTv} w={3.5} h={3.5} color={tvMode ? "white" : "gray.400"} />
                                    <RowText fontSize="xs" fontWeight="bold" color={tvMode ? "white" : "gray.400"}>{tvMode ? "Sair" : "TV"}</RowText>
                                </RowFlex>
                            </RowFlex>
                        </HStack>
                    </Flex>

                </Flex>
                )}

                {/* ── Conteúdo: Lista (tabela) ou Kanban (raias) ── */}
                {viewMode === "kanban" ? (
                    <KanbanBoard
                        items={filtered}
                        onCardClick={setSelected}
                        colMaxH={tvMode ? "calc(100vh - 40px)" : "calc(100vh - 230px)"}
                        materiaisPorPedido={materiaisPorPedido}
                    />
                ) : (
                <Flex flex={1} align="stretch" px={3} py={3} gap={2}>

                    {/* Conteúdo da tabela — linhas brancas direto sobre o fundo escuro */}
                    <Box flex={1} overflow="hidden">

                        {/* Cabeçalho */}
                        <Flex borderRadius="md" overflow="hidden" mb={2} boxShadow="sm">
                            {/* STATUS */}
                            <Flex w="168px" flexShrink={0} bg="#2D7D9A" align="center" justify="center" py={3} px={3}>
                                <Text fontWeight="black" fontSize="xs" color="white" letterSpacing="wider">STATUS</Text>
                            </Flex>
                            {/* TEMPO NO SISTEMA */}
                            <Flex w="92px" flexShrink={0} bg="#2D7D9A" align="center" justify="center" py={3} px={2}
                                borderLeft="1px solid rgba(255,255,255,0.25)">
                                <Text fontWeight="black" fontSize="xs" color="white" letterSpacing="wider" textAlign="center">TEMPO</Text>
                            </Flex>
                            {/* TIPO */}
                            <Flex w="100px" flexShrink={0} bg="#2D7D9A" align="center" justify="center" py={3} px={3}
                                borderLeft="1px solid rgba(255,255,255,0.25)">
                                <Text fontWeight="black" fontSize="xs" color="white" letterSpacing="wider">TIPO</Text>
                            </Flex>
                            {/* Demais colunas laranja */}
                            {TABLE_COLS.map(col => (
                                <Flex
                                    key={col.label}
                                    flex={col.flex}
                                    bg="#E8700A"
                                    align="center" justify="center"
                                    py={3} px={3}
                                    borderLeft="1px solid rgba(255,255,255,0.25)"
                                >
                                    <Text fontWeight="black" fontSize="xs" color="white" letterSpacing="wider" textAlign="center">
                                        {col.label}
                                    </Text>
                                </Flex>
                            ))}
                        </Flex>

                        {/* Linhas */}
                        <Flex direction="column" gap={2}>
                            {pageItems.length === 0 ? (
                                <Flex direction="column" align="center" justify="center" py={16} gap={3}>
                                    <Icon
                                        as={hasError ? FaExclamationCircle : FaClipboardList}
                                        color={hasError ? "red.300" : "gray.300"}
                                        w={10} h={10}
                                    />
                                    <Text color={hasError ? "red.400" : "gray.400"} fontWeight="bold" fontSize="md">
                                        {hasError
                                            ? "Erro ao carregar dados. Verifique a conexão com o servidor."
                                            : scheduling.length === 0
                                                ? "Nenhum pedido encontrado."
                                                : "Nenhum registro encontrado para os filtros selecionados."}
                                    </Text>
                                    {hasError && (
                                        <Text color="gray.400" fontSize="sm">O sistema tentará recarregar automaticamente em breve.</Text>
                                    )}
                                </Flex>
                            ) : pageItems.map(item => (
                                <MapRow key={item.id} item={item} />
                            ))}
                        </Flex>
                    </Box>
                </Flex>
                )}

                {/* ── Rodapé da Lista: contagem + paginação + por página ── */}
                {viewMode === "list" && (
                    <Flex
                        align="center" justify="space-between" gap={3} wrap="wrap"
                        px={5} py={3} flexShrink={0}
                        bg="gray.800" borderTop="1px solid" borderColor="gray.700"
                    >
                        <Text fontSize="sm" color="gray.300">
                            Mostrando {firstRow} a {lastRow} de {filtered.length} registros
                        </Text>

                        <HStack spacing={1}>
                            <IconButton
                                aria-label="Página anterior" size="sm" variant="ghost"
                                icon={<Icon as={FaChevronLeft} />}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                isDisabled={currentPage <= 1}
                                color="gray.200" _hover={{ bg: "whiteAlpha.200" }}
                            />
                            {paginationRange(currentPage, totalPages).map((n, i) => {
                                if (n === "...") {
                                    return (
                                        <Flex key={`dots-${i}`} align="center" justify="center" minW="32px" h="32px" color="gray.500" fontWeight="bold" fontSize="sm">
                                            …
                                        </Flex>
                                    );
                                }
                                const active = n === currentPage;
                                return (
                                    <Flex
                                        key={n}
                                        as="button"
                                        onClick={() => setPage(n)}
                                        align="center" justify="center"
                                        minW="32px" h="32px" px={2} borderRadius="md"
                                        bg={active ? "#E8700A" : "whiteAlpha.100"}
                                        color={active ? "white" : "gray.200"}
                                        fontWeight="bold" fontSize="sm"
                                        _hover={{ bg: active ? "#E8700A" : "whiteAlpha.300" }}
                                        transition="all 0.15s"
                                    >
                                        {n}
                                    </Flex>
                                );
                            })}
                            <IconButton
                                aria-label="Próxima página" size="sm" variant="ghost"
                                icon={<Icon as={FaChevronRight} />}
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                isDisabled={currentPage >= totalPages}
                                color="gray.200" _hover={{ bg: "whiteAlpha.200" }}
                            />
                        </HStack>

                        <HStack spacing={2}>
                            <Text fontSize="sm" color="gray.300">Registros por página:</Text>
                            <label htmlFor="rows-per-page" className="sr-only">Registros por página</label>
                            <select
                                id="rows-per-page"
                                title="Registros por página"
                                className="map-select"
                                style={{ minWidth: "72px" }}
                                value={itemsPerPage}
                                onChange={e => { setItemsPerPage(Number(e.target.value)); setPage(1); }}
                            >
                                {[10, 15, 20, 30, 50].map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                        </HStack>
                    </Flex>
                )}

            </Flex>

            {/* Botão flutuante para sair do modo TV (a barra fica oculta) */}
            {tvMode && (
                <RowFlex
                    onClick={exitTv}
                    position="fixed" top={3} right={3} zIndex={2500}
                    align="center" gap={2} px={3} py={2} borderRadius="md" cursor="pointer"
                    bg="blackAlpha.600" border="1px solid" borderColor="whiteAlpha.300"
                    opacity={0.5} _hover={{ opacity: 1, bg: "blackAlpha.800" }}
                    transition="all 0.15s"
                    title="Sair da tela cheia (ou tecle Esc)"
                >
                    <Icon as={FaCompress} w={3.5} h={3.5} color="white" />
                    <RowText fontSize="xs" fontWeight="bold" color="white">Sair</RowText>
                </RowFlex>
            )}


            {selected && (
                <DetailModal
                    item={selected}
                    onClose={() => setSelected(null)}
                    currentUserId={user?.id}
                    materiais={materiaisPorPedido[selected.pedidoId || selected.id]}
                    onAddMensagem={addMensagem}
                    onEditMensagem={editMensagem}
                    onDeleteMensagem={deleteMensagem}
                />
            )}

            <style>{`
                .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
                .map-select { height: 34px; padding: 0 32px 0 12px; font-size: 14px; color: var(--sm-select-text); background-color: var(--sm-select-bg); border: 1px solid var(--sm-select-border); border-radius: 6px; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23b3b5c6' d='M6 8L0 0h12z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; min-width: 140px; }
                .map-select:hover { border-color: var(--sm-select-border-hover); }
                .map-select:focus { outline: none; border-color: #ED8936; box-shadow: 0 0 0 1px #ED8936; }
                /* Opções do <select> nativo ("Registros por página") não herdam a cor do
                   pai no Chrome/Safari — o dropdown renderiza com estilo do SO, quase
                   sempre claro. Força texto escuro pra não repetir o "branco no branco". */
                .map-select option { color: #1a1d26; background-color: #ffffff; }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #CBD5E0; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #A0AEC0; }
                @keyframes pulse-ring-urgencia {
                    0%   { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.5); }
                    70%  { box-shadow: 0 0 0 8px rgba(229, 62, 62, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
                }
                .pulse-urgencia { animation: pulse-ring-urgencia 1.5s ease-out infinite; }
                @keyframes pulse-ring-consignado {
                    0%   { box-shadow: 0 0 0 0 rgba(246, 173, 85, 0.5); }
                    70%  { box-shadow: 0 0 0 8px rgba(246, 173, 85, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(246, 173, 85, 0); }
                }
                .pulse-consignado { animation: pulse-ring-consignado 1.5s ease-out infinite; }
                @keyframes pulse-ring-eletiva {
                    0%   { box-shadow: 0 0 0 0 rgba(99, 179, 237, 0.5); }
                    70%  { box-shadow: 0 0 0 8px rgba(99, 179, 237, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(99, 179, 237, 0); }
                }
                .pulse-eletiva { animation: pulse-ring-eletiva 1.5s ease-out infinite; }
                @keyframes blink-row-urgencia {
                    0%   { border-color: #FC8181; background-color: #FFF5F5; }
                    50%  { border-color: #C53030; background-color: #FEB2B2; }
                    100% { border-color: #FC8181; background-color: #FFF5F5; }
                }
                .row-urgencia { animation: blink-row-urgencia 0.9s ease-in-out infinite; }
                @keyframes blink-row-consignado {
                    0%   { border-color: #F6AD55; background-color: #FFFAF0; }
                    50%  { border-color: #C05621; background-color: #FEEBC8; }
                    100% { border-color: #F6AD55; background-color: #FFFAF0; }
                }
                .row-consignado { animation: blink-row-consignado 0.9s ease-in-out infinite; }
                @keyframes blink-row-eletiva {
                    0%   { border-color: #90CDF4; background-color: #EBF8FF; }
                    50%  { border-color: #2B6CB0; background-color: #BEE3F8; }
                    100% { border-color: #90CDF4; background-color: #EBF8FF; }
                }
                .row-eletiva { animation: blink-row-eletiva 0.9s ease-in-out infinite; }
            `}</style>
        </>
    );
}
