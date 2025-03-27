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
import { getColumn } from '../../utils/getSellerColumn';
import { useHistory, useParams } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

export default function ListUser() {
  type IParams = {
    id: string;
  };
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const history = useHistory();
  const toast = useToast();

  const params = useParams<IParams>();

  const id = params.id;

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    if (id === user.id) {
      return toast({
        title: 'Você não pode deletar esse usuário',
        description: ``,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    }

    try {
      await api.patch(`/api-essencial/v1/colaborador/update-excluido/${id}`, {
        excluido: true,
      });

      const response = await api.get(
        `/api-essencial/v1/colaborador/${user.empresa.id}/empresa?excluido=false`
      );

      const dados = response.data.data;

      const userFilter = await dados.filter(
        (u: any) => u.usuario.role != 'ROLE_ADMIN'
      );

      setUsers(userFilter);

      toast({
        title: 'Usuário deletado com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/vendedor');
    } catch (error) {
      if (users.length === 1) {
        toast({
          title: 'Usuário deletada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setUsers([]);
      }
    }
  };

  const column = getColumn(handleDelete, '/edit/vendedor');

  useEffect(() => {
    const getData = async () => {
      try {
        const resp = await api.get(
          // `/api-essencial/v1/colaborador/${user.empresa.id}/empresa?excluido=false`
          `/api-essencial/v1/colaboradores`
        );

        const dados = resp.data;

        const userFilter = dados.filter(
          (u: any) => u.usuarios.role !== 'ROLE_ADMIN'
        );

        setUsers(userFilter);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    };

    getData();
  }, [user.empresa.id]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE VENDEDORES
              </Heading>
              {/* <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/vendedor")}
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
        label="usuários"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
