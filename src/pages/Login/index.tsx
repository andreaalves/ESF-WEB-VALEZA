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
} from '@chakra-ui/react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logoLaranja.jpeg';

type IData = {
  email: string;
  password: string;
  errors: FieldError;
};

export const Login = () => {
  const { register, handleSubmit, formState } = useForm();
  const { errors } = formState;
  const toast = useToast();

  const { signIn } = useAuth();

  const history = useHistory();

  const handleSignIn: SubmitHandler<IData> = async (values) => {
    try {
      await signIn({
        email: values.email,
        password: values.password,
      });

      history.push('/home');
    } catch (error) {
      console.log(error);
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
      <Box width="100%" maxWidth={460}>
        <Flex bg="gray.800" p="8" flexDir="column">
          <Box mb="4">
            <Image
              mx="auto"
              borderRadius="full"
              boxSize="100px"
              src={logo}
              alt="Logo"
              objectFit="cover"
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
                <Input
                  // name="password"
                  id="password"
                  type="password"
                  bgColor="gray.900"
                  variant="filled"
                  _hover={{
                    bgColor: 'gray.700',
                  }}
                  {...register('password', { required: true })}
                />
                <Text color="red" mt="2" fontSize="sm">
                  {errors.password && 'Senha Obrigatória'}
                </Text>
              </FormControl>
            </Stack>
            <Button
              w="100%"
              type="submit"
              mt="6"
              bg="blue.500"
              color="white"
              _hover={{
                bg: 'blue.700',
              }}
              isLoading={formState.isSubmitting}
            >
              Entrar
            </Button>
          </form>
        </Flex>
      </Box>
    </Flex>
  );
};
