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
import { getColumn } from '../../utils/getCategoryColumn';
import { useHistory, useParams } from 'react-router-dom';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { Wapper } from '../../components/Wapper';
import { useAuth } from '../../context/AuthContext';
import { ExcludeDialog } from '../../components/ExlcudeDialog';

export default function ListCategory() {
  type IParams = {
    id: string;
  };

  const { user } = useAuth();

  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState('');

  const toast = useToast();
  const history = useHistory();

  const params = useParams<IParams>();

  console.log(params);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const id = params.id;

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    try {
      // await api.patch(`/api-essencial/v1/categorias/update-excluido/${id}`, {
      // await api.put(`/api-essencial/v1/categorias/${id}`, {
      //   excluido: true,
      // });

      const response = await api.get(
        // `/api-essencial/v1/categorias/${user.empresa.id}/empresa?excluido=false`
        `/api-essencial/v1/categorias`
      );

      setCategories(response.data);

      toast({
        title: 'Categoria deletada com sucesso',
        description: ``,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      history.push('/listar/categoria');
    } catch (error) {
      if (categories.length === 1) {
        toast({
          title: 'Categoria deletada com sucesso',
          description: ``,
          status: 'success',
          duration: 3000,
          isClosable: true,
        });
        setCategories([]);
      }
    }
  };

  const column = getColumn(handleDelete, '/edit/categoria');

  useEffect(() => {
    // if (user.empresa.id == "1" && user.role == "ROLE_ADMIN") {
    //   api.get(`/api-essencial/v1/categorias/`).then((response) => {
    //     setCategories(response.data.data);
    //   });
    // }

    api
      .get(
        // `/api-essencial/v1/categorias/${user.empresa.id}/empresa?excluido=false`
        `/api-essencial/v1/categorias`
      )
      .then((response) => {
        setCategories(response.data);
      })
      .catch((error) => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, [user.id]);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex align="start" mx="auto" mt="8" px="6">
        <Wapper>
          <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
            <Flex justify="space-between" align="center">
              <Heading size="md" fontWeight="normal">
                LISTA DE CATEGORIAS
              </Heading>
              {/* <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/categoria")}
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
                  {categories.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem categorias para exibir</Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={categories}
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
        label="categoria"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
