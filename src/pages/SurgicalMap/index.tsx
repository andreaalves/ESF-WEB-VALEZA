import React from "react";
import { Box, Flex, Text, Icon, Spinner, HStack, Stack, IconButton, Input } from "@chakra-ui/react";
import { useEffect, useState, useCallback } from "react";
import {
    FaSyncAlt, FaClipboardList, FaWifi,
    FaExclamationCircle, FaSearch, FaChevronLeft, FaChevronRight,
} from "react-icons/fa";
import { Header } from "../../components/Header";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import api from "../../service/api";
import { useAuth } from "../../context/AuthContext";
import { DateTime } from "luxon";

// ─── Tipos ───────────────────────────────────────────────────────────────────
type StatusWorkflow =
    | "AGENDADO"
    | "EM_SEPARACAO"
    | "NOTA_FISCAL"
    | "ENTREGUE"
    | "APONTADO_REALIZADO"
    | "AGUARDANDO_DEVOLUCAO"
    | "FINALIZADO";

type TipoCirurgia = "URGENCIA" | "ELETIVA" | "CONSIGNADO";

interface Scheduling {
    id: string;
    dataAgendamento: string;
    horaCirurgia?: string;
    tipo: TipoCirurgia;
    cliente: { razaoSocial: string };
    colaborador: { nome: string };
    paciente?: string;
    medico?: string;
    observacoes?: string;
    pedidoProtheus?: string;
    statusWorkflow: StatusWorkflow;
    numeroNF?: string;
    convenio?: string;
    procedimento?: string;
    statusPedido?: string; // <- status real do pedido (ex: CANCELADO_ERP)
}

// ─── Config visual ────────────────────────────────────────────────────────────
const STATUS_LIST: StatusWorkflow[] = [
    "AGENDADO", "EM_SEPARACAO", "NOTA_FISCAL",
    "ENTREGUE", "APONTADO_REALIZADO", "AGUARDANDO_DEVOLUCAO", "FINALIZADO",
];

const TIPOS: TipoCirurgia[] = ["URGENCIA", "ELETIVA", "CONSIGNADO"];

const STATUS_CFG: Record<StatusWorkflow, { label: string; dotColor: string; textColor: string }> = {
    AGENDADO:             { label: "AGENDADO",              dotColor: "#ED8936", textColor: "#C05621" },
    EM_SEPARACAO:         { label: "EM SEPARAÇÃO",          dotColor: "#ECC94B", textColor: "#B7791F" },
    NOTA_FISCAL:          { label: "NOTA FISCAL",           dotColor: "#4299E1", textColor: "#2B6CB0" },
    ENTREGUE:             { label: "ENTREGUE",              dotColor: "#48BB78", textColor: "#276749" },
    APONTADO_REALIZADO:   { label: "APONTADO / REALIZADO",  dotColor: "#F6E05E", textColor: "#744210" },
    AGUARDANDO_DEVOLUCAO: { label: "AGUARDANDO DEVOLUÇÃO",  dotColor: "#FC8181", textColor: "#C53030" },
    FINALIZADO:           { label: "FINALIZADO",            dotColor: "#68D391", textColor: "#22543D" },
};

const ITEMS_PER_PAGE = 10;

// A linha do mapa é pastel/clara de propósito nos dois temas (imita o mapa
// impresso). Por isso usa hex literal em vez dos tokens gray.*, que se invertem
// no tema claro e deixariam o texto ilegível sobre os pastéis.
const ROW_DIVISOR = "#d1d2dc";
const ROW_TEXTO = "#353646";
const ROW_TEXTO_FORTE = "#1f2029";
const ROW_TEXTO_FRACO = "#4b4d63";
const ROW_BG_CANCELADO = "#d1d2dc";
const ROW_BORDA_CANCELADO = "#9699b0";
const ROW_BORDA_CANCELADO_HOVER = "#797d9a";

const RowFlex = Flex as React.ComponentType<any>;
const RowBox = Box as React.ComponentType<any>;
const RowText = Text as React.ComponentType<any>;

