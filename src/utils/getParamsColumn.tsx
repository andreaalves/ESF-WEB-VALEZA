import { IconButton, Flex, HStack, Link as ChakraLink } from '@chakra-ui/react';
import { FiEdit2, FiXSquare } from 'react-icons/fi';

export function getColumn(
  deleteFunction: (id: string) => void,
  editPath: string
) {
  const columns = [
    {
      Header: '',
      accessor: 'empresa_id',
      Cell: ({ row }: any) => (
        <span>{`Parametrização ${row.original.empresas.razao_social}`}</span>
      ),
    },
    {
      Header: ' ',
      Cell: ({ row }: any) => (
        <Flex as="main" alignItems="center" justifyContent="end">
          <HStack spacing={2}>
            <ChakraLink href={`${editPath}/${row.original.empresa_id}`}>
              <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="blue"
                bg="blue.500"
                _hover={{
                  bg: 'blue.700',
                }}
                icon={<FiEdit2 size={18} color="#eeeef2" />}
              />
            </ChakraLink>
            {/* <ChakraLink
              onClick={(e) => {
                e.preventDefault();
                deleteFunction(row.original.id);
              }}
            >
              <IconButton
                size="sm"
                aria-label="Excluir"
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
