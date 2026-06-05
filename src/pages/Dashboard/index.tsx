// import { useContext } from "react";
import {
  Flex,
  Box,
  Text,
  Heading,
  Button,
  VStack,
  SimpleGrid,
  Divider,
  FormControl,
  ButtonGroup,
  useToast,
  Grid,
  HStack,
  Badge,
} from "@chakra-ui/react";
import { Header } from "../../components/Header";
import { useHistory, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../../service/api";
import { currencyMask } from "../../helpers/currencyMask";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";
import { useAuth } from "../../context/AuthContext";
import { DateTime } from "luxon";

import Chart from "react-apexcharts";
import { InputCustom } from "../../components/InputCustom/InputCustom";
import { useForm } from "react-hook-form";

type DashboardInsights = {
  margemMedia: number;
  pedidosAnalise: number;
  ticketMedio: number;
  clientesRisco: number;
  pedidoIdeal: Array<{ codigo?: string; nome: string; quantidade: number }>;
  tracking: Array<{ data: string; texto: string }>;
};

function numero(v: any) {
  return Number(v ?? 0) || 0;
}

function dataPedido(pedido: any) {
  return pedido?.dataEmissao || pedido?.data_emissao || pedido?.created_at || pedido?.createdAt;
}

function valorPedido(pedido: any) {
  return numero(pedido?.valorPedido ?? pedido?.valor_pedido ?? pedido?.totalPedido ?? pedido?.valor_total);
}

function margemPedido(pedido: any) {
  return numero(pedido?.margemPedido ?? pedido?.margem_pedido ?? pedido?.margem);
}

function situacaoPedido(pedido: any) {
  return String(pedido?.situacao || pedido?.status || '').toUpperCase();
}

function itensPedido(pedido: any): any[] {
  return pedido?.itensPedido || pedido?.itens_pedido || pedido?.itens || [];
}

function montarInsightsLocal(orders: any[]): DashboardInsights {
  const agora = DateTime.now();
  const pedidos = Array.isArray(orders) ? orders : [];
  const pedidosMes = pedidos.filter((p) => {
    const d = DateTime.fromISO(String(dataPedido(p) || ''));
    return d.isValid && d.month === agora.month && d.year === agora.year;
  });
  const base = pedidosMes.length ? pedidosMes : pedidos;
  const total = base.reduce((sum, p) => sum + valorPedido(p), 0);
  const comMargem = base.filter((p) => margemPedido(p) > 0);
  const margemMedia = comMargem.length
    ? comMargem.reduce((sum, p) => sum + margemPedido(p), 0) / comMargem.length
    : 0;
  const pedidosAnalise = pedidos.filter((p) => ['EM_ANALISE', 'BLOQUEADO', 'PENDENTE_APROVACAO'].includes(situacaoPedido(p))).length;

  const porProduto = new Map<string, { codigo?: string; nome: string; quantidade: number }>();
  base.forEach((pedido) => {
    itensPedido(pedido).forEach((item: any) => {
      const produto = item?.produto || item?.produtos || item;
      const nome = produto?.nome || produto?.descricao || item?.nome_produto || 'Produto';
      const codigo = produto?.codigo || produto?.produto_id || item?.produto_id;
      const key = String(codigo || nome);
      const atual = porProduto.get(key) || { codigo: codigo ? String(codigo) : undefined, nome, quantidade: 0 };
      atual.quantidade += numero(item?.quantidade);
      porProduto.set(key, atual);
    });
  });

  const ultimo = [...pedidos].sort((a, b) => {
    const da = DateTime.fromISO(String(dataPedido(a) || '')).toMillis();
    const db = DateTime.fromISO(String(dataPedido(b) || '')).toMillis();
    return db - da;
  })[0];
  const dataUltimo = dataPedido(ultimo);
  const status = situacaoPedido(ultimo) || 'PENDENTE';

  return {
    margemMedia,
    pedidosAnalise,
    ticketMedio: base.length ? total / base.length : 0,
    clientesRisco: 0,
    pedidoIdeal: Array.from(porProduto.values()).sort((a, b) => b.quantidade - a.quantidade).slice(0, 4),
    tracking: ultimo ? [
      { data: dataUltimo ? DateTime.fromISO(String(dataUltimo)).toFormat('dd/MM/yyyy') : 'Hoje', texto: `Pedido ${status.toLowerCase().replace(/_/g, ' ')}` },
      { data: dataUltimo ? DateTime.fromISO(String(dataUltimo)).toFormat('dd/MM/yyyy') : 'Hoje', texto: `Pedido #${ultimo?.pedido_id || ultimo?.id || '-'} atualizado` },
    ] : [],
  };
}

export const Dashboard = () => {
  const {
    register,
    handleSubmit,
    formState,
    reset,
    control,
    setValue,
    getValues,
  } = useForm();
  const { errors } = formState;

  const toast = useToast();
  const history = useHistory();
  const { user } = useAuth();

  const [orders, setOrders] = useState<any[]>([]);
  const [orderFilter, setOrderFilter] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialDate, setInitialDate] = useState("");
  const [finalDate, setFinalDate] = useState("");
  const [remoteInsights, setRemoteInsights] = useState<DashboardInsights | null>(null);

  function handleInitialDate(e: any) {
    setInitialDate(e.target?.value);
  }

  function handleFinalDate(e: any) {
    setFinalDate(e.target?.value);
  }

  function handleReset() {
    setInitialDate("");
    setFinalDate("");
    // setOrderFilter([]);
    // setShowFilter(-1);
  }

  useEffect(() => {
    async function getPedidos() {
      try {
        const response = await api.get(
          `/api-essencial/v1/pedidos/${user.empresa.id}/empresa?excluido=false`
        );

        console.log(response.data.data);
        setOrders(response.data.data);
      } catch (error) {
        setIsLoading(false);
      }
    }
    getPedidos();
  }, [orders.length]);

  useEffect(() => {
    async function getInsights() {
      try {
        const response = await api.get(`/api-essencial/v1/insights/dashboard/${user.empresa.id}`);
        setRemoteInsights(response.data?.data ?? response.data);
      } catch {
        setRemoteInsights(null);
      }
    }
    getInsights();
  }, [user.empresa.id]);

  useEffect(() => {
    let dt = DateTime.now();

    const ordersOfDay = orders.filter(
      (o) =>
        dt.day == DateTime.fromISO(o.dataEmissao).day &&
        dt.month == DateTime.fromISO(o.dataEmissao).month &&
        dt.year == DateTime.fromISO(o.dataEmissao).year
    );

    setOrderFilter(ordersOfDay);
  }, []);

  // setOrderFilter(ordersOfDay);

  // console.log(ordersOfDay.length);

  // if (ordersOfDay.length > 0) {
  //   let totalofDay = ordersOfDay.reduce((acc, valor: any) => {
  //     return acc + Number(valor.valorPedido);
  //   }, 0);
  //   return totalofDay;
  // }

  const total = orders.reduce((acc, valor: any) => {
    return acc + Number(valor.valorPedido);
  }, 0);

  const insights = useMemo(() => remoteInsights || montarInsightsLocal(orders), [remoteInsights, orders]);

  // setOrderFilter(ordersOfDay);

  // let total = "";

  // if (ordersOfDay.length > 0) {
  //   total = orderFilter.reduce((acc, valor: any) => {
  //     return acc + Number(valor.valorPedido);
  //   }, 0);
  // } else {
  //   total = orders.reduce((acc, valor: any) => {
  //     return acc + Number(valor.valorPedido);
  //   }, 0);
  // }

  const series = [
    { name: "vendas", data: [10, 20, 40, 50, 50, 30, 60] },
    { name: "meta", data: [20, 15, 35, 60, 40, 30, 55] },
  ];

  const options = {
    chart: {
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      foreColor: "#fff",
    },

    dataLabels: {
      enabled: true,
    },
    grid: {
      show: false,
    },
    tooltip: {
      enabled: true,
      fillSeriesColor: false,
    },
    markers: {
      size: 1,
    },
    stroke: {
      width: [4, 2],
    },
    xaxis: {
      categories: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"],
    },
  };

  const seriesBar = [
    {
      name: "Vendas",
      data: [
        {
          x: "Vendedor 1",
          y: 20,
          goals: [
            {
              name: "Meta",
              value: 14,
              strokeWidth: 5,
              strokeHeight: 10,
              strokeColor: "#00E396",
            },
          ],
        },
        {
          x: "Vendedor 2",
          y: 12,
          goals: [
            {
              name: "Meta",
              value: 10,
              strokeWidth: 5,
              strokeHeight: 10,
              strokeColor: "#00E396",
            },
          ],
        },
        {
          x: "Vendedor 3",
          y: 33,
          goals: [
            {
              name: "Meta",
              value: 39,
              strokeWidth: 5,
              strokeHeight: 10,
              strokeColor: "#00E396",
            },
          ],
        },
      ],
    },
  ];

  const optionsBar = {
    chart: {
      toolbar: {
        show: false,
      },
      zoom: {
        enabled: false,
      },
      foreColor: "#fff",
    },
    tooltip: {
      enabled: true,
    },
    grid: {
      show: false,
    },
    plotOptions: {
      bar: {
        horizontal: true,
      },
    },
    dataLabels: {},
    legend: {
      show: true,
      showForSingleSeries: true,
      customLegendItems: ["Vendas", "Meta"],
    },
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Heading size="md" fontWeight="normal">
              DASHBOARD
            </Heading>

            <Divider my="6" borderColor="gray.700" />

            <Grid width="100%" templateColumns="repeat(5, 1fr)" gap={4}>
              <Box>
                <InputCustom
                  name="inicio"
                  label="Data Inicial"
                  errors={errors}
                  control={control}
                  value={initialDate}
                  onChange={handleInitialDate}
                  type="date"
                />
              </Box>
              <Box>
                <InputCustom
                  name="final"
                  label="Data Final"
                  errors={errors}
                  control={control}
                  value={finalDate}
                  onChange={handleFinalDate}
                  type="date"
                />
              </Box>

              <Flex mt={8} flexDir="row">
                <Button
                  onClick={() => {}}
                  colorScheme="orange"
                  _focus={{ boxShadow: "none" }}
                >
                  Pesquisar
                </Button>
                <Button
                  colorScheme="orange"
                  ml={4}
                  onClick={handleReset}
                  _focus={{ boxShadow: "none" }}
                >
                  Limpar
                </Button>
              </Flex>
              <Box mt={8}></Box>
            </Grid>

            <Divider my="6" borderColor="gray.700" />

            <VStack spacing="6">
              <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                <Box bg="gray.700" h="100px" borderRadius={8} p={3}>
                  <Text color="#fff" fontWeight="bold" fontSize="1.2rem">
                    FATURAMENTO
                  </Text>
                  <Text color="green.300" fontWeight="bold" fontSize="2rem">
                    R$ {currencyMask(total)}
                  </Text>
                </Box>
                <Box bg="gray.700" h="100px" borderRadius={8} p={3}>
                  <Text color="#fff" fontWeight="bold" fontSize="1.2rem">
                    MARGEM %
                  </Text>
                  <Text color="blue.400" fontWeight="bold" fontSize="2rem">
                    87,62
                  </Text>
                </Box>
                <Box bg="gray.700" h="100px" borderRadius={8} p={3}>
                  <Text color="#fff" fontWeight="bold" fontSize="1.2rem">
                    PREÇO MÉDIO
                  </Text>
                  <Text color="gray.300" fontWeight="bold" fontSize="2rem">
                    R$ 289.236,00
                  </Text>
                </Box>
                <Box bg="gray.700" h="100px" borderRadius={8} p={3}>
                  <Text color="#fff" fontWeight="bold" fontSize="1.2rem">
                    QUANT. DE PEDIDOS
                  </Text>
                  <Text color="gray.300" fontWeight="bold" fontSize="2rem">
                    {orders.length}
                  </Text>
                </Box>
              </SimpleGrid>

              <SimpleGrid minChildWidth="260px" spacing="6" w="100%">
                <Box bg="gray.700" borderRadius={8} p={5} borderTop="4px solid #fe8026">
                  <HStack justify="space-between" mb={3}>
                    <Text color="gray.100" fontWeight="bold">Margem Média</Text>
                    <Badge colorScheme={insights.margemMedia >= 60 ? 'green' : 'orange'}>{insights.margemMedia >= 60 ? 'saudável' : 'atenção'}</Badge>
                  </HStack>
                  <Text color="#fe8026" fontWeight="bold" fontSize="3xl">{insights.margemMedia.toFixed(2)}%</Text>
                  <Box mt={3} h="6px" bg="gray.800" borderRadius="full" overflow="hidden">
                    <Box h="100%" w={`${Math.min(Math.max(insights.margemMedia, 0), 100)}%`} bg="#fe8026" />
                  </Box>
                </Box>

                <Box bg="gray.700" borderRadius={8} p={5} borderTop="4px solid #18c7b6">
                  <Text color="gray.100" fontWeight="bold" mb={2}>Pedidos em Análise</Text>
                  <Text color="#18c7b6" fontWeight="bold" fontSize="3xl">{insights.pedidosAnalise}</Text>
                  <Text color="gray.300" fontSize="sm">Aguardando liberação ou revisão comercial.</Text>
                </Box>

                <Box bg="gray.700" borderRadius={8} p={5} borderTop="4px solid #f6c945">
                  <Text color="gray.100" fontWeight="bold" mb={2}>Ticket Médio</Text>
                  <Text color="#f6c945" fontWeight="bold" fontSize="3xl">R$ {currencyMask(String(insights.ticketMedio))}</Text>
                  <Text color="gray.300" fontSize="sm">Baseado nos pedidos do período carregado.</Text>
                </Box>

                <Box bg="gray.700" borderRadius={8} p={5} borderTop="4px solid #ef4444">
                  <Text color="gray.100" fontWeight="bold" mb={2}>Clientes em Risco</Text>
                  <Text color="#ef4444" fontWeight="bold" fontSize="3xl">{insights.clientesRisco}</Text>
                  <Text color="gray.300" fontSize="sm">Pronto para o backend calcular perda de vínculo.</Text>
                </Box>
              </SimpleGrid>

              <SimpleGrid minChildWidth="320px" spacing="6" w="100%">
                <Box bg="gray.700" borderRadius={8} p={5}>
                  <HStack justify="space-between" mb={4}>
                    <Text color="#fff" fontWeight="bold" fontSize="1.1rem">Pedido Ideal</Text>
                    <Badge colorScheme="orange">mix sugerido</Badge>
                  </HStack>
                  {insights.pedidoIdeal.length ? insights.pedidoIdeal.map((p, idx) => (
                    <HStack key={`${p.codigo || p.nome}-${idx}`} justify="space-between" py={2} borderTop={idx ? '1px solid rgba(255,255,255,0.08)' : '0'}>
                      <Text color="gray.100" fontWeight="semibold">{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</Text>
                      <Text color="gray.300">{p.quantidade} un.</Text>
                    </HStack>
                  )) : (
                    <Text color="gray.300">Sem itens suficientes para sugerir um mix. O backend pode enviar os produtos recomendados aqui.</Text>
                  )}
                </Box>

                <Box bg="gray.700" borderRadius={8} p={5}>
                  <HStack justify="space-between" mb={4}>
                    <Text color="#fff" fontWeight="bold" fontSize="1.1rem">Tracking Operacional</Text>
                    <Badge colorScheme="teal">último pedido</Badge>
                  </HStack>
                  {insights.tracking.length ? insights.tracking.map((t, idx) => (
                    <Box key={`${t.data}-${idx}`} pl={4} py={2} borderLeft="2px solid #fe8026">
                      <Text color="gray.400" fontSize="sm">{t.data}</Text>
                      <Text color="gray.100" fontWeight="semibold">{t.texto}</Text>
                    </Box>
                  )) : (
                    <Text color="gray.300">Quando houver pedidos, o histórico aparece aqui.</Text>
                  )}
                </Box>
              </SimpleGrid>

              <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                <Box bg="gray.700" borderRadius={8} p={3}>
                  <Text color="#fff" fontWeight="bold" fontSize="1.2rem">
                    VENDAS DO MÊS
                  </Text>
                  <Chart
                    type="line"
                    series={series}
                    options={options}
                    height={250}
                  />
                </Box>
                <Box bg="gray.700" borderRadius={8} p={3}>
                  <Text color="#fff" fontWeight="bold" fontSize="1.2rem">
                    META POR VENDEDOR
                  </Text>
                  <Chart
                    type="bar"
                    series={seriesBar}
                    options={optionsBar}
                    height={250}
                  />
                </Box>
              </SimpleGrid>
            </VStack>
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
