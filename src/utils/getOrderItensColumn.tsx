import * as FiIcons from 'react-icons/fi';
import { IconButton, Flex, HStack, Link as ChakraLink } from '@chakra-ui/react';

export function getItensOrderColumn(
  deleteFunction: (e: any, id: string) => void,
  editPath: string
) {
  const columns = [
    {
      Header: 'Nome',
      accessor: 'produtos.nome',
    },
    {
      Header: 'Pç Tabela',
      accessor: 'preco_tabela',
      // Pedido antigo pode não ter o preço de tabela gravado no item.
      Cell: ({ row }: any) =>
        Number(row.original.preco_tabela) > 0 ? (
          <span>R$ {Number(row.original.preco_tabela).toFixed(2)}</span>
        ) : (
          <span>-</span>
        ),
    },
    {
      Header: 'Pr Unitário',
      accessor: 'precoLiquido',
      Cell: ({ row }: any) => (
        <span>R$ {Number(row.original.preco_liquido).toFixed(2)}</span>
      ),
    },
    {
      Header: 'Desconto',
      accessor: 'desconto',
      Cell: ({ row }: any) => {
        const tabela = Number(row.original.preco_tabela);
        if (!(tabela > 0)) return <span>-</span>;

        const desconto =
          ((tabela - Number(row.original.preco_liquido)) / tabela) * 100;
        // Vendido acima da tabela: mostra como acréscimo em vez de
        // desconto negativo.
        return desconto < 0 ? (
          <span>+{Math.abs(desconto).toFixed(2)} % (acréscimo)</span>
        ) : (
          <span>{desconto.toFixed(2)} %</span>
        );
      },
      // Valor calculado na tela, não existe no item — não dá para filtrar.
      disableFilters: true,
      disableSortBy: true,
    },
    {
      Header: 'Margem',
      accessor: 'margem',
      Cell: ({ row }: any) => (
        <span>{Number(row.original.margem * 100).toFixed(2)} %</span>
      ),
    },
    {
      Header: 'Qtd',
      accessor: 'quantidade',
    },
    {
      Header: 'SubTotal',
      accessor: 'total',
      Cell: ({ row }: any) => (
        <span>
          R$ {(row.original.preco_liquido * row.original.quantidade).toFixed(2)}
        </span>
      ),
    },

    // {
    //   Header: " ",
    //   Cell: ({ row }: any) => (
    //     <Flex as="main" alignItems="center">
    //       <HStack spacing={2}>
    //         <ChakraLink href={`${editPath}/${row.original.id}`}>
    //           <IconButton
    //             size="sm"
    //             aria-label="Editar"
    //             colorScheme="blue"
    //             bg="blue.500"
    //             _hover={{
    //               bg: "blue.700",
    //             }}
    //             icon={<FiIcons.FiEdit2 size={18} color="#eeeef2" />}
    //           />
    //         </ChakraLink>
    //         <ChakraLink
    //           onClick={(e) => {
    //             deleteFunction(e, row.original.id);
    //           }}
    //           href="/"
    //         >
    //           <IconButton
    //             size="sm"
    //             aria-label="Editar"
    //             colorScheme="red"
    //             bg="red.500"
    //             _hover={{
    //               bg: "red.700",
    //             }}
    //             icon={<FiIcons.FiXSquare size={18} color="#eeeef2" />}
    //           />
    //         </ChakraLink>
    //       </HStack>
    //     </Flex>
    //   ),
    //   disableSortBy: true,
    //   disableFilters: true,
    // },
  ];

  return columns;
}
