import { FiXSquare, FiEdit2 } from "react-icons/fi";
import { IconButton, Flex, HStack, Link as ChakraLink } from "@chakra-ui/react";

export function getColumn(
  deleteFunction: (id: string) => void,
  setEditId: React.Dispatch<React.SetStateAction<number>>,
  editId: Number
) {
  const columns = [
    {
      Header: "Cliente",
      accessor: "cliente.razaoSocial",
    },
    // {
    //   Header: "Custo",
    //   accessor: "produto.precoCusto",
    //   Cell: ({ row }: any) => (
    //     <span>R$ {row.original.produto.precoCusto.toFixed(2)}</span>
    //   ),
    // },
    // {
    //   Header: "Imposto",
    //   accessor: "imposto",
    //   Cell: ({ row }: any) => <span>{row.original.imposto}%</span>,
    // },
    // {
    //   Header: "Frete",
    //   accessor: "frete",
    //   Cell: ({ row }: any) => <span>{row.original.frete}%</span>,
    // },
    // {
    //   Header: "Comissão",
    //   accessor: "comissao",
    //   Cell: ({ row }: any) => <span>{row.original.comissao}%</span>,
    // },
    // {
    //   Header: "Mkt",
    //   accessor: "mkt",
    //   Cell: ({ row }: any) => <span>{row.original.mkt}%</span>,
    // },
    // {
    //   Header: "Lucro",
    //   accessor: "lucro",
    //   Cell: ({ row }: any) => <span>{row.original.lucro}%</span>,
    // },
    // {
    //   Header: "Preço Final",
    //   accessor: "precoVenda",
    //   Cell: ({ row }: any) => (
    //     <span>R$ {row.original.precoVenda.toFixed(2)}</span>
    //   ),
    // },
    // {
    //   Header: "Preço mínimo",
    //   accessor: "precoMinimo",
    //   Cell: ({ row }: any) => (
    //     <span>R$ {row.original.precoMinimo?.toFixed(2)}</span>
    //   ),
    // },
    {
      Header: " ",
      Cell: ({ row }: any) => (
        <Flex as="main" alignItems="center">
          <HStack spacing={2}>
            {/* <ChakraLink
              onClick={() => {
                if (editId === Number(row.original.id)) {
                  setEditId(0);
                  return;
                }

                setEditId(Number(row.original.id));
              }}
            >
              <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="blue"
                bg={
                  editId === Number(row.original.id) ? "orange.500" : "blue.500"
                }
                _hover={{
                  bg:
                    editId === Number(row.original.id)
                      ? "orange.600"
                      : "blue.700",
                }}
                icon={<FiEdit2 size={18} color="#eeeef2" />}
              />
            </ChakraLink> */}
            <ChakraLink
              onClick={(e) => {
                e.preventDefault();
                deleteFunction(row.original.id);
              }}
              // href="/"
            >
              <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="red"
                bg="red.500"
                _hover={{
                  bg: "red.700",
                }}
                icon={<FiXSquare size={18} color="#eeeef2" />}
              />
            </ChakraLink>
          </HStack>
        </Flex>
      ),
      disableSortBy: true,
      disableFilters: true,
    },
  ];

  return columns;
}
