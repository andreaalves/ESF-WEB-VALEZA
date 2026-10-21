import {
  Box as BoxBase,
  Flex as FlexBase,
  keyframes,
} from '@chakra-ui/react';
import { Mensagem } from '../../context/AssistenteContext';
import { Markdown } from './Markdown';

// Peças comuns ao balão flutuante e à página /assistente.

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;

export const ORANGE = '#fe8026';

// Cada ponto do "digitando" sobe e acende, um depois do outro.
const pulo = keyframes`
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
`;

interface BolhaProps {
  mensagem: Mensagem;
  // Na página, a pergunta fica mais estreita e o texto, maior.
  larga?: boolean;
}

export function Bolha({ mensagem, larga }: BolhaProps) {
  const doUsuario = mensagem.autor === 'usuario';
  return (
    <Flex justify={doUsuario ? 'flex-end' : 'flex-start'}>
      <Box
        // A resposta ocupa a largura toda: listas longas não quebram cedo.
        maxWidth={doUsuario ? (larga ? '70%' : '80%') : '100%'}
        px={larga ? '4' : '3'}
        py={larga ? '3' : '2'}
        borderRadius="12px"
        fontSize={larga ? 'md' : 'sm'}
        // A pergunta é texto puro; a resposta vem em Markdown.
        whiteSpace={doUsuario ? 'pre-wrap' : 'normal'}
        bg={doUsuario ? ORANGE : 'gray.700'}
        color={doUsuario ? 'white' : 'gray.50'}
        borderBottomRightRadius={doUsuario ? '2px' : '12px'}
        borderBottomLeftRadius={doUsuario ? '12px' : '2px'}
      >
        {doUsuario ? mensagem.texto : <Markdown texto={mensagem.texto} />}
      </Box>
    </Flex>
  );
}

// "Digitando", como no WhatsApp: três pontos pulando enquanto a resposta não chega.
export function Digitando() {
  return (
    <Flex justify="flex-start">
      <Flex
        role="status"
        aria-label="Assistente digitando"
        align="center"
        sx={{ gap: '4px' }}
        px="14px"
        py="12px"
        borderRadius="12px"
        borderBottomLeftRadius="2px"
        bg="gray.700"
      >
        {[0, 0.2, 0.4].map((atraso) => (
          <Box
            key={atraso}
            width="7px"
            height="7px"
            borderRadius="50%"
            bg="gray.50"
            opacity={0.4}
            animation={`${pulo} 1.2s ${atraso}s infinite ease-in-out`}
          />
        ))}
      </Flex>
    </Flex>
  );
}
