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
  SimpleGrid,
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
import {
  AiOutlineArrowLeft,
  AiOutlineCheck,
  AiOutlineClose,
} from 'react-icons/ai';

import { useAuth } from '../../context/AuthContext';
import { aprovarPedido, nomeDoAprovador } from '../../service/aprovacaoPedido';
import { ExcludeDialogOrder } from '../../components/ExcludeDialogOrder';
import { parseErroIntegracao } from '../../utils/parseErroIntegracao';
import { podeAprovarPedido } from '../../utils/podeAprovarPedido';

const formatarMoeda = (valor: any) =>
  Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

// 10 dígitos = fixo (61)3552-3048; 11 dígitos = celular (61)99999-9999.
const formatarTelefone = (valor?: string) => {
  const d = String(valor || '').replace(/\D/g, '');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  return valor;
};

function Secao({ titulo, children }: { titulo: string; children: any }) {
  return (
    <Box
      mb={6}
      p={5}
      border="1px solid"
      borderColor="gray.700"
      borderRadius="md"
    >
      <Text
        mb={4}
        fontSize="xs"
        fontWeight="bold"
        letterSpacing="wider"
        textTransform="uppercase"
        color="orange.400"
      >
        {titulo}
      </Text>
      <SimpleGrid
        columns={{ base: 1, md: 2, lg: 4 }}
        spacingX={8}
        spacingY={5}
      >
        {children}
      </SimpleGrid>
    </Box>
  );
}

function Campo({
  label,
  children,
  largo,
  destaque,
}: {
  label: string;
  children: any;
  largo?: boolean;
  destaque?: boolean;
}) {
  const vazio =
    children === null ||
    children === undefined ||
    children === '' ||
    (Array.isArray(children) && children.every((c) => !c));
  return (
    <Box gridColumn={largo ? { base: 'auto', md: 'span 2' } : undefined}>
      <Text
        fontSize="xs"
        textTransform="uppercase"
        letterSpacing="wide"
        color="gray.400"
        mb={1}
      >
        {label}
      </Text>
      <Text
        fontWeight="bold"
        fontSize={destaque ? 'lg' : 'md'}
        color={destaque ? 'green.400' : undefined}
        wordBreak="break-word"
      >
        {vazio ? '-' : children}
      </Text>
    </Box>
  );
}

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
  const [cliente, setCliente] = useState<any>();
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

  // O pedido só traz o cliente_id; os dados do cabeçalho vêm do cadastro.
  useEffect(() => {
    if (!dados?.cliente_id) return;
    api
      .get(`/api-essencial/v1/clientes/${dados.cliente_id}`)
      .then((response) => setCliente(response.data))
      .catch(() => {});
  }, [dados?.cliente_id]);

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

  const aprovadoPor = nomeDoAprovador(dados);

  const approvedOrder = async () => {
    try {
      await aprovarPedido(params.id, user?.name);
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
                      {cliente && (
                        <Secao titulo="Dados do cliente">
                          <Campo label="Cliente" largo>
                            {[cliente.codigo, cliente.loja]
                              .filter(Boolean)
                              .join('/')}
                            {cliente.razao_social
                              ? ` - ${cliente.razao_social}`
                              : ''}
                          </Campo>
                          <Campo label="Fantasia">{cliente.fantasia}</Campo>
                          <Campo label="CNPJ">{cliente.cnpj}</Campo>
                          <Campo label="Cidade / UF">
                            {cliente.endereco?.cidade
                              ? `${cliente.endereco.cidade} / ${cliente.endereco.uf}`
                              : null}
                          </Campo>
                          <Campo label="Telefone">
                            {formatarTelefone(cliente.telefone)}
                          </Campo>
                          <Campo label="Vendedor">
                            {cliente.colaboradores?.nome}
                          </Campo>
                        </Secao>
                      )}
                      <Secao titulo="Dados do pedido">
                        <Campo label="Forma de pagamento">
                          {dados.forma_pagamento}
                        </Campo>
                        <Campo label="Condição de pagamento">
                          {dados.condicao_pagamento}
                        </Campo>
                        <Campo label="Margem">
                          {/* Sem currencyMask: ela remove o sinal e margem
                              negativa aparecia como positiva. */}
                          {(Number(dados.margem_pedido) * 100).toLocaleString(
                            'pt-BR',
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}{' '}
                          %
                        </Campo>
                        <Campo label="Aprovado por">{aprovadoPor}</Campo>
                        <Campo label="Valor do frete">
                          {formatarMoeda(dados.valor_frete)}
                        </Campo>
                        <Campo label="Valor total" destaque>
                          {formatarMoeda(total)}
                        </Campo>
                      </Secao>
                      <ReactTableComponent
                        columns={columnItensOrder}
                        data={orders}
                        isPagenable
                      />
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