// ─── Linha da tabela ─────────────────────────────────────────────────────────
function MapRow({ item }: { item: Scheduling }) {
    const stCfg = STATUS_CFG[item.statusWorkflow];
    const tipoColor =
        item.tipo === "URGENCIA"   ? "#C53030" :
        item.tipo === "CONSIGNADO" ? "#C05621" : "#276749";
    const dt = DateTime.fromISO(item.dataAgendamento);
    const dataLabel = `${dt.toFormat("dd/MM/yyyy")} ${item.horaCirurgia || ""}`.trim();

    const isUrgencia = item.tipo === "URGENCIA";
    const isCancelado = item.statusPedido === "CANCELADO_ERP";
    const temNF = !!item.numeroNF;

    const bgColor: string = isCancelado ? ROW_BG_CANCELADO : temNF ? "green.50" : isUrgencia ? "red.50" : item.tipo === "ELETIVA" ? "blue.50" : "orange.50";
    const borderColor: string = isCancelado ? ROW_BORDA_CANCELADO : temNF ? "green.200" : isUrgencia ? "red.200" : item.tipo === "ELETIVA" ? "blue.200" : "orange.200";
    const hoverBorder: string = isCancelado ? ROW_BORDA_CANCELADO_HOVER : temNF ? "green.300" : isUrgencia ? "red.300" : item.tipo === "ELETIVA" ? "blue.300" : "orange.300";

    return (
        <RowFlex
            key={item.id}
            className={isUrgencia ? "row-urgency" : undefined}
            bg={bgColor}
            borderRadius="lg"
            boxShadow="sm"
            border="1px solid"
            borderColor={borderColor}
            align="center"
            minH="54px"
            overflow="hidden"
            _hover={{ boxShadow: "md", borderColor: hoverBorder }}
            transition="all 0.15s"
        >
            {/* STATUS */}
            <RowFlex w="168px" flexShrink={0} align="center" px={3} gap={0} py={2}>
                <RowBox
                    w="14px" h="14px"
                    minW="14px"
                    borderRadius="full"
                    bg={stCfg.dotColor}
                    flexShrink={0}
                    border="2.5px solid white"
                    outline="2px solid"
                    outlineColor={stCfg.dotColor}
                    mr={2.5}
                />
                <RowText fontWeight="bold" fontSize="xs" color={stCfg.textColor} noOfLines={2} lineHeight="1.25">
                    {stCfg.label}
                </RowText>
            </RowFlex>

            {/* TIPO */}
            <RowFlex w="100px" flexShrink={0} align="center" justify="center" px={2}
                borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="black" fontSize="xs" color={tipoColor}>
                    {item.tipo === "URGENCIA" ? "URGENCIA" :
                     item.tipo === "CONSIGNADO" ? "CONSIGNADO" : "ELETIVO"}
                </RowText>
            </RowFlex>

            {/* HOSPITAL */}
            <RowFlex flex={1.4} align="center" px={3} borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="600" fontSize="xs" color={ROW_TEXTO} noOfLines={1}>
                    {item.cliente?.razaoSocial}
                </RowText>
            </RowFlex>

            {/* DATA PROCEDIMENTO */}
            <RowFlex flex={1.3} align="center" px={3} borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="600" fontSize="xs" color={ROW_TEXTO}>{dataLabel}</RowText>
            </RowFlex>

            {/* PACIENTE */}
            <RowFlex flex={1.8} align="center" px={3} borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="700" fontSize="xs" color={ROW_TEXTO_FORTE} noOfLines={1}>
                    {item.paciente || "—"}
                </RowText>
            </RowFlex>

            {/* CONVENIO */}
            <RowFlex flex={0.9} align="center" justify="center" px={2}
                borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="600" fontSize="xs" color={ROW_TEXTO_FRACO} noOfLines={1}>
                    {item.convenio || "—"}
                </RowText>
            </RowFlex>

            {/* MEDICO */}
            <RowFlex flex={1.2} align="center" px={3} borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="600" fontSize="xs" color={ROW_TEXTO} noOfLines={1}>
                    {item.medico || "—"}
                </RowText>
            </RowFlex>

            {/* VENDEDOR */}
            <RowFlex flex={1.2} align="center" px={3} borderLeft="1px solid" borderColor={ROW_DIVISOR}>
                <RowText fontWeight="600" fontSize="xs" color={ROW_TEXTO} noOfLines={1}>
                    {item.colaborador?.nome || "—"}
                </RowText>
            </RowFlex>

            {/* PEDIDO / NF */}
            <RowFlex flex={1.4} align="center" px={3} borderLeft="1px solid" borderColor={ROW_DIVISOR} direction="column" gap={0}>
                <RowText fontWeight="700" fontSize="xs" color={ROW_TEXTO} noOfLines={1}>
                    {item.pedidoProtheus || "—"}
                </RowText>
                {item.numeroNF && (
                    <RowText fontWeight="600" fontSize="xs" color="blue.600" noOfLines={1}>
                        NF: {item.numeroNF}
                    </RowText>
                )}
            </RowFlex>
        </RowFlex>
    );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function SurgicalMap() {
    const { user } = useAuth();
    const [scheduling, setScheduling] = useState<Scheduling[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(DateTime.now());
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [filterStatus, setFilterStatus] = useState<string>("ALL");
    const [filterTipo, setFilterTipo] = useState<string>("ALL");
    const [search, setSearch] = useState("");

    const situacaoParaStatus = (situacao?: string, nota_erp?: string | null): StatusWorkflow => {
        const map: Record<string, StatusWorkflow> = {
            AGENDAMENTO:          "AGENDADO",
            AGENDADO:             "AGENDADO",
            EM_SEPARACAO:         "EM_SEPARACAO",
            NOTA_FISCAL:          "NOTA_FISCAL",
            FATURADO:             "NOTA_FISCAL",
            ENTREGUE:             "ENTREGUE",
            APONTADO_REALIZADO:   "APONTADO_REALIZADO",
            AGUARDANDO_DEVOLUCAO: "AGUARDANDO_DEVOLUCAO",
            FINALIZADO:           "FINALIZADO",
        };
        // Se tem NF emitida mas o status ainda não atualizou, garante NOTA_FISCAL
        if (!map[situacao ?? ""] && nota_erp) return "NOTA_FISCAL";
        const s = map[situacao ?? ""];
        return STATUS_LIST.includes(s) ? s : "AGENDADO";
    };

    const normalizaTipo = (v?: string): TipoCirurgia => {
        if (!v) return "ELETIVA";
        const upper = v.toUpperCase();
        if (upper === "URGENCIA") return "URGENCIA";
        if (upper === "CONSIGNADO" || upper === "CONSIGNACAO" || upper === "CONSIGNA\u00c7\u00c3O") return "CONSIGNADO";
        if (upper === "ELETIVA" || upper === "ELETIVO") return "ELETIVA";
        return "ELETIVA";
    };

    const fetchData = useCallback(() => {
        setIsRefreshing(true);

        const empresaId = user?.empresa?.id;

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

            // 2) pedidos de consigna\u00e7\u00e3o sem agendamento
            empresaId
                ? api.get(`/api-essencial/v1/pedidos/${empresaId}/empresa`)
                    .then((r) => (r.data || []) as any[])
                    .catch(() => [] as any[])
                : Promise.resolve([] as any[]),
        ])
        .then(([agendResults, pedidos]) => {
            // Agendamentos mapeados
            const doAgendamento: Scheduling[] = (agendResults as { items: any[]; nome: string }[]).flatMap(({ items, nome }) =>
                (items as any[]).map((i): Scheduling => ({
                    id: i.agendamento_id,
                    dataAgendamento: (i.data_agendamento || "").substring(0, 10),
                    horaCirurgia: i.hora_agendamento ?? undefined,
                    tipo: normalizaTipo(i.tipo || i.pedido?.tipo_pedido),
                    cliente: { razaoSocial: i.clientes?.fantasia || i.clientes?.razao_social || "" },
                    colaborador: { nome },
                    paciente: i.paciente ?? undefined,
                    medico: i.medico
                        ? (typeof i.medico === "object" ? (i.medico.nome || undefined) : i.medico)
                        : undefined,
                    observacoes: i.observacoes ?? undefined,
                    pedidoProtheus: i.pedido?.pedido_erp ?? undefined,
                    statusWorkflow: situacaoParaStatus(i.pedido?.situacao, i.pedido?.nota_erp),
                    numeroNF: i.pedido?.nota_erp ?? undefined,
                    statusPedido: i.pedido?.situacao ?? undefined,
                    convenio: i.convenio
                        ? (typeof i.convenio === "object"
                            ? (i.convenio.descricao || i.convenio.codigo || undefined)
                            : i.convenio)
                        : undefined,
                    procedimento: undefined,
                }))
            );

            // Pedidos de consigna\u00e7\u00e3o sem agendamento vinculado
            const idsComAgendamento = new Set(doAgendamento.map(s => s.pedidoProtheus).filter(Boolean));
            const doConsignacao: Scheduling[] = (pedidos as any[])
                .filter((p: any) => normalizaTipo(p.tipo_pedido) === "CONSIGNADO" && !p.excluido)
                .filter((p: any) => !idsComAgendamento.has(p.pedido_erp))
                .map((p: any): Scheduling => ({
                    id: p.pedido_id,
                    dataAgendamento: (p.data_emissao || "").substring(0, 10),
                    horaCirurgia: undefined,
                    tipo: "CONSIGNADO",
                    cliente: { razaoSocial: p.clientes?.fantasia || p.clientes?.razao_social || "" },
                    colaborador: { nome: p.colaboradores?.nome || "" },
                    paciente: undefined,
                    medico: undefined,
                    observacoes: undefined,
                    pedidoProtheus: p.pedido_erp ?? undefined,
                    statusWorkflow: situacaoParaStatus(p.situacao, p.nota_erp),
                    numeroNF: p.nota_erp ?? undefined,
                    statusPedido: p.situacao ?? undefined,
                    convenio: undefined,
                    procedimento: undefined,
                }));

            setScheduling([...doAgendamento, ...doConsignacao]);
            setHasError(false);
        })
        .catch(() => { setScheduling([]); setHasError(true); })
        .finally(() => {
            setIsLoading(false);
            setIsRefreshing(false);
            setLastUpdate(DateTime.now());
        });
    }, [user]);

    useEffect(() => {
        fetchData();
        const timer = setInterval(fetchData, 180000);
        return () => { clearInterval(timer); };
    }, [fetchData]);

    const tipoOrder: Record<TipoCirurgia, number> = { URGENCIA: 0, ELETIVA: 1, CONSIGNADO: 2 };

    const filtered = scheduling
        .filter(s => {
            if (filterStatus !== "ALL" && s.statusWorkflow !== filterStatus) return false;
            if (filterTipo !== "ALL" && s.tipo !== filterTipo) return false;
            if (search) {
                const q = search.toLowerCase();
                return (
                    s.paciente?.toLowerCase().includes(q) ||
                    s.cliente?.razaoSocial?.toLowerCase().includes(q) ||
                    s.medico?.toLowerCase().includes(q) ||
                    s.colaborador?.nome?.toLowerCase().includes(q) ||
                    s.pedidoProtheus?.toLowerCase().includes(q)
                );
            }
            return true;
        })
        .sort((a, b) => {
            const aNF = !!a.numeroNF ? 1 : 0;
            const bNF = !!b.numeroNF ? 1 : 0;
            if (aNF !== bNF) return aNF - bNF;
            return tipoOrder[a.tipo] - tipoOrder[b.tipo];
        });

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const currentPage = Math.min(page, totalPages);
    const pageItems = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const totalUrgentes = scheduling.filter(s => s.tipo === "URGENCIA").length;
    const totalEletiva = scheduling.filter(s => s.tipo === "ELETIVA").length;
    const totalConsignado = scheduling.filter(s => s.tipo === "CONSIGNADO").length;

    const totalDevolucao = scheduling.filter(s => s.statusWorkflow === "AGUARDANDO_DEVOLUCAO").length;

    const TABLE_COLS = [
        { label: "HOSPITAL",          flex: 1.4 },
        { label: "DATA PROCEDIMENTO", flex: 1.3 },
        { label: "PACIENTE",          flex: 1.8 },
        { label: "CONVENIO",          flex: 0.9 },
        { label: "MEDICO",            flex: 1.2 },
        { label: "VENDEDOR",          flex: 1.2 },
        { label: "PEDIDO / NF",        flex: 1.4 },
    ];

    if (isLoading) {
        const loadingContent = (
            // @ts-ignore
            <Flex ml="65px" mt="80px" h="calc(100vh - 80px)" align="center" justify="center" bg="gray.700">
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
            <Header />
            <SiderbarResponsive />

            <Flex direction="column" ml="65px" mt="80px" minH="calc(100vh - 80px)" bg="gray.700">

                {/* ── Título ── */}
                <Box
                    bg="gray.800"
                    py={4}
                    px={6}
                    textAlign="center"
                    flexShrink={0}
                    borderBottom="1px solid"
                    borderColor="gray.700"
                >
                    <Text fontWeight="semibold" fontSize="xl" color="gray.50">
                        MAPA CIRÚRGICO
                    </Text>
                </Box>

                {/* ── Barra de ferramentas ── */}
                <Flex
                    align="center" gap={3} px={4} py={2.5}
                    bg="gray.800" borderBottom="1px solid" borderColor="gray.700"
                    flexShrink={0} wrap="wrap"
                >
                    <HStack spacing={2} flex={1} maxW="280px">
                        <Icon as={FaSearch} color="gray.500" w={3.5} h={3.5} flexShrink={0} />
                        <Input
                            size="sm" borderRadius="md"
                            placeholder="Buscar paciente, hospital..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            bg="gray.900"
                            color="gray.50"
                            borderColor="gray.700"
                            _placeholder={{ color: "gray.400" }}
                            _hover={{ borderColor: "gray.600" }}
                            _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px #4299E1" }}
                        />
                    </HStack>
                    <Box position="relative">
                        <label htmlFor="filter-status" className="sr-only">Filtrar por status</label>
                        <select
                            id="filter-status"
                            title="Filtrar por status"
                            className="map-select"
                            value={filterStatus}
                            onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
                        >
                            <option value="ALL">Todos os Status</option>
                            {STATUS_LIST.map(s => (
                                <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                            ))}
                        </select>
                    </Box>
                    <Box position="relative">
                        <label htmlFor="filter-tipo" className="sr-only">Filtrar por tipo</label>
                        <select
                            id="filter-tipo"
                            title="Filtrar por tipo"
                            className="map-select"
                            value={filterTipo}
                            onChange={e => { setFilterTipo(e.target.value); setPage(1); }}
                        >
                            <option value="ALL">Todos os Tipos</option>
                            <option value="URGENCIA">URGÊNCIA</option>
                            <option value="ELETIVA">ELETIVA</option>
                            <option value="CONSIGNADO">CONSIGNADO</option>
                        </select>
                    </Box>

                    <HStack ml="auto" spacing={2} flexWrap="wrap">
                        {totalUrgentes > 0 && (
                            <HStack bg="red.50" border="1px solid" borderColor="red.200" borderRadius="lg" px={3} py={1} spacing={2} className="pulse-urgency">
                                <Icon as={FaExclamationCircle} color="red.500" w={3.5} h={3.5} />
                                <Text fontWeight="black" color="red.600" fontSize="sm">{totalUrgentes} Urgências</Text>
                            </HStack>
                        )}
                        {totalEletiva > 0 && (
                            <HStack bg="green.50" border="1px solid" borderColor="green.200" borderRadius="lg" px={3} py={1} spacing={2}>
                                <Box w={2.5} h={2.5} borderRadius="full" bg="green.500" />
                                <Text fontWeight="black" color="green.700" fontSize="sm">{totalEletiva} Eletivas</Text>
                            </HStack>
                        )}
                        {totalConsignado > 0 && (
                            <HStack bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="lg" px={3} py={1} spacing={2}>
                                <Box w={2.5} h={2.5} borderRadius="full" bg="orange.400" />
                                <Text fontWeight="black" color="orange.700" fontSize="sm">{totalConsignado} Consignados</Text>
                            </HStack>
                        )}
                        {totalDevolucao > 0 && (
                            <HStack bg="pink.50" border="1px solid" borderColor="pink.200" borderRadius="lg" px={3} py={1} spacing={2}>
                                <Box w={2.5} h={2.5} borderRadius="full" bg="red.400" />
                                <Text fontWeight="black" color="red.700" fontSize="sm">{totalDevolucao} Devoluções</Text>
                            </HStack>
                        )}
                        <HStack bg="blue.50" border="1px solid" borderColor="blue.200" borderRadius="lg" px={3} py={1} spacing={2}>
                            <Icon as={FaClipboardList} color="blue.500" w={3.5} h={3.5} />
                            <Text fontWeight="black" color="blue.600" fontSize="sm">{filtered.length} registros</Text>
                        </HStack>
                        <HStack spacing={1}>
                            <Icon as={FaWifi} color="green.400" w={3} h={3} />
                            <Text fontSize="xs" color="gray.300">{lastUpdate.toFormat("HH:mm:ss")}</Text>
                        </HStack>
                        {isRefreshing && <Icon as={FaSyncAlt} color="orange.400" w={4} h={4} />}
                    </HStack>
                </Flex>

                {/* ── Tabela + setas de paginação ── */}
                <Flex flex={1} align="stretch" px={3} py={3} gap={2}>

                    {/* Seta esquerda */}
                    <Flex align="center" justify="center" flexShrink={0}>
                        <IconButton
                            aria-label="Página anterior"
                            icon={<Icon as={FaChevronLeft} />}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            isDisabled={currentPage <= 1}
                            borderRadius="full" variant="ghost" size="lg"
                            color="gray.50" _hover={{ bg: "gray.800" }}
                        />
                    </Flex>

                    {/* Conteúdo da tabela */}
                    <Box flex={1} overflow="hidden">

                        {/* Cabeçalho */}
                        <Flex borderRadius="md" overflow="hidden" mb={2} boxShadow="sm">
                            {/* STATUS */}
                            <Flex w="168px" flexShrink={0} bg="#2D7D9A" align="center" justify="center" py={3} px={3}>
                                <Text fontWeight="black" fontSize="xs" color="white" letterSpacing="wider">STATUS</Text>
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
                                                ? "Nenhum agendamento encontrado."
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

                    {/* Seta direita */}
                    <Flex align="center" justify="center" flexShrink={0}>
                        <IconButton
                            aria-label="Próxima página"
                            icon={<Icon as={FaChevronRight} />}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            isDisabled={currentPage >= totalPages}
                            borderRadius="full" variant="ghost" size="lg"
                            color="gray.50" _hover={{ bg: "gray.800" }}
                        />
                    </Flex>
                </Flex>

                {/* ── Paginação ── */}
                {totalPages > 1 && (
                    <Flex justify="center" align="center" gap={2} pb={4} flexShrink={0}>
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <Box
                                key={i}
                                w={i + 1 === currentPage ? "24px" : "8px"}
                                h="8px"
                                borderRadius="full"
                                bg={i + 1 === currentPage ? "blue.500" : "gray.300"}
                                cursor="pointer"
                                onClick={() => setPage(i + 1)}
                                transition="all 0.2s"
                            />
                        ))}
                        <Text fontSize="xs" color="gray.50" ml={2}>{currentPage}/{totalPages}</Text>
                    </Flex>
                )}

            </Flex>

            <style>{`
                .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
                .map-select { height: 32px; padding: 0 32px 0 12px; font-size: 14px; color: #eeeef2; background-color: #181b23; border: 1px solid #353646; border-radius: 6px; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23b3b5c6' d='M6 8L0 0h12z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; min-width: 140px; }
                .map-select:hover { border-color: #4b4d63; }
                .map-select:focus { outline: none; border-color: #4299E1; box-shadow: 0 0 0 1px #4299E1; }
                ::-webkit-scrollbar { width: 5px; height: 5px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #CBD5E0; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #A0AEC0; }
                @keyframes pulse-ring {
                    0%   { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.5); }
                    70%  { box-shadow: 0 0 0 8px rgba(229, 62, 62, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0); }
                }
                .pulse-urgency { animation: pulse-ring 1.5s ease-out infinite; }
                @keyframes blink-row {
                    0%   { border-color: #FC8181; background-color: #FFF5F5; }
                    50%  { border-color: #E53E3E; background-color: #FED7D7; }
                    100% { border-color: #FC8181; background-color: #FFF5F5; }
                }
                .row-urgency { animation: blink-row 1s ease-in-out infinite; }
            `}</style>
        </>
    );
}
