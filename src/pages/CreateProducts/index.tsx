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
} from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Header } from '../../components/Header';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { numberMask } from '../../helpers/numberMask';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { weightMask } from '../../helpers/weightMask';
import { currencyMask } from '../../helpers/currencyMask';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import api from '../../service/api';

// import AuthContext from "../../Context/AuthContext";

type IParams = {
  id: string;
};

type IFormInputs = {
  // nome: string;
  // marca: string;
  // codigo: string;
  // categorias: {
  //   categorias_id: string;
  // };
  // fornecedor: {
  //   id: string;
  // };
  // ncm: string;
  // codigoBarra: string;
  // codigoErp: string;
  // fabricante: string;
  // unidade: string;
  // embalagem: string;
  // qtdEmbalagem: string;
  // peso: string;
  // referencia: string;
  // validade: Date;
  // precoCusto: string;
  precoVenda: string;
  // ipi: string;
  // estoque: string;
  // estoqueMinimo: string;
  // comissao: string;
  // observacao: string;
  // excluido: boolean;
};

export const CreateProducts: React.FC = () => {
  const schema = yup.object().shape({
    // nome: yup.string().required('Campo Obrigatório'),
    // marca: yup.string().required('Campo Obrigatório'),
    // codigo: yup.string().required('Campo Obrigatório'),

    // categoria: yup.object().shape({
    //   id: yup.string().required('Campo Obrigatório'),
    // }),

    // fornecedor: yup.object().shape({
    //   id: yup.string().required('Campo Obrigatório'),
    // }),

    // ncm: yup.string().required('Campo Obrigatório'),
    // codigoBarra: yup.string().required('Campo Obrigatório'),
    // codigoErp: yup.string().required("Campo Obrigatório"),
    // fabricante: yup.string().required('Campo Obrigatório'),
    // unidade: yup.string().required('Campo Obrigatório'),
    // embalagem: yup.string().required('Campo Obrigatório'),
    // qtdEmbalagem: yup.string().required('Campo Obrigatório'),
    // peso: yup.string().required('Campo Obrigatório'),
    // referencia: yup.string().required('Campo Obrigatório'),
    // validade: yup.string().required('Campo Obrigatório'),
    // precoCusto: yup.string().required('Campo Obrigatório'),
    precoVenda: yup.string().required('Campo Obrigatório'),
    // ipi: yup.string().required('Campo Obrigatório'),
    // estoque: yup.string().required('Campo Obrigatório'),
    // estoqueMinimo: yup.string().required('Campo Obrigatório'),
    // comissao: yup.string().required('Campo Obrigatório'),
    // observacao: yup.string().required('Campo Obrigatório'),
  });

  const { register, handleSubmit, formState, reset, control, setValue } =
    useForm({
      resolver: yupResolver(schema),
    });

  const [categoria, setCategoria] = useState([]);
  // const [fornecedor, setFornecedor] = useState([]);

  const params = useParams<IParams>();

  useEffect(() => {
    api
      .get(`/api-essencial/v1/categorias`)
      .then((response) => {
        const categorias = response.data.map((cat: any) => {
          return {
            id: cat.categoria_id,
            cod_categoria: cat.cod_categoria,
            nome: cat.nome,
            descricao: cat.descricao,
            excluido: cat.excluido,
          };
        });
        setCategoria(categorias);
      })
      .catch((error: any) => {
        toast({
          title: 'Não foi possível carregar as categorias',
          description: ``,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      });
  }, []);

  useEffect(() => {
    if (!params.id || !categoria) return;
    api.get(`/api-essencial/v1/produtos/${params.id}`).then((response) => {
      const newcategoria = {
        id: response.data.categorias.categoria_id,
        cod_categoria: response.data.categorias.cod_categoria,
        descricao: response.data.categorias.descricao,
        excluido: response.data.categorias.excluido,
        nome: response.data.categorias.nome,
      };
      setValue('nome', response.data.nome);
      setValue('marca', response.data.marca);
      setValue('codigo', response.data.codigo);
      setValue('categoria', newcategoria);
      setValue('ncm', response.data.ncm);
      setValue('codigoBarra', response.data.codigo_barras);
      setValue('fabricante', response.data.fabricante);
      setValue('unidade', response.data.unidade);
      setValue('embalagem', response.data.embalagem);
      setValue('qtdEmbalagem', response.data.qtd_embalagem);
      setValue('peso', response.data.peso);
      setValue('referencia', response.data.referencia);
      setValue('validade', response.data.validade);
      setValue('precoCusto', Number(response.data.preco_custo).toFixed(2));
      setValue(
        'precoVenda',
        Number(response.data.preco_custo_final).toFixed(2)
      );
      setValue('ipi', response.data.ipi);
      setValue('estoque', response.data.estoque);
      setValue('estoqueMinimo', response.data.estoque_minimo);
      setValue('comissao', response.data.comissao);
      setValue('observacao', response.data.observacao);
    });
  }, [categoria, params, setValue]);

  const { errors } = formState;
  useEffect(() => {
    console.log(errors);
  }, [errors]);
  const toast = useToast();
  const history = useHistory();

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    try {
      if (params.id) {
        const newData = {
          preco_custo_final: currencyMask(data.precoVenda),
        };

        console.log(newData);
        api
          .patch(`/api-essencial/v1/produtos/${params.id}`, newData)
          .then((response) => {
            toast({
              title: 'Cadastro atualizado com sucesso',
              description: ``,
              status: 'success',
              duration: 3000,
              isClosable: true,
            });
            reset();
            history.push('/listar/produto');
          });
        return;
      }

      // await api.get('/api-essencial/v1/produtos');
      // toast({
      //   title: 'Cadastro Realizado com sucesso',
      //   description: ``,
      //   status: 'success',
      //   duration: 3000,
      //   isClosable: true,
      // });
    } catch (error) {
      // const errorMessage = error.response.data.message;

      if (error) {
        return toast({
          title: 'Acesso Negado',
          description: `${error}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
    // finally {
    //   reset();
    // }
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />
      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Heading size="md" fontWeight="normal">
              CADASTRO DE PRODUTOS
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="8">
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="nome"
                    label="Nome do Produto"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  {/* <InputCustom
                    name="marca"
                    label="Marca"
                    errors={errors}
                    register={register}
                  /> */}
                  <InputCustom
                    name="codigo"
                    label="Código do Produto"
                    isDisabled
                    errors={errors}
                    register={register}
                  />

                  <SelectCustom
                    label="Categoria"
                    placeholder="Selecione a opção"
                    isDisabled
                    name="categoria.id"
                    errorMessage={errors.categoria?.id?.message}
                    register={register}
                    options={categoria}
                    chave="nome"
                  />
                </SimpleGrid>

                {/* <SimpleGrid minChildWidth="240px" spacing="8" w="100%"> */}
                {/* <SelectCustom
                    label="Fornecedor"
                    placeholder="Selecione a opção"
                    name="fornecedor.id"
                    errorMessage={errors.fornecedor?.id?.message}
                    register={register}
                    options={fornecedor}
                    chave="razaoSocial"
                  /> */}
                {/* </SimpleGrid> */}
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="ncm"
                    label="NCM"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="codigoBarra"
                    label="Código de Barras"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  {/* <InputCustom
                    name="codigoErp"
                    label="Código do ERP"
                    errors={errors}
                    register={register}
                  /> */}
                </SimpleGrid>

                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="fabricante"
                    label="Fabricante"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="unidade"
                    label="Unidade"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="embalagem"
                    label="Embalagem"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="qtdEmbalagem"
                    label="Quantidade Embalagem"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={numberMask}
                  />
                </SimpleGrid>

                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="peso"
                    label="Peso"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={weightMask}
                  />
                  <InputCustom
                    name="referencia"
                    label="Referência"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="validade"
                    label="Validade"
                    isDisabled
                    type="date"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>

                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="precoCusto"
                    label="Preço de Custo"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={currencyMask}
                  />
                  <InputCustom
                    name="precoVenda"
                    label="Preço de Custo Comercial"
                    errors={errors}
                    control={control}
                    masks={currencyMask}
                  />
                  <InputCustom
                    name="ipi"
                    label="IPI"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>

                {/* <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="estoque"
                    label="Estoque"
                    errors={errors}
                    control={control}
                    masks={numberMask}
                  />
                  <InputCustom
                    name="estoqueMinimo"
                    label="Estoque Mínimo"
                    errors={errors}
                    control={control}
                    masks={numberMask}
                  />
                  <InputCustom
                    name="comissao"
                    label="Comissão"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                  />
                </SimpleGrid> */}

                {/* <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="observacao"
                    label="Observações"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid> */}

                <Flex w="100%" justify="flex-end">
                  <ButtonGroup spacing="4">
                    <Button
                      fontSize="md"
                      variant="outline"
                      colorScheme="orange"
                      onClick={() => {
                        history.push('/listar/produto');
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
          </Box>
        </Wapper>
      </Flex>
    </>
  );
};
