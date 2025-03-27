// import { FiEdit2, FiXSquare, FiUserPlus } from 'react-icons/fi';
import { BiListPlus } from 'react-icons/bi';
import {
  // IconButton,
  Flex,
  HStack,
  Link as ChakraLink,
  Button,
} from '@chakra-ui/react';
import { DateTime } from 'luxon';

export function getColumn(
  deleteFunction: (id: string) => void,
  editPath: string,
  includePath: string,
  includePathParams: string
) {
  const columns = [
    {
      Header: 'Código',
      accessor: 'codigo',
    },

    {
      Header: 'Nome',
      accessor: 'nome',
    },
    {
      Header: 'Data Inicial',
      accessor: 'data_inicial',
      Cell: ({ row }: any) =>
        DateTime.fromISO(row.original.data_inicial).toFormat('dd/MM/yyyy'),
    },
    {
      Header: 'Data Final',
      accessor: 'data_final',
      Cell: ({ row }: any) =>
        DateTime.fromISO(row.original.data_final).toFormat('dd/MM/yyyy'),
    },

    {
      Header: ' ',
      Cell: ({ row }: any) => (
        <Flex as="main" alignItems="center">
          <HStack spacing={2}>
            <ChakraLink
              href={`${includePathParams}/${row.original.tabela_preco_id}`}
            >
              <Button
                size="sm"
                ml={6}
                aria-label="Parametrizar"
                bg="green.500"
                color="white"
                _hover={{
                  bg: 'green.700',
                }}
                leftIcon={<BiListPlus size={18} color="#eeeef2" />}
              >
                PARAMETRIZAÇÃO
              </Button>
            </ChakraLink>

            <ChakraLink href={`${includePath}/${row.original.tabela_preco_id}`}>
              <Button
                size="sm"
                aria-label="Editar"
                bg="blue.500"
                color="white"
                _hover={{
                  bg: 'blue.700',
                }}
                leftIcon={<BiListPlus size={18} color="#eeeef2" />}
              >
                COMPOSIÇÃO DE PREÇOS
              </Button>
            </ChakraLink>

            {/* <ChakraLink href={`/vincular/tabela-preco/${row.original.id}`}>
              <Button
                size="sm"
                aria-label="Vincular Cliente"
                colorScheme="orange"
                bg="orange.500"
                _hover={{
                  bg: "orange.700",
                }}
                leftIcon={<FiUserPlus size={18} color="#eeeef2" />}
              >
                VINCULAR CLIENTES
              </Button>
            </ChakraLink>
            <ChakraLink href={`${editPath}/${row.original.id}`}>
              <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="blue"
                bg="blue.500"
                _hover={{
                  bg: "blue.700",
                }}
                icon={<FiEdit2 size={18} color="#eeeef2" />}
              />
            </ChakraLink>
            <ChakraLink
              onClick={(e) => {
                e.preventDefault();
                deleteFunction(row.original.id);
              }}
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
            </ChakraLink> */}
          </HStack>
        </Flex>
      ),
      disableSortBy: true,
      disableFilters: true,
    },
  ];

  return columns;
}
