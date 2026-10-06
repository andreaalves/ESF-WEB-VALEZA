import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { SubmitHandler, useForm, FieldError } from 'react-hook-form';
import {
  Text,
  Button,
  Flex,
  Input,
  Stack,
  FormLabel,
  FormControl,
  useToast,
  Image,
  Box,
  Checkbox,
  IconButton,
  InputGroup,
  InputRightElement,
} from '@chakra-ui/react';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import { EsqueciSenhaModal } from '../../components/EsqueciSenhaModal';
import logo from '../../assets/logo-arvore.png';

type IData = {
  email: string;
  password: string;
  errors: FieldError;
};

// "Lembrar meu acesso": guardamos só o E-MAIL. A senha fica a cargo do
// gerenciador de senhas do navegador (autoComplete abaixo), que a guarda
// criptografada — senha em texto puro no localStorage ficaria legível por
// qualquer um que abrisse o DevTools. A chave fica fora das `@Aplication:*`
// que o logout apaga, então o e-mail continua lembrado depois de sair.
const CHAVE_EMAIL_LEMBRADO = '@Aplication:emailLembrado';

const lerEmailLembrado = (): string => {
  try {
    return localStorage.getItem(CHAVE_EMAIL_LEMBRADO) || '';
  } catch {
    return '';
  }
};

const gravarEmailLembrado = (email: string | null) => {
  try {
    if (email) localStorage.setItem(CHAVE_EMAIL_LEMBRADO, email);
    else localStorage.removeItem(CHAVE_EMAIL_LEMBRADO);
  } catch {
    // Storage bloqueado (aba anônima etc.): só não lembra — o login segue.
  }
};

export const Login = () => {
  const [emailLembrado] = useState(lerEmailLembrado);
  const { register, handleSubmit, getValues, formState } = useForm({
    defaultValues: { email: emailLembrado, password: '' },
  });
  const { errors } = formState;
  const toast = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [lembrar, setLembrar] = useState(!!emailLembrado);
  // null = fechado; string = aberto, já com o e-mail que estava digitado aqui.
  const [emailParaRecuperar, setEmailParaRecuperar] = useState<string | null>(null);

  const { signIn } = useAuth();

  const history = useHistory();

  const handleSignIn: SubmitHandler<IData> = async (values) => {
    try {
      await signIn({
        email: values.email,
        password: values.password,
      });

      gravarEmailLembrado(lembrar ? String(values.email).trim() : null);
      history.push('/home');
    } catch (error) {
      // const errorMessage = error.response.data.message;

      if (error) {
        return toast({
          title: 'Acesso Negado',
          description: ``,
          status: 'error',
          duration: 3000,
          isClosable: true,
        });
      }
    }
  };

  return (
    <Flex w="100vw" h="100vh" align="center" justify="center">
      <ThemeToggle flutuante size="md" />
      <Box width="100%" maxWidth={460}>
        <Flex bg="gray.800" p="8" flexDir="column">
          <Box mb="4">
            <Image
              mx="auto"
              boxSize="100px"
              src={logo}
              alt="Logo"
              objectFit="contain"
            />
          </Box>
          <Text mb="4" fontSize="2xl" fontWeight="bold" align="center">
            LOGIN
          </Text>
          <form onSubmit={handleSubmit(handleSignIn)}>
            <Stack spacing="4">
              <FormControl>
                <FormLabel htmlFor="email">Email</FormLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  bgColor="gray.900"
                  variant="filled"
                  _hover={{
                    bgColor: 'gray.700',
                  }}
                  {...register('email', { required: true })}
                />
                <Text color="red" mt="2" fontSize="sm">
                  {errors.email && 'Email Obrigatório'}
                </Text>
              </FormControl>
              <FormControl>
                <FormLabel htmlFor="password">Senha</FormLabel>
                <InputGroup>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    // E-mail já lembrado: o cursor vai direto para a senha.
                    autoFocus={!!emailLembrado}
                    bgColor="gray.900"
                    variant="filled"
                    _hover={{
                      bgColor: 'gray.700',
                    }}
                    {...register('password', { required: true })}
                  />
                  <InputRightElement>
                    <IconButton
                      type="button"
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      icon={showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                      onClick={() => setShowPassword((v) => !v)}
                      size="sm"
                      variant="ghost"
                      _hover={{ bg: 'gray.700' }}
                      _active={{ bg: 'gray.600' }}
                      tabIndex={-1}
                    />
                  </InputRightElement>
                </InputGroup>
                <Text color="red" mt="2" fontSize="sm">
                  {errors.password && 'Senha Obrigatória'}
                </Text>
              </FormControl>
              <Checkbox
                isChecked={lembrar}
                onChange={(e) => setLembrar(e.target.checked)}
                colorScheme="orange"
              >
                Lembrar meu acesso
              </Checkbox>
            </Stack>
            <Button
              w="100%"
              type="submit"
              mt="6"
              bg="orange.200"
              color="white"
              _hover={{
                bg: '#e56b16',
              }}
              isLoading={formState.isSubmitting}
            >
              Entrar
            </Button>
          </form>
          <Button
            mt="4"
            variant="link"
            color="gray.400"
            fontWeight="normal"
            fontSize="sm"
            onClick={() => setEmailParaRecuperar(getValues('email') || '')}
          >
            Esqueci minha senha
          </Button>
        </Flex>
      </Box>

      {/* Fora do <form> de propósito: o submit do modal subiria pela árvore do
          React e dispararia o login junto. */}
      {emailParaRecuperar !== null && (
        <EsqueciSenhaModal
          emailInicial={emailParaRecuperar}
          onClose={() => setEmailParaRecuperar(null)}
        />
      )}
    </Flex>
  );
};
