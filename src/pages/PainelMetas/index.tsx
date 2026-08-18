import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  Select as SelectBase,
  Text as TextBase,
  HStack as HStackBase,
  SimpleGrid as SimpleGridBase,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { FiDollarSign, FiTrendingUp, FiCalendar, FiUsers, FiRefreshCw, FiCheckCircle, FiTarget, FiPackage } from 'react-icons/fi';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import api from '../../service/api';
import { useHistory } from 'react-router-dom';
import { CorridaTabuleiro, CorridaTabelaClassificacao, ParticipanteCorrida } from './CorridaMetas';
import { VendedorProgresso } from './TabuleiroTrilha';

// Chakra v1 + TS strict estoura TS2590; cast para any contorna.
const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const Select = SelectBase as any;
const Text = TextBase as any;
const HStack = HStackBase as any;
const SimpleGrid = SimpleGridBase as any;
const ApexChart = Chart as any;

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const PALETA = ['#fe8026', '#4fd1c5', '#63b3ed', '#f687b3', '#9f7aea', '#68d391', '#f6ad55', '#fc8181'];

type Vendedor = { id: string; nome: string };
type MesDado = {
  meta: number;
  realizado: number;
  aFaturar: number;
  faturado: number;
  metaQuantidade: number;
  realizadoQuantidade: number;
};

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;

// Sistema começou em 2026 — sem anos anteriores nem futuros.
const ANO_INICIO = 2026;
const ANOS: number[] = [];
for (let a = ANO_INICIO; a <= Math.max(anoAtual, ANO_INICIO); a++) ANOS.push(a);

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function numero(v: any) {
  return Number(v ?? 0) || 0;
}

function qtd(v: number) {
  return `${Math.round(v).toLocaleString('pt-BR')} un.`;
}

function itensPedido(pedido: any): any[] {
  return pedido?.item_pedido || pedido?.itensPedido || pedido?.itens_pedido || pedido?.itens || [];
}

function idPedido(pedido: any) {
  return pedido?.pedido_id || pedido?.id;
}

function quantidadeItensPedido(pedido: any) {
  const itens = itensPedido(pedido);
  if (itens.length > 0) {
    return itens.reduce((soma, item) => soma + numero(item?.quantidade), 0);
  }

  return numero(
    pedido?.realizado_quantidade ??
      pedido?.quantidade_produtos ??
      pedido?.quantidade_itens ??
      pedido?.total_quantidade
  );
}

function quantidadeMeta(meta: any) {
  if (meta?.meta_quantidade != null) return numero(meta.meta_quantidade);
  if (meta?.quantidade_meta != null) return numero(meta.quantidade_meta);
  return (meta?.itens || []).reduce((soma: number, item: any) => soma + numero(item?.quantidade), 0);
}

async function carregarPedidoComItens(pedido: any) {
  if (itensPedido(pedido).length > 0 || quantidadeItensPedido(pedido) > 0) return pedido;
  const id = idPedido(pedido);
  if (!id) return pedido;

  try {
    const res = await api.get(`/api-essencial/v1/pedidos/${id}`);
    const detalhe = res.data?.data || res.data || {};
    return {
      ...pedido,
      ...detalhe,
      item_pedido:
        detalhe.item_pedido ||
        detalhe.itensPedido ||
        detalhe.itens_pedido ||
        detalhe.itens ||
        pedido.item_pedido,
    };
  } catch {
    return pedido;
  }
}

function dadosVazios(): Record<number, MesDado> {
  const o: Record<number, MesDado> = {};
  for (let m = 1; m <= 12; m++) {
    o[m] = {
      meta: 0,
      realizado: 0,
      aFaturar: 0,
      faturado: 0,
      metaQuantidade: 0,
      realizadoQuantidade: 0,
    };
  }
  return o;
}

// Cor da "casa" pelo % atingido
function statusCasa(meta: number, realizado: number) {
  if (meta <= 0) return { cor: 'gray', label: 'sem meta', pct: 0 };
  const pct = (realizado / meta) * 100;
  if (pct >= 100) return { cor: 'green', label: 'bateu', pct };
  if (pct >= 70) return { cor: 'yellow', label: 'perto', pct };
  return { cor: 'red', label: 'longe', pct };
}

