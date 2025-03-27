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
import ReactTableComponent from "../../components/TableComponent";
import api from "../../service/api";
import { getColumn } from "../../utils/getFreightColumn";
import { useHistory } from "react-router-dom";
import { SiderbarResponsive } from "../../components/SiderbarResponsive";
import { Wapper } from "../../components/Wapper";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { ExcludeDialog } from "../../components/ExlcudeDialog";

export default function ListFreight() {
  const [freights, setFreights] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [idToDelete, setIdToDelete] = useState("");

  const column = getColumn(handleDelete, "/edit/frete");

  const history = useHistory();
  const { user } = useAuth();

  const { isOpen, onOpen, onClose } = useDisclosure();

  const toast = useToast();

  function handleDelete(id: any) {
    setIdToDelete(id);
    onOpen();
  }

  const x = async (e: any, id: string) => {
    try {
      await api.patch(`/api-essencial/v1/tabela-fretes/update-excluido/${id}`, {
        excluido: true,
      });

      const response = await api.get(
        `/api-essencial/v1/tabela-fretes/${user.empresa.id}/empresa?excluido=false`
      );

      setFreights(response.data.data);

      toast({
        title: "Categoria deletada com sucesso",
        description: ``,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      history.push("/listar/frete");
    } catch (error) {
      if (freights.length === 1) {
        toast({
          title: "Frete deletada com sucesso",
          description: ``,
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        setFreights([]);
      }
    }
  };

  useEffect(() => {
    api
      .get(
        `/api-essencial/v1/tabela-fretes/${user.empresa.id}/empresa?excluido=false`
      )
      .then((response) => {
        console.log("lista frete", response.data.data);
        setFreights(response.data.data);

        const freightFormated = response.data.data.map((freight: any) => {
          freight.garantiaPeso = `R$ ${freight.garantiaPeso.toFixed(2)}`;
          freight.freteMinimo = `R$ ${freight.freteMinimo.toFixed(2)}`;
          freight.percentualFrete = `${freight.percentualFrete.toFixed(2)}`;

          return freight;
        });
        setFreights(freightFormated);
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
                LISTA DE FRETES
              </Heading>
              <Button
                as="a"
                size="sm"
                fontSize="sm"
                colorScheme="orange"
                leftIcon={<Icon as={RiAddLine} />}
                cursor="pointer"
                onClick={() => history.push("/cadastro/frete")}
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
                  {freights.length === 0 ? (
                    <Flex>
                      <Text color="orange.200">Sem frete para exibir</Text>
                    </Flex>
                  ) : (
                    <ReactTableComponent
                      columns={column}
                      data={freights}
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
        label="frete"
        deleteFunction={(e) => {
          x(e, idToDelete);
          onClose();
        }}
      />
    </>
  );
}
