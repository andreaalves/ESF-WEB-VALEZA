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
  HStack,
  Spinner,
} from '@chakra-ui/react';
import { Header } from '../../components/Header';
import { useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { SubmitHandler } from 'react-hook-form';
import { useEffect } from 'react';
import api from '../../service/api';
import * as yup from 'yup';
import { useState } from 'react';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import { yupResolver } from '@hookform/resolvers/yup';
import { percentMask } from '../../helpers/percentMask';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';

type IParams = {
  id: string;
};

type IFormInputs = {
  nome: string;
  codigo: string;
  observacao: string;
  data_inicial: string;
  data_final: string;
  rentabilidade_tabela: number;
  produto_rentabilidade_alta: number;
  produto_rentabilidade_media: number;
  produto_rentabilidade_baixa: number;
  mkt: number;
  frete: number;
  imposto_padrao: number;
  comissao: number;
  desconto_padrao: number;
  aplicar_imposto: boolean;
  excluido: boolean;
  empresa: {
    id: string;
  };
};

export const CreateParamsTable = () => {
  const { user } = useAuth();

  const params = useParams<IParams>();
  const [systemParams, setSystemParams] = useState<any[]>([]);
  const [paramsTable, setParamsTable] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const schema = yup.object().shape({
    // nome: yup.string().required("Campo Obrigatório"),
    // descricao: yup.string().required("Campo Obrigatório"),
  });

  const { register, handleSubmit, formState, reset, control, setValue } =
    useForm<any>();
  //   {
  //   resolver: yupResolver(schema),
  //   defaultValues: useMemo(() => {
  //     return formValues;
  //   }, [formValues]),
  // }

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();

  useEffect(() => {
    setIsLoading(true);

    async function getSystemParams() {
      const response = await api.get(
        `/api-essencial/v1/parametrizacao/${user.empresa.id}`
      );
      // const response = await api.get(
      //   `/api-essencial/v1/tabela-precos/${params.id}`
      // );
      // console.log(response.data);
      setSystemParams(response.data);
      setIsLoading(false);
    }

    if (!params.id) return;

    async function getTableParams() {
      setIsLoading(true);
      const response = await api.get(
        `/api-essencial/v1/tabela-precos/${params.id}`
      );
      setParamsTable([response.data]);

      setValue(
        'rentabilidade_tabela',
        response.data.rentabilidade_tabela
          ? Number(response.data.rentabilidade_tabela).toFixed(2)
          : ''
      );

      setValue(
        'produto_rentabilidade_alta',
        response.data.produto_rentabilidade_alta
          ? Number(response.data.produto_rentabilidade_alta).toFixed(2)
          : ''
      );
      setValue(
        'produto_rentabilidade_media',
        response.data.produto_rentabilidade_media
          ? Number(response.data.produto_rentabilidade_media).toFixed(2)
          : ''
      );
      setValue(
        'produto_rentabilidade_baixa',
        response.data.produto_rentabilidade_media
          ? Number(response.data.produto_rentabilidade_baixa).toFixed(2)
          : ''
      );
      setValue(
        'mkt',
        response.data.mkt ? Number(response.data.mkt).toFixed(2) : ''
      );
      setValue(
        'frete',
        response.data.frete ? Number(response.data.frete).toFixed(2) : ''
      );
      setValue(
        'imposto_padrao',
        response.data.imposto_padrao
          ? Number(response.data.imposto_padrao).toFixed(2)
          : ''
      );
      setValue(
        'comissao',
        response.data.comissao ? Number(response.data.comissao).toFixed(2) : ''
      );
      setValue(
        'desconto_padrao',
        response.data.desconto_padrao
          ? Number(response.data.desconto_padrao).toFixed(2)
          : ''
      );
    }
    setIsLoading(false);

    getSystemParams();

    getTableParams();
  }, [params, user.empresa.id, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    if (params.id) {
      const newdata = {
        ...data,
        id: params.id,
        rentabilidade_tabela: Number(data?.rentabilidade_tabela),
        produto_rentabilidade_alta: Number(data.produto_rentabilidade_alta),
        produto_rentabilidade_media: Number(data.produto_rentabilidade_media),
        produto_rentabilidade_baixa: Number(data.produto_rentabilidade_baixa),
        mkt: Number(data.mkt),
        frete: Number(data.frete),
        imposto_padrao: Number(data.imposto_padrao),
        comissao: Number(data.comissao),
        desconto_padrao: Number(data.desconto_padrao),
        aplicar_imposto: !!data?.aplicar_imposto,
        empresa: { id: user.empresa.id },
      };

      // console.log(newdata);

      try {
        await api.put(
          `/api-essencial/v1/tabela-precos/${params.id}/parametros`,
          newdata
        );

        toast({
          title: 'Parametrização atualizada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        history.push('/listar/tabela-preco');
      } catch (error) {
        if (error) {
          return toast({
            title: 'Erro Inesperado',
            description: 'Tente cadastrar daqui alguns minutos',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }
      return;
    }
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        {isLoading ? (
          <Spinner />
        ) : (
          <Wapper>
            <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
              <Heading size="md" fontWeight="normal">
                {paramsTable.length === 0 ? (
                  <Text>PARAMETRIZAÇÃO TABELA</Text>
                ) : (
                  <Text>PARAMETRIZAÇÃO - {paramsTable[0].nome}</Text>
                )}
              </Heading>

              <Divider my="6" borderColor="gray.700" />

              {systemParams.length === 0 ? (
                <Text></Text>
              ) : (
                <>
                  <HStack spacing={6}>
                    <Text color={'gray.300'}>
                      Percentual Aprovação Pedido:{' '}
                      {systemParams[0].percentual_aprovacao_pedido
                        ? Number(
                            systemParams[0].percentual_aprovacao_pedido
                          ).toFixed(2)
                        : '0.00'}
                      %
                    </Text>
                    <Text color={'gray.300'}>
                      Produto Alta Rentabilidade:{' '}
                      {systemParams[0].produto_rentabilidade_alta
                        ? Number(
                            systemParams[0].produto_rentabilidade_alta
                          ).toFixed(2)
                        : '0.00'}
                      %
                    </Text>
                    <Text color={'gray.300'}>
                      Produto Média Rentabilidade:{' '}
                      {systemParams[0].produto_rentabilidade_media
                        ? Number(
                            systemParams[0].produto_rentabilidade_media
                          ).toFixed(2)
                        : '0.00'}
                      %
                    </Text>
                    <Text color={'gray.300'}>
                      Produto Baixa Rentabilidade:{' '}
                      {systemParams[0].produto_rentabilidade_baixa
                        ? Number(
                            systemParams[0].produto_rentabilidade_baixa
                          ).toFixed(2)
                        : '0.00'}
                      %
                    </Text>
                  </HStack>
                </>
              )}

              <Divider my="6" borderColor="gray.700" />

              <form onSubmit={handleSubmit(onSubmit)}>
                <VStack spacing="6">
                  <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                    <InputCustom
                      name="rentabilidade_tabela"
                      label="Margem de rentabilidade da Tabela (%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />
                  </SimpleGrid>

                  <Divider my="6" borderColor="gray.700" />

                  <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                    <InputCustom
                      name="produto_rentabilidade_alta"
                      label="Produto alta rentabilidade (%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <InputCustom
                      name="produto_rentabilidade_media"
                      label="Produto média rentabilidade (%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <InputCustom
                      name="produto_rentabilidade_baixa"
                      label="Produto baixa rentabilidade (%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />
                  </SimpleGrid>
                  <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                    <InputCustom
                      name="mkt"
                      label="Marketing(%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <InputCustom
                      name="frete"
                      label="Frete(%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <InputCustom
                      name="comissao"
                      label="Comissao(%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <InputCustom
                      name="desconto_padrao"
                      label="Desconto(%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <InputCustom
                      name="imposto_padrao"
                      label="Imposto(%)"
                      errors={errors}
                      control={control}
                      masks={percentMask}
                      minLength={3}
                    />

                    <SelectCustom
                      label="Aplicar imposto na tabela"
                      placeholder="Selecione a opção"
                      name="aplicar_imposto"
                      register={register}
                      errorMessage={errors.aplicar_imposto?.message}
                      options={[
                        { id: 'true', value: 'Aplicar imposto' },
                        { id: 'false', value: 'Não aplicar imposto' },
                      ]}
                      chave="value"
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
            </Box>
          </Wapper>
        )}
      </Flex>
    </>
  );
};
