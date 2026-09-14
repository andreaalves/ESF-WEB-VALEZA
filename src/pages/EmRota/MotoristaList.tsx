import { Badge, Box, Flex, Icon, Text, VStack } from '@chakra-ui/react';
import { FaMapMarkerAlt } from 'react-icons/fa';
import fotoFiorino from '../../assets/entregas/fiorino-branca.png';
import { MotoristaEmRota, ParadaEntrega } from './tipos';

interface Props {
  motoristas: MotoristaEmRota[];
  selecionadoId: string | null;
  onSelecionar: (id: string) => void;
}

/** Idade do último GPS recebido — o card não pode dizer "agora" sem posição. */
const rotuloAtualizacao = (motorista: MotoristaEmRota) => {
  // Viagem encerrada não espera GPS nenhum: o app para de publicar posição
  // quando o motorista confirma a entrega.
  if (motorista.status === 'ENTREGUE') return 'Entrega concluída';
  if (motorista.status === 'CANCELADO') return 'Entrega cancelada';
  const { atualizadoEm } = motorista;
  if (!atualizadoEm) return 'Aguardando primeiro GPS';
  const segundos = Math.max(0, Math.round((Date.now() - atualizadoEm) / 1000));
  if (segundos < 45) return 'Posição atualizada agora';
  if (segundos < 3600) return `Atualizada há ${Math.max(1, Math.round(segundos / 60))} min`;
  return 'Sem sinal recente';
};

const corBadge = (status: MotoristaEmRota['status']) => {
  switch (status) {
    case 'COLETADO':
      return 'purple';
    case 'EM ROTA':
      return 'blue';
    case 'CHEGANDO':
      return 'orange';
    case 'ENTREGUE':
      return 'green';
    case 'CANCELADO':
      return 'red';
    default:
      return 'gray';
  }
};

/** Iniciais do motorista — é o que aparece quando o cadastro não tem foto. */
export const iniciaisDe = (nome: string) => {
  const partes = (nome || 'Motorista').trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] || 'M';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return `${primeira}${ultima}`.toUpperCase();
};

export const FotoMotorista = ({
  src,
  nome,
  size = '54px',
}: {
  src: string;
  nome: string;
  size?: string;
}) => (
  <Flex
    w={size}
    h={size}
    flexShrink={0}
    align="center"
    justify="center"
    borderRadius="full"
    border="2px solid"
    borderColor="orange.200"
    bg="gray.700"
    color="orange.200"
    fontWeight="bold"
    fontSize="sm"
    backgroundImage={src ? `url(${src})` : undefined}
    backgroundRepeat="no-repeat"
    backgroundSize="cover"
    backgroundPosition="center"
    boxShadow="0 4px 12px rgba(0, 0, 0, 0.28)"
  >
    {!src && iniciaisDe(nome)}
  </Flex>
);

/** A frota usa a mesma Fiorino; a foto é fixa para todos os motoristas. */
export const FotoVeiculo = ({
  width = '104px',
  height = '68px',
}: {
  width?: string;
  height?: string;
}) => (
  <Box
    w={width}
    h={height}
    flexShrink={0}
    borderRadius="md"
    backgroundImage={`url(${fotoFiorino})`}
    backgroundRepeat="no-repeat"
    backgroundSize="contain"
    backgroundPosition="center"
    boxShadow="inset 0 0 0 1px rgba(255, 255, 255, 0.08)"
  />
);

/** "2,4 km" / "800 m" — só aparece quando dá para medir. */
const distanciaCurta = (metros: number | null) => {
  if (metros === null) return '';
  if (metros < 1000) return `${Math.round(metros / 50) * 50} m`;
  return `${(metros / 1000).toFixed(1).replace('.', ',')} km`;
};

/**
 * Uma parada dentro do card do motorista.
 *
 * `indice` 0 é a próxima parada: é para onde o mapa traça a rota, e é a que
 * responde "ele vai em qual primeiro?". Com uma parada só, o card volta a ser
 * o de sempre — sem numeração nem rótulo de ordem.
 */
const ParadaCard = ({
  parada,
  indice,
  totalParadas,
}: {
  parada: ParadaEntrega;
  indice: number;
  totalParadas: number;
}) => {
  const varias = totalParadas > 1;
  const proxima = indice === 0;

  return (
    <Flex
      align="flex-start"
      gap={2}
      // Com várias paradas, a próxima ganha destaque e as seguintes recuam,
      // para o olho achar na hora para onde ele está indo agora.
      opacity={varias && !proxima ? 0.65 : 1}
      borderLeft={varias ? '2px solid' : undefined}
      borderColor={proxima ? 'orange.200' : 'gray.600'}
      pl={varias ? 3 : 0}
    >
      <Icon as={FaMapMarkerAlt} color={proxima ? 'orange.200' : 'gray.400'} mt="3px" />
      <Box minW={0} flex={1}>
        <Flex align="center" gap={2}>
          <Text fontSize="10px" color={proxima ? 'orange.200' : 'gray.400'} letterSpacing="wide">
            {varias ? (proxima ? 'PRÓXIMO DESTINO' : `${indice + 1}ª PARADA`) : 'DESTINO'}
          </Text>
          {/* A distância explica a ordem: sem ela, "próximo destino" é uma
              afirmação sem justificativa na tela. */}
          {parada.distanciaM !== null && (
            <Text fontSize="10px" color="gray.500">
              {distanciaCurta(parada.distanciaM)}
            </Text>
          )}
        </Flex>
        <Text fontSize="sm" fontWeight="semibold" noOfLines={2}>
          {parada.destino}
        </Text>
        {/* Empresa da carga: o mesmo hospital recebe entrega da Suplen
            e da NeuroVasc, e só o nome do destino não distingue. */}
        {parada.empresa && (
          <Badge mt={1} colorScheme="purple" variant="subtle" fontSize="9px" textTransform="uppercase">
            {parada.empresa}
          </Badge>
        )}
        <Text fontSize="10px" color="gray.400" noOfLines={2} mt={1}>
          {parada.destinoEndereco}
        </Text>
        <Text fontSize="10px" color="gray.500" mt={1}>
          {parada.notas.length} {parada.notas.length === 1 ? 'nota fiscal' : 'notas fiscais'}
        </Text>
      </Box>
    </Flex>
  );
};

