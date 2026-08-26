import * as FiIcons from 'react-icons/fi';
import { IconButton, Flex, HStack, Link as ChakraLink } from '@chakra-ui/react';

const ROLE_LABEL: Record<string, string> = {
  ROLE_ADMIN: 'ADMINISTRADOR',
  ROLE_USER: 'USUÁRIO',
  ROLE_SELLER: 'VENDEDOR',
  ROLE_SUPERVISOR: 'SUPERVISOR',
  ROLE_COORDINATOR: 'COORDENADOR',
  ROLE_MANAGER: 'GERENTE',
  ROLE_MANAGER_REGIONAL: 'GERENTE REGIONAL',
  ROLE_MANAGER_NATIONAL: 'GERENTE NACIONAL',
};

const TIPO_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  MOTORISTA: 'Motorista',
  VENDEDOR: 'Vendedor',
};

export function getColumn(
  deleteFunction: (id: string) => void,
  editPath: string
) {
  const columns = [
    {
      Header: 'Nome',
      accessor: 'name',
    },
    {
      Header: 'Email',
      accessor: 'email',
    },
    {
      Header: 'Função',
      accessor: 'role',
      Cell: ({ row }: any) => (
        <span>{ROLE_LABEL[row.original.role] || row.original.role}</span>
      ),
    },
    {
      Header: 'Tipo',
      accessor: 'tipo_usuario',
      Cell: ({ row }: any) => (
        <span>{TIPO_LABEL[row.original.tipo_usuario] || '—'}</span>
      ),
    },
    {
      Header: 'Origem',
      accessor: 'origem_cadastro',
      Cell: ({ row }: any) => (
        <span>
          {row.original.origem_cadastro === 'ERP'
            ? 'ERP (TOTVS)'
            : row.original.origem_cadastro === 'ESF'
            ? 'ESF (manual)'
            : '—'}
        </span>
      ),
    },
    {
      Header: ' ',
      Cell: ({ row }: any) => {
        // Usuário sincronizado do ERP não pode ser editado/excluído por
        // aqui — o backend bloqueia com 403. Vendedor tem tela própria.
        const ehErp = row.original.origem_cadastro === 'ERP';

        return (
          <Flex as="main" alignItems="center" justifyContent="end">
            <HStack spacing={2}>
              <ChakraLink
                href={ehErp ? undefined : `${editPath}/${row.original.usuario_id}`}
                pointerEvents={ehErp ? 'none' : 'auto'}
              >
                <IconButton
                  size="sm"
                  aria-label="Editar"
                  colorScheme="blue"
                  bg="blue.500"
                  isDisabled={ehErp}
                  _hover={{
                    bg: 'blue.700',
                  }}
                  icon={<FiIcons.FiEdit2 size={18} color="#eeeef2" />}
                />
              </ChakraLink>
              <IconButton
                size="sm"
                aria-label="Excluir"
                colorScheme="red"
                bg="red.500"
                isDisabled={ehErp}
                _hover={{
                  bg: 'red.700',
                }}
                onClick={() => deleteFunction(row.original.usuario_id)}
                icon={<FiIcons.FiTrash2 size={18} color="#eeeef2" />}
              />
            </HStack>
          </Flex>
        );
      },
      disableSortBy: true,
      disableFilters: true,
    },
  ];

  return columns;
}
