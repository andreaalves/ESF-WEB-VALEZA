import { ReactNode, useMemo, useState } from "react";
import {
    Box, Flex, HStack, Icon, SimpleGrid, Text, Tooltip,
} from "@chakra-ui/react";
import {
    FaArrowDown, FaArrowUp, FaBoxOpen, FaCalendarDay, FaCalendarWeek,
    FaChartLine, FaChartPie, FaClock, FaExclamationTriangle, FaFileInvoiceDollar, FaMinus,
    FaTimes, FaUserClock, FaUserTie, FaUsers,
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
// Rótulo de valor das barras horizontais: depois da ponta da barra, em cor de
// texto — dentro da barra ele era cortado sempre que a barra ficava pequena.
const ROTULO_FORA = (cor: string) => ({
    enabled: true,
    textAnchor: "start",
    offsetX: 28,
    style: { fontSize: "12px", fontWeight: 700, colors: [cor] },
    formatter: (v: number) => String(v),
});
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

// Rampa sequencial (um matiz só, mais = mais intenso) do mapa de calor de
// horários. No claro vai do claro pro escuro; no escuro, do apagado pro vivo —
// nos dois casos a célula mais forte é a que mais se destaca do fundo do card.
const HEAT_LIGHT = ["#c6dcf5", "#8bb8ec", "#4f93e0", "#1f63b8"];
const HEAT_DARK = ["#23415f", "#2c5f9c", "#3987e5", "#7db4f5"];
const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
// Vendedor sem pedido há N dias ou mais é tratado como "parado".
const DIAS_PARADO = 7;

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
    vendedorId: string;    // colaborador_id (cai no nome quando o pedido não tem colaborador)
    cliente: string;
    clienteId: string;
    hora: number | null;   // hora local real da entrada (0–23); null quando só temos o dia
    diaSemana: number;     // 1 = segunda … 7 = domingo
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

// Hora e dia da semana reais da entrada do pedido — mesma regra de
// `inicioReal` em SurgicalMap/index.tsx: pedido do App grava o instante real em
// data_emissao; pedido nativo do Protheus grava só o dia (meia-noite UTC) e
// manda a hora separada em hora_emissao (ausente nos pedidos antigos).
function momentoEntrada(dt: DateTime, horaEmissao: any): { hora: number | null; diaSemana: number } {
    const utc = dt.toUTC();
    const soData = utc.hour === 0 && utc.minute === 0 && utc.second === 0 && utc.millisecond === 0;
    if (!soData) return { hora: dt.hour, diaSemana: dt.weekday };
    const m = String(horaEmissao ?? "").match(/^(\d{1,2}):(\d{2})/);
    const h = m ? Number(m[1]) : NaN;
    return { hora: h >= 0 && h <= 23 ? h : null, diaSemana: utc.weekday };
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
            const vendedor = p.colaboradores?.nome || p.criado_por_nome || "—";
            const cliente = p.clientes?.fantasia || p.clientes?.razao_social || "—";
            const { hora, diaSemana } = momentoEntrada(dt, p.hora_emissao);
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
                vendedor,
                vendedorId: String(p.colaborador_id || vendedor),
                cliente,
                clienteId: String(p.cliente_id || cliente),
                hora,
                diaSemana,
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

// Rótulo de eixo: o ApexCharts não trunca nome comprido em barra horizontal —
// ele vaza pra fora do card pela esquerda. O nome inteiro fica no tooltip.
const nomeCurto = (nome: string) => (nome.length > 18 ? `${nome.slice(0, 17).trimEnd()}…` : nome);

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
            borderRadius="xl" px={5} py={4} minW={0} sx={{ gap: "8px" }}
            boxShadow="0 1px 2px rgba(0,0,0,.06), 0 6px 16px -4px rgba(0,0,0,.10)">
            <HStack spacing={2.5}>
                <Flex align="center" justify="center" w="30px" h="30px" borderRadius="md"
                    bg={`${accent}22`} flexShrink={0}>
                    <Icon as={icon} color={accent} w={3.5} h={3.5} />
                </Flex>
                <Text fontSize="11px" fontWeight="bold" color="gray.400" textTransform="uppercase"
                    letterSpacing="0.5px" noOfLines={1}>{label}</Text>
            </HStack>
            <Text fontSize="3xl" fontWeight="black" color="gray.50" lineHeight="1.1">{value}</Text>
            <HStack spacing={1.5} minH="18px">
                {deltaIcon && delta && (
                    <Tooltip label={delta.hint} hasArrow>
                        <HStack spacing={0.5}>
                            <Icon as={deltaIcon} color={deltaColor} w={2.5} h={2.5} />
                            <Text fontSize="xs" fontWeight="bold" color={deltaColor}>
                                {Math.abs(delta.pct!).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                            </Text>
                        </HStack>
                    </Tooltip>
                )}
                {sub && <Text fontSize="xs" color="gray.500" noOfLines={1}>{sub}</Text>}
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
            borderRadius="xl" p={5} minH={minH} minW={0} h="100%"
            boxShadow="0 1px 2px rgba(0,0,0,.06), 0 6px 16px -4px rgba(0,0,0,.10)">
            <Text fontSize="md" fontWeight="bold" color="gray.100">{title}</Text>
            {subtitle && <Text fontSize="xs" color="gray.500" mt={1}>{subtitle}</Text>}
            <Box flex={1} minH={0} mt={4}>{children}</Box>
        </Flex>
    );
}

// ─── Título de seção ───────────────────────────────────────────────────────────
function SectionTitle({ title, hint }: { title: string; hint?: string }) {
    return (
        <Flex align="baseline" flexWrap="wrap" mt={4} sx={{ gap: "4px 12px" }}
            pb={2} borderBottom="1px solid" borderColor="gray.600">
            <Text fontSize="lg" fontWeight="bold" color="gray.50">{title}</Text>
            {hint && <Text fontSize="xs" color="gray.400">{hint}</Text>}
        </Flex>
    );
}

// Faixas de cor do mapa de calor: zero fica recessivo (cor da grade) e os
// valores > 0 se dividem em até 4 degraus da rampa sequencial.
function faixasHeat(max: number, rampa: string[], zero: string) {
    const ranges = [{ from: 0, to: 0, color: zero, name: "0" }];
    const passos = Math.min(4, max);
    let de = 1;
    for (let i = 1; i <= passos && de <= max; i++) {
        const ate = Math.max(de, Math.round((max * i) / passos));
        ranges.push({
            from: de, to: ate,
            color: rampa[Math.round((i / passos) * 4) - 1],
            name: de === ate ? String(de) : `${de}–${ate}`,
        });
        de = ate + 1;
    }
    return ranges;
}

interface VendedorStat {
    id: string;
    nome: string;
    n: number;                    // pedidos no período
    valor: number;                // R$ dos pedidos válidos no período
    ticket: number;
    clientes: number;             // clientes distintos atendidos no período
    diasAtivos: number;           // dias distintos com pedido no período
    problemas: number;            // erros de integração + excluídos/cancelados no período
    delta: number | null;         // % vs. período anterior de mesmo tamanho
    diasSemPedido: number;        // desde o último pedido (qualquer data)
}
type ColVendedor = "nome" | "n" | "valor" | "ticket" | "clientes" | "diasAtivos" | "delta" | "problemas" | "diasSemPedido";
const COLS_VENDEDOR: { key: ColVendedor; label: string; hint?: string; num?: boolean }[] = [
    { key: "nome", label: "Vendedor" },
    { key: "n", label: "Pedidos", num: true },
    { key: "valor", label: "Valor", num: true, hint: "Soma dos pedidos válidos (sem erro e sem cancelados)" },
    { key: "ticket", label: "Ticket médio", num: true },
    { key: "clientes", label: "Clientes", num: true, hint: "Clientes distintos atendidos no período" },
    { key: "diasAtivos", label: "Dias ativos", num: true, hint: "Dias do período em que fez pelo menos um pedido" },
    { key: "delta", label: "Tendência", num: true, hint: "Nº de pedidos vs. o período anterior de mesmo tamanho" },
    { key: "problemas", label: "Problemas", num: true, hint: "Pedidos com erro de integração, excluídos ou cancelados" },
    { key: "diasSemPedido", label: "Último pedido", num: true },
];

const fmtDiasSemPedido = (d: number) => (d <= 0 ? "hoje" : d === 1 ? "ontem" : `há ${d} dias`);

// ─── Painel principal ──────────────────────────────────────────────────────────
export default function BIView({ pedidos }: { pedidos: any[] }) {
    const [periodo, setPeriodo] = useState<Periodo>("30");
    const [origemFiltro, setOrigemFiltro] = useState<OrigemFiltro>("app");
    const [vendedorSel, setVendedorSel] = useState<string | null>(null);
    const [ordem, setOrdem] = useState<{ col: ColVendedor; desc: boolean }>({ col: "n", desc: true });

    const { ehClaro } = useThemeMode();
    const ink = ehClaro ? INK_LIGHT : INK_DARK;
    const baseOptions = useMemo(() => buildBaseOptions(ink, ehClaro), [ink, ehClaro]);

    const rows = useMemo(() => buildRows(pedidos), [pedidos]);

    // Filtro de origem — App e Protheus são populações diferentes (produção do
    // time de vendas vs. tudo que já está no ERP), então tudo abaixo trabalha
    // em cima do recorte escolhido, não do universo inteiro.
    const rowsOrigem = useMemo(() => {
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

    // ── Desempenho por vendedor ───────────────────────────────────────────────
    // Sempre sobre o recorte de origem inteiro (não segue o vendedor
    // selecionado): é a tabela que serve de filtro. Lista todo vendedor que já
    // fez pedido nessa origem — quem está zerado no período continua aparecendo,
    // porque "parou de vender" é justamente o que se quer enxergar.
    const vendedores = useMemo<VendedorStat[]>(() => {
        const inicioAnt = inicio && nDias ? inicio.minus({ days: nDias }) : null;
        const m = new Map<string, {
            nome: string; n: number; nValidos: number; valor: number; problemas: number;
            nAnterior: number; clientes: Set<string>; dias: Set<string>; ultimo: DateTime;
        }>();
        rowsOrigem.forEach(r => {
            let v = m.get(r.vendedorId);
            if (!v) {
                v = {
                    nome: r.vendedor, n: 0, nValidos: 0, valor: 0, problemas: 0,
                    nAnterior: 0, clientes: new Set(), dias: new Set(), ultimo: r.dt,
                };
                m.set(r.vendedorId, v);
            }
            if (r.dt > v.ultimo) v.ultimo = r.dt;
            if (!inicio || r.dt >= inicio) {
                v.n++;
                v.clientes.add(r.clienteId);
                v.dias.add(r.dia);
                if (r.excluido || r.erro) v.problemas++;
                else { v.nValidos++; v.valor += r.valor; }
            } else if (inicioAnt && r.dt >= inicioAnt) {
                v.nAnterior++;
            }
        });
        return Array.from(m.entries()).map(([id, v]) => ({
            id,
            nome: v.nome === "—" ? "Sem vendedor" : v.nome,
            n: v.n,
            valor: v.valor,
            ticket: v.nValidos ? v.valor / v.nValidos : 0,
            clientes: v.clientes.size,
            diasAtivos: v.dias.size,
            problemas: v.problemas,
            delta: !inicioAnt ? null
                : v.nAnterior === 0 ? (v.n > 0 ? 100 : null)
                : ((v.n - v.nAnterior) / v.nAnterior) * 100,
            diasSemPedido: Math.max(0, Math.floor(hoje.diff(v.ultimo.startOf("day"), "days").days)),
        }));
    }, [rowsOrigem, inicioISO, hojeISO]); // eslint-disable-line react-hooks/exhaustive-deps

    const vendedoresOrdenados = useMemo(() => {
        const { col, desc } = ordem;
        return [...vendedores].sort((a, b) => {
            if (col === "nome") return (desc ? -1 : 1) * a.nome.localeCompare(b.nome, "pt-BR");
            const va = a[col], vb = b[col];
            // sem base de comparação (tendência nula) vai sempre pro fim
            if (va === null) return vb === null ? 0 : 1;
            if (vb === null) return -1;
            return (desc ? vb - va : va - vb) || b.n - a.n;
        });
    }, [vendedores, ordem]);

    // Seleção só vale enquanto o vendedor existir no recorte de origem atual.
    const vendedorAtivo = vendedores.find(v => v.id === vendedorSel) || null;
    const vendedorAtivoId = vendedorAtivo ? vendedorAtivo.id : "";

    const equipe = useMemo(() => {
        const reais = vendedores.filter(v => v.nome !== "Sem vendedor");
        const ativos = reais.filter(v => v.n > 0);
        const pedidos = ativos.reduce((s, v) => s + v.n, 0);
        const valor = ativos.reduce((s, v) => s + v.valor, 0);
        const top3 = [...ativos].sort((a, b) => b.valor - a.valor).slice(0, 3).reduce((s, v) => s + v.valor, 0);
        return {
            total: reais.length,
            ativos: ativos.length,
            mediaPedidos: ativos.length ? pedidos / ativos.length : 0,
            mediaValor: ativos.length ? valor / ativos.length : 0,
            concentracao: valor > 0 ? (top3 / valor) * 100 : null,
            parados: reais.filter(v => v.diasSemPedido >= DIAS_PARADO).length,
            maxPedidos: Math.max(1, ...vendedores.map(v => v.n)),
        };
    }, [vendedores]);

    // Daqui pra baixo tudo segue o vendedor selecionado na tabela (se houver).
    const rowsF = useMemo(
        () => (vendedorAtivoId ? rowsOrigem.filter(r => r.vendedorId === vendedorAtivoId) : rowsOrigem),
        [rowsOrigem, vendedorAtivoId]
    );

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
            nomes: top.map(([nome]) => nome),
            labels: top.map(([nome]) => nomeCurto(nome)),
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

    // Top clientes — só é exibido com um vendedor selecionado (no lugar do
    // ranking de vendedores, que viraria uma barra só).
    const porCliente = useMemo(() => {
        const m: Record<string, { nome: string; n: number; valor: number }> = {};
        noPeriodo.forEach(r => {
            if (!m[r.clienteId]) m[r.clienteId] = { nome: r.cliente, n: 0, valor: 0 };
            m[r.clienteId].n++;
            if (!r.excluido && !r.erro) m[r.clienteId].valor += r.valor;
        });
        const top = Object.values(m).sort((a, b) => b.n - a.n).slice(0, 7);
        return {
            nomes: top.map(c => c.nome),
            labels: top.map(c => nomeCurto(c.nome)),
            valores: top.map(c => c.n),
            valoresRs: top.map(c => c.valor),
        };
    }, [noPeriodo]);

    // ── Mapa de calor: dia da semana × hora em que o pedido entrou ───────────
    // Só entra pedido com hora conhecida (ver `momentoEntrada`). "Fora do
    // horário comercial" = fim de semana, antes das 8h ou a partir das 18h.
    const heat = useMemo(() => {
        const comHora = noPeriodo.filter(r => r.hora !== null);
        if (comHora.length === 0) return null;
        const grade = DIAS_SEMANA.map(() => new Array(24).fill(0) as number[]);
        let hMin = 8, hMax = 18, fora = 0;
        comHora.forEach(r => {
            const h = r.hora as number;
            grade[r.diaSemana - 1][h]++;
            if (h < hMin) hMin = h;
            if (h > hMax) hMax = h;
            if (r.diaSemana >= 6 || h < 8 || h >= 18) fora++;
        });
        const horas: number[] = [];
        for (let h = hMin; h <= hMax; h++) horas.push(h);
        let max = 0, picoDia = 0, picoHora = 0;
        grade.forEach((linha, d) => linha.forEach((n, h) => {
            if (n > max) { max = n; picoDia = d; picoHora = h; }
        }));
        return {
            // ApexCharts desenha a 1ª série embaixo — invertido pra segunda ficar no topo
            series: DIAS_SEMANA.map((nome, d) => ({
                name: nome,
                data: horas.map(h => ({ x: `${h}h`, y: grade[d][h] })),
            })).reverse(),
            max,
            pico: `${DIAS_SEMANA[picoDia]} às ${picoHora}h`,
            pctFora: (fora / comHora.length) * 100,
            amostras: comHora.length,
        };
    }, [noPeriodo]);

    const labelPeriodo = periodo === "all" ? "todo o histórico" : `últimos ${periodo} dias`;
    const labelOrigem = origemFiltro === "app" ? "pedidos feitos pelo app"
        : origemFiltro === "protheus" ? "pedidos nascidos direto no Protheus"
        : "todos os pedidos (app + Protheus)";

    const ranking = vendedorAtivo ? porCliente : porVendedor;

    function ordenarPor(col: ColVendedor) {
        setOrdem(o => (o.col === col ? { col, desc: !o.desc } : { col, desc: col !== "nome" }));
    }

    return (
        // `gap` não é style prop no Chakra 1.6 (só gridGap) — passado direto ele é
        // descartado em silêncio e os cards ficam colados. Por isso vai via `sx`.
        <Flex direction="column" px={{ base: 4, md: 8 }} py={6} flex={1} overflowY="auto" sx={{ gap: "24px" }}>

            {/* ── Filtros de origem + período ── */}
            <Flex align="center" justify="space-between" flexWrap="wrap" sx={{ gap: "12px" }}>
                <HStack spacing={2}>
                    <Icon as={FaChartLine} color="orange.400" w={4} h={4} />
                    <Text fontSize="md" fontWeight="bold" color="gray.100">
                        Visão Gerencial — {labelOrigem}
                    </Text>
                </HStack>
                <HStack spacing={3} flexWrap="wrap">
                    {vendedorAtivo && (
                        <Tooltip label="Remover filtro de vendedor" hasArrow>
                            <HStack spacing={2} px={3} py="5px" borderRadius="md" cursor="pointer"
                                bg={`${SERIES.blue}22`} border="1px solid" borderColor={SERIES.blue}
                                onClick={() => setVendedorSel(null)}>
                                <Icon as={FaUserTie} color={SERIES.blue} w={3} h={3} />
                                <Text fontSize="xs" fontWeight="bold" color="gray.100" noOfLines={1} maxW="220px">
                                    {vendedorAtivo.nome}
                                </Text>
                                <Icon as={FaTimes} color="gray.400" w={2.5} h={2.5} />
                            </HStack>
                        </Tooltip>
                    )}
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
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5}>
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

            <SectionTitle title="Volume de pedidos"
                hint={vendedorAtivo ? `filtrado por ${vendedorAtivo.nome}` : undefined} />

            {/* ── Linha 1: diário + situação ── */}
            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
                <Box gridColumn={{ xl: "span 2" }} minW={0}>
                    <ChartCard
                        title="Pedidos por dia"
                        subtitle={`Barra = emitidos no dia, por situação atual — ${periodo === "all" ? "somente dias com pedido" : labelPeriodo} · média ${kpis.mediaDia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia com produção`}
                    >
                        <Chart
                            type="bar"
                            height={300}
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
                                    labels: { rotate: 0, style: { fontSize: "11px" } },
                                    axisTicks: { show: false },
                                },
                                yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) }, forceNiceScale: true },
                                legend: { ...baseOptions.legend, position: "top", horizontalAlign: "right" },
                            } as any}
                        />
                    </ChartCard>
                </Box>

                <ChartCard title="Situação dos pedidos" subtitle={labelPeriodo}>
                    <Chart
                        type="bar"
                        height={300}
                        series={[{ name: "Pedidos", data: porSituacao.valores }]}
                        options={{
                            ...baseOptions,
                            colors: porSituacao.cores,
                            fill: BAR_FILL,
                            plotOptions: {
                                bar: { horizontal: true, distributed: true, barHeight: "50%", borderRadius: 8, dataLabels: { position: "top" } },
                            },
                            dataLabels: ROTULO_FORA(ink.primary),
                            xaxis: { categories: porSituacao.labels, labels: { show: false }, axisTicks: { show: false } },
                            yaxis: { labels: { style: { fontSize: "12px" }, maxWidth: 150 } },
                            grid: { ...baseOptions.grid, padding: { right: 36 }, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
                            legend: { show: false },
                        } as any}
                    />
                </ChartCard>
            </SimpleGrid>

            {/* ── Linha 2: semanal + tipo ── */}
            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
                <Box gridColumn={{ xl: "span 2" }} minW={0}>
                    <ChartCard title="Pedidos por semana" subtitle="últimas 12 semanas (início na segunda)">
                        <Chart
                            type="area"
                            height={280}
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
                                xaxis: { categories: porSemana.labels, labels: { style: { fontSize: "11px" } }, axisTicks: { show: false } },
                                yaxis: { labels: { formatter: (v: number) => String(Math.round(v)) }, forceNiceScale: true },
                                legend: { show: false },
                            } as any}
                        />
                    </ChartCard>
                </Box>

                <ChartCard title="Mix por tipo de pedido" subtitle={labelPeriodo}>
                    {porTipo.labels.length === 0 ? (
                        <Flex h="100%" minH="200px" align="center" justify="center">
                            <Text fontSize="sm" color="gray.500">Sem pedidos no período.</Text>
                        </Flex>
                    ) : (
                        <Chart
                            type="donut"
                            height={280}
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
                                                name: { color: ink.secondary, fontSize: "12px" },
                                                value: { color: ink.primary, fontSize: "24px", fontWeight: 800 },
                                                total: {
                                                    show: true, label: "Total", color: ink.secondary,
                                                    // lê do próprio gráfico: o react-apexcharts não reaplica
                                                    // options quando só uma função muda, e o total ficava
                                                    // preso no valor do primeiro render ao trocar de filtro
                                                    formatter: (w: any) => String(
                                                        (w.globals.seriesTotals as number[]).reduce((a, b) => a + b, 0)),
                                                },
                                            },
                                        },
                                    },
                                },
                                legend: { ...baseOptions.legend, position: "bottom", fontSize: "12px" },
                            } as any}
                        />
                    )}
                </ChartCard>
            </SimpleGrid>

            <SectionTitle title="Comportamento dos vendedores"
                hint="clique em um vendedor para filtrar o painel inteiro por ele" />

            {/* ── Equipe: resumo (não segue o vendedor selecionado) ── */}
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={5}>
                <KpiTile label="Vendedores ativos" value={String(equipe.ativos)} icon={FaUsers}
                    accent={SERIES.blue} sub={`de ${equipe.total} com pedido no histórico`} />
                <KpiTile label="Média por vendedor"
                    value={equipe.mediaPedidos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                    icon={FaUserTie} accent={SERIES.violet}
                    sub={`pedidos · ${fmtMoedaCompacta(equipe.mediaValor)} cada`} />
                <KpiTile label="Concentração"
                    value={equipe.concentracao !== null ? `${Math.round(equipe.concentracao)}%` : "—"}
                    icon={FaChartPie} accent={SERIES.yellow} sub="do valor nos 3 maiores vendedores" />
                <KpiTile label="Parados" value={String(equipe.parados)} icon={FaUserClock}
                    accent={equipe.parados > 0 ? STATUS.warning : STATUS.good}
                    sub={`sem pedido há ${DIAS_PARADO}+ dias`} />
            </SimpleGrid>

            {/* ── Tabela de desempenho por vendedor ── */}
            <ChartCard title="Desempenho por vendedor"
                subtitle={`${labelPeriodo} · clique no cabeçalho para ordenar`}>
                {vendedores.length === 0 ? (
                    <Flex minH="120px" align="center" justify="center">
                        <Text fontSize="sm" color="gray.500">Sem pedidos nesse recorte.</Text>
                    </Flex>
                ) : (
                    <Box overflow="auto" maxH="440px">
                        <Box as="table" w="100%" fontSize="sm" sx={{ borderCollapse: "collapse" }}>
                            <Box as="thead">
                                <Box as="tr">
                                    {COLS_VENDEDOR.map(c => (
                                        <Box key={c.key} as="th" py={2.5} px={3} fontSize="xs" fontWeight="bold"
                                            color={ordem.col === c.key ? "gray.100" : "gray.500"}
                                            textAlign={c.num ? "right" : "left"} whiteSpace="nowrap"
                                            cursor="pointer" userSelect="none"
                                            position="sticky" top={0} zIndex={1} bg="gray.800"
                                            borderBottom="1px solid" borderColor="gray.700"
                                            title={c.hint} onClick={() => ordenarPor(c.key)}>
                                            {c.label}{ordem.col === c.key ? (ordem.desc ? " ▾" : " ▴") : ""}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                            <Box as="tbody">
                                {vendedoresOrdenados.map(v => {
                                    const sel = vendedorAtivoId === v.id;
                                    const parado = v.diasSemPedido >= DIAS_PARADO;
                                    const deltaCor = v.delta === null || v.delta === 0 ? ink.secondary
                                        : v.delta > 0 ? STATUS.good : STATUS.critical;
                                    const deltaIcone = v.delta === null ? null
                                        : v.delta > 0 ? FaArrowUp : v.delta < 0 ? FaArrowDown : FaMinus;
                                    return (
                                        <Box as="tr" key={v.id} cursor="pointer"
                                            color={v.n > 0 ? "gray.200" : "gray.500"}
                                            bg={sel ? `${SERIES.blue}22` : "transparent"}
                                            _hover={{ bg: sel ? `${SERIES.blue}33` : "whiteAlpha.100" }}
                                            onClick={() => setVendedorSel(sel ? null : v.id)}>
                                            <Box as="td" py={3} px={3} fontWeight="semibold"
                                                borderBottom="1px solid" borderColor="gray.700"
                                                boxShadow={sel ? `inset 3px 0 0 ${SERIES.blue}` : "none"}>
                                                {v.nome}
                                            </Box>
                                            <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor="gray.700">
                                                <HStack spacing={2} justify="flex-end">
                                                    <Box w="90px" h="6px" borderRadius="full" bg={ink.grid} overflow="hidden"
                                                        display={{ base: "none", md: "block" }}>
                                                        <Box h="100%" borderRadius="full" bg={SERIES.violet}
                                                            w={`${(v.n / equipe.maxPedidos) * 100}%`} />
                                                    </Box>
                                                    <Text minW="32px" textAlign="right" fontWeight="bold">{v.n}</Text>
                                                </HStack>
                                            </Box>
                                            <Box as="td" py={3} px={3} textAlign="right" whiteSpace="nowrap"
                                                borderBottom="1px solid" borderColor="gray.700">
                                                {v.valor ? fmtMoeda(v.valor) : "—"}
                                            </Box>
                                            <Box as="td" py={3} px={3} textAlign="right" whiteSpace="nowrap"
                                                borderBottom="1px solid" borderColor="gray.700">
                                                {v.ticket ? fmtMoeda(v.ticket) : "—"}
                                            </Box>
                                            <Box as="td" py={3} px={3} textAlign="right"
                                                borderBottom="1px solid" borderColor="gray.700">{v.clientes}</Box>
                                            <Box as="td" py={3} px={3} textAlign="right"
                                                borderBottom="1px solid" borderColor="gray.700">{v.diasAtivos}</Box>
                                            <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor="gray.700">
                                                {deltaIcone && v.delta !== null ? (
                                                    <HStack spacing={1} justify="flex-end">
                                                        <Icon as={deltaIcone} color={deltaCor} w={2.5} h={2.5} />
                                                        <Text fontWeight="bold" color={deltaCor}>
                                                            {Math.abs(v.delta).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%
                                                        </Text>
                                                    </HStack>
                                                ) : <Text textAlign="right" color="gray.500">—</Text>}
                                            </Box>
                                            <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor="gray.700">
                                                {v.problemas > 0 ? (
                                                    <HStack spacing={1.5} justify="flex-end">
                                                        <Icon as={FaExclamationTriangle} color={STATUS.critical} w={2.5} h={2.5} />
                                                        <Text whiteSpace="nowrap">
                                                            {v.problemas} ({Math.round((v.problemas / v.n) * 100)}%)
                                                        </Text>
                                                    </HStack>
                                                ) : <Text textAlign="right" color="gray.500">—</Text>}
                                            </Box>
                                            <Box as="td" py={3} px={3} borderBottom="1px solid" borderColor="gray.700">
                                                <HStack spacing={2} justify="flex-end">
                                                    {parado && (
                                                        <Text fontSize="10px" fontWeight="bold" px={1.5} py="1px" borderRadius="sm"
                                                            textTransform="uppercase" color={ehClaro ? "#7a4b00" : STATUS.warning}
                                                            bg={`${STATUS.warning}33`}>parado</Text>
                                                    )}
                                                    <Text whiteSpace="nowrap">{fmtDiasSemPedido(v.diasSemPedido)}</Text>
                                                </HStack>
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>
                        </Box>
                    </Box>
                )}
            </ChartCard>

            {/* ── Linha 3: horários + ranking ── */}
            <SimpleGrid columns={{ base: 1, xl: 3 }} spacing={6}>
                <Box gridColumn={{ xl: "span 2" }} minW={0}>
                    <ChartCard
                        title="Quando os pedidos são feitos"
                        subtitle={heat
                            ? `Dia da semana × hora de entrada — ${labelPeriodo} · pico: ${heat.pico} · ${Math.round(heat.pctFora)}% fora do horário comercial (8h–18h, seg–sex)`
                            : `Dia da semana × hora de entrada — ${labelPeriodo}`}
                    >
                        {!heat ? (
                            <Flex h="100%" minH="200px" align="center" justify="center">
                                <Text fontSize="sm" color="gray.500" textAlign="center">
                                    Sem pedidos com hora de entrada registrada nesse recorte.
                                </Text>
                            </Flex>
                        ) : (
                            <Chart
                                type="heatmap"
                                height={300}
                                series={heat.series}
                                options={{
                                    ...baseOptions,
                                    stroke: { width: 3, colors: [ink.bg] },
                                    plotOptions: {
                                        heatmap: {
                                            radius: 4,
                                            enableShades: false,
                                            colorScale: {
                                                ranges: faixasHeat(heat.max, ehClaro ? HEAT_LIGHT : HEAT_DARK, ink.grid),
                                            },
                                        },
                                    },
                                    grid: { ...baseOptions.grid, show: false },
                                    xaxis: {
                                        labels: { style: { fontSize: "11px" } },
                                        axisTicks: { show: false }, axisBorder: { show: false },
                                        tooltip: { enabled: false },
                                    },
                                    yaxis: { labels: { style: { fontSize: "12px" } } },
                                    legend: { ...baseOptions.legend, position: "bottom", fontSize: "12px" },
                                    tooltip: {
                                        ...baseOptions.tooltip,
                                        y: { formatter: (v: number) => `${v} pedido(s)` },
                                    },
                                } as any}
                            />
                        )}
                    </ChartCard>
                </Box>

                <ChartCard
                    title={vendedorAtivo ? "Top clientes" : "Top vendedores"}
                    subtitle={vendedorAtivo
                        ? `de ${vendedorAtivo.nome}, por nº de pedidos — ${labelPeriodo}`
                        : `por nº de pedidos — ${labelPeriodo}`}
                >
                    {ranking.labels.length === 0 ? (
                        <Flex h="100%" minH="200px" align="center" justify="center">
                            <Text fontSize="sm" color="gray.500">Sem pedidos no período.</Text>
                        </Flex>
                    ) : (
                        <Chart
                            type="bar"
                            height={300}
                            series={[{ name: "Pedidos", data: ranking.valores }]}
                            options={{
                                ...baseOptions,
                                colors: [SERIES.violet],
                                fill: BAR_FILL,
                                plotOptions: { bar: { horizontal: true, barHeight: "50%", borderRadius: 8, dataLabels: { position: "top" } } },
                                dataLabels: ROTULO_FORA(ink.primary),
                                xaxis: { categories: ranking.labels, labels: { show: false }, axisTicks: { show: false } },
                                yaxis: { labels: { style: { fontSize: "12px" }, maxWidth: 150 } },
                                grid: { ...baseOptions.grid, padding: { right: 36 }, xaxis: { lines: { show: false } }, yaxis: { lines: { show: false } } },
                                legend: { show: false },
                                tooltip: {
                                    ...baseOptions.tooltip,
                                    x: { formatter: (v: string, opt: any) => ranking.nomes[opt.dataPointIndex] || v },
                                    y: {
                                        formatter: (v: number, opt: any) =>
                                            `${v} pedido(s) · ${fmtMoedaCompacta(ranking.valoresRs[opt.dataPointIndex] || 0)}`,
                                    },
                                },
                            } as any}
                        />
                    )}
                </ChartCard>
            </SimpleGrid>

            <SectionTitle title="Faturamento e integração"
                hint={vendedorAtivo ? `filtrado por ${vendedorAtivo.nome}` : undefined} />

            {/* ── Lead time pedido → NF (PDEV-48) ── */}
            <ChartCard
                title="Lead time por semana (pedido → NF)"
                subtitle="últimas 12 semanas · média de data_faturamento + hora_faturamento sobre a emissão do pedido"
            >
                {leadTime.amostras === 0 ? (
                    <Flex minH="80px" align="center" justify="center">
                        <Text fontSize="sm" color="gray.500" textAlign="center">
                            Ainda sem pedidos com data e hora de faturamento registradas nesse recorte.
                        </Text>
                    </Flex>
                ) : (
                    <Chart
                        type="area"
                        height={240}
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
                            xaxis: { categories: leadTime.semana.labels, labels: { style: { fontSize: "11px" } }, axisTicks: { show: false } },
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
                    borderRadius="xl" p={5} sx={{ gap: "12px" }}>
                    <HStack spacing={2} flexWrap="wrap">
                        <Icon as={FaExclamationTriangle} color={STATUS.critical} w={3.5} h={3.5} />
                        <Text fontSize="md" fontWeight="bold" color="gray.100">
                            Erros de integração pendentes ({erros.length})
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                            — pedidos enviados pelo app que não geraram pedido no ERP
                        </Text>
                    </HStack>
                    <Box overflowX="auto">
                        <Box as="table" w="100%" fontSize="sm" sx={{ borderCollapse: "collapse" }}>
                            <Box as="thead">
                                <Box as="tr" color="gray.500" textAlign="left">
                                    {["Data", "Cliente", "Vendedor", "Tipo", "Valor", "Motivo do erro"].map(h => (
                                        <Box key={h} as="th" py={2.5} px={3} fontSize="xs" fontWeight="bold"
                                            borderBottom="1px solid" borderColor="gray.700">{h}</Box>
                                    ))}
                                </Box>
                            </Box>
                            <Box as="tbody">
                                {erros.map(e => (
                                    <Box as="tr" key={e.id} color="gray.300"
                                        _hover={{ bg: "whiteAlpha.50" }}>
                                        <Box as="td" py={2.5} px={3} whiteSpace="nowrap">{e.dt.toFormat("dd/MM/yyyy HH:mm")}</Box>
                                        <Box as="td" py={2.5} px={3}>{e.cliente}</Box>
                                        <Box as="td" py={2.5} px={3}>{e.vendedor}</Box>
                                        <Box as="td" py={2.5} px={3}>{e.tipo}</Box>
                                        <Box as="td" py={2.5} px={3} whiteSpace="nowrap">{e.valor ? fmtMoeda(e.valor) : "—"}</Box>
                                        <Box as="td" py={2.5} px={3} color={STATUS.critical} fontWeight="600">
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
