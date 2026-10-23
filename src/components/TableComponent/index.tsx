import { useTable, useSortBy, useFilters, usePagination } from 'react-table';
import {
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiChevronRight,
  FiChevronLeft,
} from 'react-icons/fi';
import { Filter, DefaultColumnFilter } from './Filters';
import { useEffect, useState } from 'react';
import { gravarNaSessao, lerDaSessao } from '../../hooks/useFiltroDaSessao';
import {
  Flex,
  Table,
  Tbody,
  Th,
  Thead,
  Tr,
  Text,
  Td,
  Button,
  Box,
} from '@chakra-ui/react';

// react-icons recebe cor CSS crua (não aceita token do Chakra), então usamos a
// CSS variable do token para o ícone acompanhar tema claro/escuro.
const CorIcone = 'var(--chakra-colors-gray-50)';

interface ITableContainerProps {
  columns: any[];
  data: any[];
  isPagenable?: boolean;
  showFilter?: boolean;
  // Com chave, os filtros por coluna, a ordenação e a página ficam guardados
  // na sessão: abrir um registro e voltar devolve a tabela como estava.
  storageKey?: string;
}

interface IEstadoSalvo {
  filters: any[];
  sortBy: any[];
  pageIndex: number;
}

const ReactTableComponent = ({
  columns,
  data,
  isPagenable = false,
  showFilter = true,
  storageKey,
}: ITableContainerProps) => {
  // Lido uma vez só, na montagem: depois disso quem manda é o estado da tabela.
  const [salvo] = useState<IEstadoSalvo | null>(() =>
    storageKey ? lerDaSessao<IEstadoSalvo | null>(storageKey, null) : null
  );

  const generateSortingIndicator = (column: any) => {
    return (
      <Flex alignItems="center">
        {column.isSorted ? (
          column.isSortedDesc ? (
            <FiChevronDown color={CorIcone} size={12} />
          ) : (
            <FiChevronUp color={CorIcone} size={12} />
          )
        ) : (
          <FiChevronDown color={CorIcone} size={12} opacity={0} />
        )}
      </Flex>
    );
  };

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    page,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,

    gotoPage,
    nextPage,
    previousPage,
    state: { pageIndex, filters, sortBy },
  } = useTable(
    {
      columns,
      data,
      defaultColumn: { Filter: DefaultColumnFilter },
      initialState: {
        pageIndex: salvo?.pageIndex ?? 0,
        pageSize: 10,
        filters: salvo?.filters ?? [],
        sortBy: salvo?.sortBy ?? [],
      },
      autoResetPage: false,
      // Sem isso, cada recarga da lista (aprovar, integrar...) apagava o
      // filtro e a ordenação que o usuário tinha escolhido.
      autoResetFilters: false,
      autoResetSortBy: false,
    },
    useFilters,
    useSortBy,
    usePagination
  );

  useEffect(() => {
    if (storageKey) gravarNaSessao(storageKey, { filters, sortBy, pageIndex });
  }, [storageKey, filters, sortBy, pageIndex]);

  // autoResetPage fica desligado para o refresh não devolver o usuário à
  // página 1. O efeito colateral: se a lista encolhe (filtro, busca) com a
  // tabela numa página que deixou de existir, ela ficava em branco.
  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= pageCount) {
      gotoPage(Math.max(pageCount - 1, 0));
    }
  }, [pageIndex, pageCount, gotoPage]);

  const [filterIndexOpen, setFilterIndexOpen] = useState<number | undefined>();

  function handleFilterClick(index: number, e: any) {
    e.preventDefault();
    if (filterIndexOpen === index) setFilterIndexOpen(undefined);
    else setFilterIndexOpen(index);
  }

  return (
    <Flex
      flexDir="column"
      w="100%"
      py={2}
      px={4}
      bg="gray.900"
      borderRadius="4px"
      boxShadow="3px 4px 8px 0px rgba(0,0,0,0.25)"
    >
      <Table size="md" borderRadius="8px" {...getTableProps()}>
        <Thead borderRadius="8px">
          {headerGroups.map((headerGroup) => (
            <Tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column, index) => (
                <Th key={index}>
                  <Filter
                    isVisible={filterIndexOpen === index}
                    column={column}
                  />
                  <Flex className="filters">
                    {column.canFilter && showFilter && (
                      <Flex
                        cursor="pointer"
                        mr={1}
                        _hover={{ color: 'gray.400' }}
                        onBlur={() => setFilterIndexOpen(undefined)}
                        color="gray.200"
                      >
                        <FiFilter
                          size={16}
                          onClick={(e) => handleFilterClick(index, e)}
                        />
                      </Flex>
                    )}
                    <Flex
                      {...column.getSortByToggleProps({ title: undefined })}
                      className="thead"
                    >
                      <Text color="gray.50">{column.render('Header')}</Text>
                      {generateSortingIndicator(column)}
                    </Flex>
                  </Flex>
                </Th>
              ))}
            </Tr>
          ))}
        </Thead>

        <Tbody {...getTableBodyProps()}>
          {page.map((row) => {
            prepareRow(row);
            return (
              <Tr
                _hover={{
                  bg: 'gray.700',
                }}
                {...row.getRowProps()}
              >
                {row.cells.map((cell) => {
                  return (
                    <Td borderColor="gray.500" {...cell.getCellProps()}>
                      <Text as="span" color="gray.200" ml={0} fontSize={15}>
                        {cell.render('Cell')}
                      </Text>
                    </Td>
                  );
                })}
              </Tr>
            );
          })}
        </Tbody>
      </Table>
      {isPagenable && (
        <Box>
          <Flex alignItems="center" mt={2}>
            <Button
              size="sm"
              colorScheme="orange"
              onClick={() => previousPage()}
              disabled={!canPreviousPage}
            >
              <FiChevronLeft />
            </Button>
            <Button
              size="sm"
              colorScheme="orange"
              ml={4}
              onClick={() => nextPage()}
              disabled={!canNextPage}
            >
              <FiChevronRight />
            </Button>
            <Text ml={4} fontSize={14}>
              Página <br />
              <Text as="span" fontWeight="bold">
                {pageIndex + 1} de {pageOptions.length}
              </Text>
            </Text>
          </Flex>
        </Box>
      )}
    </Flex>
  );
};

export default ReactTableComponent;
