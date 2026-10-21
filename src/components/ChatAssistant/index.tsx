import {
  Box as BoxBase,
  Flex as FlexBase,
  Text as TextBase,
  Input as InputBase,
  IconButton as IconButtonBase,
  VStack as VStackBase,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SUGESTOES, useAssistente } from '../../context/AssistenteContext';
import logoArvore from '../../assets/logo-arvore.png';
import { Bolha, Digitando, ORANGE } from './partes';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;
const Text = TextBase as React.ComponentType<any>;
const Input = InputBase as React.ComponentType<any>;
const IconButton = IconButtonBase as React.ComponentType<any>;
const VStack = VStackBase as React.ComponentType<any>;

// Rota da página do assistente: nela o balão não aparece.
export const ROTA_ASSISTENTE = '/assistente';

export function ChatAssistant() {
  const { user } = useAuth();
  const { mensagens, carregando, escrevendo, enviar } = useAssistente();
  const { pathname } = useLocation();
  const history = useHistory();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const corpoRef = useRef<HTMLDivElement>(null);

  // Mantém o scroll no fim sempre que chega mensagem nova.
  useEffect(() => {
    corpoRef.current?.scrollTo({
      top: corpoRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [mensagens, carregando, aberto]);

  function enviarTexto(pergunta: string) {
    if (!pergunta.trim() || carregando || escrevendo) return;
    enviar(pergunta, 'balao_markdown');
    setTexto('');
  }

  const primeiroNome = (user?.name || '').split(' ')[0] || '';

  // Só aparece para usuário logado (esconde no login) e fora da página do
  // assistente, que já é o chat.
  if (!user?.id || pathname === ROTA_ASSISTENTE) return null;

  return (
    <>
      {/* Janela do chat */}
      {aberto && (
        <Flex
          position="fixed"
          bottom={{ base: '90px', md: '100px' }}
          right={{ base: '16px', md: '24px' }}
          width={{ base: 'calc(100vw - 32px)', md: '380px' }}
          height="520px"
          maxHeight="calc(100vh - 130px)"
          bg="gray.800"
          borderRadius="16px"
          boxShadow="0 12px 40px rgba(0,0,0,0.5)"
          border="1px solid"
          borderColor="gray.700"
          direction="column"
          overflow="hidden"
          zIndex={1400}
        >
          {/* Cabeçalho */}
          <Flex
            align="center"
            p="4"
            bgGradient={`linear(to-r, ${ORANGE}, #d9641a)`}
          >
            <Box
              width="36px"
              height="36px"
              borderRadius="full"
              bg="white"
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
              flexShrink={0}
            >
              <Box
                as="img"
                src={logoArvore}
                alt="Essencial"
                width="28px"
                height="28px"
                objectFit="contain"
              />
            </Box>
            <Box ml="3" flex="1">
              <Text fontWeight="bold" color="white" lineHeight="1.1">
                Assistente ESF
              </Text>
              <Text fontSize="xs" color="whiteAlpha.800">
                {carregando || escrevendo
                  ? 'digitando...'
                  : 'Online • responde sobre seus dados'}
              </Text>
            </Box>
            <IconButton
              aria-label="Abrir em tela cheia"
              title="Abrir em tela cheia"
              size="sm"
              variant="ghost"
              color="white"
              _hover={{ bg: 'whiteAlpha.300' }}
              icon={<FiIcons.FiMaximize2 size={18} />}
              onClick={() => {
                setAberto(false);
                history.push(ROTA_ASSISTENTE);
              }}
            />
            <IconButton
              aria-label="Fechar"
              size="sm"
              variant="ghost"
              color="white"
              _hover={{ bg: 'whiteAlpha.300' }}
              icon={<FiIcons.FiX size={20} />}
              onClick={() => setAberto(false)}
            />
          </Flex>

          {/* Corpo / mensagens */}
          <VStack
            flex="1"
            align="stretch"
            spacing="3"
            p="4"
            overflowY="auto"
            ref={corpoRef}
            css={{
              '&::-webkit-scrollbar': { width: '6px' },
              '&::-webkit-scrollbar-thumb': {
                background: '#4b4d63',
                borderRadius: '3px',
              },
            }}
          >
            {mensagens.length === 0 && (
              <Box>
                <Text color="gray.50" fontWeight="bold" mb="1">
                  Oi {primeiroNome || 'gerente'}! 👋
                </Text>
                <Text color="gray.300" fontSize="sm" mb="4">
                  Como posso te ajudar hoje?
                </Text>
                <Text color="gray.400" fontSize="xs" mb="2">
                  Acesso rápido
                </Text>
                <VStack align="stretch" spacing="2">
                  {SUGESTOES.map((s) => (
                    <Box
                      key={s}
                      as="button"
                      textAlign="left"
                      p="3"
                      borderRadius="10px"
                      bg="gray.700"
                      color="gray.50"
                      fontSize="sm"
                      _hover={{ bg: 'gray.600' }}
                      onClick={() => enviarTexto(s)}
                    >
                      {s}
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}

            {mensagens.map((m, i) => (
              <Bolha key={i} mensagem={m} />
            ))}

            {carregando && <Digitando />}
          </VStack>

          {/* Campo de envio */}
          <Flex p="3" borderTop="1px solid" borderColor="gray.700" align="center">
            <Input
              flex="1"
              variant="filled"
              bg="gray.700"
              border="none"
              color="gray.50"
              size="sm"
              borderRadius="full"
              placeholder="Escreva sua pergunta..."
              _focus={{ bg: 'gray.700', boxShadow: 'none' }}
              value={texto}
              onChange={(e: any) => setTexto(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === 'Enter') enviarTexto(texto);
              }}
            />
            <IconButton
              ml="2"
              aria-label="Enviar"
              size="sm"
              borderRadius="full"
              bg={ORANGE}
              color="white"
              _hover={{ bg: '#d9641a' }}
              isDisabled={!texto.trim() || carregando || escrevendo}
              icon={<FiIcons.FiSend size={16} />}
              onClick={() => enviarTexto(texto)}
            />
          </Flex>
        </Flex>
      )}

      {/* Botão flutuante */}
      <Flex
        as="button"
        position="fixed"
        bottom={{ base: '20px', md: '28px' }}
        right={{ base: '16px', md: '24px' }}
        width="60px"
        height="60px"
        borderRadius="full"
        align="center"
        justify="center"
        bgGradient={`linear(to-br, ${ORANGE}, #d9641a)`}
        color="white"
        boxShadow="0 8px 24px rgba(254,128,38,0.5)"
        _hover={{ transform: 'scale(1.06)' }}
        transition="transform 0.15s ease"
        zIndex={1400}
        onClick={() => setAberto((v) => !v)}
        aria-label="Abrir assistente"
      >
        {aberto ? (
          <FiIcons.FiX size={26} />
        ) : (
          <FiIcons.FiMessageCircle size={26} />
        )}
      </Flex>
    </>
  );
}
