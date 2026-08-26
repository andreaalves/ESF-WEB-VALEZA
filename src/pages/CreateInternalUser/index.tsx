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
  Spinner,
  Checkbox,
  Badge,
} from '@chakra-ui/react';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { Header } from '../../components/Header';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useHistory, useParams } from 'react-router-dom';
import { InputCustom } from '../../components/InputCustom/InputCustom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import api from '../../service/api';
import { SelectCustom } from '../../components/selectCustom/SelectCustom';
import { useAuth } from '../../context/AuthContext';

// Tela de cadastro de usuários "internos" (Admin, Motorista, e demais perfis
// que não são vendedor comum) — só é alcançável por ROLE_ADMIN (gate na rota).
//
// Usa o CRUD dedicado /usuarios (GET/POST/PUT/DELETE), separado do
// /colaborador antigo, que continua sendo o caminho de vendedor (CreateUser).
// O backend bloqueia (403) tentativa de editar/excluir por aqui um usuário
// com origem ERP — por isso o badge de origem abaixo usa o valor real vindo
// da API, e o Salvar fica desabilitado se cair nesse caso (não deveria
// acontecer via navegação normal, já que a lista só linka usuário ESF, mas a
// URL é digitável à mão).
type IFormInputs = {
  passwordConfirm: string;
  usuario: {
    name: string;
    email: string;
    password: string;
    role: string;
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
  // Mesma armadilha documentada em CreateUser: o GET /usuarios-filial/:id
  // devolve o empresa_id aninhado em `empresas`, não na raiz do vínculo.
  empresas: {
    empresa_id: string;
  };
};

// Perfis que este cadastro cobre. ROLE_SELLER fica de fora de propósito —
// vendedor "comum" continua sendo cadastrado só pela sincronização com o ERP.
// Um único select pro usuário (Função e Tipo pareciam pergunta duplicada na
// tela) — `tipo_usuario` vai junto, derivado da função escolhida.
const TIPOS_USUARIO = [
  { id: 'ROLE_ADMIN', value: 'Administrador' },
  { id: 'ROLE_USER', value: 'Motorista' },
  { id: 'ROLE_SUPERVISOR', value: 'Supervisor' },
  { id: 'ROLE_COORDINATOR', value: 'Coordenador' },
  { id: 'ROLE_MANAGER', value: 'Gerente' },
  { id: 'ROLE_MANAGER_REGIONAL', value: 'Gerente Regional' },
  { id: 'ROLE_MANAGER_NATIONAL', value: 'Gerente Nacional' },
];

// tipo_usuario é um enum mais simples que ROLE (VENDEDOR|MOTORISTA|ADMIN) —
// sem valor próprio pra hierarquia de venda (Supervisor/Coordenador/Gerente/
// etc), então esses mapeiam pra VENDEDOR mesmo sendo cadastrados manualmente
// aqui (só ADMIN e MOTORISTA têm valor dedicado).
function tipoUsuarioFromRole(role: string): 'ADMIN' | 'MOTORISTA' | 'VENDEDOR' {
  if (role === 'ROLE_ADMIN') return 'ADMIN';
  if (role === 'ROLE_USER') return 'MOTORISTA';
  return 'VENDEDOR';
}

// A API passou a devolver erro de validação como { message, errors: [{field, message}] }
// (zod) — sem isso, o toast só mostrava o texto genérico "Erro de validação nos dados
// enviados.", escondendo qual campo exatamente falhou (ex.: senha curta demais).
function extrairMensagemErro(error: any): string {
  const data = error?.response?.data;
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e: any) => e.message).join(' ');
  }
  return data?.message || data?.error || 'Erro ao acessar o sistema';
}

