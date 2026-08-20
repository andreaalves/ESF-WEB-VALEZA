// import { useContext } from "react";
import {
  Flex as FlexBase,
  Box as BoxBase,
  Heading as HeadingBase,
  Button as ButtonBase,
  VStack as VStackBase,
  SimpleGrid as SimpleGridBase,
  Divider as DividerBase,
  ButtonGroup as ButtonGroupBase,
  useToast,
  Text as TextBase,
} from '@chakra-ui/react';
import { Header } from '../../components/Header';
import { useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import api from '../../service/api';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import { percentMask } from '../../helpers/percentMask';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { useParametrizacao } from '../../context/ParametrizacaoContext';

// Chakra UI v1 + TS strict estoura TS2590 ("union type too complex") quando
// uma página mistura muitos componentes. Casting para any contorna o limite.
const Flex = FlexBase as any;
const Box = BoxBase as any;
const Heading = HeadingBase as any;
const Button = ButtonBase as any;
const VStack = VStackBase as any;
const SimpleGrid = SimpleGridBase as any;
const Divider = DividerBase as any;
const ButtonGroup = ButtonGroupBase as any;
const Text = TextBase as any;

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
  condicaoPgtoCliente: boolean;
  utilizaOpme: boolean;
  empresa: {
    id: string;
  };
};

type TipoPedido = {
  id: string;
  descricao: string;
};

// Regras de negócio da parametrização (aprovação de pedido, rentabilidade,
// tabela de preço...). Separado do cadastro de empresa (CreateParams):
// "Cadastrar" leva pra empresa, o lápis de editar desta lista leva pra cá.
export const CreateRegrasParametrizacao = () => {
  const { user } = useAuth();

  const params = useParams<IParams>();

  const { register, handleSubmit, formState, control, setValue } =
    useForm<any>();

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();
  const { recarregar } = useParametrizacao();
  const [tipoPedido, setTipoPedido] = useState<TipoPedido[]>([]);
  const [utilizaOpme, setUtilizaOpme] = useState(false);

  // Agendamento cirúrgico só existe quando a empresa usa OPME. Ele não é um
  // registro em tipo_pedido — o app (ESF-APP-VALEZA, tab6) o adiciona à lista
  // quando utiliza_opme = true. Replicamos o mesmo comportamento aqui.
  const tiposPedidoExibidos: TipoPedido[] = utilizaOpme
    ? [...tipoPedido, { id: 'agendamento', descricao: 'AGENDAMENTO' }]
    : tipoPedido;

  useEffect(() => {
    if (!params.id) return;

    api
      .get(`/api-essencial/v1/parametrizacao/${params.id}`)
      .then((response) => {
        const dados = response.data[0];

        setTipoPedido(dados.tipo_pedido || []);
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
        setValue(
          'integracaoPorEmpresa',
          String(!!dados?.integracao_por_empresa)
        );
        setValue(
          'multiplasTabelaPreco',
          String(!!dados?.multiplas_tabela_preco)
        );
        setValue('atendimentoPorRegiao', String(!!dados?.atendimento_por_regiao));
        setValue('condicaoPgtoCliente', String(!!dados?.condicao_pgto_cliente));
        setValue('utilizaOpme', String(!!dados?.utiliza_opme));
        setUtilizaOpme(!!dados?.utiliza_opme);
      });
  }, [params, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data) => {
    const dados = {
      empresa: { id: `${user.empresa.id}` },
      margem_rentabilidade: Number(data?.margemRentabilidade),
      valor_desconto: Number(data?.valorDesconto),
      valor_percentual_tabela_preco: Number(data?.valorPercentualTabelaPreco),
      percentual_aprovacao_pedido: Number(data?.percentualAprovacaoPedido),
      produto_rentabilidade_alta: Number(data?.produtoRentabilidadeAlta),
      produto_rentabilidade_media: Number(data?.produtoRentabilidadeMedia),
      produto_rentabilidade_baixa: Number(data?.produtoRentabilidadeBaixa),
      // A API trata integracao_por_empresa de forma diferente dos demais:
      // ela compara `== "true"` (string), então este campo PRECISA ir como
      // string "true"/"false" (o value do select). Os outros booleanos a API
      // compara `== false`, então vão como boolean mesmo. Ver ESF-WEB-SUPLEN
      // (mesma API).
      integracao_por_empresa: data?.integracaoPorEmpresa,
      multiplas_tabela_preco: String(data?.multiplasTabelaPreco) === 'true',
      atendimento_por_regiao: String(data?.atendimentoPorRegiao) === 'true',
      condicao_pgto_cliente: String(data?.condicaoPgtoCliente) === 'true',
      utiliza_opme: String(data?.utilizaOpme) === 'true',
    };

    if (!params.id) return;

    try {
      await api.post(`/api-essencial/v1/parametrizacao/${params.id}`, dados);
      toast({
        title: 'Parametrização atualizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Aguarda o recarregar pra atualizar o cache (ex.: menu Mapa
      // Cirúrgico via utiliza_opme) sem precisar sair e logar de novo.
      await recarregar();
      history.push('/listar/parametrizacao');
    } catch (error) {
      toast({
        title: 'Erro Inesperado',
        description: 'Tente cadastrar daqui alguns minutos',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
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

                  <SelectCustom
                    label="Condição de pagamento por cliente"
                    name="condicaoPgtoCliente"
                    register={register}
                    errorMessage={errors.condicaoPgtoCliente?.message}
                    options={[
                      { id: 'true', value: 'Sim' },
                      { id: 'false', value: 'Não' },
                    ]}
                    chave="value"
                  />
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
                      {tiposPedidoExibidos.length > 0 ? (
                        tiposPedidoExibidos.map((item, index) => (
                          <Text
                            as="p"
                            key={item.id || `tipo-pedido-${index}`}
                            fontSize="lg"
                            color="gray.50"
                          >
                            {item.descricao}
                          </Text>
                        ))
                      ) : (
                        <Text fontSize="lg" color="gray.50">
                          Nenhum tipo de pedido encontrado.
                        </Text>
                      )}
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
