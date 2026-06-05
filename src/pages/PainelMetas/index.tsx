import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  Select as SelectBase,
  Text as TextBase,
  HStack as HStackBase,
  SimpleGrid as SimpleGridBase,
  Badge as BadgeBase,
  Progress as ProgressBase,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { FiDollarSign, FiTrendingUp, FiAward, FiCalendar, FiUsers, FiRefreshCw, FiBarChart2 } from 'react-icons/fi';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import api from '../../service/api';
import { useHistory } from 'react-router-dom';
import { TabuleiroTrilha, AvatarBoneco, VendedorProgresso } from './TabuleiroTrilha';

// Chakra v1 + TS strict estoura TS2590; cast para any contorna.
const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const Select = SelectBase as any;
const Text = TextBase as any;
const HStack = HStackBase as any;
const SimpleGrid = SimpleGridBase as any;
const Badge = BadgeBase as any;
const Progress = ProgressBase as any;
const ApexChart = Chart as any;

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const PALETA = ['#fe8026', '#4fd1c5', '#63b3ed', '#f687b3', '#9f7aea', '#68d391', '#f6ad55', '#fc8181'];

type Vendedor = { id: string; nome: string };
type MesDado = { meta: number; realizado: number };

const anoAtual = new Date().getFullYear();
const mesAtual = new Date().getMonth() + 1;

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dadosVazios(): Record<number, MesDado> {
  const o: Record<number, MesDado> = {};
  for (let m = 1; m <= 12; m++) o[m] = { meta: 0, realizado: 0 };
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
  const history = useHistory();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState('');
  const [ano, setAno] = useState(anoAtual);
  const [dados, setDados] = useState<Record<number, MesDado>>(dadosVazios());
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
    try {
      const res = await api.get(`/api-essencial/v1/metas/${user.empresa.id}`, {
        params: { ano },
      });
      (res.data || []).forEach((m: any) => {
        if (!metaMap[m.colaborador_id]) metaMap[m.colaborador_id] = {};
        if (m.mes >= 1 && m.mes <= 12) {
          metaMap[m.colaborador_id][m.mes] = Number(m.valor_meta) || 0;
        }
      });
    } catch {
      // endpoint de meta ainda não existe — segue só com realizado
    }

    // REALIZADO por colaborador/mês (soma dos pedidos válidos no ano)
    const realMap: Record<string, Record<number, number>> = {};
    try {
      const res = await api.get(`/api-essencial/v1/pedidos/${user.empresa.id}/empresa`);
      (res.data || []).forEach((p: any) => {
        if (!p.data_emissao) return;
        const d = new Date(p.data_emissao);
        if (d.getFullYear() !== Number(ano)) return;
        const sit = String(p.situacao || '').toUpperCase();
        if (['CANCELADO', 'EM_ANALISE', 'ERRO_INTEGRACAO'].includes(sit)) return;
        const cid = p.colaborador_id;
        const mes = d.getMonth() + 1;
        if (!realMap[cid]) realMap[cid] = {};
        realMap[cid][mes] = (realMap[cid][mes] || 0) + (Number(p.valor_pedido) || 0);
      });
    } catch {}

    // dados do vendedor selecionado (ou agregado de todos) p/ gráfico + cards
    const novo = dadosVazios();
    for (let m = 1; m <= 12; m++) {
      if (vendedorId) {
        novo[m] = {
          meta: metaMap[vendedorId]?.[m] || 0,
          realizado: realMap[vendedorId]?.[m] || 0,
        };
      } else {
        let meta = 0;
        let real = 0;
        Object.keys(metaMap).forEach((cid) => (meta += metaMap[cid][m] || 0));
        Object.keys(realMap).forEach((cid) => (real += realMap[cid][m] || 0));
        novo[m] = { meta, realizado: real };
      }
    }
    setDados(novo);

    // progresso de cada vendedor p/ a corrida: percentual da meta do mes atual
    setProgresso(
      vendedores.slice(0, 8).map((v, i) => {
        const meta = metaMap[v.id]?.[mesAtual] || 0;
        const real = realMap[v.id]?.[mesAtual] || 0;
        const pctMes = meta > 0 ? real / meta : 0;
        const casas = Math.min(Math.max(pctMes * 12, 0), 12);
        return { id: v.id, nome: v.nome, casas, cor: PALETA[i % PALETA.length] };
      })
    );
  }

  useEffect(() => {
    carregarReal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorId, ano]);

  const totais = useMemo(() => {
    let meta = 0;
    let realizado = 0;
    let casasBatidas = 0;
    for (let m = 1; m <= 12; m++) {
      meta += dados[m].meta;
      realizado += dados[m].realizado;
      if (dados[m].meta > 0 && dados[m].realizado >= dados[m].meta) casasBatidas++;
    }
    const pct = meta > 0 ? (realizado / meta) * 100 : 0;
    return { meta, realizado, casasBatidas, pct };
  }, [dados]);

  const gaugeOptions: any = {
    chart: { background: 'transparent', sparkline: { enabled: true } },
    colors: [totais.pct >= 100 ? '#68d391' : totais.pct >= 70 ? '#f6ad55' : '#fe8026'],
    plotOptions: {
      radialBar: {
        startAngle: -135,
        endAngle: 135,
        hollow: { size: '65%', background: 'transparent' },
        track: { background: '#353646', strokeWidth: '100%' },
        dataLabels: {
          name: { show: true, color: '#9699B0', fontSize: '13px', offsetY: 24 },
          value: {
            show: true,
            color: '#fff',
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

  const kpiCards = [
    {
      label: 'Meta do Ano',
      value: brl(totais.meta),
      icon: FiDollarSign,
      color: '#63b3ed',
      bg: 'rgba(99,179,237,0.12)',
    },
    {
      label: 'Realizado',
      value: brl(totais.realizado),
      icon: FiTrendingUp,
      color: '#fe8026',
      bg: 'rgba(254,128,38,0.12)',
    },
    {
      label: '% Atingido',
      value: `${totais.pct.toFixed(1)}%`,
      icon: FiBarChart2,
      color: totais.pct >= 100 ? '#68d391' : totais.pct >= 70 ? '#f6ad55' : '#fc8181',
      bg: totais.pct >= 100 ? 'rgba(104,211,145,0.12)' : totais.pct >= 70 ? 'rgba(246,173,85,0.12)' : 'rgba(252,129,129,0.12)',
    },
    {
      label: 'Meses Batidos',
      value: `${totais.casasBatidas}/12`,
      icon: FiAward,
      color: '#9f7aea',
      bg: 'rgba(159,122,234,0.12)',
    },
  ];

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p={['4', '6', '8']} bg="gray.800" borderRadius={12} mb="16">

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
              <Box w="140px">
                <HStack mb="1" spacing="1">
                  <FiCalendar color="#9699B0" size={13} />
                  <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider">
                    Ano
                  </Text>
                </HStack>
                <Select
                  bgColor="gray.700"
                  variant="filled"
                  _hover={{ bgColor: 'gray.700' }}
                  value={ano}
                  onChange={(e: any) => setAno(Number(e.target.value))}
                >
                  {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </Box>
            </HStack>

            {/* ── KPI Cards ── */}
            <SimpleGrid columns={[2, 2, 4]} spacing="4" mb="6">
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
                        <Text fontSize={['lg', 'xl', '2xl']} fontWeight="800" color="white" lineHeight="1.1">
                          {card.value}
                        </Text>
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

            {/* ── Linha central: gauge + ranking ── */}
            <SimpleGrid columns={[1, 1, 2]} spacing="4" mb="6">

              {/* Gauge de performance */}
              <Box bg="gray.900" borderRadius="xl" p="6" display="flex" flexDirection="column" alignItems="center" justifyContent="center">
                <Text fontSize="xs" color="gray.400" textTransform="uppercase" letterSpacing="wider" mb="3">
                  Performance Geral {MESES[mesAtual - 1]}/{ano}
                </Text>
                <ApexChart
                  type="radialBar"
                  height={220}
                  series={gaugeSeries}
                  options={gaugeOptions}
                />
                <HStack spacing="6" mt="1">
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
                    <Text fontSize="xs" color="gray.500">Meses OK</Text>
                    <Text fontSize="sm" fontWeight="bold" color="green.300">{totais.casasBatidas}/12</Text>
                  </Box>
                </HStack>
              </Box>

              {/* Ranking de vendedores */}
              <Box bg="gray.900" borderRadius="xl" p="5" overflow="auto" maxH="320px">
                <HStack mb="4" spacing="2">
                  <FiUsers color="#fe8026" size={16} />
                  <Text fontSize="sm" fontWeight="bold" color="gray.200" textTransform="uppercase" letterSpacing="wider">
                    Vendedores — {MESES[mesAtual - 1]}
                  </Text>
                </HStack>
                {progresso.length === 0 ? (
                  <Text fontSize="sm" color="gray.500" textAlign="center" pt="6">
                    Nenhum dado disponível para o período.
                  </Text>
                ) : (
                  progresso.map((v, idx) => {
                    const pct = Math.round((v.casas / 12) * 100);
                    return (
                      <Box
                        key={v.id}
                        mb="3"
                        pb="3"
                        borderBottom={idx < progresso.length - 1 ? '1px solid' : 'none'}
                        borderColor="gray.700"
                        cursor="pointer"
                        onClick={() => history.push(`/cadastro/meta/${v.id}?ano=${ano}`)}
                        _hover={{ opacity: 0.8 }}
                      >
                        <HStack spacing="3" mb="1">
                          {/* Avatar boneco */}
                          <AvatarBoneco
                            cor={v.cor}
                            nome={v.nome}
                            size={36}
                            onClick={() => history.push(`/cadastro/meta/${v.id}?ano=${ano}`)}
                            title={v.nome}
                          />
                          <Box flex="1" minW={0}>
                            <HStack justify="space-between">
                              <Text fontSize="sm" fontWeight="600" color="gray.100" noOfLines={1}>
                                {v.nome}
                              </Text>
                              <Badge
                                fontSize="xs"
                                colorScheme={pct >= 100 ? 'green' : pct >= 70 ? 'yellow' : 'red'}
                                borderRadius="full"
                                px="2"
                              >
                                {pct}%
                              </Badge>
                            </HStack>
                            <Progress
                              mt="1"
                              size="xs"
                              borderRadius="full"
                              value={Math.min(pct, 100)}
                              sx={{
                                '& > div': {
                                  background: `linear-gradient(90deg, ${v.cor} 0%, #4fd1c5 100%)`,
                                },
                              }}
                            />
                          </Box>
                        </HStack>
                      </Box>
                    );
                  })
                )}
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
                  const { meta, realizado } = dados[m];
                  const st = statusCasa(meta, realizado);
                  const isAtual = m === mesAtual;
                  return (
                    <Box
                      key={m}
                      bg="gray.800"
                      borderRadius="lg"
                      p="3"
                      border="1px solid"
                      borderColor={isAtual ? 'orange.200' : 'gray.700'}
                      boxShadow={isAtual ? '0 0 0 2px rgba(254,128,38,.25)' : 'none'}
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
                      <Text fontSize="lg" fontWeight="800" color="white" lineHeight="1.1">
                        {meta > 0 ? `${st.pct.toFixed(0)}%` : '—'}
                      </Text>
                      <Progress
                        mt="1"
                        mb="2"
                        size="xs"
                        borderRadius="full"
                        colorScheme={st.cor}
                        value={Math.min(st.pct, 100)}
                      />
                      <Text fontSize="10px" color="gray.400" noOfLines={1}>
                        {meta > 0 ? brl(realizado) : 'sem meta'}
                      </Text>
                      <Text fontSize="10px" color="gray.600" noOfLines={1}>
                        {meta > 0 ? `de ${brl(meta)}` : ''}
                      </Text>
                    </Box>
                  );
                })}
              </SimpleGrid>
            </Box>

            {/* ── Corrida das metas ── */}
            <Box bg="gray.900" borderRadius="xl" p="5">
              <HStack spacing="2" mb="3">
                <FiAward color="#fe8026" size={16} />
                <Text fontSize="sm" fontWeight="bold" color="gray.200" textTransform="uppercase" letterSpacing="wider">
                  Corrida das Metas — {MESES[mesAtual - 1]}/{ano}
                </Text>
              </HStack>
              <TabuleiroTrilha
                vendedores={progresso}
                onVendedorClick={(id) => history.push(`/cadastro/meta/${id}?ano=${ano}`)}
              />
              {progresso.length > 0 && (
                <HStack mt="4" spacing="4" flexWrap="wrap">
                  {progresso.map((v) => (
                    <HStack key={v.id} spacing="2">
                      <AvatarBoneco cor={v.cor} nome={v.nome} size={28} />
                      <Text fontSize="sm" color="gray.300">{v.nome}</Text>
                      <Badge colorScheme="gray" fontSize="xs">{Math.round((v.casas / 12) * 100)}%</Badge>
                    </HStack>
                  ))}
                </HStack>
              )}
            </Box>

            {totais.meta === 0 && (
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
