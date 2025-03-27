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
import { useAuth } from '../../context/AuthContext';
import { useEffect, useMemo } from 'react';
import { useState } from 'react';

// import AuthContext from "../../Context/AuthContext";

type IFormInputs = {
  nome: string;
  descricao: string;
  excluido: boolean;
};

type IParams = {
  id: string;
};

export const CreateCategory: React.FC = () => {
  const { user } = useAuth();

  const params = useParams<IParams>();
  const [formValues, setFormValues] = useState({});

  const schema = yup.object().shape({
    nome: yup.string().required('Campo Obrigatório'),
    descricao: yup.string().required('Campo Obrigatório'),
  });

  const { register, handleSubmit, formState, reset, setValue } = useForm<any>({
    resolver: yupResolver(schema),
    defaultValues: useMemo(() => {
      return formValues;
    }, [formValues]),
  });

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();

  useEffect(() => {
    if (!params.id) return;

    api.get(`/api-essencial/v1/categorias/${params.id}`).then((response) => {
      console.log(response);
      setValue('nome', response.data.nome);
      setValue('descricao', response.data.descricao);
    });
  }, [params, setValue]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    Object.assign(data, {
      empresa: { id: `${user.empresa.id}` },
    });

    if (params.id) {
      Object.assign(data, { id: params.id });

      try {
        await api.put(`/api-essencial/v1/categorias/${params.id}`, data);
        toast({
          title: 'Cadastro atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        history.push('/listar/categoria');
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
      await api.post('/api-essencial/v1/categorias', data);

      toast({
        title: 'Cadastro Realizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push('/listar/categoria');
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

    // api
    //   .post("/api-essencial/v1/categorias", data)
    //   .then((response) => {
    //     toast({
    //       title: "Cadastro Realizado com sucesso",
    //       description: ``,
    //       status: "success",
    //       duration: 3000,
    //       isClosable: true,
    //     });
    //     history.push("/listar/categoria");
    //   })
    //   .catch((error) => {
    //     // console.log(error.data.errors.details);
    //     if (error) {
    //       return toast({
    //         title: "Erro Inesperado",
    //         description: "Tente cadastrar daqui alguns minutos",
    //         status: "error",
    //         duration: 3000,
    //         isClosable: true,
    //       });
    //     }
    //   })
    //   .finally(() => {
    //     reset();
    //   });
  };

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Heading size="md" fontWeight="normal">
              CADASTRO DE CATEGORIAS
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="8">
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="nome"
                    label="Nome da Categoria"
                    errors={errors}
                    register={register}
                  />
                  <InputCustom
                    name="descricao"
                    label="Descrição"
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
                        history.push('/listar/categoria');
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