export const PainelMetas = () => {
  const { user } = useAuth();
  const { ehClaro } = useThemeMode();
  const history = useHistory();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState('');
  const [ano, setAno] = useState(anoAtual);
  const [mesSel, setMesSel] = useState(mesAtual);
  const [dados, setDados] = useState<Record<number, MesDado>>(dadosVazios());
  const [participantes, setParticipantes] = useState<ParticipanteCorrida[]>([]);
  const [progresso, setProgresso] = useState<VendedorProgresso[]>([]);

  useEffect(() => {
    api
      .get('/api-essencial/v1/colaboradores')
      .then((res) =>
        setVendedores((res.data || []).map((c: any) => ({ id: c.colaborador_id, nome: c.nome })))
      )
      .catch(() => {});
  }, []);

  // Carrega meta + realizado (pedidos) — dados reais.
  async function carregarReal() {
    // META por colaborador/mês: GET /metas/:empresa
    const metaMap: Record<string, Record<number, number>> = {};
    const metaQtdMap: Record<string, Record<number, number>> = {};
    try {
      const res = await api.get(`/api-essencial/v1/metas/${user.empresa.id}`, {
        params: { ano },
      });
      (res.data || []).forEach((m: any) => {
        if (!metaMap[m.colaborador_id]) metaMap[m.colaborador_id] = {};
        if (!metaQtdMap[m.colaborador_id]) metaQtdMap[m.colaborador_id] = {};
        if (m.mes >= 1 && m.mes <= 12) {
          metaMap[m.colaborador_id][m.mes] = Number(m.valor_meta) || 0;
          metaQtdMap[m.colaborador_id][m.mes] = quantidadeMeta(m);
        }
      });
    } catch {
      // endpoint de meta ainda não existe — segue só com realizado
    }

    // REALIZADO por colaborador/mês, separando "a faturar" (sem nota) de "faturado" (com nota)
    type RealMes = { aFaturar: number; faturado: number; quantidade: number };
    const realMap: Record<string, Record<number, RealMes>> = {};
    try {
      const res = await api.get(`/api-essencial/v1/pedidos/${user.empresa.id}/empresa`);
      const pedidosValidos = (res.data || []).filter((p: any) => {
        if (!p.data_emissao) return false;
        const d = new Date(p.data_emissao);
        if (d.getFullYear() !== Number(ano)) return false;
        // Pedido excluído (soft delete) ou bloqueado não conta como realizado
        if (p.excluido === true || p.status_pedido === false) return false;
        const sit = String(p.situacao || '').toUpperCase();
        // EXCLUIDO_ERP = excluído no ERP; NOTA_CANCELADA = nota cancelada via webhook
        if (['CANCELADO', 'EM_ANALISE', 'ERRO_INTEGRACAO', 'EXCLUIDO_ERP', 'NOTA_CANCELADA', 'BLOQUEADO'].includes(sit)) return false;
        return true;
      });
      const pedidosComItens = await Promise.all(pedidosValidos.map(carregarPedidoComItens));

      pedidosComItens.forEach((p: any) => {
        const d = new Date(p.data_emissao);
        const sit = String(p.situacao || '').toUpperCase();
        const cid = p.colaborador_id;
        const mes = d.getMonth() + 1;
        const valor = Number(p.valor_pedido) || 0;
        const quantidade = quantidadeItensPedido(p);
        // Faturado = situação FATURADO ou já tem nota emitida (nota_erp). Senão, ainda é "a faturar".
        const ehFaturado = sit === 'FATURADO' || !!String(p.nota_erp || '').trim();
        if (!realMap[cid]) realMap[cid] = {};
        if (!realMap[cid][mes]) realMap[cid][mes] = { aFaturar: 0, faturado: 0, quantidade: 0 };
        if (ehFaturado) realMap[cid][mes].faturado += valor;
        else realMap[cid][mes].aFaturar += valor;
        realMap[cid][mes].quantidade += quantidade;
      });
    } catch {}

    // dados do vendedor selecionado (ou agregado de todos) p/ gráfico + cards
    const novo = dadosVazios();
    for (let m = 1; m <= 12; m++) {
      let meta = 0;
      let aFaturar = 0;
      let faturado = 0;
      let metaQuantidade = 0;
      let realizadoQuantidade = 0;
      if (vendedorId) {
        meta = metaMap[vendedorId]?.[m] || 0;
        aFaturar = realMap[vendedorId]?.[m]?.aFaturar || 0;
        faturado = realMap[vendedorId]?.[m]?.faturado || 0;
        metaQuantidade = metaQtdMap[vendedorId]?.[m] || 0;
        realizadoQuantidade = realMap[vendedorId]?.[m]?.quantidade || 0;
      } else {
        Object.keys(metaMap).forEach((cid) => (meta += metaMap[cid][m] || 0));
        Object.keys(metaQtdMap).forEach((cid) => (metaQuantidade += metaQtdMap[cid][m] || 0));
        Object.keys(realMap).forEach((cid) => {
          aFaturar += realMap[cid][m]?.aFaturar || 0;
          faturado += realMap[cid][m]?.faturado || 0;
          realizadoQuantidade += realMap[cid][m]?.quantidade || 0;
        });
      }
      novo[m] = {
        meta,
        aFaturar,
        faturado,
        // Realizado = tudo que o vendedor vendeu no mês (a faturar + já faturado).
        // Antes contava só "a faturar", então quando o pedido era faturado a
        // performance caía pra 0%. Mesma regra do realDoMes da corrida.
        realizado: aFaturar + faturado,
        metaQuantidade,
        realizadoQuantidade,
      };
    }
    setDados(novo);

    // participantes da corrida (mês selecionado): pedidos a faturar, meta, % e crescimento vs mês anterior
    // Realizado do mês = tudo que o vendedor vendeu (a faturar + já faturado).
    // Antes contava só "a faturar", então quem já tinha pedido faturado ficava
    // com 0 e o peão não andava na trilha.
    const realDoMes = (cid: string, m: number) => {
      const r = realMap[cid]?.[m];
      return (r?.aFaturar || 0) + (r?.faturado || 0);
    };
    // Só vendedores com meta cadastrada no mês participam da corrida/classificação.
    const parts: ParticipanteCorrida[] = vendedores
      .map((v, i) => {
        const meta = metaMap[v.id]?.[mesSel] || 0;
        const realizado = realDoMes(v.id, mesSel);
        const pct = meta > 0 ? (realizado / meta) * 100 : 0;
        const realAnt = mesSel > 1 ? realDoMes(v.id, mesSel - 1) : 0;
        const deltaPct = realAnt > 0 ? ((realizado - realAnt) / realAnt) * 100 : realizado > 0 ? null : 0;
        return { id: v.id, nome: v.nome, cor: PALETA[i % PALETA.length], realizado, meta, pct, deltaPct };
      })
      .filter((p) => p.meta > 0);
    setParticipantes(parts);

    // Progresso na trilha = CORRIDA DO MÊS ATUAL. "casas" guarda a fração da meta
    // do mês selecionado (0..1); a trilha usa isso para posicionar o peão na linha
    // que leva até a casa do mês atual (chegou na casa = bateu 100%).
    const prog: VendedorProgresso[] = vendedores
      .map((v, i) => {
        const metaMes = metaMap[v.id]?.[mesSel] || 0;
        const realMes = realDoMes(v.id, mesSel);
        const fracMes = metaMes > 0 ? Math.min(realMes / metaMes, 1) : 0;
        return { id: v.id, nome: v.nome, casas: fracMes, cor: PALETA[i % PALETA.length], realizado: realMes, meta: metaMes };
      })
      // só corre quem tem meta cadastrada no mês atual
      .filter((v) => (metaMap[v.id]?.[mesSel] || 0) > 0);
    setProgresso(prog);
  }

  useEffect(() => {
    carregarReal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorId, ano, vendedores, mesSel]);

  const totais = useMemo(() => {
    let casasBatidas = 0;
    let metaAno = 0;
    for (let m = 1; m <= 12; m++) {
      metaAno += dados[m].meta;
      if (dados[m].meta > 0 && dados[m].realizado >= dados[m].meta) casasBatidas++;
    }
    // Cards e gauge refletem o mês selecionado (não o ano)
    const meta = dados[mesSel].meta;
    const realizado = dados[mesSel].realizado;
    const aFaturar = dados[mesSel].aFaturar;
    const faturado = dados[mesSel].faturado;
    const metaQuantidade = dados[mesSel].metaQuantidade;
    const realizadoQuantidade = dados[mesSel].realizadoQuantidade;
    const pct = meta > 0 ? (realizado / meta) * 100 : 0;
    const pctQuantidade = metaQuantidade > 0 ? (realizadoQuantidade / metaQuantidade) * 100 : 0;
    return {
      meta,
      realizado,
      aFaturar,
      faturado,
      metaQuantidade,
      realizadoQuantidade,
      casasBatidas,
      pct,
      pctQuantidade,
      metaAno,
    };
  }, [dados, mesSel]);

  const gaugeOptions: any = {
    chart: {
      background: 'transparent',
      sparkline: { enabled: true },
      redrawOnParentResize: false,
      redrawOnWindowResize: false,
      animations: { enabled: false },
    },
    colors: [totais.pct >= 100 ? '#68d391' : totais.pct >= 70 ? '#f6ad55' : '#fe8026'],
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: { size: '65%', background: 'transparent' },
        track: { background: ehClaro ? '#cfd3de' : '#353646', strokeWidth: '100%' },
        dataLabels: {
          name: { show: true, color: ehClaro ? '#6b7080' : '#9699B0', fontSize: '13px', offsetY: 24 },
          value: {
            show: true,
            color: ehClaro ? '#1a1d26' : '#fff',
            fontSize: '32px',
            fontWeight: 800,
            offsetY: -12,
            formatter: (v: number) => `${Math.round(v)}%`,
          },
        },
      },
    },
    fill: { type: 'gradient', gradient: { shade: 'dark', type: 'horizontal', gradientToColors: ['#4fd1c5'], stops: [0, 100] } },
    labels: ['Performance'],
  };
  const gaugeSeries = [Math.min(totais.pct, 100)];

  // Linha: Meta × Realizado (a faturar + faturado) ao longo dos 12 meses do ano
  const lineOptions: any = {
    chart: {
      type: 'line',
      background: 'transparent',
      toolbar: { show: false },
      foreColor: '#9699B0',
      redrawOnParentResize: false,
      redrawOnWindowResize: false,
      animations: { enabled: false },
    },
    colors: ['#63b3ed', '#fe8026'],
    stroke: { width: 3, curve: 'smooth' },
    markers: { size: 3 },
    grid: { show: true, borderColor: '#222634', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    legend: { labels: { colors: '#cfd2dc' } },
    xaxis: { categories: MESES, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: '#7c8093' } } },
    yaxis: {
      labels: {
        formatter: (v: number) =>
          v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K` : `R$ ${Math.round(v)}`,
        style: { colors: '#7c8093' },
      },
    },
    tooltip: { theme: 'dark', y: { formatter: (v: number) => brl(v) } },
  };
  const lineSeries = [
    { name: 'Meta', data: MESES.map((_, i) => dados[i + 1].meta) },
    { name: 'Realizado', data: MESES.map((_, i) => dados[i + 1].realizado) },
  ];

  const kpiCards = [
    {
      label: `Meta de ${MESES[mesSel - 1]}`,
      value: brl(totais.meta),
      icon: FiDollarSign,
      color: '#63b3ed',
      bg: 'rgba(99,179,237,0.12)',
    },
    {
      label: 'Produtos vendidos',
      value: qtd(totais.realizadoQuantidade),
      detail: totais.metaQuantidade > 0 ? `Meta: ${qtd(totais.metaQuantidade)}` : 'Sem meta de qtd.',
      icon: FiPackage,
      color: '#4fd1c5',
      bg: 'rgba(79,209,197,0.12)',
    },
    {
      label: 'Pedidos a faturar',
      value: brl(totais.aFaturar),
      icon: FiTrendingUp,
      color: '#fe8026',
      bg: 'rgba(254,128,38,0.12)',
    },
    {
      label: 'Falta para a meta',
      value: brl(Math.max(totais.meta - totais.realizado, 0)),
      icon: FiTarget,
      color: totais.meta > 0 && totais.realizado >= totais.meta ? '#68d391' : '#f6ad55',
      bg: totais.meta > 0 && totais.realizado >= totais.meta ? 'rgba(104,211,145,0.12)' : 'rgba(246,173,85,0.12)',
    },
    {
      label: 'Faturado',
      value: brl(totais.faturado),
      icon: FiCheckCircle,
      color: '#68d391',
      bg: 'rgba(104,211,145,0.12)',
    },
  ];

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6" w="100%" maxW="100%" overflowX="hidden">
        <Wapper>
          <Box flex="1" w="100%" minW={0} overflowX="hidden" p={['4', '6', '8']} bg="gray.800" borderRadius={12} mb="16">

            {/* ── Cabeçalho ── */}
            <HStack justify="space-between" flexWrap="wrap" mb="6">
              <Box>
                <Heading size="lg" fontWeight="bold" letterSpacing="tight">
                  Painel de Metas
                </Heading>
                <Text color="gray.400" fontSize="sm" mt="1">
                  Acompanhe o desempenho da equipe de vendas
                </Text>
              </Box>
              <HStack spacing="3">
                <Button
                  size="sm"
                  leftIcon={<FiRefreshCw />}
                  colorScheme="gray"
                  variant="outline"
                  onClick={carregarReal}
                  _hover={{ bg: 'gray.700' }}
                >
                  Atualizar
                </Button>
              </HStack>
            </HStack>

            {/* ── Filtros ── */}
            <HStack
              spacing="4"
              align="flex-end"
              flexWrap="wrap"
              p="4"
              bg="gray.900"
              borderRadius="lg"
              mb="6"
              borderLeft="3px solid"
              borderColor="orange.200"
            >
              <Box minW="260px" flex="1">
                <HStack mb="1" spacing="1">
                  <FiUsers color="#9699B0" size={13} />
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider">
                    Vendedor
                  </Text>
                </HStack>
                <Select
                  aria-label="Filtrar por vendedor"
                  placeholder="Todos os vendedores"
                  bgColor="gray.700"
                  variant="filled"
                  _hover={{ bgColor: 'gray.700' }}
                  value={vendedorId}
                  onChange={(e: any) => setVendedorId(e.target.value)}
                >
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </Select>
              </Box>
              <Box w="160px">
                <HStack mb="1" spacing="1">
                  <FiCalendar color="#9699B0" size={13} />
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider">
                    Mês
                  </Text>
                </HStack>
                <Select
                  aria-label="Filtrar por mês"
                  bgColor="gray.700"
                  variant="filled"
                  _hover={{ bgColor: 'gray.700' }}
                  value={mesSel}
                  onChange={(e: any) => setMesSel(Number(e.target.value))}
                >
                  {MESES.map((nome, i) => (
                    <option key={nome} value={i + 1}>{nome}</option>
                  ))}
                </Select>
              </Box>
              <Box w="140px">
                <HStack mb="1" spacing="1">
                  <FiCalendar color="#9699B0" size={13} />
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider">
                    Ano
                  </Text>
                </HStack>
                <Select
                  aria-label="Filtrar por ano"
                  bgColor="gray.700"
                  variant="filled"
                  _hover={{ bgColor: 'gray.700' }}
                  value={ano}
                  onChange={(e: any) => setAno(Number(e.target.value))}
                >
                  {ANOS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </Box>
            </HStack>

            {/* ── KPI Cards ── */}
            <SimpleGrid columns={[1, 2, 3, 5]} spacing="4" mb="6">
              {kpiCards.map((card) => {
                const Icon = card.icon as any;
                return (
                  <Box
                    key={card.label}
                    bg="gray.900"
                    borderRadius="xl"
                    p="5"
                    position="relative"
                    overflow="hidden"
                    _after={{
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      w: '4px',
                      h: '100%',
                      bg: card.color,
                      borderRadius: '4px 0 0 4px',
                    }}
                  >
                    <HStack justify="space-between" align="flex-start">
                      <Box>
                        <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider" mb="1">
                          {card.label}
                        </Text>
                        <Text fontSize={['lg', 'xl', '2xl']} fontWeight="800" color="gray.50" lineHeight="1.1">
                          {card.value}
                        </Text>
                        {'detail' in card && card.detail && (
                          <Text fontSize="xs" color="gray.500" mt="1" noOfLines={1}>
                            {card.detail}
                          </Text>
                        )}
                      </Box>
                      <Box
                        w="42px"
                        h="42px"
                        borderRadius="xl"
                        bg={card.bg}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        flexShrink={0}
                      >
                        <Icon size={20} color={card.color} />
                      </Box>
                    </HStack>
                  </Box>
                );
              })}
            </SimpleGrid>

            {/* ── Gauge + Destaques (lado a lado, como antes) ── */}
            <SimpleGrid columns={[1, 1, 2]} spacing="4" mb="6">
              <Box bg="gray.900" borderRadius="xl" p="6" minW={0} w="100%" overflow="hidden" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider" mb="3">
                  Performance Geral {MESES[mesSel - 1]}/{ano}
                </Text>
                <Text fontSize="xs" color="gray.500" textAlign="center" mt="-2" mb="2">
                  Cálculo: realizado (a faturar + faturado) ÷ meta do mês × 100
                </Text>
                <ApexChart
                  key={`gauge-${vendedorId}-${ano}-${mesSel}`}
                  type="radialBar"
                  width={300}
                  height={260}
                  series={gaugeSeries}
                  options={gaugeOptions}
                />
                <HStack spacing="6" mt="1" flexWrap="wrap" justify="center">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.500">Meta</Text>
                    <Text fontSize="sm" fontWeight="bold" color="gray.200">{brl(totais.meta)}</Text>
                  </Box>
                  <Box w="1px" h="30px" bg="gray.700" />
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.500">Realizado</Text>
                    <Text fontSize="sm" fontWeight="bold" color="orange.200">{brl(totais.realizado)}</Text>
                  </Box>
                  <Box w="1px" h="30px" bg="gray.700" />
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.500">Qtd vendida</Text>
                    <Text fontSize="sm" fontWeight="bold" color="teal.200">
                      {qtd(totais.realizadoQuantidade)}
                      {totais.metaQuantidade > 0 ? ` / ${qtd(totais.metaQuantidade)}` : ''}
                    </Text>
                  </Box>
                  <Box w="1px" h="30px" bg="gray.700" />
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.500">Meses OK</Text>
                    <Text fontSize="sm" fontWeight="bold" color="green.300">{totais.casasBatidas}/12</Text>
                  </Box>
                </HStack>
              </Box>

              {/* Gráfico de linhas: Meta × Realizado no ano */}
              <Box bg="gray.900" borderRadius="xl" p="5" minW={0} overflow="hidden">
                <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider" mb="2">
                  Meta × Realizado — {ano}
                </Text>
                <ApexChart key={`line-${vendedorId}-${ano}`} type="line" height={250} series={lineSeries} options={lineOptions} />
              </Box>
            </SimpleGrid>

            {/* ── Meses ── */}
            <Box bg="gray.900" borderRadius="xl" p="5" mb="6">
              <HStack spacing="2" mb="4">
                <FiCalendar color="#fe8026" size={16} />
                <Text fontSize="sm" fontWeight="bold" color="gray.200" textTransform="uppercase" letterSpacing="wider">
                  Mês a Mês{vendedorId ? '' : ' — todos os vendedores'}
                </Text>
              </HStack>
              <SimpleGrid columns={[2, 3, 4, 6]} spacing="3">
                {MESES.map((nome, i) => {
                  const m = i + 1;
                  const { meta, realizado, metaQuantidade, realizadoQuantidade } = dados[m];
                  const st = statusCasa(meta, realizado);
                  const isAtual = m === mesSel;
                  return (
                    <Box
                      key={m}
                      bg="gray.800"
                      borderRadius="lg"
                      p="3"
                      border="1px solid"
                      borderColor={isAtual ? 'orange.200' : 'gray.700'}
                      boxShadow={isAtual ? '0 0 0 2px rgba(254,128,38,.25)' : 'none'}
                      cursor="pointer"
                      onClick={() => setMesSel(m)}
                      _hover={{ borderColor: 'orange.200' }}
                      position="relative"
                      overflow="hidden"
                      _after={{
                        content: '""',
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        w: '100%',
                        h: '3px',
                        bg: st.cor === 'green' ? '#68d391' : st.cor === 'yellow' ? '#f6ad55' : st.cor === 'red' ? '#fc8181' : '#4a5568',
                        borderRadius: '0 0 8px 8px',
                      }}
                    >
                      <HStack justify="space-between" mb="1">
                        <Text fontSize="xs" fontWeight="900" color={isAtual ? 'orange.200' : 'gray.300'} letterSpacing="wider">
                          {nome}
                        </Text>
                        {isAtual && (
                          <Box w="6px" h="6px" borderRadius="full" bg="orange.200" />
                        )}
                      </HStack>
                      <Text fontSize="lg" fontWeight="800" color="gray.50" lineHeight="1.1">
                        {meta > 0 ? `${st.pct.toFixed(0)}%` : '—'}
                      </Text>
                      <Box mt="1" mb="2" h="6px" w="100%" borderRadius="full" bg="whiteAlpha.200" overflow="hidden">
                        <Box
                          h="100%"
                          borderRadius="full"
                          w={`${Math.min(st.pct, 100)}%`}
                          style={{
                            background: `linear-gradient(to right, ${
                              st.pct >= 100 ? '#68d391' : st.pct >= 70 ? '#f6ad55' : '#fe8026'
                            }, #4fd1c5)`,
                            transition: 'width .6s ease',
                          }}
                        />
                      </Box>
                      <Text fontSize="10px" color="gray.400" noOfLines={1}>
                        {meta > 0 ? brl(realizado) : 'sem meta'}
                      </Text>
                      <Text fontSize="10px" color="gray.600" noOfLines={1}>
                        {meta > 0 ? `de ${brl(meta)}` : ''}
                      </Text>
                      {(metaQuantidade > 0 || realizadoQuantidade > 0) && (
                        <Text fontSize="10px" color="teal.200" noOfLines={1} mt="1">
                          Qtd: {qtd(realizadoQuantidade)}
                          {metaQuantidade > 0 ? ` / ${qtd(metaQuantidade)}` : ''}
                        </Text>
                      )}
                    </Box>
                  );
                })}
              </SimpleGrid>
            </Box>

            {/* ── Jornada das metas (trilha de ilhas) ── */}
            <CorridaTabuleiro
              meses={MESES.map((_, i) => {
                const mm = i + 1;
                const d = dados[mm];
                const pct = d.meta > 0 ? (d.realizado / d.meta) * 100 : 0;
                return { mes: mm, meta: d.meta, realizado: d.realizado, pct };
              })}
              progresso={progresso}
              mesSel={mesSel}
              ano={ano}
              onVendedorClick={(id: string) => history.push(`/cadastro/meta/${id}?ano=${ano}`)}
            />

            {/* ── Classificação dos participantes (ocupa toda a largura) ── */}
            <Box mt="6">
              <CorridaTabelaClassificacao
                participantes={participantes}
                onParticipanteClick={(id: string) => history.push(`/cadastro/meta/${id}?ano=${ano}`)}
              />
            </Box>

            {totais.metaAno === 0 && (
              <Box mt="4" p="3" bg="rgba(254,128,38,0.08)" borderRadius="lg" border="1px solid" borderColor="orange.200">
                <Text fontSize="sm" color="orange.200">
                  Ainda não há metas cadastradas para o período. Cadastre em "Metas".
                </Text>
              </Box>
            )}
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