export const CreateInternalUser: React.FC = () => {
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
    },
    [['password', 'password']]
  );

  const { register, handleSubmit, formState, reset, setValue } = useForm({
    resolver: yupResolver(schema),
  });

  const { errors } = formState;
  const toast = useToast();
  const history = useHistory();
  const { user } = useAuth();

  const params = useParams<IParams>();

  const [isLoading, setIsLoading] = useState(!!params.id);
  const [filiais, setFiliais] = useState<IEmpresa[]>([]);
  const [vinculos, setVinculos] = useState<IVinculoFilial[]>([]);
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState<string[]>(
    []
  );
  const [origemCadastro, setOrigemCadastro] = useState<string | undefined>(
    undefined
  );
  // Edição bloqueada só no caso (não navegável pela UI normal) de alguém
  // digitar na URL o id de um usuário sincronizado do ERP — o backend
  // rejeita com 403, então nem deixamos tentar submeter.
  const edicaoBloqueadaPorOrigemErp =
    !!params.id && origemCadastro === 'ERP';

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

  useEffect(() => {
    if (!params.id) return;

    api
      .get(`/api-essencial/v1/usuarios-filial/${params.id}`)
      .then((response) => {
        const lista = (response.data || []) as IVinculoFilial[];
        setVinculos(lista);
        setFiliaisSelecionadas(lista.map((v) => v.empresas.empresa_id));
      })
      .catch(() => {});
  }, [params.id]);

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
          `/api-essencial/v1/usuarios/${params.id}`
        );

        setValue('usuario.name', response.data.name);
        setValue('usuario.email', response.data.email);
        setValue('usuario.role', response.data.role);
        setOrigemCadastro(response.data.origem_cadastro);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar usuário',
          description: extrairMensagemErro(error),
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    }

    getData();
  }, [params.id, setValue, toast]);

  const onSubmit: SubmitHandler<IFormInputs> = async (data) => {
    const tipo_usuario = tipoUsuarioFromRole(data.usuario.role);

    if (params.id) {
      try {
        const payload: Record<string, unknown> = {
          name: data.usuario.name,
          email: data.usuario.email,
          role: data.usuario.role,
          tipo_usuario,
        };
        if (data.usuario.password) payload.password = data.usuario.password;

        await api.put(`/api-essencial/v1/usuarios/${params.id}`, payload);

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
              usuario_id: params.id,
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
        history.push('/listar/usuario');
      } catch (error: any) {
        toast({
          title: 'Atenção !!',
          description: extrairMensagemErro(error),
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      }

      return;
    }

    try {
      const response = await api.post('/api-essencial/v1/usuarios', {
        name: data.usuario.name,
        email: data.usuario.email,
        password: data.usuario.password,
        role: data.usuario.role,
        tipo_usuario,
        empresa_id: user?.empresa?.id,
      });

      const novoUsuarioId = response.data?.usuario_id;

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
      history.push('/listar/usuario');
    } catch (error: any) {
      toast({
        title: 'Atenção !!',
        description: extrairMensagemErro(error),
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const onInvalid = (formErrors: any) => {
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
            <Heading size="md" fontWeight="normal">
              CADASTRO DE USUÁRIOS
            </Heading>

            <Divider my="6" borderColor="gray.600" />
            {isLoading ? (
              <Flex justify="center">
                <Spinner color="white" />
              </Flex>
            ) : (
              <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
                <VStack spacing="8">
                  {edicaoBloqueadaPorOrigemErp && (
                    <Badge
                      colorScheme="red"
                      px={3}
                      py={2}
                      borderRadius="md"
                      display="block"
                      w="100%"
                      whiteSpace="normal"
                    >
                      Este usuário foi criado pela sincronização com o ERP e
                      não pode ser editado por aqui — use a tela de Vendedores.
                    </Badge>
                  )}
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
                      label="Tipo de usuário"
                      placeholder="Selecione a opção"
                      name="usuario.role"
                      register={register}
                      options={TIPOS_USUARIO}
                      errorMessage={errors.usuario?.role?.message}
                      chave="value"
                    />
                  </SimpleGrid>

                  <Box w="100%">
                    <Text as="p" mb={2}>
                      Origem do cadastro:
                    </Text>
                    <Badge colorScheme="orange" px={2} py={1} borderRadius="md">
                      {origemCadastro === 'ERP'
                        ? 'ERP (TOTVS)'
                        : 'ESF (cadastro manual)'}
                    </Badge>
                  </Box>

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
                          history.push('/listar/usuario');
                        }}
                      >
                        VOLTAR
                      </Button>
                      <Button
                        fontSize="md"
                        colorScheme="orange"
                        type="submit"
                        isLoading={formState.isSubmitting}
                        isDisabled={edicaoBloqueadaPorOrigemErp}
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
