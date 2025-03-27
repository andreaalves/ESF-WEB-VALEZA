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
import { Header } from "../../components/Header";
import ReactTableComponent from "../../components/TableComponent";
import api from "../../service/api";
import { getColumn } from "../../utils/getShippingCompany";
import { useHistory } from "react-router-dom";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ExcludeDialog } from "../../components/ExlcudeDialog";

export default function ListShippingCompany() {
  const [shippingCompanies, setShippingCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [idToDelete, setIdToDelete] = useState("");

  const toast = useToast();

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const column = getColumn(handleDelete, "/edit/transportadora");

  const x = async (e: any, id: string) => {
    try {
      await api.patch(
        `/api-essencial/v1/transportadoras/update-excluido/${id}`,
        {
          excluido: true,
        }
      );

      const response = await api.get(
        `/api-essencial/v1/transportadoras/${user.empresa.id}/empresa?excluido=false`
      );

      setShippingCompanies(response.data.data);

      toast({
        title: "Categoria deletada com sucesso",
        description: ``,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      history.push("/listar/transportadora");
    } catch (error) {
      if (shippingCompanies.length === 1) {
        toast({
          title: "Categoria deletada com sucesso",
          description: ``,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        setShippingCompanies([]);
      }
    }
  };

  const history = useHistory();
  const { user } = useAuth();

  console.log(user.empresa.id);

  useEffect(() => {
    api
      .get(
        `/api-essencial/v1/transportadoras/${user.empresa.id}/empresa?excluido=false`
      )
      .then((response) => {
        setShippingCompanies(response.data.data);
        console.log(response.data.data);
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
                LISTA DE TRANSPORTADORAS
              </Heading>
              <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/transportadora")}
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
                  {shippingCompanies.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">
                        Sem transportadoras para exibir
                      </Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={shippingCompanies}
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
        label="transportadora"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