export const MotoristaList = ({ motoristas, selecionadoId, onSelecionar }: Props) => {
  return (
    <VStack
      align="stretch"
      spacing={4}
      w={{ base: '100%', xl: '380px' }}
      maxH={{ base: 'none', xl: 'calc(100vh - 170px)' }}
      flexShrink={0}
      overflowY="auto"
      pr={{ base: 0, xl: 2 }}
    >
      {motoristas.map((motorista) => {
        const selecionado = motorista.id === selecionadoId;

        return (
          <Box
            key={motorista.id}
            data-motorista-card="true"
            onClick={(event) => {
              event.stopPropagation();
              onSelecionar(motorista.id);
            }}
            cursor="pointer"
            flexShrink={0}
            bg="gray.800"
            borderWidth="2px"
            borderColor={selecionado ? 'orange.200' : 'transparent'}
            borderRadius="xl"
            overflow="hidden"
            transition="all 0.15s"
            boxShadow={selecionado ? '0 10px 28px rgba(0, 0, 0, 0.28)' : 'md'}
            _hover={{
              borderColor: selecionado ? 'orange.200' : 'gray.600',
              transform: 'translateY(-1px)',
            }}
          >
            <Flex align="center" p={4} pb={3}>
              {/* Margem explícita: mantém a bolinha afastada mesmo em versões
                  do navegador nas quais o gap do Flex não é aplicado. */}
              <Box position="relative" flexShrink={0} mr="24px">
                <FotoMotorista src={motorista.fotoMotorista} nome={motorista.nome} />
                <Box
                  position="absolute"
                  right="1px"
                  bottom="1px"
                  w="12px"
                  h="12px"
                  bg={motorista.atualizadoEm ? 'green.400' : 'gray.500'}
                  borderRadius="full"
                  border="2px solid"
                  borderColor="gray.800"
                />
              </Box>
              <Box flex={1} minW={0}>
                <Text fontSize="10px" color="orange.200" fontWeight="bold" letterSpacing="wide">
                  MOTORISTA
                </Text>
                <Text fontWeight="bold" isTruncated>
                  {motorista.nome}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  {rotuloAtualizacao(motorista)}
                </Text>
              </Box>
              <Badge colorScheme={corBadge(motorista.status)}>{motorista.status}</Badge>
            </Flex>

            <Flex
              align="center"
              justify="space-between"
              gap={3}
              px={4}
              py={3}
              bg="gray.900"
              borderY="1px solid"
              borderColor="gray.700"
            >
              <Box minW={0}>
                <Text fontSize="10px" color="gray.400" letterSpacing="wide">
                  VEÍCULO
                </Text>
                <Text fontSize="sm" fontWeight="bold" isTruncated>
                  {motorista.modeloVeiculo}
                </Text>
                <Flex gap={2} align="center" mt={1}>
                  <Badge colorScheme="orange" variant="subtle">
                    {motorista.placa}
                  </Badge>
                  <Text fontSize="xs" color="gray.400">
                    {[motorista.corVeiculo, motorista.anoVeiculo].filter(Boolean).join(' • ')}
                  </Text>
                </Flex>
              </Box>
              <FotoVeiculo />
            </Flex>

            <Box p={4}>
              {/* As paradas da viagem, na ordem em que ele deve fazê-las. Com
                  mais de uma, a primeira ganha o rótulo PRÓXIMO DESTINO — é a
                  resposta para "ele vai em qual primeiro?". */}
              <VStack align="stretch" spacing={3}>
                {motorista.paradas.map((parada, indice) => (
                  <ParadaCard
                    key={parada.id}
                    parada={parada}
                    indice={indice}
                    totalParadas={motorista.paradas.length}
                  />
                ))}
              </VStack>
              {motorista.qtdDestinos > 1 && (
                <Text fontSize="10px" color="gray.500" mt={3}>
                  {motorista.qtdDestinos} destinos · {motorista.notas.length}{' '}
                  {motorista.notas.length === 1 ? 'nota fiscal' : 'notas fiscais'} na viagem
                </Text>
              )}
            </Box>
          </Box>
        );
      })}

      {motoristas.length === 0 && (
        <Text color="gray.400" textAlign="center" mt={8}>
          Nenhum motorista em rota agora.
        </Text>
      )}
    </VStack>
  );
};
