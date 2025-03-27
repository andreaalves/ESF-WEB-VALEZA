import { useEffect } from 'react';
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
import { cnpjMask } from '../../helpers/cnpjMask';
import { phoneMask } from '../../helpers/phoneMask';
import { cellphoneMask } from '../../helpers/cellphoneMask';
import { cepMask } from '../../helpers/cepMask';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import api from '../../service/api';
import { useState } from 'react';
import { currencyMask } from '../../helpers/currencyMask';
import { useAuth } from '../../context/AuthContext';

// import AuthContext from "../../Context/AuthContext";

type IFormInputs = {
  razaoSocial: string;
  fantasia: string;
  cnpj: string;
  ie: string;
  emailCopiaPedido: string;
  emailXmlNfe: string;
  condicaoPagamento: string;
  limiteCredito: string;
  segmento: string;
  telefone: string;
  celular: string;
  site: string;
  observacao: string;
  endereco?: [
    {
      logradouro: string;
      complemento: string;
      numero: string;
      bairro: string;
      cidade: string;
      uf: string;
      cep: string;
      tipoEndereco: string;
      pontoReferencia: string;
    }
  ];
  empresa: {
    id: string;
  };
  colaborador: {
    id: string;
  };
};

interface IParams {
  id: string;
}

export const CreateCostumer: React.FC = () => {
  const [sellersList, setSellersList] = useState([]);

  const schema = yup.object().shape({
    razaoSocial: yup.string().required('Campo Obrigatório'),
    fantasia: yup.string().required('Campo Obrigatório'),
    cnpj: yup.string().required('Campo Obrigatório'),
    emailCopiaPedido: yup
      .string()
      .email('Digite um email válido')
      .required('Campo Obrigatório'),
    emailXmlNfe: yup
      .string()
      .email('Digite um email válido')
      .required('Campo Obrigatório'),
    condicaoPagamento: yup.string().required('Campo Obrigatório'),
    limiteCredito: yup.string().required('Campo Obrigatório'),
    segmento: yup.string().required('Campo Obrigatório'),
    colaborador: yup.object().shape({
      id: yup.string().required('Campo Obrigatório'),
    }),
    telefone: yup.string().required('Campo Obrigatório'),
    celular: yup.string().required('Campo Obrigatório'),
    endereco: yup.object().shape({
      logradouro: yup.string().required('Campo Obrigatório'),
      complemento: yup.string(),
      numero: yup.string().required('Campo Obrigatório'),
      bairro: yup.string().required('Campo Obrigatório'),
      cidade: yup.string().required('Campo Obrigatório'),
      uf: yup.string().required('Campo Obrigatório'),
      cep: yup.string().required('Campo Obrigatório'),
    }),
  });

  const { register, handleSubmit, formState, reset, control, setValue } =
    useForm({
      resolver: yupResolver(schema),
    });

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();
  const { user } = useAuth();
  const params = useParams<IParams>();

  useEffect(() => {
    api.get(`/api-essencial/v1/colaboradores`).then((response) => {
      const colaboradores = response.data.map((colaborador: any) => {
        return {
          id: colaborador.colaborador_id,
          nome: colaborador.nome,
        };
      });

      setSellersList(colaboradores);
    });
  }, []);

  useEffect(() => {
    if (!params.id) return;

    api.get(`/api-essencial/v1/clientes/${params.id}`).then((response) => {
      const colaboradorFormatado = {
        id: response.data.colaboradores?.colaborador_id,
        nome: response.data.colaboradores?.nome,
      };

      setValue('razaoSocial', response.data.razao_social);
      setValue('fantasia', response.data.fantasia);
      setValue('cnpj', response.data.cnpj);
      setValue('ie', response.data.ie);
      setValue('emailCopiaPedido', response.data.email_copia_pedido);
      setValue('emailXmlNfe', response.data.email_xml_nfe);
      setValue('colaborador', colaboradorFormatado);
      setValue('limiteCredito', response.data.limite_credito);
      setValue('segmento', response.data.segmento);
      setValue('telefone', response.data.telefone);
      setValue('celular', response.data.celular);
      setValue('site', response.data.site);
      setValue('observacao', response.data.observacao);
      setValue('endereco', response.data.endereco);
    });
  }, [params.id, sellersList, setValue]);

  const characters = ['.', '-', '(', ')'];

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    characters.forEach((character) => {
      data.limiteCredito = data.limiteCredito.replaceAll(character, '');
      data.limiteCredito = data.limiteCredito.replaceAll(',', '.');
    });

    Object.assign(data, {
      empresa: { id: `${user.empresa.id}` },
      excluido: false,
      enderecos: [
        {
          ...data.endereco,
          tipoEndereco: 'LOCAL',
        },
      ],
    });

    delete data.endereco;

    if (params.id) {
      // Object.assign(data, { id: params.id });

      try {
        await api.put(`/api-essencial/v1/clientes/${params.id}`, data);
        toast({
          title: 'Cadastro atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        reset();
        history.push('/listar/cliente');
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

    // console.log("Dados", data);

    try {
      await api.post('/api-essencial/v1/clientes', data);
      toast({
        title: 'Cadastro Realizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push('/listar/cliente');
    } catch (error: any) {
      if (error.data.errors?.details) {
        toast({
          title: 'Atenção !!',
          description: `${error.data.errors.details}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
        return;
      }

      if (error) {
        toast({
          title: 'Erro Inesperado',
          description: 'Tente cadastrar daqui alguns minutos',
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
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
              CADASTRO DE CLIENTES
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="8">
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="razaoSocial"
                    label="Razão Social"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="fantasia"
                    label="Nome Fantasia"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="cnpj"
                    label="CNPJ"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={cnpjMask}
                    maxLength={18}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="ie"
                    label="Inscrição Estadual"
                    isDisabled
                    errors={errors}
                    register={register}
                  />

                  {/* <InputCustom
                    name="contato"
                    label="Contato"
                    isDisabled
                    errors={errors}
                    register={register}
                  /> */}
                  <InputCustom
                    name="emailCopiaPedido"
                    label="Email"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="emailXmlNfe"
                    label="Email NFE"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <SelectCustom
                    label="Vendedor"
                    isDisabled
                    placeholder="Selecione a opção"
                    name="colaborador.id"
                    errorMessage={errors.colaborador?.id?.message}
                    register={register}
                    options={sellersList}
                    chave="nome"
                  />
                  {/* <SelectCustom
                    label="Condição de Pagamento"
                    isDisabled
                    placeholder="Selecione a opção"
                    name="condicaoPagamento"
                    errorMessage={errors.condicaoPagamento?.message}
                    register={register}
                    options={[
                      { id: 'PARCELADO', paymentMethod: 'Parcelado' },
                      { id: 'AVISTA', paymentMethod: 'À vista' },
                    ]}
                    chave="paymentMethod"
                  /> */}
                  <InputCustom
                    name="limiteCredito"
                    label="Limite de Crédito"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={currencyMask}
                    maxLength={14}
                  />

                  <InputCustom
                    name="segmento"
                    label="Segmento"
                    isDisabled
                    errors={errors}
                    register={register}
                    maxLength={14}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="telefone"
                    label="Telefone"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={phoneMask}
                    maxLength={13}
                  />

                  <InputCustom
                    name="celular"
                    label="Celular"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={cellphoneMask}
                    maxLength={14}
                  />

                  <InputCustom
                    name="site"
                    label="Site"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="observacao"
                    label="Observação"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <Divider my="6" borderColor="gray.600" />
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.descricao_endereco"
                    label="Logradouro"
                    isDisabled
                    errors={errors}
                    register={register}
                  />

                  {/* <InputCustom
                    name="endereco.complemento"
                    label="Complemento"
                    isDisabled
                    errors={errors}
                    register={register}
                  /> */}
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  {/* <InputCustom
                    name="endereco.numero"
                    label="Número"
                    isDisabled
                    errors={errors}
                    register={register}
                  /> */}

                  <InputCustom
                    name="endereco.bairro"
                    label="Bairro"
                    isDisabled
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="endereco.cidade"
                    label="Cidade"
                    isDisabled
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.uf"
                    label="UF"
                    isDisabled
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="endereco.cep"
                    label="CEP"
                    isDisabled
                    errors={errors}
                    control={control}
                    masks={cepMask}
                    maxLength={9}
                  />

                  {/* <SelectCustom
                    label="Tipo Endereço"
                    isDisabled
                    placeholder="Selecione a opção"
                    name="endereco.tipoEndereco"
                    register={register}
                    errors={errors}
                    options={[
                      { id: "LOCAL", value: "Local" },
                      { id: "COBRANCA", value: "Cobrança" },
                      { id: "ENTREGA", value: "Entrega" },
                    ]}
                    chave="value"
                  /> */}
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.pontoReferencia"
                    label="Ponto de Referência"
                    isDisabled
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
                        history.push('/listar/cliente');
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
