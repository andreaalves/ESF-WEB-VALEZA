import {
  Box,
  Divider,
  Flex,
  Button,
  Icon,
  Heading,
  Spinner,
  Text,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import { RiAddLine } from "react-icons/ri";
import { useEffect } from "react";
import { Header } from "../../components/Header";
import api from "../../service/api";
import { getColumn } from "../../utils/getProviderColumn";
import { useHistory } from "react-router-dom";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";
import { useState } from "react";
import ReactTableComponent from "../../components/TableComponent";
import { useAuth } from "../../context/AuthContext";
import { ExcludeDialog } from "../../components/ExlcudeDialog";

export default function ListProvider() {
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState("");
  const toast = useToast();

  const history = useHistory();
  const { user } = useAuth();

  const { isOpen, onOpen, onClose } = useDisclosure();

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    try {
      await api.patch(`/api-essencial/v1/fornecedores/update-excluido/${id}`, {
        excluido: true,
      });

      const response = await api.get(
        `/api-essencial/v1/fornecedores/${user.empresa.id}/empresa?excluido=false`
      );

      setProviders(response.data.data);

      toast({
        title: "Categoria deletada com sucesso",
        description: ``,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      history.push("/listar/fornecedor");
    } catch (error) {
      if (providers.length === 1) {
        toast({
          title: "Fornecedor deletado com sucesso",
          description: ``,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        setProviders([]);
      }
    }
  };

  const column = getColumn(handleDelete, "/edit/fornecedor");

  useEffect(() => {
    api
      .get(
        `/api-essencial/v1/fornecedores/${user.empresa.id}/empresa?excluido=false`
      )
      .then((response) => {
        console.log(response.data.data);
        setProviders(response.data.data);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
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
                LISTA DE FORNECEDORES
              </Heading>
              <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/fornecedor")}
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
                  {providers.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">
                        Sem fornecedores para exibir
                      </Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={providers}
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
        label="fornecedor"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
