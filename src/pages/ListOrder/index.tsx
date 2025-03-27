import {
  Box,
  Divider,
  Flex,
  Text,
  Heading,
  Spinner,
  Input,
  Grid,
  GridItem,
  Button,
  HStack,
  useToast,
} from '@chakra-ui/react';
import { DateTime } from 'luxon';
import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import ReactTableComponent from '../../components/TableComponent';
import api from '../../service/api';
import { getColumn } from '../../utils/getOrderColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import OrderInfoModal from '../../components/OrderInfoModal';
import { useAuth } from '../../context/AuthContext';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { useForm } from 'react-hook-form';

export default function ListOrder() {
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
  const [orders, setOrders] = useState<any[]>([]);
  const [showIndex, setShowIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [initialDate, setInitialDate] = useState('');
  const [finalDate, setFinalDate] = useState('');
  const [orderFilter, setOrderFilter] = useState<any[]>([]);
  const [showFilter, setShowFilter] = useState(-1);
  const [params, setParams] = useState<any[]>([]);

  const history = useHistory();
  const { user } = useAuth();

  const toast = useToast();

  useEffect(() => {
    async function getParams() {
      try {
        const response = await api.get(
          `/api-essencial/v1/parametrizacao/${user.empresa.id}`
        );

        setValue(
          'percentualAprovacaoPedido',
          response.data[0].percentual_aprovacao_pedido
        );
        setParams(response.data);
      } catch (error) {}
    }
    getParams();

    async function getPedidos() {
      try {
        const response = await api.get(
          `/api-essencial/v1/pedidos/${user.empresa.id}/empresa`
        );

        // const orderParams = response.data.data;
        // if (params[0].percentualAprovacaoPedido == undefined) return;
        // const orderParams = response.data.data.filter(
        //   (o: any) => o.margemPedido <= params[0].percentualAprovacaoPedido
        // );

        setOrders(response.data);
      } catch (error) {}

      setIsLoading(false);
    }
    getPedidos();
  }, [orders.length, user.empresa.id, setValue]);

  function showModal(index: number) {
    setShowIndex(index);
  }

  function handleInitialDate(e: any) {
    setInitialDate(e.target?.value);
  }

  function handleFinalDate(e: any) {
    setFinalDate(e.target?.value);
  }

  function handleReset() {
    setInitialDate('');
    setFinalDate('');
    setOrderFilter([]);
    setShowFilter(-1);
  }

  function handlePercentAprovaded() {
    // if (params[0].percentualAprovacaoPedido == undefined) return;
    // if (initialDate == "" || finalDate == "") {
    //   const orderFilter = orders.filter(
    //     (o: any) => o.margemPedido <= params[0].percentualAprovacaoPedido
    //   );
    // }
  }

  function handleSearch() {
    console.log(finalDate, initialDate);
    if (DateTime.fromISO(finalDate) < DateTime.fromISO(initialDate)) {
      return toast({
        title: 'DATAS INVÁLIDAS',
        description: 'A data inicial é maior que a data Final',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }

    // if (
    //   params[0].percentualAprovacaoPedido != "" &&
    //   initialDate === "" &&
    //   initialDate === ""
    // ) {
    //   const orderFilter = orders.filter(
    //     (o) => o.margemPedido <= params[0].percentualAprovacaoPedido
    //   );

    //   setOrderFilter(orderFilter);
    //   return;
    // }

    const orderFilter = orders.filter(
      (o) =>
        DateTime.fromISO(o.data_emissao).plus({ hours: 3 }) >=
          DateTime.fromISO(initialDate) &&
        DateTime.fromISO(o.data_emissao).plus({ hours: 3 }) <=
          DateTime.fromISO(finalDate)
      // || o.margemPedido <= params[0].percentualAprovacaoPedido
    );
    setOrderFilter(orderFilter);

    console.log('oderFilter', orderFilter);
    if (orderFilter.length >= 1) {
      setShowFilter(-1);
      return;
    }

    // if (orderFilter.length === 0) {
    //   return toast({
    //     title: "SEM PEDIDOS",
    //     description: "Não há pedidos nesse período",
    //     status: "error",
    //     duration: 3000,
    //     isClosable: true,
    //   });
    // }

    setShowFilter(0);
  }

  const column = getColumn(
    () => console.log('delted'),
    '/listar/pedido',
    showModal
  );

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE PEDIDOS
              </Heading>
            </Flex>

            <Divider my="6" borderColor="gray.700" />

            <Grid
              width="100%"
              templateColumns="repeat(5, 1fr)"
              gap={4}
              // minChildWidth="120px"
            >
              {/* <Box>
                <InputCustom
                  name="pedido"
                  label="Pedido"
                  errors={errors}
                  register={register}
                />
              </Box> */}
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
              <Box>
                <InputCustom
                  name="percentualAprovacaoPedido"
                  label="% Aprovação Pedido"
                  errors={errors}
                  register={register}
                  isDisabled
                  // value={percentual_aprovacao_pedido}
                  onChange={handlePercentAprovaded}
                />
              </Box>

              <Flex mt={8} flexDir="row">
                <Button
                  onClick={handleSearch}
                  colorScheme="orange"
                  _focus={{ boxShadow: 'none' }}
                >
                  Pesquisar
                </Button>
                <Button
                  colorScheme="orange"
                  ml={4}
                  onClick={handleReset}
                  _focus={{ boxShadow: 'none' }}
                >
                  Limpar
                </Button>
              </Flex>
              <Box mt={8}></Box>
            </Grid>

            <Divider my="6" borderColor="gray.700" />

            <Flex justifyContent="center">
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <>
                  {orders.length === 0 || showFilter === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem pedidos para exibir</Text>
                    </Flex>
                  ) : (
                    <>
                      <ReactTableComponent
                        columns={column}
                        data={orderFilter.length === 0 ? orders : orderFilter}
                        isPagenable
                      />

                      <OrderInfoModal
                        order={orders}
                        showIndex={showIndex}
                        setShowIndex={setShowIndex}
                      />
                    </>
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Wapper>
      </Flex>
    </>
  );
}
