// import { useContext } from "react";
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
import { Header } from '../../components/Header';
import { useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { SubmitHandler } from 'react-hook-form';
import { useEffect } from 'react';
import api from '../../service/api';
// import * as yup from 'yup';
// import { useState } from 'react';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import { percentMask } from '../../helpers/percentMask';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';

type IParams = {
  id: string;
};

type IFormInputs = {
  excluido: string;
  margemRentabilidade: string;
  valorDesconto: string;
  valorPercentualTabelaPreco: string;
  percentualAprovacaoPedido: string;
  produtoRentabilidadeAlta: string;
  produtoRentabilidadeMedia: string;
  produtoRentabilidadeBaixa: string;
  integracaoPorEmpresa?: boolean | null;
  empresa: {
    id: string;
  };
};

export const CreateParams = () => {
  const { user } = useAuth();

  const params = useParams<IParams>();
  // const [formValues, setFormValues] = useState({});

  // const schema = yup.object().shape({
  // nome: yup.string().required("Campo Obrigatório"),
  // descricao: yup.string().required("Campo Obrigatório"),
  // });

  const { register, handleSubmit, formState, control, setValue } =
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
    if (!params.id) return;

    api
      .get(`/api-essencial/v1/parametrizacao/${params.id}`)
      .then((response) => {
        const dados = response.data[0];

        setValue(
          'margemRentabilidade',
          (Number(dados?.margem_rentabilidade) * 100).toFixed(2)
        );
        setValue('valorDesconto', (dados?.valor_desconto * 100).toFixed(2));
        setValue(
          'valorPercentualTabelaPreco',
          (dados?.valor_percentual_tabela_preco * 100).toFixed(2)
        );
        setValue(
          'percentualAprovacaoPedido',
          Number(dados?.percentual_aprovacao_pedido).toFixed(2)
        );
        setValue(
          'produtoRentabilidadeAlta',
          Number(dados?.produto_rentabilidade_alta).toFixed(2)
        );
        setValue(
          'produtoRentabilidadeMedia',
          Number(dados?.produto_rentabilidade_media).toFixed(2)
        );
        setValue(
          'produtoRentabilidadeBaixa',
          Number(dados?.produto_rentabilidade_baixa)?.toFixed(2)
        );
        setValue('integracaoPorEmpresa', dados?.integracao_por_empresa);
      });
  }, [params, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    // Object.assign(data, {
    const dados = {
      empresa: { id: `${user.empresa.id}` },
      margem_rentabilidade: Number(data?.margemRentabilidade),
      valor_desconto: Number(data?.valorDesconto),
      valor_percentual_tabela_preco: Number(data?.valorPercentualTabelaPreco),
      percentual_aprovacao_pedido: Number(data?.percentualAprovacaoPedido),
      produto_rentabilidade_alta: Number(data?.produtoRentabilidadeAlta),
      produto_rentabilidade_media: Number(data?.produtoRentabilidadeMedia),
      produto_rentabilidade_baixa: Number(data?.produtoRentabilidadeBaixa),
      integracao_por_empresa: data?.integracaoPorEmpresa,
      // excluido: false,
      // });
    };

    console.log('Parametrizacao', dados);

    if (params.id) {
      // Object.assign(data, { id: params.id });

      try {
        await api.post(`/api-essencial/v1/parametrizacao/${params.id}`, dados);
        toast({
          title: 'Parametrização atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        history.push('/listar/parametrizacao');
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
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Heading size="md" fontWeight="normal">
              PARAMETRIZAÇÃO
            </Heading>

            <Divider my="6" borderColor="gray.700" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="6">
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  {/* <InputCustom
                    name="margemRentabilidade"
                    label="Margem de rentabilidade (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  /> */}

                  <InputCustom
                    name="percentualAprovacaoPedido"
                    label="Perc. aprovação pedidos (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  />

                  <SelectCustom
                    label="Tipo de Parametrização"
                    placeholder="Selecione a opção"
                    name="integracaoPorEmpresa"
                    register={register}
                    errorMessage={errors.integracaoPorEmpresa?.message}
                    options={[
                      { id: 'true', value: 'Parametrização por Empresa' },
                      { id: 'false', value: 'Parametrização por Tabela' },
                    ]}
                    chave="value"
                  />

                  {/* <InputCustom
                    name="valorDesconto"
                    label="Valor do desconto (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  /> */}
                  {/* <InputCustom
                    name="valorPercentualTabelaPreco"
                    label="Valor percentual tabela (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  /> */}
                </SimpleGrid>

                <Divider my="6" borderColor="gray.700" />

                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="produtoRentabilidadeAlta"
                    label="Produto alta rentabilidade (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  />

                  <InputCustom
                    name="produtoRentabilidadeMedia"
                    label="Produto média rentabilidade (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  />

                  <InputCustom
                    name="produtoRentabilidadeBaixa"
                    label="Produto baixa rentabilidade (%)"
                    errors={errors}
                    control={control}
                    masks={percentMask}
                    minLength={3}
                  />
                </SimpleGrid>

                <Flex w="100%" justify="flex-end">
                  <ButtonGroup spacing="4">
                    <Button
                      fontSize="md"
                      variant="outline"
                      colorScheme="orange"
                      onClick={() => {
                        history.push('/listar/parametrizacao');
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
