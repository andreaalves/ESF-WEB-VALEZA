import { ReactNode, useMemo, useState } from "react";
import {
    Box, Flex, HStack, Icon, SimpleGrid, Text, Tooltip,
} from "@chakra-ui/react";
import {
    FaArrowDown, FaArrowUp, FaBoxOpen, FaCalendarDay, FaCalendarWeek,
    FaChartLine, FaClock, FaExclamationTriangle, FaFileInvoiceDollar, FaMinus,
} from "react-icons/fa";
import Chart from "react-apexcharts";
import { DateTime } from "luxon";
import { parseErroIntegracao } from "../../utils/parseErroIntegracao";
import { useThemeMode } from "../../context/ThemeModeContext";

// ─────────────────────────────────────────────────────────────────────────────
// BI do Mapa Cirúrgico — visão gerencial dos pedidos, com filtro de origem
// (App / Protheus / Todos) já que as duas populações têm naturezas diferentes
// (produção do time de vendas vs. tudo que já está no ERP).
//
// Fonte de dados: a MESMA resposta de /pedidos/{empresa}/empresa que a tela já
// busca (polling de 3 min) — nenhuma chamada extra. Diferente do mapa/Kanban,
// aqui os pedidos com ERRO_INTEGRACAO e os excluídos ENTRAM na conta: o BI mede
// produção e saúde da integração, não o fluxo operacional.
// ─────────────────────────────────────────────────────────────────────────────

// Paleta categórica validada p/ superfície escura (dataviz: CVD ΔE 41+, ≥3:1).
const SERIES = {
    blue: "#3987e5",   // slot 1 — emitidos / séries principais
    aqua: "#199e70",   // slot 2 — faturados (com NF)
    yellow: "#c98500", // slot 3
    violet: "#9085e9", // slot 4
    red: "#e66767",    // slot 5
};
// Cores de estado (semânticas — nunca usadas como "série 6"). `good` e
// `orange` foram re-calibradas (dataviz: validate_palette.js) — o verde
// original (#0ca30c) e o laranja original (#dd6b20) formavam um par com o
// vermelho de erro (#d03b3b) abaixo do piso de distinção em visão normal
// (ΔE < 15, "verde limão" e "laranja quase igual ao vermelho" a olho nu).
const STATUS = {
    good: "#16a34a",
    warning: "#fab219",
    critical: "#d03b3b",
    muted: "#718096",
    orange: "#c98500",
};
// Ambas as pontas validadas (dataviz: contraste texto >=4.4:1, grade
// deliberadamente baixo-contraste/recessiva). `bg` bate com o literal de
// gray.800 de cada modo (theme.ts / light-theme.css) — usado pra separador
// de fatia do donut, que precisa "sumir" contra o fundo do card.
const INK_DARK = { primary: "#F7FAFC", secondary: "#A0AEC0", grid: "#2D3748", bg: "#1f2029" };
const INK_LIGHT = { primary: "#1A202C", secondary: "#64748B", grid: "#E2E8F0", bg: "#f7f8fc" };
// Texto sobre marca colorida (dentro de barra/fatia) — fixo nos dois temas
// porque a cor da barra em si não muda com o tema, só o fundo do card muda.
const LABEL_ON_MARK = "#FFFFFF";
// Preenchimento em degradê pras barras (visual "moderno" — chapado é o que
// lia como gráfico datado). Fica de fora do baseOptions de propósito: o
// donut abaixo usa fatia chapada (degradê em pizza fica sujo), então cada
// gráfico de barra declara isso explicitamente.
const BAR_FILL = {
    type: "gradient",
    gradient: {
        shade: "light",
        type: "vertical",
        shadeIntensity: 0.35,
        inverseColors: false,
        opacityFrom: 1,
        opacityTo: 0.75,
        stops: [0, 100],
    },
};

type Periodo = "7" | "30" | "90" | "all";
const PERIODOS: { key: Periodo; label: string }[] = [
    { key: "7", label: "7 dias" },
    { key: "30", label: "30 dias" },
    { key: "90", label: "90 dias" },
    { key: "all", label: "Tudo" },
];

type Origem = "APP" | "PROTHEUS";
type OrigemFiltro = "app" | "protheus" | "todos";
const ORIGENS: { key: OrigemFiltro; label: string }[] = [
    { key: "app", label: "App" },
    { key: "protheus", label: "Protheus" },
    { key: "todos", label: "Todos" },
];

interface Row {
    id: string;
    dt: DateTime;
    dia: string;          // YYYY-MM-DD (fuso local)
    situacao: string;
    origem: Origem;        // APP (payload_enviado) vs. nascido direto no Protheus
    temNF: boolean;
    erro: boolean;        // só existe pro App: enviado pelo app mas sem pedido no ERP
    excluido: boolean;
    valor: number;
    tipo: string;
    vendedor: string;
    cliente: string;
    pedidoErp: string;
    dataFaturamento: DateTime | null; // data_faturamento + hora_faturamento (PDEV-48) — cobre as duas origens
    leadTimeHoras: number | null;     // pedido → NF, só quando dataFaturamento existe
    erroMotivo: string | null;        // motivo traduzido do payload_recebido (só quando erro === true)
}

