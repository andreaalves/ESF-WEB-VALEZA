import { useTable, useSortBy, useFilters, usePagination } from 'react-table';
import {
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiChevronRight,
  FiChevronLeft,
} from 'react-icons/fi';
import { Filter, DefaultColumnFilter } from './Filters';
import {
  // useEffect,
  useState,
} from 'react';
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

interface ITableContainerProps {
  columns: any[];
  data: any[];
  isPagenable?: boolean;
  showFilter?: boolean;
}

const ReactTableComponent = ({
  columns,
  data,
  isPagenable = false,
  showFilter = true,
}: ITableContainerProps) => {
  const generateSortingIndicator = (column: any) => {
    return (
      <Flex alignItems="center">
        {column.isSorted ? (
          column.isSortedDesc ? (
            <FiChevronDown color="white" size={12} />
          ) : (
            <FiChevronUp color="white" size={12} />
          )
        ) : (
          <FiChevronDown color="white" size={12} opacity={0} />
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

    nextPage,
    previousPage,
    state: { pageIndex },
  } = useTable(
    {
      columns,
      data,
      defaultColumn: { Filter: DefaultColumnFilter },
      initialState: { pageIndex: 0, pageSize: 10 },
      autoResetPage: false,
    },
    useFilters,
    useSortBy,
    usePagination
  );

  // useEffect(() => {
  //   pageIndex;
  // }, []);

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
                      <Text color="white">{column.render('Header')}</Text>
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
