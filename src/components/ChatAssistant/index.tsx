import {
  Box as BoxBase,
  Flex as FlexBase,
  Text as TextBase,
  Input as InputBase,
  IconButton as IconButtonBase,
  Avatar as AvatarBase,
  Spinner as SpinnerBase,
  VStack as VStackBase,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import * as FiIcons from 'react-icons/fi';
import { useAuth } from '../../context/AuthContext';
import api from '../../service/api';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;
const Text = TextBase as React.ComponentType<any>;
const Input = InputBase as React.ComponentType<any>;
const IconButton = IconButtonBase as React.ComponentType<any>;
const Avatar = AvatarBase as React.ComponentType<any>;
const Spinner = SpinnerBase as React.ComponentType<any>;
const VStack = VStackBase as React.ComponentType<any>;

const ORANGE = '#fe8026';

interface Mensagem {
  autor: 'ia' | 'usuario';
  texto: string;
}

// Sugestões de "acesso rápido" exibidas quando a conversa está vazia.
const SUGESTOES = [
  'Como estão minhas metas este mês?',
  'Resumo dos pedidos a faturar',
  'Quais vendedores estão abaixo da meta?',
];

export function ChatAssistant() {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [carregando, setCarregando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  // Mantém o scroll no fim sempre que chega mensagem nova.
  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, carregando]);

  async function enviar(pergunta: string) {
    const texto_limpo = pergunta.trim();
    if (!texto_limpo || carregando) return;

    setMensagens((m) => [...m, { autor: 'usuario', texto: texto_limpo }]);
    setTexto('');
    setCarregando(true);

    try {
      // CONTRATO BACKEND (Murilo): POST /api-essencial/v1/assistente/chat
      // body: { empresa_id, usuario_id, mensagem, historico }
      // retorno: { resposta: string }
      const response = await api.post('/api-essencial/v1/assistente/chat', {
        empresa_id: user?.empresa?.id,
        usuario_id: user?.id,
        mensagem: texto_limpo,
        historico: mensagens,
      });

      const resposta = response?.data?.resposta;
      setMensagens((m) => [
        ...m,
        {
          autor: 'ia',
          texto:
            resposta ||
            'Não consegui entender. Pode reformular a pergunta?',
        },
      ]);
    } catch (error) {
      // Demo-fallback enquanto o endpoint não existe (padrão do projeto).
      setMensagens((m) => [
        ...m,
        {
          autor: 'ia',
          texto:
            'O assistente ainda está sendo integrado. Em breve vou responder ' +
            'com os dados de metas, pedidos e desempenho da sua equipe.',
        },
      ]);
    } finally {
      setCarregando(false);
    }
  }

  const primeiroNome = (user?.name || '').split(' ')[0] || '';

  // Só aparece para usuário logado (esconde no login).
  if (!user?.id) return null;

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
            <Avatar
              size="sm"
              name={primeiroNome}
              bg="whiteAlpha.300"
              color="white"
              icon={<FiIcons.FiHeadphones size={18} />}
            />
            <Box ml="3" flex="1">
              <Text fontWeight="bold" color="white" lineHeight="1.1">
                Assistente ESF
              </Text>
              <Text fontSize="xs" color="whiteAlpha.800">
                Online • responde sobre seus dados
              </Text>
            </Box>
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
                      onClick={() => enviar(s)}
                    >
                      {s}
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}

            {mensagens.map((m, i) => (
              <Flex
                key={i}
                justify={m.autor === 'usuario' ? 'flex-end' : 'flex-start'}
              >
                <Box
                  maxWidth="80%"
                  px="3"
                  py="2"
                  borderRadius="12px"
                  fontSize="sm"
                  whiteSpace="pre-wrap"
                  bg={m.autor === 'usuario' ? ORANGE : 'gray.700'}
                  color={m.autor === 'usuario' ? 'white' : 'gray.50'}
                  borderBottomRightRadius={
                    m.autor === 'usuario' ? '2px' : '12px'
                  }
                  borderBottomLeftRadius={m.autor === 'ia' ? '2px' : '12px'}
                >
                  {m.texto}
                </Box>
              </Flex>
            ))}

            {carregando && (
              <Flex justify="flex-start">
                <Box px="3" py="2" borderRadius="12px" bg="gray.700">
                  <Spinner size="sm" color="orange.200" />
                </Box>
              </Flex>
            )}

            <Box ref={fimRef} />
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
                if (e.key === 'Enter') enviar(texto);
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
              isDisabled={!texto.trim() || carregando}
              icon={<FiIcons.FiSend size={16} />}
              onClick={() => enviar(texto)}
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
