import {
  Box as BoxBase,
  Button as ButtonBase,
  Flex as FlexBase,
  Heading as HeadingBase,
  IconButton as IconButtonBase,
  SimpleGrid as SimpleGridBase,
  Text as TextBase,
  Textarea as TextareaBase,
  VStack as VStackBase,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { FiMessageCircle, FiPlus, FiSend } from 'react-icons/fi';
import logoArvore from '../../assets/logo-arvore.png';
import { Bolha, Digitando, ORANGE } from '../../components/ChatAssistant/partes';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { SUGESTOES, useAssistente } from '../../context/AssistenteContext';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Button = ButtonBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;
const Heading = HeadingBase as React.ComponentType<any>;
const IconButton = IconButtonBase as React.ComponentType<any>;
const SimpleGrid = SimpleGridBase as React.ComponentType<any>;
const Text = TextBase as React.ComponentType<any>;
const Textarea = TextareaBase as React.ComponentType<any>;
const VStack = VStackBase as React.ComponentType<any>;

// O Assistente ESF em tela cheia. A conversa é a mesma do balão flutuante
// (AssistenteContext): o que foi perguntado num aparece no outro.
export function Assistente() {
  const { user } = useAuth();
  const { mensagens, carregando, escrevendo, enviar, novaConversa } =
    useAssistente();
  const [texto, setTexto] = useState('');
  const corpoRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLTextAreaElement>(null);
  const ocupado = carregando || escrevendo;

  // Mantém o scroll no fim sempre que chega mensagem nova.
  useEffect(() => {
    corpoRef.current?.scrollTo({
      top: corpoRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [mensagens, carregando]);

  // Abre pronto para digitar.
  useEffect(() => campoRef.current?.focus(), []);

  function enviarTexto(pergunta: string) {
    if (!pergunta.trim() || ocupado) return;
    enviar(pergunta, 'pagina');
    setTexto('');
    campoRef.current?.focus();
  }

  const primeiroNome = (user?.name || '').split(' ')[0] || '';

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6" w="100%" maxW="100%" overflowX="hidden">
        <Wapper>
          <Flex
            flex="1"
            w="100%"
            minW={0}
            // Ocupa a altura da tela: só a conversa rola, o campo fica fixo embaixo.
            h="calc(100vh - 150px)"
            minH="420px"
            direction="column"
            bg="gray.800"
            borderRadius={12}
            mb="8"
            overflow="hidden"
          >
            {/* ── Cabeçalho ── */}
            <Flex
              align="center"
              px={['4', '6']}
              py="4"
              borderBottom="1px solid"
              borderColor="gray.700"
            >
              <Box
                width="40px"
                height="40px"
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
                  width="30px"
                  height="30px"
                  objectFit="contain"
                />
              </Box>
              <Box ml="3" flex="1" minW={0}>
                <Heading size="md" fontWeight="bold" letterSpacing="tight">
                  Assistente ESF
                </Heading>
                <Text color="gray.400" fontSize="sm">
                  {ocupado
                    ? 'digitando...'
                    : 'Pergunte sobre pedidos, vendas, metas, preços e clientes'}
                </Text>
              </Box>
              <Button
                size="sm"
                leftIcon={<FiPlus />}
                variant="outline"
                colorScheme="gray"
                _hover={{ bg: 'gray.700' }}
                isDisabled={mensagens.length === 0}
                onClick={() => {
                  novaConversa();
                  campoRef.current?.focus();
                }}
              >
                Nova conversa
              </Button>
            </Flex>

            {/* ── Conversa ── */}
            <Box
              ref={corpoRef}
              flex="1"
              overflowY="auto"
              px={['4', '6']}
              py="6"
              css={{
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-thumb': {
                  background: '#4b4d63',
                  borderRadius: '3px',
                },
              }}
            >
              <VStack align="stretch" spacing="4" maxW="900px" mx="auto">
                {mensagens.length === 0 && (
                  <Box textAlign="center" pt={['4', '10']}>
                    <Flex
                      mx="auto"
                      mb="4"
                      width="56px"
                      height="56px"
                      borderRadius="full"
                      align="center"
                      justify="center"
                      bgGradient={`linear(to-br, ${ORANGE}, #d9641a)`}
                      color="white"
                    >
                      <FiMessageCircle size={28} />
                    </Flex>
                    <Heading size="md" mb="2">
                      Oi {primeiroNome || 'gerente'}! 👋
                    </Heading>
                    <Text color="gray.400" mb="8">
                      Como posso te ajudar hoje?
                    </Text>
                    <SimpleGrid columns={[1, 1, 3]} spacing="3" textAlign="left">
                      {SUGESTOES.map((s) => (
                        <Box
                          key={s}
                          as="button"
                          textAlign="left"
                          p="4"
                          borderRadius="12px"
                          bg="gray.700"
                          color="gray.50"
                          fontSize="sm"
                          _hover={{ bg: 'gray.600' }}
                          onClick={() => enviarTexto(s)}
                        >
                          {s}
                        </Box>
                      ))}
                    </SimpleGrid>
                  </Box>
                )}

                {mensagens.map((m, i) => (
                  <Bolha key={i} mensagem={m} larga />
                ))}

                {carregando && <Digitando />}
              </VStack>
            </Box>

            {/* ── Campo de envio ── */}
            <Box px={['4', '6']} py="4" borderTop="1px solid" borderColor="gray.700">
              <Flex maxW="900px" mx="auto" align="flex-end">
                <Textarea
                  ref={campoRef}
                  flex="1"
                  rows={2}
                  resize="none"
                  variant="filled"
                  bg="gray.700"
                  border="none"
                  color="gray.50"
                  borderRadius="12px"
                  placeholder="Escreva sua pergunta... (Enter envia, Shift+Enter quebra a linha)"
                  _hover={{ bg: 'gray.700' }}
                  _focus={{ bg: 'gray.700', boxShadow: 'none' }}
                  value={texto}
                  onChange={(e: any) => setTexto(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      enviarTexto(texto);
                    }
                  }}
                />
                <IconButton
                  ml="3"
                  aria-label="Enviar"
                  size="lg"
                  borderRadius="full"
                  bg={ORANGE}
                  color="white"
                  _hover={{ bg: '#d9641a' }}
                  isDisabled={!texto.trim() || ocupado}
                  icon={<FiSend size={20} />}
                  onClick={() => enviarTexto(texto)}
                />
              </Flex>
            </Box>
          </Flex>
        </Wapper>
      </Flex>
    </>
  );
}
