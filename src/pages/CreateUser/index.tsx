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
  Checkbox,
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

type IEmpresa = {
  empresa_id: string;
  fantasia?: string;
  razao_social?: string;
  filial?: string;
  excluido: boolean;
};

type IVinculoFilial = {
  usuario_filial_id: string;
  // GET /usuarios-filial/:usuario_id devolve empresa_id aninhado dentro de
  // `empresas`, não na raiz do vínculo — ler `v.empresa_id` direto sempre dá
  // undefined, o que fazia o checklist voltar desmarcado a cada reload e, pior,
  // fazia o reconciliador do submit tratar TODO vínculo existente como "para
  // remover" (indevidamente apagando o acesso salvo) sempre que o usuário não
  // re-marcasse manualmente a filial antes de salvar de novo.
  empresas: {
    empresa_id: string;
  };
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

        password: yup
          .string()
          .notRequired()
          .default('')
          .test(
            'senha-forte',
            'A senha deve ter no mínimo 8 caracteres, com letra e número.',
            (value) =>
              !value ||
              (value.length >= 8 &&
                /[A-Za-z]/.test(value) &&
                /[0-9]/.test(value))
          ),
        role: yup.string().required('Campo obrigatório.'),
      }),

      passwordConfirm: yup
        .string()
        .oneOf([yup.ref('usuario.password'), null], 'Senhas não são iguais'),
      // .nullable() é obrigatório aqui: o backend devolve validade_licenca
      // como null quando o vendedor nunca teve essa data preenchida, e o
      // setValue joga esse null direto pro form — sem isso, yup rejeitava
      // (string() não aceita null por padrão) e travava o Salvar em
      // silêncio pra qualquer vendedor sem validade de licença.
      validadeLicenca: yup.string().nullable().notRequired(),
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
  const [filiais, setFiliais] = useState<IEmpresa[]>([]);
  const [usuarioId, setUsuarioId] = useState('');
  const [vinculos, setVinculos] = useState<IVinculoFilial[]>([]);
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<string[]>(
    []
  );

  // Lista de todas as filiais pra oferecer no checklist.
  useEffect(() => {
    api
      .get('/empresas')
      .then((response) => {
        const ativas = (response.data || []).filter(
          (e: IEmpresa) => !e.excluido
        );
        setFiliais(ativas);
      })
      .catch(() => {});
  }, []);

  // Vínculos já concedidos a este usuário (não ao colaborador — usuario_id e
  // colaborador_id/params.id são entidades diferentes). Só busca depois que
  // o usuario_id real chega via GET /colaborador/:id, abaixo.
  useEffect(() => {
    if (!usuarioId) return;

    api
      .get(`/api-essencial/v1/usuarios-filial/${usuarioId}`)
      .then((response) => {
        const lista = (response.data || []) as IVinculoFilial[];
        setVinculos(lista);
        setFiliaisSelecionadas(lista.map((v) => v.empresas.empresa_id));
      })
      .catch(() => {});
  }, [usuarioId]);

  const toggleFilial = (empresaId: string) => {
    setFiliaisSelecionadas((prev) =>
      prev.includes(empresaId)
        ? prev.filter((id) => id !== empresaId)
        : [...prev, empresaId]
    );
  };

  useEffect(() => {
    if (!params.id) return;

    async function getData() {
      try {
        const response = await api.get(
          `/api-essencial/v1/colaborador/${params.id}`
        );

        // setValue('usuario', response.data.usuarios) (objeto inteiro de uma
        // vez) não estava refletindo nos inputs "usuario.name"/"usuario.role"
        // — setando cada campo pelo path exato resolve.
        setValue('usuario.name', response.data.usuarios?.name);
        setValue('usuario.email', response.data.usuarios?.email);
        setValue('usuario.role', response.data.usuarios?.role);
        // Sem input visível: o PUT /colaborador/:id ignora o :id da URL e
        // decide qual registro alterar pelo usuario.usuario_id do body —
        // sem isso no form, o salvar quebra ou altera o colaborador errado.
        setValue('usuario.usuario_id', response.data.usuarios?.usuario_id);
        setUsuarioId(response.data.usuarios?.usuario_id || '');
        setValue('regiao', response.data.regiao);
        // API devolve snake_case (validade_licenca/informacao_adicional),
        // não validadeLicenca/informacaoAdicional — vinham sempre vazios.
        setValue('validadeLicenca', response.data.validade_licenca);
        setValue('informacaoAdicional', response.data.informacao_adicional);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar vendedor',
          description:
            error?.response?.data?.message || 'Tente novamente daqui alguns minutos',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    }

    getData();
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

        // Sem PUT no /usuarios-filial — reconcilia vínculo por vínculo: cria
        // os marcados que ainda não existiam, revoga os que existiam e foram
        // desmarcados.
        const vinculadas = vinculos.map((v) => v.empresas.empresa_id);
        const paraAdicionar = filiaisSelecionadas.filter(
          (id) => !vinculadas.includes(id)
        );
        const paraRemover = vinculos.filter(
          (v) => !filiaisSelecionadas.includes(v.empresas.empresa_id)
        );

        const resultados = await Promise.allSettled([
          ...paraAdicionar.map((empresa_id) =>
            api.post('/api-essencial/v1/usuarios-filial', {
              usuario_id: usuarioId,
              empresa_id,
            })
          ),
          ...paraRemover.map((v) =>
            api.delete(
              `/api-essencial/v1/usuarios-filial/${v.usuario_filial_id}`
            )
          ),
        ]);
        const falhas = resultados.filter((r) => r.status === 'rejected');
        if (falhas.length > 0) {
          toast({
            title: 'Atenção',
            description:
              'Cadastro salvo, mas houve erro ao atualizar as filiais com acesso.',
            status: 'warning',
            duration: 4000,
            isClosable: true,
          });
        }

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
        // Erro do axios vem em error.response.data, não error.data — o jeito
        // antigo (error.data) nunca era verdadeiro e engolia o erro sem
        // mostrar nada pro usuário.
        toast({
          title: 'Atenção !!',
          description:
            error?.response?.data?.message ||
            error?.response?.data?.error ||
            'Erro ao acessar o sistema',
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      }

      return;
    }

    try {
      const response = await api.post('/api-essencial/v1/colaborador', data);

      // Mesma reconciliação do fluxo de edição, mas aqui não há vínculos
      // prévios — só cria os que foram marcados, usando o usuario_id que
      // acabou de ser gerado pelo cadastro.
      const novoUsuarioId =
        response.data?.usuarios?.usuario_id ||
        response.data?.usuario?.usuario_id ||
        response.data?.usuario_id;

      if (novoUsuarioId && filiaisSelecionadas.length > 0) {
        const resultados = await Promise.allSettled(
          filiaisSelecionadas.map((empresa_id) =>
            api.post('/api-essencial/v1/usuarios-filial', {
              usuario_id: novoUsuarioId,
              empresa_id,
            })
          )
        );
        const falhas = resultados.filter((r) => r.status === 'rejected');
        if (falhas.length > 0) {
          toast({
            title: 'Atenção',
            description:
              'Cadastro salvo, mas houve erro ao vincular as filiais com acesso.',
            status: 'warning',
            duration: 4000,
            isClosable: true,
          });
        }
      }

      toast({
        title: 'Cadastro realizado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      reset();
      history.push('/listar/vendedor');
    } catch (error: any) {
      toast({
        title: 'Atenção !!',
        description:
          error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Erro ao acessar o sistema',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  // Sem isso, uma falha de validação fazia o SALVAR não dar nenhum feedback
  // visível (nenhum toast, nenhum erro óbvio) — parecia que o botão não
  // fazia nada.
  const onInvalid = (formErrors: any) => {
    // Coleta recursiva: os campos com erro real variam (pode ser um que a
    // gente não previu), então em vez de checar caminho por caminho varremos
    // o objeto inteiro atrás de qualquer `.message`.
    const mensagens: string[] = [];
    const coletar = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (typeof node.message === 'string') mensagens.push(node.message);
      Object.keys(node).forEach((key) => {
        if (key === 'message' || key === 'type' || key === 'ref') return;
        coletar(node[key]);
      });
    };
    coletar(formErrors);

    // eslint-disable-next-line no-console
    console.error('Erros de validação do formulário:', formErrors);

    toast({
      title: 'Verifique os campos do formulário',
      description: mensagens.length
        ? mensagens.join(' ')
        : 'Erro de validação não identificado — veja o console (F12) para detalhes.',
      status: 'error',
      duration: 6000,
      isClosable: true,
    });
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
              <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
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

                  <Box w="100%">
                    <Text as="p" mb={2}>
                      Filiais com acesso:
                    </Text>
                    {filiais.length > 0 ? (
                      <VStack
                        align="start"
                        spacing={3}
                        borderRadius="lg"
                        p={4}
                        bg="gray.700"
                      >
                        {filiais.map((empresa) => (
                          <Checkbox
                            key={empresa.empresa_id}
                            isChecked={filiaisSelecionadas.includes(
                              empresa.empresa_id
                            )}
                            onChange={() => toggleFilial(empresa.empresa_id)}
                            colorScheme="orange"
                          >
                            {empresa.fantasia || empresa.razao_social}
                            {empresa.filial ? ` (${empresa.filial})` : ''}
                          </Checkbox>
                        ))}
                      </VStack>
                    ) : (
                      <Text fontSize="sm" color="gray.50">
                        Nenhuma empresa cadastrada.
                      </Text>
                    )}
                  </Box>

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
