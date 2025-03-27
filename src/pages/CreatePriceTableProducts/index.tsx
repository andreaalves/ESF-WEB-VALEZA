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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Grid,
  GridItem,
  HStack,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
  PopoverArrow,
  PopoverCloseButton,
} from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Header } from '../../components/Header';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { Wapper } from '../../components/Wapper';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import api from '../../service/api';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import ReactTableComponent from '../../components/TableComponent';
import { getColumn } from '../../utils/getTablePriceProductColumn';
import { useAuth } from '../../context/AuthContext';

// import AuthContext from "../../Context/AuthContext";

// interface Products {
//   id?: string;
//   nome: string;
//   marca: string;
//   codigo: string;
//   categoria: {
//     id: string;
//   };
//   fornecedor: {
//     id: string;
//   };
//   ncm: string;
//   codigoBarra: string;
//   // codigoErp: string;
//   fabricante: string;
//   unidade: string;
//   embalagem: string;
//   qtdEmbalagem: string;
//   peso: string;
//   referencia: string;
//   validade: Date;
//   precoCusto: string;
//   precoVenda: string;
//   ipi: string;
//   estoque: string;
//   estoqueMinimo: string;
//   comissao: string;
//   observacao: string;
//   excluido: boolean;
// }

type IFormInputs = {
  precoCusto: number;
  precoVenda: number;
  imposto: number;
  frete: number;
  comissao: number;
  lucro: number;
  mkt: number;
  lucroLiquido: number;
  tabelaPreco: {
    id: string;
  };
  produto: {
    id: string;
  };
};

interface IParams {
  id: string;
}

