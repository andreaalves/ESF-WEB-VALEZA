import {
  Box,
  Divider,
  Flex,
  Text,
  Heading,
  Spinner,
  Button,
  Icon,
  VStack,
  HStack,
  useToast,
  useDisclosure,
} from '@chakra-ui/react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import { SubmitHandler, useForm } from 'react-hook-form';
import ReactTableComponent from '../../components/TableComponent';
import api from '../../service/api';
import { getItensOrderColumn } from '../../utils/getOrderItensColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { currencyMask } from '../../helpers/currencyMask';
import {
  AiOutlineArrowLeft,
  AiOutlineCheck,
  AiOutlineClose,
} from 'react-icons/ai';

import { useAuth } from '../../context/AuthContext';
import { ExcludeDialogOrder } from '../../components/ExcludeDialogOrder';
import { parseErroIntegracao } from '../../utils/parseErroIntegracao';
import { podeAprovarPedido } from '../../utils/podeAprovarPedido';

export default function ListItensOrder() {
  type IParams = {
    id: string;
  };

  type IFormInputs = {
    situacao: string;
  };

  const { register, handleSubmit, formState, reset, control, setValue } =
    useForm();

  const { errors, isSubmitting } = formState;

  const [orders, setOrders] = useState<any[]>([]);
  const [dados, setDados] = useState<any>();
  const [showIndex, setShowIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');

  const { isOpen, onOpen, onClose } = useDisclosure();

  const history = useHistory();
  const params = useParams<IParams>();
  const { user } = useAuth();
  const toast = useToast();

  const blockOrder = async (e: any, id: string) => {
    try {
      await api.patch(`/api-essencial/v1/pedidos/block-orders/${id}`);

      toast({
        title: 'Pedido bloqueado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/pedido');
    } catch (error) {
      // if (orders.length === 1) {
      //   toast({
      //     title: "Pedido bloqueado com sucesso",
      //     description: ``,
      //     status: "success",
      //     duration: 3000,
      //     isClosable: true,
      //   });
      //   setOrders([]);
      // }
    }
  };

  useEffect(() => {
    api
      .get(`/api-essencial/v1/pedidos/${params.id}`)
      .then((response) => {
        setDados(response.data);
        setOrders(response.data.item_pedido);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, [orders.length, params.id]);

  const columnItensOrder = getItensOrderColumn(
    () => {},
    '/edit'
  );

  const erroIntegracao =
    String(dados?.situacao || '').toUpperCase() === 'ERRO_INTEGRACAO'
      ? parseErroIntegracao(dados?.payload_recebido)
      : null;

  // Tenta achar o nome do produto apontado pelo Protheus entre os itens do pedido
  const produtoErroNome: string | null =
    (erroIntegracao?.produto &&
      dados?.item_pedido?.find(
        (ip: any) => ip?.produtos?.codigo === erroIntegracao.produto
      )?.produtos?.nome) ||
    null;

  const total = orders.reduce((acc, valor: any) => {
    return acc + valor.quantidade * valor.preco_liquido;
  }, 0);

  const approvedOrder = async () => {
    try {
      await api.patch(`/api-essencial/v1/pedidos/update-status/${params.id}`);
      toast({
        title: 'Pedido Aprovado',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/pedido');
    } catch (error) {}
  };

  function handleDelete(id: any) {
    onOpen();
  }

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {};

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                ITENS DO PEDIDOS
              </Heading>
              {podeAprovarPedido(user?.role) &&
              !isLoading &&
              orders.length !== 0 &&
              dados.situacao === 'EM_ANALISE' ? (
                <HStack>
                  <Button
                    as="a"
                    size="sm"
                    fontSize="sm"
                    variant="outline"
                    colorScheme="orange"
                    leftIcon={<Icon as={AiOutlineArrowLeft} />}
                    cursor="pointer"
                    onClick={() => history.push('/listar/pedido')}
                  >
                    VOLTAR
                  </Button>
                  <form onSubmit={handleSubmit(onSubmit)}>
                    <Button
                      as="a"
                      size="sm"
                      fontSize="sm"
                      // variant="outline"
                      colorScheme="green"
                      leftIcon={<Icon as={AiOutlineCheck} />}
                      cursor="pointer"
                      onClick={approvedOrder}
                    >
                      APROVAR
                    </Button>
                  </form>

                  <Button
                    as="a"
                    size="sm"
                    fontSize="sm"
                    // variant="outline"
                    colorScheme="red"
                    leftIcon={<Icon as={AiOutlineClose} />}
                    cursor="pointer"
                    onClick={handleDelete}
                  >
                    NÃO APROVAR
                  </Button>
                </HStack>
              ) : (
                <Button
                  as="a"
                  size="sm"
                  fontSize="sm"
                  variant="outline"
                  colorScheme="orange"
                  leftIcon={<Icon as={AiOutlineArrowLeft} />}
                  cursor="pointer"
                  onClick={() => history.push('/listar/pedido')}
                >
                  VOLTAR
                </Button>
              )}
            </Flex>

            <Divider my="6" borderColor="gray.700" />

            {!isLoading && erroIntegracao && (
              <VStack
                alignItems="stretch"
                spacing={2}
                mb={6}
                p={4}
                border="1px solid"
                borderColor="red.500"
                borderRadius="md"
                bg="gray.900"
              >
                <Text fontSize="14px" fontWeight="bold" color="red.300">
                  ⚠ MOTIVO DO ERRO DE INTEGRAÇÃO (TOTVS)
                </Text>
                <Text fontSize="14px" color="gray.100">
                  {erroIntegracao.motivo}
                </Text>
                {erroIntegracao.produto && (
                  <Text fontSize="14px" color="gray.100">
                    <Text as="span" fontWeight="bold" textColor="gray.200">
                      PRODUTO APONTADO:{' '}
                    </Text>
                    {erroIntegracao.produto}
                    {produtoErroNome ? ` - ${produtoErroNome}` : ''}
                  </Text>
                )}
                <Box
                  as="pre"
                  maxH="160px"
                  overflowY="auto"
                  p={2}
                  fontSize="11px"
                  whiteSpace="pre-wrap"
                  color="gray.400"
                  bg="gray.800"
                  borderRadius="md"
                >
                  {erroIntegracao.texto}
                </Box>
              </VStack>
            )}

            <Flex alignItems="center" justifyContent="center">
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <>
                  {orders.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem pedidos para exibir</Text>
                    </Flex>
                  ) : (
                    <Flex flexDirection="column" width="100%">
                      <Flex justifyContent="space-between">
                        <VStack alignItems="start">
                          <Text>FORMA DE PAGAMENTO:</Text>
                          <Text fontWeight="bold">{dados.forma_pagamento}</Text>
                        </VStack>
                        <VStack alignItems="start">
                          <Text>CONDIÇÃO DE PAGAMENTO:</Text>
                          <Text fontWeight="bold">
                            {dados.condicao_pagamento}
                          </Text>
                        </VStack>
                        <VStack alignItems="start">
                          <Text>MARGEM:</Text>
                          <Text fontWeight="bold">
                            {currencyMask(
                              (dados.margem_pedido * 100).toFixed(2).toString()
                            )}{' '}
                            %
                          </Text>
                        </VStack>
                        <VStack alignItems="start">
                          <Text>VALOR DO FRETE:</Text>
                          <Text fontWeight="bold">
                            R${' '}
                            {currencyMask(
                              Number(dados.valor_frete).toFixed(2).toString()
                            )}
                          </Text>
                        </VStack>
                        <VStack alignItems="start">
                          <Text>VALOR DO TOTAL:</Text>
                          <Text fontWeight="bold">
                            R$ {currencyMask(total.toFixed(2))}
                          </Text>
                        </VStack>
                      </Flex>
                      <Divider my="6" borderColor="gray.700" />
                      <ReactTableComponent
                        columns={columnItensOrder}
                        data={orders}
                        isPagenable
                      />{' '}
                      *
                    </Flex>
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Wapper>
      </Flex>

      <ExcludeDialogOrder
        isOpen={isOpen}
        onClose={onClose}
        label="pedido"
        deleteFunction={(e) => {
          blockOrder(e, params.id);
          onClose();
        }}
      />
    </>
  );
}
