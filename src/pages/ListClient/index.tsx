import {
  Box,
  Divider,
  Flex,
  Button,
  Icon,
  Heading,
  Input,
  Spinner,
  useToast,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { RiAddLine } from 'react-icons/ri';
import { useEffect, useMemo, useState } from 'react';
import { Header } from '../../components/Header';
import ReactTableComponent from '../../components/TableComponent';
import api from '../../service/api';
import { getColumn } from '../../utils/getClientColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

const semAcento = (valor: any) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const soDigitos = (valor: any) => String(valor ?? '').replace(/\D/g, '');

export default function ListClient() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');
  const [busca, setBusca] = useState('');

  const { user } = useAuth();
  const toast = useToast();

  const history = useHistory();

  const userFind = user.empresa.id;

  const { isOpen, onOpen, onClose } = useDisclosure();

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    try {
      await api.patch(`/api-essencial/v1/clientes/update-excluido/${id}`, {
        excluido: true,
      });

      const response = await api.get(
        `/api-essencial/v1/clientes/${user.empresa.id}/empresa?excluido=false`
      );

      setClients(response.data.data);

      toast({
        title: 'Categoria deletada com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/cliente');
    } catch (error) {
      if (clients.length === 1) {
        toast({
          title: 'Categoria deletada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setClients([]);
      }
    }
  };

  const column = getColumn(handleDelete, '/edit/cliente');

  const termo = semAcento(busca.trim());

  const clientesFiltrados = useMemo(() => {
    if (!termo) return clients;
    // Termo só com números/pontuação é tratado como CNPJ/CPF: compara sem
    // máscara, então "18547816" acha "18.547.816/0020-68" e vice-versa.
    const digitos = /^[\d\s./-]+$/.test(termo) ? soDigitos(termo) : '';

    return clients.filter((cliente: any) => {
      const alvo = semAcento(
        [
          cliente.fantasia,
          cliente.razao_social,
          cliente.cnpj,
          cliente.codigo,
        ].join(' ')
      );
      if (alvo.includes(termo)) return true;
      return !!digitos && soDigitos(cliente.cnpj).includes(digitos);
    });
  }, [clients, termo]);

  useEffect(() => {
    api
      // .get(`/api-essencial/v1/clientes/${userFind}/empresa?excluido=false`)
      .get(`/api-essencial/v1/clientes`)
      .then((response) => {
        setClients(response.data);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, [userFind]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center" wrap="wrap" gap={3}>
              <Heading size="md" fontWeight="normal">
                LISTA DE CLIENTES
              </Heading>
              <Input
                size="sm"
                w={{ base: '100%', md: '320px' }}
                borderRadius="md"
                placeholder="Buscar por nome, CNPJ/CPF ou código"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
              {/* <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/cliente")}
              >
                Cadastrar
              </Button> */}
            </Flex>

            <Divider my="6" borderColor="gray.700" />

            <Flex justifyContent="center">
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <>
                  {clients.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem clientes para exibir</Text>
                    </Flex>
                  ) : clientesFiltrados.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">
                        Nenhum cliente encontrado para "{busca.trim()}"
                      </Text>
                    </Flex>
                  ) : (
                    // key = termo: remonta a tabela a cada busca para voltar
                    // à página 1 (a tabela usa autoResetPage: false).
                    <ReactTableComponent
                      key={termo}
                      columns={column}
                      data={clientesFiltrados}
                      isPagenable
                    />
                  )}
                </>
              )}
            </Flex>
          </Box>
        </Wapper>
      </Flex>
      <ExcludeDialog
        isOpen={isOpen}
        onClose={onClose}
        label="cliente"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