// `data_faturamento` (coluna `date`, sem hora) + `hora_faturamento` (string
// "HH:mm[:ss]", coluna separada) — só combinamos os dois quando ambos vierem,
// senão o timestamp fica preso à meia-noite e distorce o lead time.
// A data sai SEMPRE do fuso UTC: `@db.Date` no Prisma serializa como meia-noite
// UTC, que lida no fuso local (UTC-3) cairia no DIA ANTERIOR e derrubaria o
// lead time em ~24h (mesmo bug corrigido em SurgicalMap/index.tsx, 2026-08-19).
// Já a hora vem do ERP em horário de Brasília, então é aplicada no fuso local.
function parseDataFaturamento(dataStr: any, horaStr: any): DateTime | null {
    if (!dataStr || !horaStr) return null;
    const d = DateTime.fromISO(String(dataStr), { zone: "utc" });
    if (!d.isValid) return null;
    const m = String(horaStr).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const dt = DateTime.fromISO(`${d.toISODate()}T${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`);
    return dt.isValid ? dt : null;
}

// Normaliza a resposta crua da API para o que o BI precisa. Cobre as duas
// origens (App e Protheus nativo) — a distinção vira o campo `origem` e o
// filtro de tab decide quais entram nos gráficos.
function buildRows(pedidos: any[]): Row[] {
    return (pedidos || [])
        .map((p: any): Row | null => {
            const origem: Origem = p?.payload_enviado ? "APP" : "PROTHEUS";
            let pl: any = p.payload_enviado;
            if (typeof pl === "string") { try { pl = JSON.parse(pl); } catch { pl = null; } }
            const dt = DateTime.fromISO(p.data_emissao ?? "");
            if (!dt.isValid) return null;
            const tipoRaw = ((pl?.TIPO_PEDIDO ?? p.tipo_pedido) || "").toString().toUpperCase();
            const tipo =
                tipoRaw.includes("URG") ? "URGÊNCIA"
                : tipoRaw.includes("ELET") ? "ELETIVA"
                : tipoRaw.includes("CONSIG") ? "CONSIGNADO"
                : tipoRaw.includes("VEND") ? "VENDA"
                : "OUTRO";
            // ERRO_INTEGRACAO é um conceito só do fluxo App (webhook que falhou
            // ao criar o pedido no ERP) — pedido nativo do Protheus já nasce lá,
            // então nunca entra nessa flag.
            const semErp = !p.pedido_erp || !String(p.pedido_erp).trim();
            const erro = origem === "APP" && (p.situacao === "ERRO_INTEGRACAO" || semErp);
            const erroMotivo = erro ? parseErroIntegracao(p.payload_recebido)?.motivo ?? null : null;
            const dataFaturamento = parseDataFaturamento(p.data_faturamento, p.hora_faturamento);
            const leadTimeHoras = dataFaturamento ? dataFaturamento.diff(dt, "hours").hours : null;
            return {
                id: p.pedido_id,
                dt,
                dia: dt.toISODate(),
                situacao: (p.situacao || "").toString(),
                origem,
                temNF: !!(p.nota_erp && String(p.nota_erp).trim()),
                erro,
                excluido: p.excluido === true || p.situacao === "EXCLUIDO_ERP" || p.situacao === "CANCELADO_ERP",
                valor: Number(p.valor_pedido) || 0,
                tipo,
                vendedor: p.colaboradores?.nome || p.criado_por_nome || "—",
                cliente: p.clientes?.fantasia || p.clientes?.razao_social || "—",
                pedidoErp: (p.pedido_erp || "").toString().trim(),
                dataFaturamento,
                erroMotivo,
                // negativo = inconsistência de dado (NF "antes" do pedido) — não entra na média
                leadTimeHoras: leadTimeHoras !== null && leadTimeHoras >= 0 ? leadTimeHoras : null,
            };
        })
        .filter((r): r is Row => r !== null);
}

