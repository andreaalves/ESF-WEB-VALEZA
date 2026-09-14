import {
  Badge,
  Box,
  Flex,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Stack,
  Text,
} from '@chakra-ui/react';
import { NotaEntrega, ParadaEntrega } from './tipos';

/** Texto curto da carga: o número quando é uma NF só, a contagem quando é mais de uma. */
export const resumoNotas = (notas: NotaEntrega[]) => {
  if (notas.length === 0) return 'Sem nota fiscal';
  return notas.length === 1 ? `NF ${notas[0].numero}` : `${notas.length} notas fiscais`;
};

const Campo = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <Box minW={0}>
    <Text fontSize="10px" color="gray.400" letterSpacing="wider">
      {rotulo}
    </Text>
    <Text fontSize="sm" fontWeight="medium" wordBreak="break-word">
      {valor}
    </Text>
  </Box>
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Nome do motorista — o modal é da VIAGEM dele, não de um hospital só. */
  motorista: string;
  /**
   * Paradas da viagem, na ordem em que ele deve fazê-las (a primeira é a
   * próxima). Com mais de uma, o modal separa as notas por hospital: é o
   * lugar onde o escritório vê a carga inteira e onde cada parte desce.
   */
  paradas: ParadaEntrega[];
}

export const NotasEntregaModal = ({ isOpen, onClose, motorista, paradas }: Props) => {
  const notas = paradas.reduce<NotaEntrega[]>((acc, parada) => acc.concat(parada.notas), []);
  const totalEntregues = notas.filter((nota) => nota.status === 'ENTREGUE').length;
  const totalPendentes = notas.length - totalEntregues;
  const variasParadas = paradas.length > 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside" isCentered>
      <ModalOverlay />
      <ModalContent bg="gray.900" color="gray.50" borderRadius="xl" overflow="hidden">
        <ModalHeader px={{ base: 5, md: 6 }} pt={5} pb={4}>
          <Text fontSize="xs" color="gray.400" letterSpacing="wider">
            CARGA DA VIAGEM
          </Text>
          <Text mt={1} pr={10} fontSize="lg" lineHeight="shorter">
            {motorista}
          </Text>
          <Flex mt={3} gap={2} wrap="wrap">
            <Badge colorScheme="orange" fontSize="10px">
              {resumoNotas(notas)}
            </Badge>
            {variasParadas && (
              <Badge colorScheme="blue" fontSize="10px">
                {paradas.length} paradas
              </Badge>
            )}
            {totalEntregues > 0 && (
              <Badge colorScheme="green" fontSize="10px">
                {totalEntregues} {totalEntregues === 1 ? 'entregue' : 'entregues'}
              </Badge>
            )}
            {totalPendentes > 0 && (
              <Badge colorScheme="yellow" fontSize="10px">
                {totalPendentes} {totalPendentes === 1 ? 'pendente' : 'pendentes'}
              </Badge>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody px={{ base: 5, md: 6 }} pb={6}>
          <Stack spacing={6}>
            {paradas.map((parada, indice) => (
              <Box key={parada.id}>
                {/* Cabeçalho da parada. Com um hospital só ele some: o modal
                    volta a ser a lista simples de notas daquela entrega. */}
                {variasParadas && (
                  <Flex align="baseline" gap={2} mb={3}>
                    <Badge colorScheme={indice === 0 ? 'orange' : 'gray'} fontSize="10px">
                      {indice === 0 ? 'PRÓXIMA' : `${indice + 1}ª PARADA`}
                    </Badge>
                    <Text fontSize="sm" fontWeight="bold" noOfLines={1}>
                      {parada.destino}
                    </Text>
                  </Flex>
                )}
                <Stack spacing={3}>
                  {parada.notas.map((nota, indiceNota) => {
                    const entregue = nota.status === 'ENTREGUE';

                    return (
                      <Box
                        // O número não serve sozinho de chave: nota sem NF vem
                        // com string vazia, e agora várias paradas dividem a
                        // mesma lista.
                        key={`${parada.id}-${nota.numero || indiceNota}`}
                        bg="gray.800"
                        border="1px solid"
                        borderColor={entregue ? 'green.400' : 'whiteAlpha.200'}
                        borderRadius="lg"
                        p={{ base: 4, md: 5 }}
                        boxShadow={entregue ? 'inset 4px 0 0 var(--chakra-colors-green-400)' : 'none'}
                      >
                        <SimpleGrid
                          columns={{ base: 1, sm: 3 }}
                          spacing={3}
                          mb={4}
                          pb={4}
                          borderBottom="1px solid"
                          borderColor="whiteAlpha.200"
                        >
                          <Box>
                            <Text mb={1} fontSize="10px" color="gray.400" letterSpacing="wider">
                              NOTA FISCAL
                            </Text>
                            <Badge colorScheme={entregue ? 'green' : 'orange'} fontSize="sm">
                              NF {nota.numero}
                            </Badge>
                          </Box>
                          <Box>
                            <Text mb={1} fontSize="10px" color="gray.400" letterSpacing="wider">
                              PEDIDO
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold">
                              {nota.pedido}
                            </Text>
                          </Box>
                          <Box textAlign={{ base: 'left', sm: 'right' }}>
                            <Text mb={1} fontSize="10px" color="gray.400" letterSpacing="wider">
                              STATUS
                            </Text>
                            <Badge colorScheme={entregue ? 'green' : 'yellow'}>
                              {entregue ? 'ENTREGUE' : 'PENDENTE'}
                            </Badge>
                            {entregue && nota.horarioEntrega && (
                              <Text mt={1} fontSize="xs" color="green.300" fontWeight="semibold">
                                Entregue às {nota.horarioEntrega}
                              </Text>
                            )}
                          </Box>
                        </SimpleGrid>

                        <Text mb={3} fontSize="10px" color="gray.400" letterSpacing="wider">
                          DADOS DO PACIENTE
                        </Text>
                        <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={{ base: 3, sm: 5 }}>
                          <Campo rotulo="PACIENTE" valor={nota.paciente} />
                          <Campo rotulo="MÉDICO" valor={nota.medico} />
                          <Campo rotulo="CONVÊNIO" valor={nota.convenio} />
                        </SimpleGrid>
                      </Box>
                    );
                  })}
                  {parada.notas.length === 0 && (
                    <Text fontSize="sm" color="gray.400">
                      Sem nota fiscal registrada nesta parada.
                    </Text>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
