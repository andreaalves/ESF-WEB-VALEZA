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
import api from '../../service/api';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import { useAuth } from '../../context/AuthContext';

// import AuthContext from "../../Context/AuthContext";

type IFormInputs = {
  razaoSocial: string;
  fantasia: string;
  cnpj: string;
  ie: string;
  contato: string;
  email: string;
  telefone: string;
  celular: string;
  site: string;
  observacao: string;
  endereco: [
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
};

type IParams = {
  id: string;
};

export const CreateProvider: React.FC = () => {
  const schema = yup.object().shape({
    razaoSocial: yup.string().required('Campo Obrigatório'),
    fantasia: yup.string().required('Campo Obrigatório'),
    cnpjCpf: yup.string().required('Campo Obrigatório'),
    contato: yup.string().required('Campo Obrigatório'),
    email: yup
      .string()
      .email('Digite um email válido')
      .required('Campo Obrigatório'),
    telefone: yup.string().required('Campo Obrigatório'),
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

  const params = useParams<IParams>();

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();
  const { signOut, user } = useAuth();

  useEffect(() => {
    if (!params.id) return;
    api.get(`/api-essencial/v1/fornecedores/${params.id}`).then((response) => {
      console.log(response.data.data);
      setValue('razaoSocial', response.data.data.razaoSocial);
      setValue('fantasia', response.data.data.fantasia);
      setValue('cnpjCpf', response.data.data.cnpjCpf);
      setValue('ieRg', response.data.data.ieRg);
      setValue('contato', response.data.data.contato);
      setValue('email', response.data.data.email);
      setValue('telefone', response.data.data.telefone);
      setValue('celular', response.data.data.celular);
      setValue('site', response.data.data.site);
      setValue('observacao', response.data.data.observacao);
      setValue('endereco', response.data.data.endereco);
    });
  }, [params.id, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
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

    console.log(data);

    if (params.id) {
      Object.assign(data, { id: params.id });

      try {
        await api.put(`/api-essencial/v1/fornecedores`, data);
        toast({
          title: 'Cadastro atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        reset();
        history.push('/listar/fornecedor');
      } catch (error: any) {
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

    try {
      await api.post('/api-essencial/v1/fornecedores', data);
      toast({
        title: 'Cadastro Realizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push('/listar/fornecedor');
    } catch (error: any) {
      if (error.data.errors?.details) {
        toast({
          title: 'Atenção !!',
          description: `${error.data.errors.details}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
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
              CADASTRO DE FORNECEDORES
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="8">
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="razaoSocial"
                    label="Razão Social"
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="fantasia"
                    label="Nome Fantasia"
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="cnpjCpf"
                    label="CNPJ"
                    errors={errors}
                    control={control}
                    masks={cnpjMask}
                    maxLength={18}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="ieRg"
                    label="Inscrição Estadual"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="contato"
                    label="Contato"
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="email"
                    label="Email"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="telefone"
                    label="Telefone"
                    errors={errors}
                    control={control}
                    masks={phoneMask}
                    maxLength={13}
                  />

                  <InputCustom
                    name="celular"
                    label="Celular"
                    errors={errors}
                    control={control}
                    masks={cellphoneMask}
                    maxLength={14}
                  />

                  <InputCustom
                    name="site"
                    label="Site"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="observacao"
                    label="Observação"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <Divider my="6" borderColor="gray.600" />
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.logradouro"
                    label="Logradouro"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="endereco.complemento"
                    label="Complemento"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.numero"
                    label="Número"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="endereco.bairro"
                    label="Bairro"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="endereco.cidade"
                    label="Cidade"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.uf"
                    label="UF"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="endereco.cep"
                    label="CEF"
                    errors={errors}
                    control={control}
                    masks={cepMask}
                    maxLength={9}
                  />

                  {/* <SelectCustom
                    label="Tipo Endereço"
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
                        history.push('/listar/fornecedor');
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