const fmtMoeda = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtMoedaCompacta = (v: number) =>
    v >= 1_000_000 ? `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : v >= 1_000 ? `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`
    : fmtMoeda(v);
const fmtLeadTime = (horas: number) =>
    horas >= 48 ? `${(horas / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`
    : `${horas.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;

// Opções base dos gráficos — acompanham o toggle claro/escuro (ver `ink` no
// componente). Grade recessiva (baixo contraste, tracejada) e sem toolbar.
function buildBaseOptions(ink: typeof INK_DARK, ehClaro: boolean): any {
    return {
        chart: {
            background: "transparent",
            toolbar: { show: false },
            zoom: { enabled: false },
            animations: { easing: "easeinout", speed: 400 },
            fontFamily: "inherit",
            foreColor: ink.secondary,
        },
        grid: { borderColor: ink.grid, strokeDashArray: 4, xaxis: { lines: { show: false } } },
        dataLabels: { enabled: false },
        tooltip: { theme: ehClaro ? "light" : "dark" },
        legend: { labels: { colors: ink.secondary }, markers: { radius: 2 } },
        states: { active: { filter: { type: "none" } } },
    };
}

// ─── Tile de KPI ───────────────────────────────────────────────────────────────
function KpiTile({ label, value, sub, icon, accent, delta }: {
    label: string; value: string; sub?: string;
    icon: any; accent: string;
    delta?: { pct: number | null; hint: string };
}) {
    const { ehClaro } = useThemeMode();
    const secondary = ehClaro ? INK_LIGHT.secondary : INK_DARK.secondary;
    const deltaIcon = delta == null || delta.pct == null ? null
        : delta.pct > 0 ? FaArrowUp : delta.pct < 0 ? FaArrowDown : FaMinus;
    const deltaColor = delta == null || delta.pct == null ? secondary
        : delta.pct > 0 ? STATUS.good : delta.pct < 0 ? STATUS.critical : secondary;
    return (
        <Flex direction="column" bg="gray.800" border="1px solid" borderColor="gray.700"
            borderRadius="xl" p={3} gap={1} minW={0}
            boxShadow="0 1px 2px rgba(0,0,0,.06), 0 6px 16px -4px rgba(0,0,0,.10)">
            <HStack spacing={2}>
                <Flex align="center" justify="center" w="26px" h="26px" borderRadius="md"
                    bg={`${accent}22`} flexShrink={0}>
                    <Icon as={icon} color={accent} w={3} h={3} />
                </Flex>
                <Text fontSize="10px" fontWeight="bold" color="gray.400" textTransform="uppercase"
                    letterSpacing="0.5px" noOfLines={1}>{label}</Text>
            </HStack>
            <Text fontSize="2xl" fontWeight="black" color="gray.50" lineHeight="1.1">{value}</Text>
            <HStack spacing={1.5} minH="16px">
                {deltaIcon && delta && (
                    <Tooltip label={delta.hint} hasArrow>
                        <HStack spacing={0.5}>
                            <Icon as={deltaIcon} color={deltaColor} w={2.5} h={2.5} />
                            <Text fontSize="11px" fontWeight="bold" color={deltaColor}>
                                {Math.abs(delta.pct!).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                            </Text>
                        </HStack>
                    </Tooltip>
                )}
                {sub && <Text fontSize="11px" color="gray.500" noOfLines={1}>{sub}</Text>}
            </HStack>
        </Flex>
    );
}

// ─── Card de gráfico ───────────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, minH }: {
    title: string; subtitle?: string; children: ReactNode; minH?: string;
}) {
    return (
        <Flex direction="column" bg="gray.800" border="1px solid" borderColor="gray.700"
            borderRadius="xl" p={4} gap={1} minH={minH} minW={0}
            boxShadow="0 1px 2px rgba(0,0,0,.06), 0 6px 16px -4px rgba(0,0,0,.10)">
            <Text fontSize="sm" fontWeight="bold" color="gray.100">{title}</Text>
            {subtitle && <Text fontSize="11px" color="gray.500">{subtitle}</Text>}
            <Box flex={1} minH={0} mt={1}>{children}</Box>
        </Flex>
    );
}

// ─── Painel principal ──────────────────────────────────────────────────────────
export default function BIView({ pedidos }: { pedidos: any[] }) {
    const [periodo, setPeriodo] = useState<Periodo>("30");
    const [origemFiltro, setOrigemFiltro] = useState<OrigemFiltro>("app");

    const { ehClaro } = useThemeMode();
    const ink = ehClaro ? INK_LIGHT : INK_DARK;
    const baseOptions = useMemo(() => buildBaseOptions(ink, ehClaro), [ink, ehClaro]);

    const rows = useMemo(() => buildRows(pedidos), [pedidos]);

    // Filtro de origem — App e Protheus são populações diferentes (produção do
    // time de vendas vs. tudo que já está no ERP), então tudo abaixo trabalha
    // em cima do recorte escolhido, não do universo inteiro.
    const rowsF = useMemo(() => {
        if (origemFiltro === "todos") return rows;
        const alvo: Origem = origemFiltro === "app" ? "APP" : "PROTHEUS";
        return rows.filter(r => r.origem === alvo);
    }, [rows, origemFiltro]);

    const hoje = DateTime.now().startOf("day");
    const nDias = periodo === "all" ? null : Number(periodo);
    const inicio = nDias ? hoje.minus({ days: nDias - 1 }) : null;
    // Strings estáveis para os arrays de dependência (o ESLint do CRA 4 quebra
    // com optional chaining/chamadas dentro das deps — bug do exhaustive-deps).
    const hojeISO = hoje.toISODate();
    const inicioISO = inicio ? inicio.toISODate() : "";

    // Recorte do período selecionado (para gráficos e KPIs de valor).
    const noPeriodo = useMemo(
        () => rowsF.filter(r => !inicio || r.dt >= inicio),
        [rowsF, inicioISO] // eslint-disable-line react-hooks/exhaustive-deps
    );

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const doDia = (d: DateTime) => rowsF.filter(r => r.dia === d.toISODate()).length;
        const desde = (d: DateTime) => rowsF.filter(r => r.dt >= d).length;

        const pedidosHoje = doDia(hoje);
        const pedidosOntem = doDia(hoje.minus({ days: 1 }));
        const seteDias = desde(hoje.minus({ days: 6 }));
        const seteAnteriores = rowsF.filter(r =>
            r.dt >= hoje.minus({ days: 13 }) && r.dt < hoje.minus({ days: 6 })).length;
        const mes = desde(hoje.startOf("month"));

        const validos = noPeriodo.filter(r => !r.excluido && !r.erro);
        const valorTotal = validos.reduce((s, r) => s + r.valor, 0);
        const ticket = validos.length ? valorTotal / validos.length : 0;

        const errosAtivos = rowsF.filter(r => r.erro && !r.excluido).length;
        // Contagem, não percentual: todo pedido válido fatura, então "% faturado"
        // seria sempre 100%. O que informa é quantos dos emitidos viraram NF —
        // a diferença para o total são os excluídos/cancelados e erros.
        const faturados = validos.filter(r => r.temNF).length;

        // média por dia com pedido no período (dias sem produção não diluem)
        const diasComPedido = new Set(noPeriodo.map(r => r.dia)).size;
        const mediaDia = diasComPedido ? noPeriodo.length / diasComPedido : 0;

        const pct = (atual: number, anterior: number): number | null =>
            anterior === 0 ? (atual > 0 ? 100 : null) : ((atual - anterior) / anterior) * 100;

        return {
            pedidosHoje, seteDias, mes, total: rowsF.length,
            valorTotal, ticket, errosAtivos, faturados, mediaDia,
            deltaHoje: pct(pedidosHoje, pedidosOntem),
            deltaSemana: pct(seteDias, seteAnteriores),
        };
    }, [rowsF, noPeriodo, hojeISO]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Pedidos por dia (emitidos, empilhados por situação atual) ─────────────
    // Agrupado pelo dia de EMISSÃO do pedido, não pelo dia da NF — o lead time
    // pedido→NF já tem seu próprio card (ver `leadTime` acima); aqui o gráfico é
    // sobre volume de produção. Na prática todo pedido vivo tem NF, então as
    // fatias são só Faturado / Erro / Excluído — quem está "sem NF" é sempre
    // um excluído/cancelado ou um erro de integração (decisão do usuário:
    // não existe fatia "sem NF"). Pedido vivo ainda sem nota (janela curta
    // entre emitir e faturar) conta como faturado, para a barra fechar com
    // o total emitido do dia.
    const porDia = useMemo(() => {
        let dias: string[];
        if (nDias) {
            dias = [];
            for (let i = nDias - 1; i >= 0; i--) dias.push(hoje.minus({ days: i }).toISODate());
        } else {
            // "Tudo": só os dias que realmente tiveram pedido — sem buracos vazios no gráfico.
            dias = Array.from(new Set(rowsF.map(r => r.dia))).sort();
        }
        const n = dias.length;
        const grupoDe = (r: Row) => (r.excluido ? "excl" : r.erro ? "erro" : "fat");
        const cont: Record<string, Record<string, number>> =
            { fat: {}, erro: {}, excl: {} };
        rowsF.forEach(r => {
            const g = grupoDe(r);
            cont[g][r.dia] = (cont[g][r.dia] || 0) + 1;
        });
        return {
            labels: dias.map(d => DateTime.fromISO(d).toFormat("dd/MM")),
            fat: dias.map(d => cont.fat[d] || 0),
            erro: dias.map(d => cont.erro[d] || 0),
            excl: dias.map(d => cont.excl[d] || 0),
            n,
        };
    }, [rowsF, nDias, hojeISO]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Pedidos por semana (12 semanas, fixo) ─────────────────────────────────
    const porSemana = useMemo(() => {
        const semanas: DateTime[] = [];
        const inicioSemana = hoje.startOf("week");
        for (let i = 11; i >= 0; i--) semanas.push(inicioSemana.minus({ weeks: i }));
        const porInicio: Record<string, number> = {};
        rowsF.forEach(r => {
            const k = r.dt.startOf("week").toISODate();
            porInicio[k] = (porInicio[k] || 0) + 1;
        });
        return {
            labels: semanas.map(s => s.toFormat("dd/MM")),
            valores: semanas.map(s => porInicio[s.toISODate()] || 0),
        };
    }, [rowsF, hojeISO]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Lead time pedido → NF (PDEV-48) ────────────────────────────────────────
    // Só existe amostra quando o backend grava data_faturamento + hora_faturamento
    // (hoje ainda não acontece pros pedidos do app — ver [[bi-view-mapa]]/PDEV-48).
    // Enquanto isso o card mostra estado vazio em vez de uma média enganosa.
    const leadTime = useMemo(() => {
        const comLead = noPeriodo.filter(r => r.leadTimeHoras !== null);
        const medioHoras = comLead.length
            ? comLead.reduce((s, r) => s + (r.leadTimeHoras as number), 0) / comLead.length
            : null;

        const semanas: DateTime[] = [];
        const inicioSemana = hoje.startOf("week");
        for (let i = 11; i >= 0; i--) semanas.push(inicioSemana.minus({ weeks: i }));
        const somaPorSemana: Record<string, { soma: number; n: number }> = {};
        rowsF.forEach(r => {
            if (r.leadTimeHoras === null) return;
            const k = r.dt.startOf("week").toISODate();
            if (!somaPorSemana[k]) somaPorSemana[k] = { soma: 0, n: 0 };
            somaPorSemana[k].soma += r.leadTimeHoras;
            somaPorSemana[k].n++;
        });
        return {
            medioHoras,
            amostras: comLead.length,
            semana: {
                labels: semanas.map(s => s.toFormat("dd/MM")),
                valores: semanas.map(s => {
                    const k = s.toISODate();
                    return somaPorSemana[k] ? somaPorSemana[k].soma / somaPorSemana[k].n : null;
                }),
            },
        };
    }, [rowsF, noPeriodo, hojeISO]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Por tipo / situação / vendedor (seguem o período) ─────────────────────
    const porTipo = useMemo(() => {
        const m: Record<string, number> = {};
        noPeriodo.forEach(r => { m[r.tipo] = (m[r.tipo] || 0) + 1; });
        const ordem = ["CONSIGNADO", "ELETIVA", "URGÊNCIA", "VENDA", "OUTRO"];
        const labels = ordem.filter(t => m[t]);
        return { labels, valores: labels.map(t => m[t]) };
    }, [noPeriodo]);

    const porSituacao = useMemo(() => {
        const grupos: { label: string; cor: string; test: (r: Row) => boolean }[] = [
            { label: "Faturado (NF)", cor: STATUS.good, test: r => r.temNF && !r.excluido },
            { label: "Em andamento", cor: SERIES.blue, test: r => !r.temNF && !r.erro && !r.excluido },
            { label: "Erro de integração", cor: STATUS.critical, test: r => r.erro && !r.excluido },
            { label: "Bloqueado", cor: STATUS.warning, test: r => r.situacao === "BLOQUEADO" && !r.excluido },
            { label: "Excluído/Cancelado", cor: STATUS.orange, test: r => r.excluido },
        ];
        // cada pedido conta uma única vez, no primeiro grupo que casar
        const cont = grupos.map(() => 0);
        noPeriodo.forEach(r => {
            const i = grupos.findIndex(g => g.test(r));
            if (i >= 0) cont[i]++;
        });
        const idx = cont.map((n, i) => ({ n, i })).filter(x => x.n > 0);
        return {
            labels: idx.map(x => grupos[x.i].label),
            valores: idx.map(x => x.n),
            cores: idx.map(x => grupos[x.i].cor),
        };
    }, [noPeriodo]);

    const porVendedor = useMemo(() => {
        const m: Record<string, { n: number; valor: number }> = {};
        noPeriodo.forEach(r => {
            if (!m[r.vendedor]) m[r.vendedor] = { n: 0, valor: 0 };
            m[r.vendedor].n++;
            if (!r.excluido && !r.erro) m[r.vendedor].valor += r.valor;
        });
        const top = Object.entries(m).sort((a, b) => b[1].n - a[1].n).slice(0, 7);
        return {
            labels: top.map(([nome]) => nome),
            valores: top.map(([, v]) => v.n),
            valoresRs: top.map(([, v]) => v.valor),
        };
    }, [noPeriodo]);

    // Erros de integração ativos — sempre o estado ATUAL, ignora o período.
    // Conceito só existe pro App (ver `erro` em buildRows), então na tab
    // Protheus essa lista fica vazia naturalmente.
    const erros = useMemo(
        () => rowsF.filter(r => r.erro && !r.excluido)
            .sort((a, b) => b.dt.toMillis() - a.dt.toMillis()),
        [rowsF]
    );

    const labelPeriodo = periodo === "all" ? "todo o histórico" : `últimos ${periodo} dias`;
    const labelOrigem = origemFiltro === "app" ? "pedidos feitos pelo app"
        : origemFiltro === "protheus" ? "pedidos nascidos direto no Protheus"
        : "todos os pedidos (app + Protheus)";

    return (
        <Flex direction="column" gap={3} p={3} flex={1} overflowY="auto">

            {/* ── Filtros de origem + período ── */}
            <Flex align="center" justify="space-between" flexWrap="wrap" gap={2}>
                <HStack spacing={2}>
                    <Icon as={FaChartLine} color="orange.400" w={4} h={4} />
                    <Text fontSize="sm" fontWeight="bold" color="gray.100">
                        Visão Gerencial — {labelOrigem}
                    </Text>
                </HStack>
                <HStack spacing={2} flexWrap="wrap">
                    <HStack bg="gray.900" borderRadius="md" p="3px" border="1px solid" borderColor="gray.700" spacing={1}>
                        {ORIGENS.map(o => (
                            <Box
                                key={o.key} onClick={() => setOrigemFiltro(o.key)}
                                px={3} py={1} borderRadius="sm" cursor="pointer"
                                bg={origemFiltro === o.key ? "blue.500" : "transparent"}
                                _hover={{ bg: origemFiltro === o.key ? "blue.500" : "gray.800" }}
                                transition="all 0.15s"
                            >
                                <Text fontSize="xs" fontWeight="bold"
                                    color={origemFiltro === o.key ? "white" : "gray.400"}>{o.label}</Text>
                            </Box>
                        ))}
                    </HStack>
                    <HStack bg="gray.900" borderRadius="md" p="3px" border="1px solid" borderColor="gray.700" spacing={1}>
                        {PERIODOS.map(p => (
                            <Box
                                key={p.key} onClick={() => setPeriodo(p.key)}
                                px={3} py={1} borderRadius="sm" cursor="pointer"
                                bg={periodo === p.key ? "orange.500" : "transparent"}
                                _hover={{ bg: periodo === p.key ? "orange.500" : "gray.800" }}
                                transition="all 0.15s"
                            >
                                <Text fontSize="xs" fontWeight="bold"
                                    color={periodo === p.key ? "white" : "gray.400"}>{p.label}</Text>
                            </Box>
                        ))}
                    </HStack>
                </HStack>
            </Flex>

            {/* ── KPIs ── */}
            <SimpleGrid columns={{ base: 2, md: 4, xl: 8 }} spacing={2}>
                <KpiTile label="Hoje" value={String(kpis.pedidosHoje)} icon={FaCalendarDay}
                    accent={SERIES.blue} delta={{ pct: kpis.deltaHoje, hint: "vs. ontem" }} sub="vs. ontem" />
                <KpiTile label="Últimos 7 dias" value={String(kpis.seteDias)} icon={FaCalendarWeek}
                    accent={SERIES.blue} delta={{ pct: kpis.deltaSemana, hint: "vs. 7 dias anteriores" }} sub="vs. semana ant." />
                <KpiTile label="No mês" value={String(kpis.mes)} icon={FaChartLine}
                    accent={SERIES.violet} sub={hoje.toFormat("LLLL", { locale: "pt-BR" })} />
                <KpiTile label="Total geral" value={String(kpis.total)} icon={FaBoxOpen}
                    accent={SERIES.aqua} sub="desde o início" />
                <KpiTile label={`Valor (${periodo === "all" ? "tudo" : periodo + "d"})`}
                    value={fmtMoedaCompacta(kpis.valorTotal)} icon={FaFileInvoiceDollar}
                    accent={SERIES.yellow} sub={`ticket ${fmtMoedaCompacta(kpis.ticket)}`} />
                <KpiTile label="Faturados" value={String(kpis.faturados)}
                    icon={FaFileInvoiceDollar} accent={STATUS.good}
                    sub={`com NF, de ${noPeriodo.length} emitidos no período`} />
                <KpiTile label="Lead time (pedido → NF)"
                    value={leadTime.medioHoras !== null ? fmtLeadTime(leadTime.medioHoras) : "—"}
                    icon={FaClock} accent={leadTime.medioHoras !== null ? SERIES.aqua : STATUS.muted}
                    sub={leadTime.amostras > 0 ? `média de ${leadTime.amostras} pedido(s)` : "aguardando dados do ERP (PDEV-48)"} />
                <KpiTile label="Erros integração" value={String(kpis.errosAtivos)} icon={FaExclamationTriangle}
                    accent={kpis.errosAtivos > 0 ? STATUS.critical : STATUS.good}
                    sub={kpis.errosAtivos > 0 ? "exigem ação" : "tudo certo"} />
            </SimpleGrid>

            {/* ── Linha 1: diário + situação ── */}
            <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={3}>
                <Box gridColumn={{ lg: "span 2" }}>
                    <ChartCard
                        title="Pedidos por dia"
                        subtitle={`Barra = emitidos no dia, por situação atual — ${periodo === "all" ? "somente dias com pedido" : labelPeriodo} · média ${kpis.mediaDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia com produção`}
                        minH="300px"
                    >
                        <Chart
                            type="bar"
                            height={230}
                            series={[
                                { name: "Faturado (NF)", data: porDia.fat },
                                { name: "Erro de integração", data: porDia.erro },
                                { name: "Excluído/Cancelado", data: porDia.excl },
                            ]}
                            options={{
                                ...baseOptions,
                                chart: { ...baseOptions.chart, stacked: true },
                                colors: [STATUS.good, STATUS.critical, STATUS.orange],
                                fill: BAR_FILL,
                                plotOptions: { bar: { columnWidth: porDia.n > 35 ? "80%" : "55%", borderRadius: 8 } },
                                stroke: { show: true, width: 2, colors: ["transparent"] },
                                xaxis: {
                                    categories: porDia.labels,
                                    tickAmount: Math.min(12, porDia.n),
                                    labels: { rotate: 0, style: { fontSize: "10px" } },
                                    axisTicks: { show: false },
                                },
                                yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) }, forceNiceScale: true },
                                legend: { ...baseOptions.legend, position: "top", horizontalAlign: "right" },
                            } as any}
                        />
                    </ChartCard>
                </Box>

                <ChartCard title="Situação dos pedidos" subtitle={labelPeriodo} minH="300px">
                    <Chart
                        type="bar"
                        height={230}
                        series={[{ name: "Pedidos", data: porSituacao.valores }]}
                        options={{
                            ...baseOptions,
                            colors: porSituacao.cores,
                            fill: BAR_FILL,
                            plotOptions: {
                                bar: { horizontal: true, distributed: true, barHeight: "55%", borderRadius: 8 },
                            },
                            dataLabels: {
                                enabled: true,
                                style: { fontSize: "11px", fontWeight: 700, colors: [LABEL_ON_MARK] },
                                formatter: (v: number) => String(v),
                            },
                            xaxis: { categories: porSituacao.labels, labels: { show: false }, axisTicks: { show: false } },
                            yaxis: { labels: { style: { fontSize: "11px" }, maxWidth: 140 } },
                            grid: { ...baseOptions.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
                            legend: { show: false },
                        } as any}
                    />
                </ChartCard>
            </SimpleGrid>

            {/* ── Linha 2: semanal + tipo + vendedores ── */}
            <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3}>
                <ChartCard title="Pedidos por semana" subtitle="últimas 12 semanas (início na segunda)" minH="280px">
                    <Chart
                        type="area"
                        height={210}
                        series={[{ name: "Pedidos", data: porSemana.valores }]}
                        options={{
                            ...baseOptions,
                            colors: [SERIES.blue],
                            stroke: { curve: "smooth", width: 3 },
                            markers: { size: 4, strokeWidth: 0, colors: [SERIES.blue] },
                            fill: {
                                type: "gradient",
                                gradient: { shadeIntensity: 1, opacityFrom: 0.45, opacityTo: 0.03, stops: [0, 100] },
                            },
                            xaxis: { categories: porSemana.labels, labels: { style: { fontSize: "10px" } }, axisTicks: { show: false } },
                            yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) }, forceNiceScale: true },
                            legend: { show: false },
                        } as any}
                    />
                </ChartCard>

                <ChartCard title="Mix por tipo de pedido" subtitle={labelPeriodo} minH="280px">
                    {porTipo.labels.length === 0 ? (
                        <Flex h="100%" align="center" justify="center">
                            <Text fontSize="sm" color="gray.500">Sem pedidos no período.</Text>
                        </Flex>
                    ) : (
                        <Chart
                            type="donut"
                            height={210}
                            series={porTipo.valores}
                            options={{
                                ...baseOptions,
                                labels: porTipo.labels,
                                colors: [SERIES.blue, SERIES.aqua, SERIES.yellow, SERIES.violet, SERIES.red],
                                stroke: { colors: [ink.bg], width: 2 },
                                plotOptions: {
                                    pie: {
                                        donut: {
                                            size: "68%",
                                            labels: {
                                                show: true,
                                                name: { color: ink.secondary, fontSize: "11px" },
                                                value: { color: ink.primary, fontSize: "20px", fontWeight: 800 },
                                                total: {
                                                    show: true, label: "Total", color: ink.secondary,
                                                    formatter: () => String(porTipo.valores.reduce((a, b) => a + b, 0)),
                                                },
                                            },
                                        },
                                    },
                                },
                                legend: { ...baseOptions.legend, position: "bottom", fontSize: "11px" },
                            } as any}
                        />
                    )}
                </ChartCard>

                <ChartCard title="Top vendedores" subtitle={`por nº de pedidos — ${labelPeriodo}`} minH="280px">
                    <Chart
                        type="bar"
                        height={210}
                        series={[{ name: "Pedidos", data: porVendedor.valores }]}
                        options={{
                            ...baseOptions,
                            colors: [SERIES.violet],
                            fill: BAR_FILL,
                            plotOptions: { bar: { horizontal: true, barHeight: "55%", borderRadius: 8 } },
                            dataLabels: {
                                enabled: true,
                                style: { fontSize: "11px", fontWeight: 700, colors: [LABEL_ON_MARK] },
                                formatter: (v: number) => String(v),
                            },
                            xaxis: { categories: porVendedor.labels, labels: { show: false }, axisTicks: { show: false } },
                            yaxis: { labels: { style: { fontSize: "11px" }, maxWidth: 140 } },
                            grid: { ...baseOptions.grid, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
                            legend: { show: false },
                            tooltip: {
                                ...baseOptions.tooltip,
                                y: {
                                    formatter: (v: number, opt: any) =>
                                        `${v} pedido(s) · ${fmtMoedaCompacta(porVendedor.valoresRs[opt.dataPointIndex] || 0)}`,
                                },
                            },
                        } as any}
                    />
                </ChartCard>
            </SimpleGrid>

            {/* ── Linha 3: lead time pedido → NF (PDEV-48) ── */}
            <ChartCard
                title="Lead time por semana (pedido → NF)"
                subtitle="últimas 12 semanas · média de data_faturamento + hora_faturamento sobre a emissão do pedido"
                minH="240px"
            >
                {leadTime.amostras === 0 ? (
                    <Flex h="100%" align="center" justify="center">
                        <Text fontSize="sm" color="gray.500" textAlign="center">
                            Ainda sem pedidos com data e hora de faturamento registradas nesse recorte.
                        </Text>
                    </Flex>
                ) : (
                    <Chart
                        type="area"
                        height={180}
                        series={[{ name: "Lead time médio", data: leadTime.semana.valores }]}
                        options={{
                            ...baseOptions,
                            colors: [SERIES.aqua],
                            stroke: { curve: "smooth", width: 3 },
                            markers: { size: 4, strokeWidth: 0, colors: [SERIES.aqua] },
                            fill: {
                                type: "gradient",
                                gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.03, stops: [0, 100] },
                            },
                            xaxis: { categories: leadTime.semana.labels, labels: { style: { fontSize: "10px" } }, axisTicks: { show: false } },
                            yaxis: {
                                labels: { formatter: (v: number) => (v == null ? "" : fmtLeadTime(v)) },
                                forceNiceScale: true,
                            },
                            legend: { show: false },
                            tooltip: {
                                ...baseOptions.tooltip,
                                y: { formatter: (v: number) => (v == null ? "sem dados" : fmtLeadTime(v)) },
                            },
                        } as any}
                    />
                )}
            </ChartCard>

            {/* ── Erros de integração (estado atual, não segue o período) ── */}
            {erros.length > 0 && (
                <Flex direction="column" bg="gray.800" border="1px solid" borderColor={`${STATUS.critical}66`}
                    borderRadius="lg" p={4} gap={2}>
                    <HStack spacing={2}>
                        <Icon as={FaExclamationTriangle} color={STATUS.critical} w={3.5} h={3.5} />
                        <Text fontSize="sm" fontWeight="bold" color="gray.100">
                            Erros de integração pendentes ({erros.length})
                        </Text>
                        <Text fontSize="11px" color="gray.500">
                            — pedidos enviados pelo app que não geraram pedido no ERP
                        </Text>
                    </HStack>
                    <Box overflowX="auto">
                        <Box as="table" w="100%" fontSize="xs" sx={{ borderCollapse: "collapse" }}>
                            <Box as="thead">
                                <Box as="tr" color="gray.500" textAlign="left">
                                    {["Data", "Cliente", "Vendedor", "Tipo", "Valor", "Motivo do erro"].map(h => (
                                        <Box key={h} as="th" py={1.5} px={2} fontWeight="bold"
                                            borderBottom="1px solid" borderColor="gray.700">{h}</Box>
                                    ))}
                                </Box>
                            </Box>
                            <Box as="tbody">
                                {erros.map(e => (
                                    <Box as="tr" key={e.id} color="gray.300"
                                        _hover={{ bg: "whiteAlpha.50" }}>
                                        <Box as="td" py={1.5} px={2} whiteSpace="nowrap">{e.dt.toFormat("dd/MM/yyyy HH:mm")}</Box>
                                        <Box as="td" py={1.5} px={2}>{e.cliente}</Box>
                                        <Box as="td" py={1.5} px={2}>{e.vendedor}</Box>
                                        <Box as="td" py={1.5} px={2}>{e.tipo}</Box>
                                        <Box as="td" py={1.5} px={2} whiteSpace="nowrap">{e.valor ? fmtMoeda(e.valor) : "—"}</Box>
                                        <Box as="td" py={1.5} px={2} color={STATUS.critical} fontWeight="600">
                                            {e.erroMotivo || "Sem pedido no ERP (sem detalhe do TOTVS)"}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>
                </Flex>
            )}
        </Flex>
    );
}
