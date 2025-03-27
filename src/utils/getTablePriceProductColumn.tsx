import { FiEdit2 } from 'react-icons/fi';
import {
  IconButton,
  Flex,
  HStack,
  Link as ChakraLink,
  Popover,
  PopoverTrigger,
  Button,
  PopoverContent,
  PopoverHeader,
  // PopoverArrow,
  Box,
  PopoverBody,
  PopoverCloseButton,
  // Text,
  useToast,
  SimpleGrid,
  Spinner,
} from '@chakra-ui/react';
import { InputCustom } from '../components/InputCustom/InputCustom';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import api from '../service/api';
import { useParams } from 'react-router-dom';
// import { percentMask } from '../helpers/percentMask';

interface IParams {
  id: string;
}

type IFormInputs = {
  preco_custo: number;
  preco_custo_operacional: number;
  preco_venda: number;
  imposto: number;
  frete: number;
  comissao: number;
  lucro: number;
  mkt: number;
  lucro_liquido: number;
  preco_tabela: number;
  desconto: number | null;
  codigo: string;
  // precoCustoFinal: number | null;
  tabelaPreco: {
    id: string;
    codigo_tabela_preco: string;
  };
};

const PopoverCustom = ({ row, productsList, setProductsList }: any) => {
  // console.log("Aqui", productsList);

  const [products, setProducts] = useState<any[]>([]);
  // const [productsList, setProductsList] = useState<any[]>([]);
  const [isProductSelected, setIsProductSelected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editId, setEditId] = useState('');
  const [isEditLoading, setIsEditLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState,
    reset,
    setValue,
    getValues,
    control,
  } = useForm();

  const { errors } = formState;

  const params = useParams<IParams>();

  const toast = useToast();

  // useEffect(() => {
  //   const getData = async () => {
  //     try {
  //       const pList = await api.get(
  //         `/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`
  //       );

  //       setProductsList(pList.data.data);
  //     } catch (error) {
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };
  //   getData();
  // }, []);

  useEffect(() => {
    if (editId === '') {
      // setValue('produtos.produto_id', null);
      setValue('preco_custo_operacional', null);
      // setValue('', null);
      setValue('imposto', null);
      setValue('frete', null);
      setValue('comissao', null);
      setValue('mkt', null);
      setValue('lucro', null);
      // setValue('lucroMin', null);
      setValue('desconto', null);
      setValue('preco_tabela', null);
      setValue('lucro_liquido', null);
      setValue('codigo', null);
      setValue('codigo_tabela_preco', null);
      // setValue('precoCustoFinal', null);

      setIsProductSelected(false);

      handleRecalculateTotal(null, '');
      return;
    }

    setIsEditLoading(true);

    api
      .get(`/api-essencial/v1/tabela-preco-produtos/${editId}`)
      .then((response) => {
        setValue('produto', response.data.produtos.nome);
        setValue('produto_id', response.data.produtos.produto_id);
        setValue(
          'preco_custo',
          Number(response.data.produtos.preco_custo)?.toFixed(2)
        );
        setValue(
          'preco_custo_operacional',
          Number(response.data.preco_custo)?.toFixed(2)
        );
        setValue(
          'imposto',
          response.data.imposto
            ? Number(response.data.imposto)?.toFixed(2)
            : Number(response.data.tabela_preco.imposto_padrao)?.toFixed(2)
        );
        setValue('frete', Number(response.data.tabela_preco.frete)?.toFixed(2));
        setValue(
          'comissao',
          Number(response.data.tabela_preco.comissao)?.toFixed(2)
        );
        setValue('mkt', Number(response.data.tabela_preco.mkt)?.toFixed(2));
        setValue('lucro', response.data.lucro);
        setValue('codigo', response.data.codigo);
        setValue('codigo_tabela_preco', response.data.codigo_tabela_preco);
        setValue('desconto', Number(response.data.desconto)?.toFixed(2));
        setValue(
          'preco_tabela',
          Number(response.data.preco_tabela)?.toFixed(2)
        );
        // setValue('lucroMin', response.data.lucroMin);
        // setValue('precoCustoFinal', response.data.preco_custo_final);
        // setValue(
        //   'lucroLiquido',
        //   Number(response.data.lucro_liquido)?.toFixed(2)
        // );
        // setValue("precoVenda", response.data.data.precoVenda);
        // setValue("precoVenda")

        setIsProductSelected(true);

        handleRecalculateTotal(null, '');
      })
      .finally(() => {
        setIsEditLoading(false);
      });
  }, [editId]);

  const handleChange = (e: any) => {
    // console.log('products' + products);
    const productFindById = products.find(
      (product) => +e.target.value === product.id
    );

    setValue(
      'preco_custo_operacional',
      productFindById?.preco_custo_operacional.toFixed(2)
    );
    // setValue("precoVenda", productFindById?.precoCusto.toFixed(2));
    handleRecalculateTotal(null, '');

    if (productFindById) setIsProductSelected(true);
    else {
      setIsProductSelected(false);
      reset();
    }
  };

  function handleRecalculateTotal(e: any, fieldName: string) {
    let preco_custo_operacional = getValues('preco_custo_operacional');
    let frete = getValues('frete');
    let imposto = getValues('imposto');
    let comissao = getValues('comissao');
    let mkt = getValues('mkt');
    let preco_tabela = getValues('preco_tabela');
    let desconto = getValues('desconto');

    if (fieldName === 'preco_custo_operacional')
      preco_custo_operacional = e.target.value;
    if (fieldName === 'frete') frete = e.target.value;
    if (fieldName === 'imposto') imposto = e.target.value;
    if (fieldName === 'comissao') comissao = e.target.value;
    if (fieldName === 'mkt') mkt = e.target.value;
    if (fieldName === 'preco_tabela') preco_tabela = e.target.value;
    if (fieldName === 'desconto') desconto = e.target.value;

    let precoFinalcomDesconto = preco_tabela - preco_tabela * (desconto / 100);

    setValue('preco_venda', Number(precoFinalcomDesconto)?.toFixed(2));

    let somaPercentual =
      Number(frete) / 100 +
      Number(imposto) / 100 +
      Number(comissao) / 100 +
      Number(mkt) / 100;

    let lucroLiquidoCalculado =
      precoFinalcomDesconto -
      (precoFinalcomDesconto * (somaPercentual || 0) +
        Number(preco_custo_operacional));

    setValue('lucro_liquido', Number(lucroLiquidoCalculado)?.toFixed(2));

    let lucroCalculado = (
      (lucroLiquidoCalculado / precoFinalcomDesconto) *
      100
    ).toFixed(2);
    setValue('lucro', lucroCalculado);

    let custoCalculado =
      precoFinalcomDesconto * somaPercentual + Number(preco_custo_operacional);
    setValue('precoCustoFinal', custoCalculado);

    // console.log("l liquido", lucroLiquidoCalculado);
    // console.log("p custo", precoCustoInserido);
    // console.log("soma perc", somaPercentual);
    // console.log("desconto ", descontoPadrao);
    // console.log("preco Tabela ", precoTabela);

    //console.log(total);

    // setValue("precoVenda", total.toFixed(2));
  }

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    // data.comissao = Number(data.comissao);
    // data.frete = Number(data.frete);
    // data.imposto = Number(data.imposto);
    // data.lucro = Number(data.lucro);
    // data.mkt = Number(data.mkt);
    // data.preco_custo = Number(data.preco_custo_operacional);
    // data.preco_custo_operacional = Number(data.preco_custo_operacional);
    // data.preco_venda = Number(data.preco_venda);
    // data.lucro_liquido = Number(data.lucro_liquido);
    // data.precoTabela = Number(data.precoTabela);
    // data.desconto = Number(data.desconto);
    // data.precoCustoFinal = Number(data.precoCustoFinal);

    try {
      if (editId) {
        const newData = {
          imposto: Number(data.imposto),
          lucro: Number(data.lucro),
          preco_custo: Number(data.preco_custo_operacional),
          preco_custo_operacional: Number(data.preco_custo_operacional),
          preco_venda: Number(data.preco_venda),
          lucro_liquido: Number(data.lucro_liquido),
          desconto: Number(data.desconto),
        };

        await api.put(
          `/api-essencial/v1/tabela-preco-produtos/${editId}`,
          newData
        );

        setEditId('');

        const pList = await api.get(
          `/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`
        );

        await toast({
          title: 'Preços atualizados com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });

        setProductsList(pList.data);
      }

      // await api.post("/api-essencial/v1/tabela-preco-produtos", data);

      // const getAll = await api.get(
      //   `/api-essencial/v1/tabela-preco-produtos/tabela/${params.id}`
      // );

      // setProductsList(getAll.data.data);

      // toast({
      //   title: "Cadastro Realizado com sucesso",
      //   status: "success",
      //   duration: 3000,
      //   isClosable: true,
      // });
      // reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message;

      // console.log(errorMessage);

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

  return (
    <Popover placement="top-end">
      <PopoverTrigger>
        <IconButton
          size="sm"
          aria-label="Editar"
          colorScheme="blue"
          bg={'blue.500'}
          _hover={{
            bg: 'blue.700',
          }}
          icon={<FiEdit2 size={18} color="#eeeef2" />}
          onClick={() => {
            // if (editId === Number(row.id)) {
            //   setEditId(0);

            //   return;
            // }

            setEditId(row.tabela_preco_produto_id);
          }}
        />
      </PopoverTrigger>

      <PopoverContent bg="gray.900" maxW="110rem" w="100%">
        <PopoverHeader fontWeight="semibold">Compor Preço</PopoverHeader>
        {/* <PopoverArrow /> */}
        <PopoverCloseButton />
        <PopoverBody w="100%">
          {isLoading ? (
            <form onSubmit={handleSubmit(onSubmit)}>
              <SimpleGrid spacing="2">
                <HStack>
                  <Box w="30%">
                    <InputCustom
                      name="produto"
                      label="Produto"
                      isDisabled
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={handleChange}
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="preco_custo"
                      label="C.Prot.(R$)"
                      isDisabled
                      errors={errors}
                      register={register}
                      size="sm"
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="preco_custo_operacional"
                      label="C.Com.(R$)"
                      isDisabled
                      type="number"
                      step=".0001"
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={(e) =>
                        handleRecalculateTotal(e, 'preco_custo_operacional')
                      }
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="imposto"
                      label="Imposto(%)"
                      type="number"
                      step=".001"
                      errors={errors}
                      register={register}
                      minLength={3}
                      size="sm"
                      onChange={(e) => handleRecalculateTotal(e, 'imposto')}
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="frete"
                      label="Frete(%)"
                      isDisabled
                      type="number"
                      step=".001"
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={(e) => handleRecalculateTotal(e, 'frete')}
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="comissao"
                      label="Comissão(%)"
                      isDisabled
                      type="number"
                      step=".001"
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={(e) => handleRecalculateTotal(e, 'comissao')}
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="mkt"
                      label="Mkt(%)"
                      isDisabled
                      type="number"
                      step=".001"
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={(e) => handleRecalculateTotal(e, 'mkt')}
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="lucro"
                      label="Lucro(%)"
                      type="number"
                      step=".001"
                      isDisabled
                      errors={errors}
                      register={register}
                      size="sm"
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="preco_tabela"
                      label="P.Tabela(R$)"
                      isDisabled
                      type="number"
                      step=".001"
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={(e) =>
                        handleRecalculateTotal(e, 'preco_tabela')
                      }
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="desconto"
                      label="D.Padrão(%)"
                      type="number"
                      step=".001"
                      errors={errors}
                      register={register}
                      size="sm"
                      onChange={(e) => handleRecalculateTotal(e, 'desconto')}
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="preco_venda"
                      label="Pç Venda(R$)"
                      isDisabled
                      errors={errors}
                      register={register}
                      size="sm"
                    />
                  </Box>
                  <Box>
                    <InputCustom
                      name="lucro_liquido"
                      label="L.Líquido(R$)"
                      isDisabled
                      errors={errors}
                      register={register}
                      size="sm"
                    />
                  </Box>
                  <Box alignSelf="flex-end">
                    <Button
                      fontSize="sm"
                      size="sm"
                      colorScheme="orange"
                      type="submit"
                      isLoading={formState.isSubmitting}
                    >
                      SALVAR
                    </Button>
                  </Box>
                </HStack>
              </SimpleGrid>
            </form>
          ) : (
            <Flex justifyContent="center">
              <Spinner color="white" />
            </Flex>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
};

export function getColumn(
  deleteFunction: (e: any, id: string) => void,
  setEditId: React.Dispatch<React.SetStateAction<string>>,
  editId: string,
  productsList: any,
  setProductsList: any
) {
  const columns = [
    {
      Header: 'Código',
      accessor: 'produtos.codigo',
    },
    {
      Header: 'Produto',
      accessor: 'produtos.nome',
    },
    {
      Header: 'C.Prt',
      accessor: 'produtos.preco_custo',
      Cell: ({ row }: any) => (
        <span>
          R${' '}
          {Number(row.original?.produtos?.preco_custo)
            ? Number(row.original.produtos.preco_custo)?.toFixed(2)
            : ''}
        </span>
      ),
    },
    {
      Header: 'C.Com',
      accessor: 'preco_custo',
      Cell: ({ row }: any) => (
        <span>R$ {Number(row.original.preco_custo)?.toFixed(2)}</span>
      ),
    },
    {
      Header: 'Imposto',
      accessor: 'imposto',
      Cell: ({ row }: any) =>
        row.original.imposto ? (
          <span>{Number(row.original.imposto)?.toFixed(2)}%</span>
        ) : (
          <span>
            {Number(row.original.tabela_preco.imposto_padrao)?.toFixed(2)}%
          </span>
        ),
    },
    {
      Header: 'Frete',
      accessor: 'frete',
      Cell: ({ row }: any) => (
        <span>{Number(row.original.tabela_preco.frete)?.toFixed(2)}%</span>
      ),
    },
    {
      Header: 'Comissão',
      accessor: 'comissao',
      Cell: ({ row }: any) => (
        <span>{Number(row.original.tabela_preco.comissao)?.toFixed(2)}%</span>
      ),
    },
    {
      Header: 'Mkt',
      accessor: 'mkt',
      Cell: ({ row }: any) => (
        <span>{Number(row.original.tabela_preco.mkt)?.toFixed(2)}%</span>
      ),
    },
    {
      Header: 'Lucro',
      accessor: 'lucro',
      Cell: ({ row }: any) => (
        <span>{Number(row.original.lucro)?.toFixed(2)}%</span>
      ),
    },
    {
      Header: 'Pç Tabela',
      accessor: 'preco_tabela',
      Cell: ({ row }: any) => (
        <span>R$ {Number(row.original.preco_tabela)?.toFixed(2)}</span>
      ),
    },
    {
      Header: 'Desc Padrão',
      accessor: 'desconto',
      Cell: ({ row }: any) => (
        <span>{Number(row.original.desconto)?.toFixed(2)}%</span>
      ),
    },
    {
      Header: 'Pç Venda',
      accessor: 'preco_venda',
      Cell: ({ row }: any) => (
        <span>R$ {Number(row.original.preco_venda)?.toFixed(2)}</span>
      ),
    },
    {
      Header: 'Lc Líquido',
      accessor: 'lucro_liquido',
      Cell: ({ row }: any) => (
        <span>R$ {Number(row.original.lucro_liquido)?.toFixed(2)}</span>
      ),
    },
    {
      Header: ' ',
      Cell: ({ row }: any) => (
        <>
          <Flex as="main" alignItems="center">
            <HStack spacing={2}>
              <ChakraLink
              // onClick={() => {
              //   if (editId === Number(row.original.id)) {
              //     setEditId(0);

              //     return;
              //   }

              //   setEditId(Number(row.original.id));
              // }}
              >
                {/* <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="blue"
                bg={
                  editId === Number(row.original.id) ? "orange.500" : "blue.500"
                }
                _hover={{
                  bg:
                    editId === Number(row.original.id)
                      ? "orange.600"
                      : "blue.700",
                }}
                icon={<FiEdit2 size={18} color="#eeeef2" />}
              /> */}
              </ChakraLink>
              <PopoverCustom
                row={row.original}
                productsList={productsList}
                setProductsList={setProductsList}
              />
              {/* <ChakraLink
              onClick={(e) => {
                e.preventDefault();
                deleteFunction(e, row.original.id);
              }}
              href="/"
            >
              <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="red"
                bg="red.500"
                _hover={{
                  bg: "red.700",
                }}
                icon={<FiXSquare size={18} color="#eeeef2" />}
              />
            </ChakraLink> */}
            </HStack>
          </Flex>
        </>
      ),
      disableSortBy: true,
      disableFilters: true,
    },
  ];

  return columns;
}
