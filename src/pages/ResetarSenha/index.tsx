import { useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { SubmitHandler, useForm } from 'react-hook-form';
import { Box, Button, Flex, Image, Stack, Text } from '@chakra-ui/react';
import { useAuth } from '../../context/AuthContext';
import { CampoSenha } from '../../components/CampoSenha';
import { EsqueciSenhaModal } from '../../components/EsqueciSenhaModal';
import { ThemeToggle } from '../../components/ThemeToggle';
import {
  ehLinkDeSenhaInvalido,
  mensagemDoErroDeSenha,
  redefinirSenha,
  TAMANHO_MINIMO_SENHA,
} from '../../service/senha';
import logo from '../../assets/logo-arvore.png';

type IData = {
  novaSenha: string;
  confirmacao: string;
};

// Destino do link do e-mail de recuperação: /resetar-senha?token=...
//
// O caminho e o nome do parâmetro NÃO são escolha desta web: quem monta o link
// é o ESF-API (`${FRONTEND_URL_ADMIN}/resetar-senha?token=`). Renomear a rota
// aqui quebra todo e-mail que o backend mandar.
export const ResetarSenha = () => {
  const { search } = useLocation();
  const token = new URLSearchParams(search).get('token') || '';

  const { register, handleSubmit, getValues, formState } = useForm<IData>();
  const { errors } = formState;
  const { user } = useAuth();
  const history = useHistory();

  const [visivel, setVisivel] = useState(false);
  const [erro, setErro] = useState('');
  const [linkInvalido, setLinkInvalido] = useState(!token);
  const [concluido, setConcluido] = useState(false);
  const [pedindoNovoLink, setPedindoNovoLink] = useState(false);

  const handleRedefinir: SubmitHandler<IData> = async (values) => {
    setErro('');

    try {
      await redefinirSenha(token, values.novaSenha, values.confirmacao);
      setConcluido(true);
    } catch (error) {
      if (ehLinkDeSenhaInvalido(error)) {
        setLinkInvalido(true);
        return;
      }

      setErro(
        mensagemDoErroDeSenha(
          error,
          'Não foi possível salvar a nova senha. Tente novamente.'
        )
      );
    }
  };

  // Quem abre o link já logado continua logado (a troca não derruba a sessão);
  // em "/" a rota de login o devolve sozinha para /home.
  const sair = () => history.push('/');

  const botaoPrincipal = {
    w: '100%',
    mt: '6',
    bg: 'orange.200',
    color: 'white',
    _hover: { bg: '#e56b16' },
  };

  return (
    <Flex w="100vw" h="100vh" align="center" justify="center">
      <ThemeToggle flutuante size="md" />
      <Box width="100%" maxWidth={460}>
        <Flex bg="gray.800" p="8" flexDir="column">
          <Box mb="4">
            <Image mx="auto" boxSize="100px" src={logo} alt="Logo" objectFit="contain" />
          </Box>

          {concluido && (
            <>
              <Text mb="4" fontSize="2xl" fontWeight="bold" align="center">
                SENHA REDEFINIDA
              </Text>
              <Text align="center">Sua nova senha já está valendo.</Text>
              <Button {...botaoPrincipal} onClick={sair}>
                {user ? 'Voltar para o sistema' : 'Ir para o login'}
              </Button>
            </>
          )}

          {!concluido && linkInvalido && (
            <>
              <Text mb="4" fontSize="2xl" fontWeight="bold" align="center">
                LINK INVÁLIDO OU EXPIRADO
              </Text>
              <Text align="center">
                O link de recuperação vale por 30 minutos e só pode ser usado uma vez.
                Peça um novo para continuar.
              </Text>
              <Button {...botaoPrincipal} onClick={() => setPedindoNovoLink(true)}>
                Pedir novo link
              </Button>
            </>
          )}

          {!concluido && !linkInvalido && (
            <>
              <Text mb="4" fontSize="2xl" fontWeight="bold" align="center">
                NOVA SENHA
              </Text>
              <form onSubmit={handleSubmit(handleRedefinir)}>
                <Stack spacing="2">
                  <CampoSenha
                    id="nova-senha"
                    rotulo="Nova senha"
                    autoComplete="new-password"
                    autoFocus
                    visivel={visivel}
                    aoAlternarVisibilidade={() => setVisivel((v) => !v)}
                    registro={register('novaSenha', {
                      required: 'Informe a nova senha',
                      minLength: {
                        value: TAMANHO_MINIMO_SENHA,
                        message: `A senha deve ter no mínimo ${TAMANHO_MINIMO_SENHA} caracteres`,
                      },
                    })}
                    erro={errors.novaSenha?.message}
                  />
                  <CampoSenha
                    id="confirmacao-nova-senha"
                    rotulo="Confirmar nova senha"
                    autoComplete="new-password"
                    visivel={visivel}
                    registro={register('confirmacao', {
                      required: 'Repita a nova senha',
                      validate: (valor) =>
                        valor === getValues('novaSenha') || 'As senhas não são iguais',
                    })}
                    erro={errors.confirmacao?.message}
                  />
                </Stack>
                {!!erro && (
                  <Text color="red" fontSize="sm">
                    {erro}
                  </Text>
                )}
                <Button
                  {...botaoPrincipal}
                  type="submit"
                  isLoading={formState.isSubmitting}
                >
                  Salvar nova senha
                </Button>
              </form>
            </>
          )}

          {!concluido && (
            <Button
              mt="4"
              variant="link"
              color="gray.400"
              fontWeight="normal"
              fontSize="sm"
              onClick={sair}
            >
              {user ? 'Voltar para o sistema' : 'Voltar para o login'}
            </Button>
          )}
        </Flex>
      </Box>

      {pedindoNovoLink && (
        <EsqueciSenhaModal onClose={() => setPedindoNovoLink(false)} />
      )}
    </Flex>
  );
};
