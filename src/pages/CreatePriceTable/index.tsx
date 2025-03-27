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
import { Wapper } from '../../components/Wapper';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import api from '../../service/api';
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

type IParams = {
  id: string;
};

type IFormInputs = {
  nome: string;
  dataInicial: string;
  dataFinal: string;
  observacao: string;
  empresa: {
    id: string;
  };
};

export const CreatePriceTable: React.FC = () => {
  const schema = yup.object().shape({
    nome: yup.string().required('Campo Obrigatório'),
    dataInicial: yup.string().required('Campo Obrigatório'),
    dataFinal: yup.string().required('Campo Obrigatório'),
  });

  const {
    register,
    handleSubmit,
    formState,
    reset,
    control,
    setValue,
    getValues,
  } = useForm({
    resolver: yupResolver(schema),
  });

  const { errors } = formState;
  const params = useParams<IParams>();
  const toast = useToast();
  const history = useHistory();
  const { user } = useAuth();

  useEffect(() => {
    if (!params.id) return;
    api.get(`/api-essencial/v1/tabela-precos/${params.id}`).then((response) => {
      console.log(response.data.data);
      setValue('nome', response.data.data.nome);
      setValue('dataInicial', response.data.data.dataInicial);
      setValue('dataFinal', response.data.data.dataFinal);
      setValue('observacao', response.data.data.observacao);
    });
  }, [params.id, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    console.log(data);

    Object.assign(data, {
      empresa: { id: `${user.empresa.id}` },
      excluido: false,
    });

    if (params.id) {
      Object.assign(data, { id: params.id });
      try {
        await api.put(`/api-essencial/v1/tabela-precos/${params.id}`, data);
        toast({
          title: 'Cadastro atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        reset();
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

    try {
      await api.post('/api-essencial/v1/tabela-precos', data);
      console.log('Dados', data);

      toast({
        title: 'Cadastro Realizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push('/listar/tabela-preco');
    } catch (error: any) {
      if (error.data.errors?.details) {
        return toast({
          title: 'Atenção !!',
          description: `${error.data.errors.details}`,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }

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
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8}>
            <Heading size="md" fontWeight="normal">
              CADASTRO TABELA DE PREÇOS
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="8">
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="nome"
                    label="Nome"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="dataInicial"
                    label="Vigência - Data início"
                    type="date"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="dataFinal"
                    label="Vigência - Data final"
                    type="date"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="observacao"
                    label="Observação"
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
      </Flex>
    </>
  );
};
