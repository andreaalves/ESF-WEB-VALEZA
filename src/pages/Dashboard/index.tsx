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
} from "@chakra-ui/react";
import { Header } from "../../components/Header";
import { useHistory, useParams } from "react-router-dom";
import { useEffect } from "react";
import api from "../../service/api";
import { useState } from "react";
import { currencyMask } from "../../helpers/currencyMask";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";
import { useAuth } from "../../context/AuthContext";
import { DateTime } from "luxon";

import Chart from "react-apexcharts";
import { InputCustom } from "../../components/InputCustom/InputCustom";
import { useForm } from "react-hook-form";

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
