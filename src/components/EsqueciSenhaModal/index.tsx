import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Text,
} from '@chakra-ui/react';
import { mensagemDoErroDeSenha, solicitarLinkDeSenha } from '../../service/senha';

interface EsqueciSenhaModalProps {
  // E-mail que já estava digitado na tela de login, para não pedir de novo.
  emailInicial?: string;
  onClose: () => void;
}

type IData = {
  email: string;
};

// Montado só enquanto aberto (quem usa renderiza condicionalmente), então cada
// abertura começa do formulário, sem o aviso do pedido anterior.
//
// ATENÇÃO ao usar: renderize FORA de qualquer <form> da página. O modal vai
// para um portal, mas no React o submit daqui sobe pela árvore de componentes
// e dispararia também o formulário de fora (o do login, por exemplo).
export function EsqueciSenhaModal({ emailInicial = '', onClose }: EsqueciSenhaModalProps) {
  const { register, handleSubmit, formState } = useForm<IData>({
    defaultValues: { email: emailInicial },
  });
  const { errors } = formState;
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  const handleEnviar: SubmitHandler<IData> = async ({ email }) => {
    setErro('');

    try {
      setAviso(await solicitarLinkDeSenha(email.trim()));
    } catch (error) {
      setErro(
        mensagemDoErroDeSenha(error, 'Não foi possível enviar o link. Tente novamente.')
      );
    }
  };

  return (
    <Modal isOpen onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="gray.800">
        <ModalHeader>Esqueci minha senha</ModalHeader>
        <ModalCloseButton />

        {aviso ? (
          <>
            {/* O backend responde igual exista ou não o e-mail; a tela repete
                o texto dele e não afirma que a mensagem foi enviada. */}
            <ModalBody>
              <Text mb="3">{aviso}</Text>
              <Text color="gray.400" fontSize="sm">
                O link vale por 30 minutos. Se não chegar, olhe também a caixa de spam.
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                mr="3"
                _hover={{ bg: 'gray.700' }}
                _active={{ bg: 'gray.600' }}
                onClick={() => setAviso('')}
              >
                Enviar de novo
              </Button>
              <Button bg="orange.200" color="white" _hover={{ bg: '#e56b16' }} onClick={onClose}>
                Fechar
              </Button>
            </ModalFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit(handleEnviar)}>
            <ModalBody>
              <Text mb="4" color="gray.400" fontSize="sm">
                Informe o e-mail que você usa para entrar. Vamos enviar um link para você
                criar uma nova senha.
              </Text>
              <FormControl>
                <FormLabel htmlFor="email-recuperacao">Email</FormLabel>
                <Input
                  id="email-recuperacao"
                  type="email"
                  autoComplete="username"
                  autoFocus
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
              {!!erro && (
                <Text color="red" fontSize="sm">
                  {erro}
                </Text>
              )}
            </ModalBody>
            <ModalFooter>
              <Button
                variant="ghost"
                mr="3"
                _hover={{ bg: 'gray.700' }}
                _active={{ bg: 'gray.600' }}
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                bg="orange.200"
                color="white"
                _hover={{ bg: '#e56b16' }}
                isLoading={formState.isSubmitting}
              >
                Enviar link
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
