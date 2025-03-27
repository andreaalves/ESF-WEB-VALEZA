import { useEffect, useState } from 'react';
import {
  Flex,
  Text,
  Box,
  Heading,
  Button,
  VStack,
  SimpleGrid,
  Divider,
  ButtonGroup,
  useToast,
  Icon,
  Spinner,
} from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Header } from '../../components/Header';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { InputCustom } from '../../components/InputCustom/InputCustom';
// import { cnpjMask } from '../../helpers/cnpjMask';
// import { phoneMask } from '../../helpers/phoneMask';
// import { cellphoneMask } from '../../helpers/cellphoneMask';
// import { cepMask } from '../../helpers/cepMask';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import api from '../../service/api';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
// import { DateTime } from 'luxon';
// import types from '@chakra-ui/visually-hidden';
// import { useAuth } from '../../context/AuthContext';
// import { AiOutlineCheck } from 'react-icons/ai';

type IFormInputs = {
  codigo: string;
  passwordConfirm: string;
  regiao: string;
  validadeLicenca: string;
  informacaoAdicional: string;
  usuario: {
    name: string;
    email: string;
    password: string;
    role: string;
    empresa_id: string;
  };
};

type IParams = {
  id: string;
};

export const CreateUser: React.FC = () => {
  const schema = yup.object().shape(
    {
      usuario: yup.object().shape({
        name: yup.string().required('Campo obrigatório.'),
        email: yup
          .string()
          .email('Digite um email válido.')
          .required('Campo obrigatório.'),

        password: yup.string().notRequired().default(''),
        role: yup.string().required('Campo obrigatório.'),
      }),

      passwordConfirm: yup
        .string()
        .oneOf([yup.ref('usuario.password'), null], 'Senhas não são iguais'),
      validadeLicenca: yup.string().notRequired(),
    },
    [['password', 'password']]
  );

  const { register, handleSubmit, formState, reset, setValue } = useForm({
    resolver: yupResolver(schema),
  });

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();

  const params = useParams<IParams>();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;

    async function getData() {
      setIsLoading(true);
      const response = await api.get(
        `/api-essencial/v1/colaborador/${params.id}`
      );

      setValue('nome', response.data.nome);
      setValue('codigo', response.data.codigo);
      setValue('usuario', response.data.usuarios);
      setValue('regiao', response.data.regiao);
      setValue('validadeLicenca', response.data.validadeLicenca);
      setValue('informacaoAdicional', response.data.informacaoAdicional);
    }

    getData();
    setIsLoading(false);
  }, [params.id, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    // delete data.passwordConfirm;

    // Object.assign(data, {
    //   nome: data.usuario.name,
    //   empresa: {
    //     id: user.empresa.id,
    //   },
    //   excluido: false,
    // });

    // Object.assign(data.usuario, {
    //   empresa: {
    //     id: user.empresa.id,
    //   },
    //   role: data.usuario.role,
    // });

    if (params.id) {
      try {
        await api.put(`/api-essencial/v1/colaborador/${params.id}`, data);

        toast({
          title: 'Cadastro atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        reset();
        history.push('/listar/vendedor');
      } catch (error: any) {
        console.log(error);
        if (error.data) {
          return toast({
            title: 'Atenção !!',
            description: `${
              error.data.message
                ? error.data.message
                : 'Erro ao acessar o sistema'
            }`,
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }

      return;
    }

    // try {
    //   await api.post('/api-essencial/v1/colaborador', data);
    //   toast({
    //     title: 'Cadastro Realizado com sucesso',
    //     description: ``,
    //     status: 'success',
    //     duration: 3000,
    //     isClosable: true,
    //   });
    //   reset();
    //   history.push('/listar/vendedor');
    // } catch (error: any) {
    //   if (error.data.errors?.details) {
    //     return toast({
    //       title: 'Atenção !!',
    //       description: `${error.data.errors.details}`,
    //       status: 'error',
    //       duration: 3000,
    //       isClosable: true,
    //     });
    //   }
    //   if (error.data) {
    //     return toast({
    //       title: 'Atenção !!',
    //       description: 'Erro ao acessar o sistema',
    //       status: 'error',
    //       duration: 3000,
    //       isClosable: true,
    //     });
    //   }
    // }
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            {/* <Flex justify="space-between" align="center"> */}
            <Heading size="md" fontWeight="normal">
              CADASTRO DE VENDEDORES
            </Heading>

            <Divider my="6" borderColor="gray.600" />
            {isLoading ? (
              <Flex justify="center">
                <Spinner color="white" />
              </Flex>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <VStack spacing="8">
                  <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                    <InputCustom
                      name="usuario.name"
                      label="Nome"
                      errors={errors}
                      register={register}
                    />
                    <InputCustom
                      name="usuario.email"
                      label="Email"
                      errors={errors}
                      register={register}
                    />
                    <InputCustom
                      name="usuario.password"
                      label="Senha"
                      placeholder="*******"
                      errors={errors}
                      register={register}
                      maxLength={18}
                      type="password"
                    />

                    <InputCustom
                      name="passwordConfirm"
                      label="Confirme a senha"
                      placeholder="*******"
                      errors={errors}
                      register={register}
                      maxLength={18}
                      type="password"
                    />

                    <SelectCustom
                      label="Função"
                      placeholder="Selecione a opção"
                      name="usuario.role"
                      isDisabled
                      register={register}
                      options={[
                        { id: 'ROLE_SELLER', value: 'Vendedor' },
                        { id: 'ROLE_SUPERVISOR', value: 'Supervisor' },
                        { id: 'ROLE_COORDINATOR', value: 'Coordenador' },
                        { id: 'ROLE_MANAGER', value: 'Gerente' },
                        {
                          id: 'ROLE_MANAGER_REGIONAL',
                          value: 'Gerente Regional',
                        },
                        {
                          id: 'ROLE_MANAGER_NACIONAL',
                          value: 'Gerente Nacional',
                        },
                      ]}
                      errorMessage={errors.usuario?.role?.message}
                      chave="value"
                    />
                  </SimpleGrid>
                  <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                    <InputCustom
                      name="regiao"
                      label="Região"
                      errors={errors}
                      register={register}
                    />

                    {/* <InputCustom
                    name="validadeLicenca"
                    label="Validade da Licença"
                    type="date"
                    errors={errors}
                    register={register}
                  /> */}
                    <InputCustom
                      name="informacaoAdicional"
                      label="Informação Adicional"
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
                          history.push('/listar/vendedor');
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
      </Flex>
    </>
  );
};
