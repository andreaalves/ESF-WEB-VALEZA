import { useEffect, useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import {
  ConfiguracaoEmail,
  configuracaoDaEmpresa,
  DadosConfiguracaoEmail,
  ehConfiguracaoDeExemplo,
  listarConfiguracoesEmail,
  mensagemDoErroDeEmail,
  PORTA_PADRAO,
  salvarConfiguracaoEmail,
  senhaObrigatoria,
} from '../../service/parametrizacaoEmail';

export interface EmpresaDoEmail {
  empresa_id: string;
  fantasia?: string | null;
  razao_social?: string | null;
  filial?: string | null;
}

interface ConfiguracaoEmailModalProps {
  empresas: EmpresaDoEmail[];
  onClose: () => void;
}

// Texto SEMPRE na ponta baixa da escala gray.* (gray.50 principal, gray.400
// secundário): o tema claro inverte os tokens.
const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <Text mb={1} fontSize="10px" color="gray.400" fontWeight="700" letterSpacing="wider">
    {children}
  </Text>
);

const nomeDaEmpresa = (empresa: EmpresaDoEmail) =>
  `${empresa.fantasia || empresa.razao_social || 'Empresa'}${
    empresa.filial ? ` (${empresa.filial})` : ''
  }`;

// Conta de e-mail (SMTP) usada pela API para enviar o link de "Esqueci minha
// senha" e o PDF do pedido. A linha GERAL vale para toda empresa que não tiver
// uma conta própria.
//
// Montado só enquanto aberto (a página renderiza condicionalmente): fechar
// descarta o que foi digitado.
//
// Não há botão de excluir de propósito: a exclusão da API é lógica, a listagem
// devolve a linha excluída sem marcá-la e, para uma empresa, a linha antiga
// continua ocupando a chave única — criar de novo falharia.
export function ConfiguracaoEmailModal({ empresas, onClose }: ConfiguracaoEmailModalProps) {
  const { register, handleSubmit, reset, formState } = useForm<DadosConfiguracaoEmail>({
    defaultValues: { host: '', porta: PORTA_PADRAO, usuario: '', senha: '', descricao: '' },
  });
  const { errors } = formState;
  const toast = useToast();

  const [lista, setLista] = useState<ConfiguracaoEmail[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState('');
  // '' = configuração geral.
  const [empresaId, setEmpresaId] = useState('');
  const [senhaVisivel, setSenhaVisivel] = useState(false);
  const [erro, setErro] = useState('');

  const atual = configuracaoDaEmpresa(lista, empresaId || null);
  const deExemplo = ehConfiguracaoDeExemplo(atual);
  const exigeSenha = senhaObrigatoria(atual);

  useEffect(() => {
    let ativo = true;

    listarConfiguracoesEmail()
      .then((dados) => {
        if (ativo) setLista(dados);
      })
      .catch(() => {
        if (ativo) setErroCarga('Não foi possível carregar a configuração de e-mail.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, []);

  // Trocar de empresa (ou terminar de carregar) repõe o formulário com o que
  // está salvo para ela. A senha nunca vem da API, então começa sempre vazia.
  useEffect(() => {
    setErro('');
    reset({
      host: atual?.host || '',
      porta: atual?.porta || PORTA_PADRAO,
      usuario: deExemplo ? '' : atual?.usuario || '',
      senha: '',
      descricao: atual?.descricao || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual?.parametrizacao_email_id, empresaId, carregando]);

  const handleSalvar: SubmitHandler<DadosConfiguracaoEmail> = async (values) => {
    setErro('');

    try {
      await salvarConfiguracaoEmail(atual?.parametrizacao_email_id, values, empresaId || null);
    } catch (error) {
      setErro(
        mensagemDoErroDeEmail(error, 'Não foi possível salvar a configuração. Tente novamente.')
      );
      return;
    }

    toast({
      title: 'Configuração de e-mail salva',
      description: 'Os próximos envios já usam esta conta.',
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
    onClose();
  };

  const salvando = formState.isSubmitting;

  return (
    <Modal isOpen onClose={onClose} size="lg" isCentered closeOnOverlayClick={!salvando}>
      <ModalOverlay />
      <ModalContent bg="gray.900" color="gray.50" borderRadius="xl" overflow="hidden">
        <ModalHeader px={{ base: 5, md: 6 }} pt={5} pb={3}>
          <Text fontSize="xs" color="gray.400" letterSpacing="wider">
            PARAMETRIZAÇÃO
          </Text>
          <Text mt={1} pr={10} fontSize="lg" lineHeight="shorter">
            Conta de envio de e-mail
          </Text>
        </ModalHeader>
        <ModalCloseButton isDisabled={salvando} />

        <form onSubmit={handleSubmit(handleSalvar)} autoComplete="off">
          <ModalBody px={{ base: 5, md: 6 }} pb={2}>
            {carregando ? (
              <Flex align="center" justify="center" py={10}>
                <Spinner color="orange.200" />
              </Flex>
            ) : erroCarga ? (
              <Text fontSize="sm" color="red.300" py={6}>
                {erroCarga}
              </Text>
            ) : (
              <Stack spacing={4}>
                <Text fontSize="sm" color="gray.400">
                  É por esta conta que saem o link de "Esqueci minha senha" e o PDF do pedido.
                </Text>

                <Box>
                  <Rotulo>VALE PARA</Rotulo>
                  <Select
                    size="sm"
                    borderRadius="md"
                    isDisabled={salvando}
                    value={empresaId}
                    onChange={(evento) => setEmpresaId(evento.target.value)}
                  >
                    <option value="">Todas as empresas (geral)</option>
                    {empresas.map((empresa) => (
                      <option key={empresa.empresa_id} value={empresa.empresa_id}>
                        {nomeDaEmpresa(empresa)}
                      </option>
                    ))}
                  </Select>
                  {!!empresaId && !atual && (
                    <Text mt={2} fontSize="xs" color="gray.400">
                      Esta empresa não tem conta própria e usa a geral. Preencha abaixo só se
                      ela precisar enviar por outra conta.
                    </Text>
                  )}
                </Box>

                {deExemplo && (
                  <Box
                    bg="gray.800"
                    borderWidth="1px"
                    borderColor="orange.300"
                    borderRadius="md"
                    px={3}
                    py={2.5}
                  >
                    <Text fontSize="sm" color="orange.200">
                      A conta gravada hoje é a de exemplo da instalação. Nenhum e-mail é
                      enviado até uma conta de verdade ser salva.
                    </Text>
                  </Box>
                )}

                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <FormControl isInvalid={!!errors.host} gridColumn={{ md: 'span 2' }}>
                    <Rotulo>SERVIDOR SMTP</Rotulo>
                    <Input
                      size="sm"
                      borderRadius="md"
                      placeholder="smtp.office365.com"
                      maxLength={255}
                      {...register('host', {
                        validate: (valor) => !!valor.trim() || 'Informe o servidor',
                      })}
                    />
                    <FormErrorMessage>{errors.host?.message}</FormErrorMessage>
                  </FormControl>

                  <FormControl isInvalid={!!errors.porta}>
                    <Rotulo>PORTA</Rotulo>
                    <Input
                      size="sm"
                      borderRadius="md"
                      inputMode="numeric"
                      maxLength={5}
                      {...register('porta', {
                        validate: (valor) =>
                          /^\d{1,5}$/.test(valor.trim()) || 'Informe a porta (só números)',
                      })}
                    />
                    <FormErrorMessage>{errors.porta?.message}</FormErrorMessage>
                  </FormControl>
                </SimpleGrid>

                <FormControl isInvalid={!!errors.usuario}>
                  <Rotulo>USUÁRIO (E-MAIL DA CONTA)</Rotulo>
                  <Input
                    size="sm"
                    borderRadius="md"
                    placeholder="envio@suaempresa.com.br"
                    maxLength={255}
                    autoComplete="off"
                    {...register('usuario', {
                      validate: (valor) => !!valor.trim() || 'Informe o usuário da conta',
                    })}
                  />
                  <FormErrorMessage>{errors.usuario?.message}</FormErrorMessage>
                </FormControl>

                <FormControl isInvalid={!!errors.senha}>
                  <Rotulo>SENHA DA CONTA</Rotulo>
                  <InputGroup size="sm">
                    <Input
                      borderRadius="md"
                      type={senhaVisivel ? 'text' : 'password'}
                      maxLength={255}
                      // "new-password" impede o navegador de preencher com a senha
                      // de login de quem está configurando.
                      autoComplete="new-password"
                      placeholder={exigeSenha ? '' : 'Em branco mantém a senha atual'}
                      {...register('senha', {
                        validate: (valor) =>
                          !exigeSenha || !!valor || 'Informe a senha da conta',
                      })}
                    />
                    <InputRightElement>
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label={senhaVisivel ? 'Ocultar senha' : 'Mostrar senha'}
                        icon={senhaVisivel ? <FiEyeOff /> : <FiEye />}
                        onClick={() => setSenhaVisivel((visivel) => !visivel)}
                      />
                    </InputRightElement>
                  </InputGroup>
                  <FormErrorMessage>{errors.senha?.message}</FormErrorMessage>
                </FormControl>

                <FormControl>
                  <Rotulo>DESCRIÇÃO (OPCIONAL)</Rotulo>
                  <Input
                    size="sm"
                    borderRadius="md"
                    maxLength={255}
                    {...register('descricao')}
                  />
                </FormControl>

                {!!erro && (
                  <Text fontSize="sm" color="red.300">
                    {erro}
                  </Text>
                )}
              </Stack>
            )}
          </ModalBody>

          <ModalFooter px={{ base: 5, md: 6 }} py={4}>
            <HStack spacing={3}>
              <Button size="sm" variant="ghost" onClick={onClose} isDisabled={salvando}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                colorScheme="orange"
                isDisabled={carregando || !!erroCarga}
                isLoading={salvando}
                loadingText="Salvando"
              >
                Salvar
              </Button>
            </HStack>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
