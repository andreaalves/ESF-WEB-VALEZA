import {
  Box,
  Divider,
  Flex,
  Button,
  Icon,
  Heading,
  Spinner,
  useToast,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { RiAddLine } from 'react-icons/ri';
import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import ReactTableComponent from '../../components/TableComponent';
import api from '../../service/api';
import { getColumn } from '../../utils/getInternalUserColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

// Lista TODOS os usuários (GET /usuarios) — vendedor sincronizado do ERP,
// admin, motorista, etc — diferente de ListUser (Lista de Vendedores), que só
// lê da tabela colaboradores e por isso nunca mostra quem não tem esse
// cadastro (caso do admin/motorista criados manualmente).
export default function ListInternalUser() {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const history = useHistory();
  const toast = useToast();

  function handleDelete(id: string) {
    setIdToDelete(id);
    onOpen();
  }

  async function confirmarExclusao(id: string) {
    try {
      await api.delete(`/api-essencial/v1/usuarios/${id}`);
      setUsers((prev) => prev.filter((u) => u.usuario_id !== id));
      toast({
        title: 'Usuário excluído com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description:
          error?.response?.data?.message || 'Tente novamente daqui alguns minutos',
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  }

  const column = getColumn(handleDelete, '/edit/usuario');

  useEffect(() => {
    const getData = async () => {
      try {
        const resp = await api.get('/api-essencial/v1/usuarios');
        setUsers(resp.data || []);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar usuários',
          description:
            error?.response?.status === 404
              ? 'Rota /usuarios ainda não está disponível no backend.'
              : error?.response?.data?.message ||
                'Tente novamente daqui alguns minutos',
          status: 'error',
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
    };

    getData();
  }, [toast]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE USUÁRIOS
              </Heading>
              <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push('/cadastro/usuario')}
              >
                Cadastrar
              </Button>
            </Flex>

            <Divider my="6" borderColor="gray.700" />

            <Flex justifyContent="center">
              {isLoading ? (
                <Spinner color="white" />
              ) : (
                <>
                  {users.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem usuários para exibir</Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={users}
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
        label="usuário"
        deleteFunction={() => {
          confirmarExclusao(idToDelete);
          onClose();
        }}
      />
    </>
  );
}
