import {
  FormControl,
  FormLabel,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Text,
} from '@chakra-ui/react';
import { UseFormRegisterReturn } from 'react-hook-form';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';

interface CampoSenhaProps {
  id: string;
  rotulo: string;
  // Diz ao gerenciador de senhas do navegador qual senha oferecer/guardar.
  autoComplete: 'current-password' | 'new-password';
  registro: UseFormRegisterReturn;
  erro?: string;
  visivel: boolean;
  // Só o primeiro campo do formulário leva o olho — ele vale para todos.
  aoAlternarVisibilidade?: () => void;
  autoFocus?: boolean;
}

// Campo de senha das telas de recuperação/troca, com a mesma aparência do
// campo do login.
export function CampoSenha({
  id,
  rotulo,
  autoComplete,
  registro,
  erro,
  visivel,
  aoAlternarVisibilidade,
  autoFocus = false,
}: CampoSenhaProps) {
  return (
    <FormControl>
      <FormLabel htmlFor={id}>{rotulo}</FormLabel>
      <InputGroup>
        <Input
          id={id}
          type={visivel ? 'text' : 'password'}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          bgColor="gray.900"
          variant="filled"
          _hover={{
            bgColor: 'gray.700',
          }}
          {...registro}
        />
        {aoAlternarVisibilidade && (
          <InputRightElement>
            <IconButton
              type="button"
              aria-label={visivel ? 'Ocultar senhas' : 'Mostrar senhas'}
              icon={visivel ? <RiEyeOffLine /> : <RiEyeLine />}
              onClick={aoAlternarVisibilidade}
              size="sm"
              variant="ghost"
              _hover={{ bg: 'gray.700' }}
              _active={{ bg: 'gray.600' }}
              tabIndex={-1}
            />
          </InputRightElement>
        )}
      </InputGroup>
      <Text color="red" mt="2" fontSize="sm">
        {erro}
      </Text>
    </FormControl>
  );
}
