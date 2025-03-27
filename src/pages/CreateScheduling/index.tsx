import { useEffect, useState } from "react";
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
} from "@chakra-ui/react";
import * as yup from "yup";
import { yupResolver } from "@hookform/resolvers/yup";
import { Header } from "../../components/Header";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { useHistory, useParams } from "react-router-dom";
import { InputCustom } from "../../components/InputCustom/InputCustom";
import { cnpjMask } from "../../helpers/cnpjMask";
import { phoneMask } from "../../helpers/phoneMask";
import { cellphoneMask } from "../../helpers/cellphoneMask";
import { cepMask } from "../../helpers/cepMask";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";
import { SelectCustom } from "../../components/selectCustom/SelectCustom";
import api from "../../service/api";
import { useAuth } from "../../context/AuthContext";
import { states } from "../../utils/states";
import { array, date } from "yup/lib/locale";
import { DateTime } from "luxon";

// import AuthContext from "../../Context/AuthContext";

type IParams = {
  id: string;
};

type IFormInputs = {
  dataAgendamento: string;
  observacoes?: string;

  colaborador: {
    id: string;
  };

  cliente: {
    id: string;
  };

  pedido: {
    id?: string;
  };

  visita: {
    id?: string;
  };
};

export const CreateScheduling: React.FC = () => {
  const [collaborator, setCollaborator] = useState<any[]>([]);
  const [costumer, setCostumer] = useState<any[]>([]);
  const [selectedCostumer, setSelectedCostumer] = useState<any[]>([]);
  const [initialDate, setInitialDate] = useState("");
  const [city, setCity] = useState("");

  const schema = yup.object().shape({
    dataAgendamento: yup.string().required("Campo Obrigatório"),
    colaborador: yup.object().shape({
      id: yup.string().required("Campo Obrigatório"),
    }),
    cliente: yup.object().shape({
      id: yup.string().required("Campo Obrigatório"),
    }),
  });

  const params = useParams<IParams>();

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
  const toast = useToast();
  const history = useHistory();
  const { user } = useAuth();

  useEffect(() => {
    api
      .get(
        `/api-essencial/v1/clientes/${user.empresa.id}/empresa?excluido=false`
      )
      .then((response) => {
        setCostumer(response.data.data);
        console.log(response.data.data);
      });
  }, []);

  useEffect(() => {
    api

      .get(
        `api-essencial/v1/colaborador/${user.empresa.id}/empresa?excluido=false`
      )
      .then((response) => {
        setCollaborator(response.data.data);
        console.log(response.data.data);
      });
  }, []);

  function handleChange(e: any) {
    // console.log(e.target.value);

    let costumerFilter = costumer.filter((c) => c.colaborador != null);

    // console.log(costumerFilter);

    let listClienteCollaborator = costumerFilter.filter(
      (c) => e.target.value == c.colaborador.id
    );

    // console.log(listClienteCollaborator);

    setValue("colaborador.id", e.target.value);
    setSelectedCostumer(listClienteCollaborator);
    setValue("cliente.id", "");
  }

  function handleDate(e: any) {
    let day = DateTime.now().day;
    let mounth = DateTime.now().month;
    let year = DateTime.now().year;
    console.log(DateTime.fromISO(e.target.value));
    console.log(e.target.value);
    console.log(DateTime.fromISO(`${year}-${mounth}-${day}`));

    if (
      DateTime.fromISO(e.target.value) <
      DateTime.fromISO(DateTime.now().toISODate())
    ) {
      return toast({
        title: "DATA INVÁLIDA",
        description: "Data anterior a data atual",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
    return e.target.value;
  }

  // useEffect(() => {
  //   if (!params.id) return;
  //   if (costumer.length == 0) return;

  //   const getData = async () => {
  //     try {
  //       const resp = await api.get(
  //         `/api-essencial/v1/transportadoras/${params.id}`
  //       );

  //       let estados = stateList.filter(
  //         (estado) => resp.data.data.endereco.uf === estado.uf
  //       );
  //       setSelectedState(estados);

  //       const city = estados.find(
  //         (estado) => estado.nome === resp.data.data.endereco.cidade
  //       );

  //       console.log(city);

  //       setValue("razaoSocial", resp.data.data.razaoSocial);
  //       setValue("fantasia", resp.data.data.fantasia);
  //       setValue("cnpj", resp.data.data.cnpj);
  //       setValue("contato", resp.data.data.contato);
  //       setValue("email", resp.data.data.email);
  //       setValue("celular", resp.data.data.celular);
  //       setValue("telefone", resp.data.data.telefone);
  //       setValue("site", resp.data.data.site);
  //       setValue("observacao", resp.data.data.observacao);
  //       setValue("endereco", resp.data.data.endereco);
  //       setValue("endereco.uf", resp.data.data.endereco.uf);
  //       setValue("endereco.cidade", city.id);
  //     } catch (error) {}
  //   };

  //   getData();
  // }, [params.id, stateList]);

  // const handleChange = (e: any) => {
  //   let estados = stateList.filter((estado) => e.target.value === estado.uf);
  //   setSelectedState(estados);
  // };

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    console.log(data);

    // Object.assign(data, {
    //   empresa: { id: user.empresa.id },
    //   excluido: false,
    //   enderecos: [
    //     {
    //       ...data.endereco,
    //       tipoEndereco: "LOCAL",
    //     },
    //   ],
    // });

    // if (params.id) {
    //   Object.assign(data, { id: params.id });

    //   try {
    //     await api.put(`/api-essencial/v1/transportadoras`, data);
    //     toast({
    //       title: "Cadastro atualizado com sucesso",
    //       description: ``,
    //       status: "success",
    //       duration: 3000,
    //       isClosable: true,
    //     });
    //     reset();
    //     history.push("/listar/transportadora");
    //   } catch (error: any) {
    //     if (error) {
    //       return toast({
    //         title: "Atenção !!",
    //         description: "Erro ao acessar o sistema",
    //         status: "error",
    //         duration: 3000,
    //         isClosable: true,
    //       });
    //     }
    //   }

    //   return;
    // }
    // console.log(data);
    try {
      await api.post("/api-essencial/v1/agendamentos", data);
      toast({
        title: "Cadastro Realizado com sucesso",
        description: ``,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push("/listar/agendamento");
    } catch (error: any) {
      if (error.data.errors?.details) {
        return toast({
          title: "Atenção !!",
          description: `${error.data.errors.details}`,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }

      if (error) {
        return toast({
          title: "Erro Inesperado",
          description: "Tente cadastrar daqui alguns minutos",
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  useEffect(() => {
    console.log(errors);
  }, [errors]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Heading size="md" fontWeight="normal">
              CADASTRO DE AGENDAMENTOS
            </Heading>

            <Divider my="6" borderColor="gray.600" />

            <form onSubmit={handleSubmit(onSubmit)}>
              <VStack spacing="8">
                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  {/* <InputCustom
                    name="dataAgendamento"
                    label="Data do agendamento"
                    type="date"
                    errors={errors}
                    register={register}
                    onChange={handleDate}
                  /> */}

                  <Controller
                    name="dataAgendamento"
                    control={control}
                    render={({ field }) => (
                      <InputCustom
                        {...field}
                        name="dataAgendamento"
                        label="Data do agendamento"
                        type="date"
                        control={control}
                        errors={errors}
                        onChange={(e) => field.onChange(handleDate(e))}
                      />
                    )}
                  />

                  <Controller
                    name="colaborador.id"
                    control={control}
                    render={({ field }) => (
                      <SelectCustom
                        {...field}
                        label="Colaborador"
                        placeholder="Selecione a opção"
                        control={control}
                        onChange={(e) => field.onChange(handleChange(e))}
                        errorMessage={errors.colaborador?.id?.message}
                        chave="nome"
                        name="colaborador.id"
                        options={collaborator}
                      />
                    )}
                  />

                  {/* <SelectCustom
                    label="Colaborador"
                    placeholder="Selecione a opção"
                    name="colaborador.id"
                    register={register}
                    // control={control}
                    options={collaborator}
                    // options={selectedState.map((city) => {
                    //   city.id = city.codigo;
                    //   return city;
                    // })}
                    errorMessage={errors.colaborador?.id?.message}
                    chave="nome"
                    onChange={handleChange}
                  /> */}

                  <SelectCustom
                    label="Cliente"
                    placeholder="Selecione a opção"
                    name="cliente.id"
                    register={register}
                    options={selectedCostumer}
                    errorMessage={errors.cliente?.id?.message}
                    chave="fantasia"
                  />
                </SimpleGrid>

                <SimpleGrid minChildWidth="240px" spacing="8" w="100%">
                  <InputCustom
                    name="observacoes"
                    label="Observações"
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
                        history.push("/listar/agendamento");
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