export const CreatePriceTableProducts: React.FC = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<any[]>([]);
  const [isProductSelected, setIsProductSelected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [editId, setEditId] = useState('');
  const [parametrizacao, setParametrizacao] = useState<any[]>([]);

  const column = getColumn(
    () => {},
    setEditId,
    editId,
    productsList,
    setProductsList
  );

  const { user } = useAuth();

  const params = useParams<IParams>();

  const { isOpen, onOpen, onClose } = useDisclosure();

  // const [productChoice, setProductChoice] = useState({});

  const schema = yup.object().shape({
    imposto: yup.string().nullable().required('Campo Obrigatório'),
    frete: yup.string().nullable().required('Campo Obrigatório'),
    comissao: yup.string().nullable().required('Campo Obrigatório'),
    lucro: yup.string().nullable().required('Campo Obrigatório'),
    mkt: yup.string().nullable().required('Campo Obrigatório'),
    produto: yup.object().shape({
      id: yup.string().nullable().required('Campo Obrigatório'),
    }),
  });

  const { register, handleSubmit, formState, reset, setValue, getValues } =
    useForm({
      resolver: yupResolver(schema),
    });

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();

  // const defaultFrete = watch("imposto");

  // console.log(defaultFrete);
  // console.log(pv);

  useEffect(() => {
    const getData = async () => {
      // try {
      //   const resp = await api.get(
      //     `/api-essencial/v1/produtos/${user.empresa.id}/empresateste?excluido=false`
      //   );
      //   await setProducts(resp.data.data);
      // } catch (error) {
      // } finally {
      //   setIsLoading(false);
      // }

      // try {
      //   const response = await api.get(
      //     `/api-essencial/v1/parametrizacao/${user.empresa.id}/empresa?excluido=false`
      //   );

      //   console.log(response.data.data);
      // } catch (error) {}

      try {
        const pList = await api.get(
          `/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`
        );

        // console.log('plist', pList);

        setProductsList(pList.data);
        setIsLoading(false);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };
    getData();
  }, [editId]);

  // useEffect(() => {
  //   api
  //     .get(`/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`)
  //     .then((response) => {
  //       setProductsList(response.data.data);
  //     })
  //     .finally(() => {
  //       setIsLoading(false);
  //     });
  // }, [params.id]);

  // useEffect(() => {
  //   if (editId === 0) {
  //     setValue("produto.id", null);
  //     setValue("precoCusto", null);
  //     setValue("imposto", null);
  //     setValue("frete", null);
  //     setValue("comissao", null);
  //     setValue("mkt", null);
  //     setValue("lucro", null);
  //     setValue("lucroMin", null);

  //     setIsProductSelected(false);

  //     handleRecalculateTotal(null, "");
  //     return;
  //   }

  //   setIsEditLoading(true);

  //   api
  //     .get(`/api-essencial/v1/tabela-preco-produtos/${editId}`)
  //     .then((response) => {
  //       setValue("produto", response.data.data.produto);
  //       setValue("precoCusto", response.data.data.precoCusto);
  //       setValue("imposto", response.data.data.imposto);
  //       setValue("frete", response.data.data.frete);
  //       setValue("comissao", response.data.data.comissao);
  //       setValue("mkt", response.data.data.mkt);
  //       setValue("lucro", response.data.data.lucro);
  //       setValue("lucroMin", response.data.data.lucroMin);

  //       setIsProductSelected(true);

  //       handleRecalculateTotal(null, "");
  //     })
  //     .finally(() => {
  //       setIsEditLoading(false);
  //     });
  // }, [editId]);

  // const handleChange = (e: any) => {
  //   const productP = products.find((product) => +e.target.value === product.id);

  //   setValue("precoCusto", productP?.precoCusto.toFixed(2));
  //   setValue("precoVenda", productP?.precoCusto.toFixed(2));
  //   handleRecalculateTotal(null, "");

  //   if (productP) setIsProductSelected(true);
  //   else {
  //     setIsProductSelected(false);
  //     reset();
  //   }
  // };

  // function handleRecalculateTotal(e: any, fieldName: string) {
  //   let precoCusto = getValues("precoCusto");

  //   let frete = getValues("frete");
  //   let imposto = getValues("imposto");
  //   let comissao = getValues("comissao");
  //   let mkt = getValues("mkt");
  //   let lucro = getValues("lucro");

  //   if (fieldName === "frete") frete = e.target.value;
  //   if (fieldName === "imposto") imposto = e.target.value;
  //   if (fieldName === "comissao") comissao = e.target.value;
  //   if (fieldName === "mkt") mkt = e.target.value;
  //   if (fieldName === "lucro") lucro = e.target.value;

  //   if (!precoCusto) {
  //     setValue("precoVenda", 0);
  //     return;
  //   }

  //   let parcial =
  //     (Number(frete) +
  //       Number(imposto) +
  //       Number(comissao) +
  //       Number(mkt) +
  //       Number(lucro)) /
  //     100;

  //   parcial = parcial + 1;

  //   const total = precoCusto * parcial;

  //   console.log(total);

  //   setValue("precoVenda", total.toFixed(2));
  // }

  // const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
  //   data.comissao = Number(data.comissao);
  //   data.frete = Number(data.frete);
  //   data.imposto = Number(data.imposto);
  //   data.lucro = Number(data.lucro);
  //   data.mkt = Number(data.mkt);
  //   data.precoCusto = Number(data.precoCusto);
  //   data.precoVenda = Number(data.precoVenda);

  //   try {
  //     Object.assign(data, {
  //       tabelaPreco: {
  //         id: params.id,
  //       },
  //     });

  //     if (editId > 0) {
  //       Object.assign(data, { id: editId });

  //       api
  //         .put(`/api-essencial/v1/tabela-preco-produtos/${editId}`, data)
  //         .then(async (response) => {
  //           setEditId(0);
  //           toast({
  //             title: "Cadastro atualizado com sucesso",
  //             description: ``,
  //             status: "success",
  //             duration: 3000,
  //             isClosable: true,
  //           });

  //           const getAll = await api.get(
  //             `/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`
  //           );

  //           setProductsList(getAll.data.data);
  //         })
  //         .finally(() => {});
  //       return;
  //     }

  //     await api.post("/api-essencial/v1/tabela-preco-produtos", data);

  //     const getAll = await api.get(
  //       `/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`
  //     );

  //     setProductsList(getAll.data.data);

  //     toast({
  //       title: "Cadastro Realizado com sucesso",
  //       status: "success",
  //       duration: 3000,
  //       isClosable: true,
  //     });
  //     reset();
  //   } catch (error: any) {
  //     const errorMessage = error.response.data.message;

  //     console.log(errorMessage);

  //     if (error) {
  //       return toast({
  //         title: "Acesso Negado",
  //         description: `${errorMessage}`,
  //         status: "error",
  //         duration: 3000,
  //         isClosable: true,
  //       });
  //     }
  //   } finally {
  //   }
  // };

  // useEffect(() => {
  //   console.log("ERRO:", errors);
  // }, [errors]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      {/* <Flex align="start" mx="auto" mt="8" px="6" position="relative"> */}
      {/* <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8}>
            <Heading size="md" fontWeight="normal">
              CADASTRO TABELA DE PREÇOS
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
                      label="Nome do Produto"
                      placeholder="Selecione a opção"
                      name="produto.id"
                      errorMessage={errors.produto?.id?.message}
                      register={register}
                      options={products}
                      chave="nome"
                      onChange={handleChange}
                    />

                    <InputCustom
                      name="precoCusto"
                      label="Preço de Custo"
                      isReadOnly
                      errors={errors}
                      register={register}
                    />

                    <InputCustom
                      name="imposto"
                      label="Imposto"
                      isReadOnly={!isProductSelected}
                      errors={errors}
                      type="number"
                      step=".001"
                      register={register}
                      onChange={(e) => handleRecalculateTotal(e, "imposto")}
                    />

                    <InputCustom
                      name="frete"
                      label="Frete (%)"
                      isReadOnly={!isProductSelected}
                      errors={errors}
                      type="number"
                      step=".001"
                      register={register}
                      onChange={(e) => handleRecalculateTotal(e, "frete")}
                    />
                  </SimpleGrid>
                  <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                    <InputCustom
                      name="comissao"
                      label="Comissão (%)"
                      isReadOnly={!isProductSelected}
                      errors={errors}
                      type="number"
                      step=".001"
                      register={register}
                      onChange={(e) => handleRecalculateTotal(e, "comissao")}
                    />

                    <InputCustom
                      name="mkt"
                      label="Mkt (%)"
                      isReadOnly={!isProductSelected}
                      errors={errors}
                      type="number"
                      step=".001"
                      register={register}
                      onChange={(e) => handleRecalculateTotal(e, "mkt")}
                    />

                    <InputCustom
                      name="lucro"
                      label="Lucro (%)"
                      isReadOnly={!isProductSelected}
                      errors={errors}
                      type="number"
                      step=".001"
                      register={register}
                      onChange={(e) => handleRecalculateTotal(e, "lucro")}
                    />

                    <InputCustom
                      name="precoMinimo"
                      label="Lucro Mínimo (%)"
                      isReadOnly={!isProductSelected}
                      errors={errors}
                      register={register}
                    />

                    <InputCustom
                      name="precoVenda"
                      label="Preço Final"
                      isReadOnly={true}
                      errors={errors}
                      register={register}
                    />
                  </SimpleGrid>

                  <Flex w="100%" justify="flex-end">
                    <ButtonGroup spacing="4">
                      <Button
                        fontSize="md"
                        variant="outline"
                        colorScheme="orange"
                        onClick={() => {
                          history.push("/listar/tabela-preco");
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
        </Wapper> */}
      {/* {isEditLoading && ( */}
      {/* <Spinner
            color="orange.500"
            position="absolute"
            top="65%"
            left="50%"
          />
        )}
      </Flex> */}

      <Flex
        // align="start"
        mx="auto"
        px="6"
        mt="145px"
        align="flex-start"
        ml="65px"
        // overflowX="auto"
      >
        {/* <Flex w="100%" mt="40px" align="flex-start" ml="65px"> */}
        <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
          <Flex justify="space-between" align="center">
            <Heading size="md" fontWeight="normal">
              {productsList.length === 0 ? (
                <Text>LISTA DE PRODUTOS</Text>
              ) : (
                <Text>
                  LISTA DE PRODUTOS - TABELA {productsList[0].tabela_preco.nome}{' '}
                  - COD - {productsList[0].tabela_preco.codigo}
                </Text>
              )}
            </Heading>

            <Button
              ml={4}
              fontSize="sm"
              variant="outline"
              colorScheme="orange"
              onClick={() => {
                history.push('/listar/tabela-preco');
              }}
            >
              VOLTAR
            </Button>
          </Flex>

          <Divider my="6" borderColor="gray.700" />

          <Flex justifyContent="center">
            {isLoading ? (
              <Spinner color="white" />
            ) : (
              <>
                {productsList.length === 0 ? (
                  <Flex>
                    <Text color="orange.200">Sem produtos para exibir</Text>
                  </Flex>
                ) : (
                  <ReactTableComponent
                    columns={column}
                    data={productsList}
                    isPagenable
                  />
                )}
              </>
            )}
          </Flex>
        </Box>
        {/* </Flex> */}

        <Flex>
          <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent bg="gray.800">
              <ModalHeader>Parametrização</ModalHeader>
              <ModalCloseButton />
              <ModalBody>
                <Text>dfgsdf</Text>
              </ModalBody>

              <ModalFooter>
                <Button colorScheme="orange" mr={3} onClick={onClose}>
                  Salvar
                </Button>
                <Button variant="outline" colorScheme="orange">
                  Cancelar
                </Button>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </Flex>
      </Flex>
    </>
  );
};
