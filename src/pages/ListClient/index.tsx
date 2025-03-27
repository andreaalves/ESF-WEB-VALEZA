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
import { getColumn } from '../../utils/getClientColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

export default function ListClient() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');

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

  useEffect(() => {
    api
      // .get(`/api-essencial/v1/clientes/${userFind}/empresa?excluido=false`)
      .get(`/api-essencial/v1/clientes`)
      .then((response) => {
        console.log('clientes', response.data);
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
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE CLIENTES
              </Heading>
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
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={clients}
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
