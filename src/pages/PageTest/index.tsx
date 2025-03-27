import { Box, Divider, Flex, Heading, Button, Icon } from "@chakra-ui/react";
import { RiAddLine } from "react-icons/ri";
import { useEffect } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import ReactTableComponent from "../../components/TableComponent";
import api from "../../service/api";
import { getColumn } from "../../utils/getColumn";

export default function PagesTest() {
  const column = getColumn(() => console.log("delted"), "/edit");

  const columns = [
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Abc",
      surname: "Da silva",
      age: 20,
    },
    {
      name: "Xyz",
      surname: "De Souza",
      age: 20,
    },
    {
      name: "Bcd",
      surname: "Jayme",
      age: 20,
    },
    {
      name: "Raphael",
      surname: "Jayme",
      age: 20,
    },
  ];

  useEffect(() => {
    api.get("/api-essencial/v1/fornecedores").then((response) => {
      console.log(response.data);
    });
  }, []);

  return (
    <>
      <Header />

      <Flex w="100%" maxWidth="90%" align="start" mx="auto" mt="8" px="6">
        <Sidebar />
        <Box flex="1" p="8" bg="gray.800" borderRadius={8} mb="16">
          <Flex size="md" fontWeight="normal" justify="space-between">
            LISTAGEM DE FRETE
            <Button
              as="a"
              size="sm"
              fontSize="sm"
              colorScheme="orange"
              leftIcon={<Icon as={RiAddLine} />}
              cursor="pointer"
            >
              Cadastrar
            </Button>
          </Flex>

          <Divider my="6" borderColor="gray.700" />

          <Flex justifyContent="center">
            <ReactTableComponent columns={column} data={columns} isPagenable />
          </Flex>
        </Box>
      </Flex>
    </>
  );
}
