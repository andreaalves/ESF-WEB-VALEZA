import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  Divider as DividerBase,
  Select as SelectBase,
  Text as TextBase,
  HStack as HStackBase,
  SimpleGrid as SimpleGridBase,
  Badge as BadgeBase,
  Progress as ProgressBase,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import api from '../../service/api';
import { useHistory } from 'react-router-dom';
import { Tabuleiro3D, VendedorProgresso } from './Tabuleiro3D';

// Chakra v1 + TS strict estoura TS2590; cast para any contorna.
const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const Divider = DividerBase as any;
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
  const toast = useToast();
  const history = useHistory();

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedorId, setVendedorId] = useState('');
  const [ano, setAno] = useState(anoAtual);
  const [dados, setDados] = useState<Record<number, MesDado>>(dadosVazios());
  const [simulado, setSimulado] = useState(false);
  const [progresso, setProgresso] = useState<VendedorProgresso[]>([]);

  useEffect(() => {
    api
      .get('/api-essencial/v1/colaboradores')
      .then((res) =>
        setVendedores((res.data || []).map((c: any) => ({ id: c.colaborador_id, nome: c.nome })))
      )
      .catch(() => {});
  }, []);

  // Carrega meta (endpoint pendente) + realizado (pedidos) — dados reais.
  async function carregarReal() {
    setSimulado(false);

    // META por colaborador/mês: GET /metas/:empresa (pode não existir → ignora)
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

    // progresso (casas batidas) de cada vendedor p/ o tabuleiro
    setProgresso(
      vendedores.slice(0, 8).map((v, i) => {
        let casas = 0;
        for (let m = 1; m <= 12; m++) {
          const meta = metaMap[v.id]?.[m] || 0;
          const real = realMap[v.id]?.[m] || 0;
          if (meta > 0 && real >= meta) casas++;
        }
        return { id: v.id, nome: v.nome, casas, cor: PALETA[i % PALETA.length] };
      })
    );
  }

  useEffect(() => {
    if (!simulado) carregarReal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorId, ano]);

  // Preenche com dados de exemplo só pra visualizar o painel funcionando.
  function simular() {
    const novo = dadosVazios();
    for (let m = 1; m <= 12; m++) {
      const meta = 1_000_000;
      const fator = 0.4 + Math.random() * 0.8; // 40% a 120%
      novo[m] = { meta, realizado: Math.round(meta * fator) };
    }
    setDados(novo);

    // tokens dos vendedores no tabuleiro (nomes reais quando já carregados)
    const baseVend = vendedores.length
      ? vendedores
      : [
          { id: 'd1', nome: 'Mário Silva' },
          { id: 'd2', nome: 'Ana Souza' },
          { id: 'd3', nome: 'Carlos Lima' },
          { id: 'd4', nome: 'Joana Reis' },
          { id: 'd5', nome: 'Pedro Alves' },
        ];
    setProgresso(
      baseVend.slice(0, 8).map((v, i) => ({
        id: v.id,
        nome: v.nome,
        casas: Math.floor(Math.random() * 13),
        cor: PALETA[i % PALETA.length],
      }))
    );

    setSimulado(true);
    toast({
      title: 'Modo simulação',
      description: 'Dados de exemplo só para visualizar. Clique em "Dados reais" para limpar.',
      status: 'info',
      duration: 4000,
      isClosable: true,
    });
  }

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

  const chartSeries = [
    { name: 'Meta', data: MESES.map((_, i) => dados[i + 1].meta) },
    { name: 'Realizado', data: MESES.map((_, i) => dados[i + 1].realizado) },
  ];

  const chartOptions = {
    chart: { toolbar: { show: false }, zoom: { enabled: false }, foreColor: '#fff' },
    colors: ['#718096', '#fe8026'],
    grid: { show: false },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
    dataLabels: { enabled: false },
    legend: { show: true },
    xaxis: { categories: MESES },
    yaxis: {
      labels: {
        formatter: (v: number) =>
          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v),
      },
    },
    tooltip: { y: { formatter: (v: number) => brl(v) } },
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <HStack justify="space-between" flexWrap="wrap">
              <Heading size="md" fontWeight="normal">
                PAINEL DE METAS
              </Heading>
              <HStack spacing="3">
                <Button size="sm" colorScheme="orange" variant="outline" onClick={simular}>
                  Simular
                </Button>
                <Button size="sm" colorScheme="gray" variant="outline" onClick={carregarReal}>
                  Dados reais
                </Button>
              </HStack>
            </HStack>

            <Divider my="6" borderColor="gray.700" />

            {/* Filtros */}
            <HStack spacing="6" align="flex-end" flexWrap="wrap">
              <Box minW="280px" flex="1">
                <Text mb="2" color="gray.300">Vendedor</Text>
                <Select
                  placeholder="Todos os vendedores"
                  bgColor="gray.700" variant="filled" _hover={{ bgColor: 'gray.700' }}
                  value={vendedorId}
                  onChange={(e: any) => setVendedorId(e.target.value)}
                  isDisabled={simulado}
                >
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </Select>
              </Box>
              <Box w="160px">
                <Text mb="2" color="gray.300">Ano</Text>
                <Select
                  bgColor="gray.700" variant="filled" _hover={{ bgColor: 'gray.700' }}
                  value={ano} onChange={(e: any) => setAno(Number(e.target.value))}
                  isDisabled={simulado}
                >
                  {[anoAtual - 1, anoAtual, anoAtual + 1].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </Box>
            </HStack>

            {/* Resumo */}
            <HStack spacing="4" mt="6" flexWrap="wrap">
              <Badge colorScheme="gray" p="2" borderRadius="md">Meta ano: {brl(totais.meta)}</Badge>
              <Badge colorScheme="orange" p="2" borderRadius="md">Realizado: {brl(totais.realizado)}</Badge>
              <Badge colorScheme={totais.pct >= 100 ? 'green' : 'yellow'} p="2" borderRadius="md">
                {totais.pct.toFixed(1)}% do ano
              </Badge>
              <Badge colorScheme="green" p="2" borderRadius="md">Casas batidas: {totais.casasBatidas}/12</Badge>
            </HStack>

            <Divider my="6" borderColor="gray.700" />

            {/* Detalhe por mês */}
            <HStack spacing="3" align="center" mb="1">
              <Box w="4px" h="22px" bg="orange.400" borderRadius="full" />
              <Heading size="sm" color="orange.300" letterSpacing="wide" textTransform="uppercase">
                Detalhe por mês{vendedorId ? '' : ' — todos os vendedores'}
              </Heading>
            </HStack>
            <Box mb="4" px="3" py="2" bg="gray.700" borderRadius="md" borderLeft="3px solid" borderColor="orange.400">
              <Text fontSize="xs" color="gray.300" lineHeight="tall">
                Cada card mostra o valor realizado vs. a meta daquele mês.{' '}
                <Text as="span" color="green.300" fontWeight="bold">Verde</Text> = bateu a meta (≥ 100%) ·{' '}
                <Text as="span" color="yellow.300" fontWeight="bold">Amarelo</Text> = entre 70% e 99% ·{' '}
                <Text as="span" color="red.300" fontWeight="bold">Vermelho</Text> = abaixo de 70%.{' '}
                Meses com borda verde são os meses "batidos" — cada vendedor avança uma casa na corrida por mês batido.
              </Text>
            </Box>
            <SimpleGrid columns={[2, 3, 4, 6]} spacing="5">
              {MESES.map((nome, i) => {
                const m = i + 1;
                const { meta, realizado } = dados[m];
                const st = statusCasa(meta, realizado);
                return (
                  <Box
                    key={m}
                    bg="gray.900"
                    borderRadius="lg"
                    p="4"
                    borderTop="4px solid"
                    borderColor={`${st.cor}.400`}
                  >
                    <HStack justify="space-between">
                      <Text fontWeight="bold">{nome}</Text>
                      <Badge colorScheme={st.cor}>{meta > 0 ? `${st.pct.toFixed(0)}%` : '—'}</Badge>
                    </HStack>
                    <Progress
                      mt="2"
                      size="sm"
                      borderRadius="full"
                      colorScheme={st.cor}
                      value={Math.min(st.pct, 100)}
                    />
                    <Text mt="2" fontSize="xs" color="gray.400">
                      {meta > 0 ? brl(realizado) : 'sem meta'}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {meta > 0 ? `de ${brl(meta)}` : ''}
                    </Text>
                  </Box>
                );
              })}
            </SimpleGrid>

            <Divider my="6" borderColor="gray.700" />

            {/* Tabuleiro ilustrado — corrida das metas mês a mês */}
            <HStack spacing="3" align="center" mb="3">
              <Box w="4px" h="22px" bg="orange.400" borderRadius="full" />
              <Heading size="sm" color="orange.300" letterSpacing="wide" textTransform="uppercase">
                Corrida das metas — 12 casas do mês
              </Heading>
            </HStack>
            <Box bg="transparent" overflow="hidden" p="0">
              <Tabuleiro3D
                vendedores={progresso}
                onVendedorClick={(id) => history.push(`/cadastro/meta/${id}?ano=${ano}`)}
              />
            </Box>
            {progresso.length > 0 && (
              <HStack mt="3" spacing="5" flexWrap="wrap">
                {progresso.map((v) => (
                  <HStack key={v.id} spacing="2">
                    <Box w="12px" h="12px" borderRadius="full" bg={v.cor} />
                    <Text fontSize="sm">{v.nome}</Text>
                    <Badge colorScheme="gray">{v.casas}/12</Badge>
                  </HStack>
                ))}
              </HStack>
            )}

            <Divider my="6" borderColor="gray.700" />

            {/* Gráfico Meta x Realizado */}
            <Text mb="3" color="gray.300">Meta × Realizado (mês a mês)</Text>
            <Box bg="gray.900" borderRadius="lg" p="4">
              <ApexChart type="bar" height={320} series={chartSeries} options={chartOptions} />
            </Box>

            {!simulado && totais.meta === 0 && (
              <Text mt="4" fontSize="sm" color="orange.200">
                Ainda não há metas cadastradas/lidas (o endpoint de leitura entra quando o
                backend subir). Clique em "Simular" para ver o painel funcionando.
              </Text>
            )}
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
