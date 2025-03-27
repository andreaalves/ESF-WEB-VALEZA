import {
  Box,
  Divider,
  Flex,
  Button,
  Icon,
  Heading,
  Spinner,
  Text,
  useDisclosure,
  useToast,
} from '@chakra-ui/react';
import { RiAddLine } from 'react-icons/ri';
import { MdUpdate } from 'react-icons/md';
import { useEffect } from 'react';
import { Header } from '../../components/Header';
import ReactTableComponent from '../../components/TableComponent';
import api from '../../service/api';
import { getColumn } from '../../utils/getProductColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';
import apiIntegrador from '../../service/apiIntegrador';

export default function ListProduct() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const column = getColumn(handleDelete, '/edit/produto');

  const { isOpen, onOpen, onClose } = useDisclosure();

  const toast = useToast();

  const { user } = useAuth();
  const history = useHistory();

  const updateProducts = async () => {
    setIsLoading(true);
    toast({
      title: 'Sincronização iniciada',
      description: 'Essa operação de levar alguns minutos',
      status: 'warning',
      duration: 3000,
      isClosable: true,
    });

    try {
      const responseCategorias = await apiIntegrador.get(
        '/get-categorias-from-erp'
      );

      if (responseCategorias.status === 200) {
        toast({
          title: 'Categorias atualizadas',
          description: `${responseCategorias.data?.message}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      if (error.response.data.message) {
        toast({
          title: 'Erro na atualização',
          description: `${error.response.data.message}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      setIsLoading(false);
    }

    try {
      setIsLoading(true);
      const responseProdutos = await apiIntegrador.get('/get-produto-from-erp');

      if (responseProdutos.status === 200) {
        toast({
          title: 'Produtos atualizados',
          description: `${responseProdutos.data?.message}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      if (error.response.data.message) {
        toast({
          title: 'Erro na atualização',
          description: `${error.response.data.message}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      setIsLoading(false);
    }

    try {
      setIsLoading(true);
      const responseTabelaPreco = await apiIntegrador.get(
        '/get-tabelas-preco-from-erp'
      );

      if (responseTabelaPreco.status === 200) {
        toast({
          title: 'Tabelas preço atualizadas',
          description: `${responseTabelaPreco.data?.message}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      if (error.response.data.message) {
        toast({
          title: 'Erro na atualização',
          description: `${error.response.data.message}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      setIsLoading(false);
    }

    try {
      setIsLoading(true);
      const responseColaboradores = await apiIntegrador.get(
        '/get-colaborador-from-erp'
      );

      if (responseColaboradores.status === 200) {
        toast({
          title: 'Colaboradores atualizadas',
          description: `${responseColaboradores.data?.message}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      if (error.response.data.message) {
        toast({
          title: 'Erro na atualização',
          description: `${error.response.data.message}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      setIsLoading(false);
    }

    try {
      setIsLoading(true);
      const responseClientes = await apiIntegrador.get('/get-cliente-from-erp');

      if (responseClientes.status === 200) {
        toast({
          title: 'Clientes atualizados',
          description: `${responseClientes.data?.message}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      if (error.response.data.message) {
        toast({
          title: 'Erro na atualização',
          description: `${error.response.data.message}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      setIsLoading(false);
    }
    try {
      setIsLoading(true);
      const responseItensTabelaPrecoProduto = await apiIntegrador.get(
        '/get-tabela-preco-produto-from-erp'
      );

      if (responseItensTabelaPrecoProduto.status === 200) {
        toast({
          title: 'Clientes atualizados',
          description: `${responseItensTabelaPrecoProduto.data?.message}`,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }
    } catch (error: any) {
      if (error.response.data.message) {
        toast({
          title: 'Erro na atualização',
          description: `${error.response.data.message}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      } else {
        toast({
          title: 'Erro na atualização',
          description: `Tente mais tarde`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
      setIsLoading(false);
    }
  };

  const x = async (e: any, id: string) => {
    try {
      await api.patch(`/api-essencial/v1/produtos/update-excluido/${id}`, {
        excluido: true,
      });

      const response = await api.get(
        // `/api-essencial/v1/produtos/${user.empresa.id}/empresa?excluido=false`
        `/api-essencial/v1/produtos`
      );

      setProducts(response.data);

      toast({
        title: 'Categoria deletada com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/categoria');
    } catch (error) {
      if (products.length === 1) {
        toast({
          title: 'Categoria deletada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setProducts([]);
      }
    }
  };

  useEffect(() => {
    const getData = async () => {
      try {
        const resp = await api.get(`/api-essencial/v1/produtos`);
        const dados = resp.data;

        setProducts(dados);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    getData();
  }, [user.empresa.id]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE PRODUTOS
              </Heading>
              <Button
                as="a"
                size="sm"
                fontSize="sm"
                disabled={isLoading}
                bg="green.500"
                color="white"
                _hover={{
                  bg: 'green.700',
                }}
                leftIcon={<Icon as={MdUpdate} />}
                cursor="pointer"
                onClick={updateProducts}
              >
                Sincronizar
              </Button>
              {/* <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/produto")}
              >
                Cadastrar
              </Button> */}
            </Flex>

            <Divider my="6" borderColor="gray.700" />

            <Flex justifyContent="center">
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <>
                  {products.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem produtos para exibir</Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={products}
                      isPagenable
                    />
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Wapper>
      </Flex>

      <ExcludeDialog
        isOpen={isOpen}
        onClose={onClose}
        label="categoria"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
