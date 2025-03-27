/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import {
  Flex,
  Box,
  Heading,
  Button,
  VStack,
  SimpleGrid,
  Divider,
  ButtonGroup,
  useToast,
  Text,
  Spinner,
  useDisclosure,
} from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Header } from '../../components/Header';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { Wapper } from '../../components/Wapper';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import api from '../../service/api';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import ReactTableComponent from '../../components/TableComponent';
import { getColumn } from '../../utils/getTablePriceClientColumn';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

type IFormInputs = {
  tabelaPreco: {
    id: string;
  };
  cliente: {
    id: string;
  };
  excluido: boolean;
};

interface IParams {
  id: string;
}

export const CreateLinkClient: React.FC = () => {
  const [client, setClient] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  // const [isProductSelected, setIsProductSelected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editId, setEditId] = useState(0);
  const [idToDelete, setIdToDelete] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const column = getColumn(handleDelete, setEditId, editId);

  const { user } = useAuth();

  const params = useParams<IParams>();

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    console.log(id);
    try {
      await api.delete(`/api-essencial/v1/tabela-preco-cliente/${id}`, {});

      const response = await api.get(
        `/api-essencial/v1/tabela-preco-cliente/tabela/${params.id}`
      );

      setClientsList(response.data.data);

      toast({
        title: 'Cliente retirado da tabela com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // history.push("/vincular/tabela-preco");
    } catch (error) {
      if (clientsList.length === 1) {
        toast({
          title: 'Categoria deletada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setClientsList([]);
      }
    }
  };

  const schema = yup.object().shape({
    // imposto: yup.string().nullable().required("Campo Obrigatório"),
    // frete: yup.string().nullable().required("Campo Obrigatório"),
    // comissao: yup.string().nullable().required("Campo Obrigatório"),
    // lucro: yup.string().nullable().required("Campo Obrigatório"),
    // mkt: yup.string().nullable().required("Campo Obrigatório"),
    // produto: yup.object().shape({
    //   id: yup.string().nullable().required("Campo Obrigatório"),
    // }),
  });

  const { register, handleSubmit, formState, reset, setValue } = useForm({
    resolver: yupResolver(schema),
  });

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();

  useEffect(() => {
    const getData = async () => {
      try {
        const resp = await api.get(
          `/api-essencial/v1/clientes/${user.empresa.id}/empresa?excluido=false`
        );

        const dados = resp.data.data;

        setClient(dados);

        const respTabela = await api.get(
          `/api-essencial/v1/tabela-preco-cliente/tabela/${params.id}`
        );

        const dadosTabela = respTabela.data.data;

        setClientsList(dadosTabela);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    getData();
  }, [user.empresa.id, params.id]);

  useEffect(() => {
    if (editId === 0) {
      setValue('cliente.id', null);
    }

    // setIsEditLoading(true);

    api
      .get(`/api-essencial/v1/tabela-preco-cliente/${editId}`)
      .then((response) => {
        console.log(response.data);
        setValue('cliente', response.data.data.cliente);

        // setIsProductSelected(true);
      })
      .finally(() => {
        setIsEditLoading(false);
      });
  }, [editId]);

  const handleChange = (e: any) => {
    const clienteSelecionado = client.find(
      (client) => +e.target.value === client.id
    );
  };

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    try {
      Object.assign(data, {
        tabelaPreco: {
          id: params.id,
        },
        excluido: false,
      });

      if (editId > 0) {
        Object.assign(data, { id: editId });

        api
          .put(`/api-essencial/v1/tabela-preco-cliente/${editId}`, data)
          .then(async (response) => {
            setEditId(0);
            toast({
              title: 'Cadastro atualizado com sucesso',
              description: ``,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });

            const getAll = await api.get(
              `/api-essencial/v1/tabela-preco-cliente/tabela/${params.id}`
            );

            setClientsList(getAll.data.data);
          })
          .finally(() => {});
        return;
      }

      await api.post('/api-essencial/v1/tabela-preco-cliente', data);

      const getAll = await api.get(
        `/api-essencial/v1/tabela-preco-cliente/tabela/${params.id}`
      );

      setClientsList(getAll.data.data);

      toast({
        title: 'Cadastro Realizado com sucesso',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
    } catch (error: any) {
      const errorMessage = error.response.data.message;

      console.log(errorMessage);

      if (error) {
        return toast({
          title: 'Acesso Negado',
          description: `${errorMessage}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    } finally {
    }
  };

  useEffect(() => {
    console.log('ERRO:', errors);
  }, [errors]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6" position="relative">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8}>
            <Heading size="md" fontWeight="normal">
              VINCULAR CLIENTE
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            {isLoading ? (
              <Flex justifyContent="center">
                <Spinner color="white" />
              </Flex>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <VStack spacing="8">
                  <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                    <SelectCustom
                      label="Selecionar Cliente"
                      placeholder="Selecione a opção"
                      name="cliente.id"
                      errorMessage={errors.client?.id?.message}
                      register={register}
                      // control={control}
                      options={client}
                      chave="razaoSocial"
                      onChange={handleChange}
                    />
                  </SimpleGrid>

                  <Flex w="100%" justify="flex-end">
                    <ButtonGroup spacing="4">
                      <Button
                        fontSize="md"
                        variant="outline"
                        colorScheme="orange"
                        onClick={() => {
                          history.push('/listar/tabela-preco');
                        }}
                      >
                        VOLTAR
                      </Button>
                      <Button
                        fontSize="md"
                        colorScheme="orange"
                        type="submit"
                        isLoading={formState.isSubmitting}
                      >
                        SALVAR
                      </Button>
                    </ButtonGroup>
                  </Flex>
                </VStack>
              </form>
            )}
          </Box>
        </Wapper>
        {isEditLoading && (
          <Spinner
            color="orange.500"
            position="absolute"
            top="65%"
            left="50%"
          />
        )}
      </Flex>

      <Flex align="start" mx="auto" px="6">
        <Flex w="100%" mt="40px" align="flex-start" ml="65px">
          <Box
            flex="1"
            p="8"
            bg="gray.800"
            borderRadius={8}
            mb="16"
            overflowX="auto"
          >
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE CLIENTES VINCULADOS
              </Heading>
            </Flex>

            <Divider my="6" borderColor="gray.700" />

            <Flex justifyContent="center">
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <>
                  {clientsList.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem produtos para exibir</Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={clientsList}
                      isPagenable
                    />
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Flex>
      </Flex>
      <ExcludeDialog
        isOpen={isOpen}
        onClose={onClose}
        label="cliente desse tabela de preço"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
};
