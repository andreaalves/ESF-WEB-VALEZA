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
  Text,
  Image,
} from '@chakra-ui/react';
import { Header } from '../../components/Header';
import { useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import api from '../../service/api';
// import * as yup from 'yup';
// import { useState } from 'react';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import { percentMask } from '../../helpers/percentMask';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { useParametrizacao } from '../../context/ParametrizacaoContext';

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
  multiplasTabelaPreco: boolean;
  tipoPedido: TipoPedido[];
  atendimentoPorRegiao: boolean;
  utilizaOpme: boolean;
  empresa: {
    id: string;
  };
};

type TipoPedido = {
  id: string;
  descricao: string;
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
  const { recarregar } = useParametrizacao();
  const [tipoPedido, setTipoPedido] = useState<TipoPedido[]>([]);
  const [logo, setLogo] = useState<Buffer | undefined>();

  useEffect(() => {
    if (!params.id) return;

    api
      .get(`/api-essencial/v1/parametrizacao/${params.id}`)
      .then((response) => {
        const dados = response.data[0];

        console.log('dados', dados);

        setTipoPedido(dados.tipo_pedido || []);
        setLogo(dados.empresas?.logo || undefined);
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
        setValue('multiplasTabelaPreco', dados?.multiplas_tabela_preco);
        setValue('atendimentoPorRegiao', dados?.atendimento_por_regiao);
        setValue('utilizaOpme', dados?.utiliza_opme);
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
      multiplas_tabela_preco: data?.multiplasTabelaPreco,
      atendimento_por_regiao: data?.atendimentoPorRegiao,
      utiliza_opme: data?.utilizaOpme,
      // excluido: false,
      // });
    };

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
        recarregar();
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

                  <SelectCustom
                    label="Empresa utiliza múltiplas tabelas de preço"
                    name="multiplasTabelaPreco"
                    register={register}
                    errorMessage={errors.multiplasTabelaPreco?.message}
                    options={[
                      { id: 'true', value: 'Sim' },
                      { id: 'false', value: 'Não' },
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

                <Divider my="6" borderColor="gray.700" />
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <SelectCustom
                    label="Atendimento por região"
                    name="atendimentoPorRegiao"
                    register={register}
                    errorMessage={errors.atendimentoPorRegiao?.message}
                    options={[
                      { id: 'true', value: 'Sim' },
                      { id: 'false', value: 'Não' },
                    ]}
                    chave="value"
                  />

                  <SelectCustom
                    label="Utiliza OPME"
                    name="utilizaOpme"
                    register={register}
                    errorMessage={errors.utilizaOpme?.message}
                    options={[
                      { id: 'true', value: 'Sim' },
                      { id: 'false', value: 'Não' },
                    ]}
                    chave="value"
                  />

                  <Box>
                    <Text as="p" mb={2}>
                      Tipos de pedido:
                    </Text>
                    <Box borderRadius="lg" p={4} bg={'gray.700'}>
                      {tipoPedido.length > 0 ? (
                        tipoPedido.map((item, index) => (
                          <Text
                            as="p"
                            key={item.id || `tipo-pedido-${index}`}
                            fontSize="lg"
                            color="white"
                          >
                            {item.descricao}
                          </Text>
                        ))
                      ) : (
                        <Text fontSize="lg" color="white">
                          Nenhum tipo de pedido encontrado.
                        </Text>
                      )}
                    </Box>
                  </Box>

                  <Box>
                    <Text>Logomarca:</Text>
                    <Box bg={'gray.700'} borderRadius="lg" p={4} mt={2}>
                      <Image
                        // mx="auto"
                        boxSize="100px"
                        src={
                          logo && typeof logo !== 'string' && 'data' in logo
                            ? `data:image/png;base64,${btoa(
                                String.fromCharCode(...(logo as any).data)
                              )}`
                            : ''
                        }
                        alt="Logo"
                        objectFit="cover"
                      />
                    </Box>
                  </Box>
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
