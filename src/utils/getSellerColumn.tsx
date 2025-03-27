import * as FiIcons from 'react-icons/fi';
import { IconButton, Flex, HStack, Link as ChakraLink } from '@chakra-ui/react';

export function getColumn(
  deleteFunction: (id: string) => void,
  editPath: string
) {
  const columns = [
    {
      Header: 'Nome',
      accessor: 'nome',
    },
    {
      Header: 'Email',
      accessor: 'usuarios.email',
    },
    {
      Header: 'Código',
      accessor: 'codigo',
    },
    {
      Header: 'Função',
      accessor: 'usuarios.role',
      Cell: ({ row }: any) => (
        <span>
          {row.original.usuarios.role === 'ROLE_MANAGER' ? 'GERENTE' : ''}
          {row.original.usuarios.role === 'ROLE_SELLER' ? 'VENDEDOR' : ''}
          {row.original.usuarios.role === 'ROLE_SUPERVISOR' ? 'SUPERVISOR' : ''}
          {row.original.usuarios.role === 'ROLE_COORDINATOR'
            ? 'COORDENADOR'
            : ''}
          {row.original.usuarios.role === 'ROLE_MANAGER_REGIONAL'
            ? 'GERENTE REGIONAL'
            : ''}
          {row.original.usuarios.role === 'ROLE_MANAGER_NATIONAL'
            ? 'GERENTE NACIONAL'
            : ''}
        </span>
      ),
    },

    {
      Header: ' ',
      Cell: ({ row }: any) => (
        <Flex as="main" alignItems="center" justifyContent="end">
          <HStack spacing={2}>
            <ChakraLink href={`${editPath}/${row.original.usuario_id}`}>
              <IconButton
                size="sm"
                aria-label="Editar"
                colorScheme="blue"
                bg="blue.500"
                _hover={{
                  bg: 'blue.700',
                }}
                icon={<FiIcons.FiEdit2 size={18} color="#eeeef2" />}
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
                aria-label="Editar"
                colorScheme="red"
                bg="red.500"
                _hover={{
                  bg: "red.700",
                }}
                icon={<FiIcons.FiXSquare size={18} color="#eeeef2" />}
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
