import * as FiIcons from 'react-icons/fi';
import {
  IconButton as IconButtonBase,
  Flex as FlexBase,
  HStack as HStackBase,
  Link as ChakraLinkBase,
} from '@chakra-ui/react';
import { DateTime } from 'luxon';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const IconButton = IconButtonBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;
const HStack = HStackBase as React.ComponentType<any>;
const ChakraLink = ChakraLinkBase as React.ComponentType<any>;

export function getColumn(
  deleteFunction: (e: any, id: string) => void,
  editPath: string,
  showModalFuntion: (index: number) => void,
  approveFunction: (id: string) => void,
  isGerente: boolean
) {
  const columns: any[] = [
    {
      Header: 'Código',
      accessor: 'id',
      Cell: ({ row }: any) => (
        <span>ESF{row.original.pedido_id.slice(-5)}</span>
      ),
    },
    {
      Header: 'Cliente',
      accessor: 'clientes.razao_social',
    },
    {
      Header: 'Vendedor',
      accessor: 'colaboradores.nome',
    },
    {
      Header: 'Data de emissão',
      accessor: 'dataEmissao',
      Cell: ({ row }: any) =>
        DateTime.fromISO(row.original.data_emissao)
          .plus({ hours: 3 })
          .toFormat('dd/MM/yyyy'),
    },
    {
      Header: 'Margem Pedido',
      accessor: 'margemPedido',
      Cell: ({ row }: any) => (
        <span>{(row.original.margem_pedido * 100).toFixed(2)}%</span>
      ),
    },
    {
      Header: 'Situação',
      accessor: 'situacao',
    },
    {
      Header: ' ',
      Cell: ({ row }: any) => (
        <Flex as="main" alignItems="center">
          <HStack spacing={2}>
            {/* <ChakraLink
              onClick={(e) => {
                showModalFuntion(Number(row.original.id));
              }}
            >
              <IconButton
                size="sm"
                aria-label="Informações"
                colorScheme="green"
                bg="green.500"
                _hover={{
                  bg: "green.700",
                }}
                icon={<FiIcons.FiInfo size={18} color="#eeeef2" />}
              />
            </ChakraLink> */}
            <ChakraLink href={`${editPath}/${row.original.pedido_id}`}>
              <IconButton
                size="sm"
                aria-label="Informações"
                colorScheme="green"
                bg="green.500"
                _hover={{
                  bg: 'green.700',
                }}
                icon={<FiIcons.FiInfo size={18} color="#eeeef2" />}
              />
            </ChakraLink>
            {/* Aprovação/reprovação agora só dentro do pedido (ListItensOrder),
                não mais pela lista. */}
            {/* <ChakraLink
              onClick={(e) => {
                deleteFunction(e, row.original.id);
              }}
              href="/"
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
