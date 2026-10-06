import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  useToast,
} from '@chakra-ui/react';
import { CampoSenha } from '../CampoSenha';
import {
  alterarSenha,
  mensagemDoErroDeSenha,
  TAMANHO_MINIMO_SENHA,
} from '../../service/senha';

interface AlterarSenhaModalProps {
  onClose: () => void;
}

type IData = {
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
};

// Troca da PRÓPRIA senha, para quem está logado e lembra a atual. Redefinir a
// senha de outra pessoa continua sendo das telas de cadastro (só admin).
//
// Montado só enquanto aberto (o Header renderiza condicionalmente): fechar
// descarta o que foi digitado.
export function AlterarSenhaModal({ onClose }: AlterarSenhaModalProps) {
  const { register, handleSubmit, getValues, formState } = useForm<IData>();
  const { errors } = formState;
  const toast = useToast();
  const [visivel, setVisivel] = useState(false);
  const [erro, setErro] = useState('');

  const handleSalvar: SubmitHandler<IData> = async (values) => {
    setErro('');

    try {
      await alterarSenha(values.senhaAtual, values.novaSenha, values.confirmacao);
    } catch (error) {
      setErro(
        mensagemDoErroDeSenha(error, 'Não foi possível alterar a senha. Tente novamente.')
      );
      return;
    }

    toast({
      title: 'Senha alterada',
      description: 'Sua nova senha já está valendo.',
      status: 'success',
      duration: 5000,
      isClosable: true,
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="gray.800">
        <ModalHeader>Alterar senha</ModalHeader>
        <ModalCloseButton />
        <form onSubmit={handleSubmit(handleSalvar)}>
          <ModalBody>
            <Stack spacing="2">
              <CampoSenha
                id="senha-atual"
                rotulo="Senha atual"
                autoComplete="current-password"
                autoFocus
                visivel={visivel}
                aoAlternarVisibilidade={() => setVisivel((v) => !v)}
                registro={register('senhaAtual', { required: 'Informe a senha atual' })}
                erro={errors.senhaAtual?.message}
              />
              <CampoSenha
                id="nova-senha"
                rotulo="Nova senha"
                autoComplete="new-password"
                visivel={visivel}
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
              Salvar nova senha
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
