import {
  Box,
  Divider,
  Flex,
  Button,
  Icon,
  Heading,
  Spinner,
  useDisclosure,
  Text,
  useToast,
} from '@chakra-ui/react';
import { RiAddLine } from 'react-icons/ri';
import { useEffect, useState } from 'react';
import { Header } from '../../components/Header';
import ReactTableComponent from '../../components/TableComponent';
import api from '../../service/api';
import { getColumn } from '../../utils/getTableProductsColumn';
import { useHistory } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

export default function ListTableProducts() {
  const [tablePrice, setTablePrice] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user } = useAuth();
  const toast = useToast();

  const history = useHistory();

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    try {
      await api.patch(`/api-essencial/v1/tabela-precos/update-excluido/${id}`, {
        excluido: true,
      });

      const response = await api.get(
        // `/api-essencial/v1/tabela-precos/${user.empresa.id}/empresa?excluido=false`
        `/api-essencial/v1/tabela-precos`
      );

      setTablePrice(response.data);

      toast({
        title: 'Categoria deletada com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/tabela-preco');
    } catch (error) {
      if (tablePrice.length === 1) {
        toast({
          title: 'Categoria deletada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setTablePrice([]);
      }
    }
  };

  const column = getColumn(
    handleDelete,
    '/edit/tabela-preco',
    '/cadastro/preco-produto',
    '/cadastro/parametrizacao-tabela-preco'
  );

  useEffect(() => {
    api
      .get(
        // `/api-essencial/v1/tabela-precos/${user.empresa.id}/empresa?excluido=false`
        `/api-essencial/v1/tabela-precos`
      )
      .then((response) => {
        setTablePrice(response.data);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE TABELA DE PREÇOS
              </Heading>
              {/* <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/tabela-preco")}
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
                  {tablePrice.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">
                        Sem tabelas de preço para exibir
                      </Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={tablePrice}
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
        label="tabela de preço"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
