import { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  Image,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { FiDownload } from 'react-icons/fi';
import { EntregaHistorico, obterCanhoto } from '../../service/entregas';
import { dataIsoParaBr } from '../../helpers/dataBr';

const Etapa = ({ rotulo, data, hora }: { rotulo: string; data?: string; hora?: string }) => (
  <Box minW={0}>
    <Text fontSize="10px" color="gray.400" letterSpacing="wider">
      {rotulo}
    </Text>
    <Text fontSize="sm" fontWeight="medium">
      {data ? `${dataIsoParaBr(data)}${hora ? ` às ${hora}` : ''}` : '—'}
    </Text>
  </Box>
);

interface Props {
  entrega: EntregaHistorico;
  onClose: () => void;
}

export const CanhotoModal = ({ entrega, onClose }: Props) => {
  const [urlImagem, setUrlImagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  // A imagem vem por uma rota autenticada, então é baixada como blob e vira um
  // object URL. Ele precisa ser revogado ao fechar o modal — senão o arquivo
  // fica preso na memória da aba a cada canhoto aberto.
  useEffect(() => {
    let ativo = true;
    let objectUrl: string | null = null;

    setCarregando(true);
    setErro(null);
    setUrlImagem(null);

    obterCanhoto(entrega.entregaId)
      .then((url) => {
        objectUrl = url;
        if (ativo) setUrlImagem(url);
        else URL.revokeObjectURL(url);
      })
      .catch((falha: any) => {
        if (!ativo) return;
        // O arquivo mora no disco do servidor da API; um 404 aqui costuma ser
        // canhoto que existe no banco mas sumiu do disco (ver obterCanhoto).
        setErro(
          falha?.response?.status === 404
            ? 'O arquivo do canhoto não está mais no servidor.'
            : 'Não foi possível carregar o canhoto.'
        );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entrega.entregaId]);

  const nomeArquivo = `canhoto-${entrega.notaErp || entrega.pedidoErp || entrega.entregaId}.jpg`;

  return (
    <Modal isOpen onClose={onClose} size="2xl" scrollBehavior="inside" isCentered>
      <ModalOverlay />
      <ModalContent bg="gray.900" color="gray.50" borderRadius="xl" overflow="hidden">
        <ModalHeader px={{ base: 5, md: 6 }} pt={5} pb={4}>
          <Text fontSize="xs" color="gray.400" letterSpacing="wider">
            CANHOTO ASSINADO
          </Text>
          <Text mt={1} pr={10} fontSize="lg" lineHeight="shorter">
            {entrega.cliente || 'Destino não informado'}
          </Text>
          <Flex mt={3} gap={2} wrap="wrap">
            {entrega.notaErp && (
              <Badge colorScheme="orange" fontSize="10px">
                NF {entrega.notaErp}
              </Badge>
            )}
            {entrega.pedidoErp && (
              <Badge colorScheme="blue" fontSize="10px">
                Pedido {entrega.pedidoErp}
              </Badge>
            )}
            {entrega.empresaNome && (
              <Badge colorScheme="purple" fontSize="10px">
                {entrega.empresaNome}
              </Badge>
            )}
          </Flex>
        </ModalHeader>
        <ModalCloseButton />

        <ModalBody px={{ base: 5, md: 6 }} pb={6}>
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={5}>
            <Box minW={0}>
              <Text fontSize="10px" color="gray.400" letterSpacing="wider">
                MOTORISTA
              </Text>
              <Text fontSize="sm" fontWeight="medium" isTruncated>
                {entrega.motorista || '—'}
              </Text>
            </Box>
            <Etapa rotulo="COLETADO" data={entrega.coleta?.data} hora={entrega.coleta?.hora} />
            <Etapa rotulo="SAIU PARA ROTA" data={entrega.inicioRota?.data} hora={entrega.inicioRota?.hora} />
            <Etapa rotulo="ENTREGUE" data={entrega.entrega?.data} hora={entrega.entrega?.hora} />
          </SimpleGrid>

          <Flex
            align="center"
            justify="center"
            minH="320px"
            bg="gray.800"
            borderRadius="lg"
            borderWidth="1px"
            borderColor="gray.700"
            p={3}
          >
            {carregando ? (
              <Spinner color="orange.200" size="lg" />
            ) : erro ? (
              <Text color="red.300" fontSize="sm" textAlign="center">
                {erro}
              </Text>
            ) : (
              urlImagem && (
                <Image
                  src={urlImagem}
                  alt={`Canhoto da entrega para ${entrega.cliente}`}
                  maxH="60vh"
                  borderRadius="md"
                />
              )
            )}
          </Flex>

          {urlImagem && (
            <Flex justify="flex-end" mt={4}>
              <Button
                as="a"
                href={urlImagem}
                download={nomeArquivo}
                size="sm"
                colorScheme="orange"
                leftIcon={<FiDownload />}
              >
                Baixar
              </Button>
            </Flex>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
