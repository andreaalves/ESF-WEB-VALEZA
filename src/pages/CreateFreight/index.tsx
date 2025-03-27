// import { useContext } from "react";
import {
  Flex,
  Box,
  Heading,
  Button,
  VStack,
  SimpleGrid,
  Divider,
  FormControl,
  ButtonGroup,
  useToast,
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
import { currencyMask } from '../../helpers/currencyMask';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';

type IParams = {
  id: string;
};

type IFormInputs = {
  transportadora: {
    id: string;
  };
  destino: string;
  percentualFrete: string;
  garantiaPeso: string;
  freteMinimo: string;
  prazoEntrega: string;
};

export const CreateFreight = () => {
  const toast = useToast();
  const history = useHistory();

  const schema = yup.object().shape({
    transportadora: yup.object().shape({
      id: yup.string().required('Campo Obrigatório'),
    }),
    destino: yup.string().required('Campo Obrigatório'),
    percentualFrete: yup.string().required('Campo Obrigatório'),
    garantiaPeso: yup.string().required('Campo Obrigatório'),
    freteMinimo: yup.string().required('Campo Obrigatório'),
    prazoEntrega: yup.string().required('Campo Obrigatório'),
  });

  const { register, handleSubmit, formState, reset, control, setValue } =
    useForm({
      resolver: yupResolver(schema),
    });
  const { errors } = formState;
  const params = useParams<IParams>();
  const { user } = useAuth();

  const [transportadora, setTransportadora] = useState([]);

  useEffect(() => {
    api
      .get(
        `/api-essencial/v1/transportadoras/${user.empresa.id}/empresa?excluido=false`
      )
      .then((response) => setTransportadora(response.data.data));
  }, [user.empresa.id]);

  useEffect(() => {
    if (!params.id || transportadora.length < 1) return;

    api.get(`/api-essencial/v1/tabela-fretes/${params.id}`).then((response) => {
      console.log('editar', response.data);

      setValue('transportadora.id', response.data.data.transportadora.id);
      setValue('destino', response.data.data.destino);
      setValue(
        'percentualFrete',
        response.data.data.percentualFrete.toFixed(2)
      );
      setValue('garantiaPeso', response.data.data.garantiaPeso.toFixed(2));
      setValue('freteMinimo', response.data.data.freteMinimo.toFixed(2));
      setValue('prazoEntrega', response.data.data.prazoEntrega);
    });
  }, [params.id, setValue, transportadora]);

  const characters = ['.', '-', '(', ')'];

  const Submit: SubmitHandler<IFormInputs> = async (data, e) => {
    console.log(data);
    characters.forEach((character) => {
      data.percentualFrete = data.percentualFrete.replaceAll(character, '');
      data.percentualFrete = data.percentualFrete.replaceAll(',', '.');
    });
    characters.forEach((character) => {
      data.freteMinimo = data.freteMinimo.replaceAll(character, '');
      data.freteMinimo = data.freteMinimo.replaceAll(',', '.');
    });
    characters.forEach((character) => {
      data.garantiaPeso = data.garantiaPeso.replaceAll(character, '');
      data.garantiaPeso = data.garantiaPeso.replaceAll(',', '.');
    });
    Object.assign(data, {
      empresa: { id: `${user.empresa.id}` },
      excluido: false,
    });

    if (params.id) {
      Object.assign(data, { id: params.id });

      try {
        await api.put(`/api-essencial/v1/tabela-fretes/${params.id}`, data);
        toast({
          title: 'Cadastro atualizado com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        reset();
        history.push('/listar/frete');
      } catch (error) {
        if (error) {
          return toast({
            title: 'Atenção !!',
            description: 'Erro ao acessar o sistema',
            status: 'error',
            duration: 3000,
            isClosable: true,
          });
        }
      }

      return;
    }

    try {
      await api.post('/api-essencial/v1/tabela-fretes', data);
      console.log('dados', data);
      toast({
        title: 'Cadastro Realizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push('/listar/frete');
    } catch (error: any) {
      if (error) {
        return toast({
          title: 'Atenção !!',
          description: 'Erro ao acessar o sistema',
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
              CADASTRO DE FRETE
            </Heading>

            <Divider my="6" borderColor="gray.700" />

            <form onSubmit={handleSubmit(Submit)}>
              <VStack spacing="6">
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <SelectCustom
                    label="Transportadora"
                    placeholder="Selecione a opção"
                    name="transportadora.id"
                    errorMessage={errors.transportadora?.id?.message}
                    register={register}
                    options={transportadora}
                    chave="razaoSocial"
                  />

                  <InputCustom
                    name="destino"
                    label="Destino"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>

                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="percentualFrete"
                    label="Frete (%)"
                    errors={errors}
                    control={control}
                    masks={currencyMask}
                    minLength={3}
                  />

                  <InputCustom
                    name="garantiaPeso"
                    label="Garantia Peso (R$)"
                    errors={errors}
                    control={control}
                    masks={currencyMask}
                  />
                </SimpleGrid>

                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="freteMinimo"
                    label="Frete Mínimo (R$)"
                    errors={errors}
                    control={control}
                    masks={currencyMask}
                  />

                  <FormControl>
                    <SelectCustom
                      label="Prazo de entrega"
                      placeholder="Selecione a opção"
                      name="prazoEntrega"
                      register={register}
                      options={[
                        { id: '3 a 5 dias úteis', value: '3 a 5 dias úteis' },
                        { id: '4 a 6 dias úteis', value: '4 a 6 dias úteis' },
                        { id: '5 a 7 dias úteis', value: '5 a 7 dias úteis' },
                        { id: '5 a 8 dias úteis', value: '5 a 8 dias úteis' },
                        {
                          id: '10 a 15 dias úteis',
                          value: '10 a 15 dias úteis',
                        },
                      ]}
                      errorMessage={errors.prazoEntrega?.message}
                      chave="id"
                    />
                  </FormControl>
                </SimpleGrid>

                <Flex w="100%" justify="flex-end">
                  <ButtonGroup spacing="4">
                    <Button
                      fontSize="md"
                      variant="outline"
                      colorScheme="orange"
                      onClick={() => {
                        history.push('/listar/frete');
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
