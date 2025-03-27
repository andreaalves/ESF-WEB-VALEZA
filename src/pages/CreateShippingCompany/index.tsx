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
import { SubmitHandler, useForm } from "react-hook-form";
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
import { array } from "yup/lib/locale";

// import AuthContext from "../../Context/AuthContext";

type IParams = {
  id: string;
};

type IFormInputs = {
  razaoSocial: string;
  fantasia: string;
  cnpj: string;
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
    id: number;
  };
};

export const CreateShipingCompany: React.FC = () => {
  const [stateList, setStateList] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState<any[]>([]);
  const [city, setCity] = useState("");

  const schema = yup.object().shape({
    razaoSocial: yup.string().required("Campo Obrigatório"),
    fantasia: yup.string().required("Campo Obrigatório"),
    cnpj: yup.string().required("Campo Obrigatório"),
    contato: yup.string().required("Campo Obrigatório"),
    email: yup
      .string()
      .email("Digite um email válido")
      .required("Campo Obrigatório"),
    telefone: yup.string().required("Campo Obrigatório"),
    endereco: yup.object().shape({
      logradouro: yup.string().required("Campo Obrigatório"),
      complemento: yup.string(),
      numero: yup.string().required("Campo Obrigatório"),
      bairro: yup.string().required("Campo Obrigatório"),
      cidade: yup.string().required("Campo Obrigatório"),
      uf: yup.string().required("Campo Obrigatório"),
      cep: yup.string().required("Campo Obrigatório"),
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
    api.get("/api-essencial/v1/municipios").then((response) => {
      setStateList(response.data.data);
    });
  }, []);

  useEffect(() => {
    if (!params.id) return;
    if (stateList.length == 0) return;

    const getData = async () => {
      try {
        const resp = await api.get(
          `/api-essencial/v1/transportadoras/${params.id}`
        );

        let estados = stateList.filter(
          (estado) => resp.data.data.endereco.uf === estado.uf
        );
        setSelectedState(estados);

        const city = estados.find(
          (estado) => estado.nome === resp.data.data.endereco.cidade
        );

        console.log(city);

        setValue("razaoSocial", resp.data.data.razaoSocial);
        setValue("fantasia", resp.data.data.fantasia);
        setValue("cnpj", resp.data.data.cnpj);
        setValue("contato", resp.data.data.contato);
        setValue("email", resp.data.data.email);
        setValue("celular", resp.data.data.celular);
        setValue("telefone", resp.data.data.telefone);
        setValue("site", resp.data.data.site);
        setValue("observacao", resp.data.data.observacao);
        setValue("endereco", resp.data.data.endereco);
        setValue("endereco.uf", resp.data.data.endereco.uf);
        setValue("endereco.cidade", city.id);
      } catch (error) {}
    };

    getData();
  }, [params.id, stateList]);

  const handleChange = (e: any) => {
    let estados = stateList.filter((estado) => e.target.value === estado.uf);
    setSelectedState(estados);
  };

  const onSubmit: SubmitHandler<IFormInputs> = async (data, e) => {
    console.log(data);

    Object.assign(data, {
      empresa: { id: user.empresa.id },
      excluido: false,
      enderecos: [
        {
          ...data.endereco,
          tipoEndereco: "LOCAL",
        },
      ],
    });

    if (params.id) {
      Object.assign(data, { id: params.id });

      try {
        await api.put(`/api-essencial/v1/transportadoras`, data);
        toast({
          title: "Cadastro atualizado com sucesso",
          description: ``,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        reset();
        history.push("/listar/transportadora");
      } catch (error: any) {
        if (error) {
          return toast({
            title: "Atenção !!",
            description: "Erro ao acessar o sistema",
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        }
      }

      return;
    }
    console.log(data);
    try {
      await api.post("/api-essencial/v1/transportadoras", data);
      toast({
        title: "Cadastro Realizado com sucesso",
        description: ``,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push("/listar/transportadora");
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
              CADASTRO DE TRANSPORTADORA
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
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="cnpj"
                    label="CNPJ"
                    errors={errors}
                    control={control}
                    masks={cnpjMask}
                    maxLength={18}
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
                </SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="site"
                    label="Site"
                    errors={errors}
                    register={register}
                  />

                  <InputCustom
                    name="observacao"
                    label="Observação"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <Divider my="6" borderColor="gray.600" />
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  {/* <InputCustom
                    name="endereco.uf"
                    label="UF"
                    errors={errors}
                    register={register}
                  /> */}

                  <SelectCustom
                    label="UF"
                    placeholder="Selecione a opção"
                    name="endereco.uf"
                    register={register}
                    options={states}
                    errorMessage={errors.endereco?.uf?.message}
                    chave="value"
                    onChange={handleChange}
                  />

                  <SelectCustom
                    label="Cidade"
                    placeholder="Selecione a opção"
                    name="endereco.cidade"
                    register={register}
                    options={selectedState.map((city) => {
                      city.id = city.codigo;
                      return city;
                    })}
                    errorMessage={errors.endereco?.cidade?.message}
                    chave="nome"
                    // onChange={handleChangeCity}
                  />

                  <InputCustom
                    name="endereco.cep"
                    label="CEP"
                    errors={errors}
                    control={control}
                    masks={cepMask}
                    maxLength={9}
                  />
                </SimpleGrid>
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
                  <InputCustom
                    name="endereco.numero"
                    label="Número"
                    errors={errors}
                    register={register}
                  />
                </SimpleGrid>
                <SimpleGrid
                  minChildWidth="240px"
                  spacing="6"
                  w="100%"
                ></SimpleGrid>
                <SimpleGrid minChildWidth="240px" spacing="6" w="100%">
                  <InputCustom
                    name="endereco.bairro"
                    label="Bairro"
                    errors={errors}
                    register={register}
                  />
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
                        history.push("/listar/transportadora");
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
