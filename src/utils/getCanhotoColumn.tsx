import { Badge, Flex, IconButton, Text, Tooltip } from '@chakra-ui/react';
import { FiEye } from 'react-icons/fi';
import { EntregaHistorico } from '../service/entregas';
import { dataIsoParaBr } from '../helpers/dataBr';

/** Rótulo e cor de cada status da entrega — mesmo vocabulário das baias do Kanban. */
export const STATUS_ENTREGA_CFG: Record<string, { label: string; cor: string }> = {
  COLETADO: { label: 'COLETADO', cor: 'blue' },
  EM_ROTA: { label: 'EM ROTA', cor: 'yellow' },
  ENTREGUE: { label: 'ENTREGUE', cor: 'green' },
  CANCELADO: { label: 'CANCELADO', cor: 'red' },
};

export function getColumn(verCanhoto: (entrega: EntregaHistorico) => void) {
  const columns = [
    {
      Header: 'Status',
      accessor: 'status',
      Cell: ({ row }: any) => {
        const cfg = STATUS_ENTREGA_CFG[row.original.status];
        return (
          <Badge colorScheme={cfg?.cor || 'gray'} fontSize="10px">
            {cfg?.label || row.original.status}
          </Badge>
        );
      },
    },
    {
      // `ordenacao` é "YYYY-MM-DD HH:MM" da etapa mais recente: ordena
      // corretamente como texto e é o que interessa ver na coluna.
      Header: 'Última etapa',
      accessor: 'ordenacao',
      Cell: ({ row }: any) => {
        const [data, hora] = String(row.original.ordenacao || '').split(' ');
        const dataBr = dataIsoParaBr(data);
        return <span>{dataBr ? `${dataBr}${hora ? ` ${hora}` : ''}` : '—'}</span>;
      },
    },
    {
      Header: 'Motorista',
      accessor: 'motorista',
      Cell: ({ row }: any) => <span>{row.original.motorista || '—'}</span>,
    },
    {
      Header: 'Destino',
      accessor: 'cliente',
      Cell: ({ row }: any) => (
        <Flex direction="column" minW={0}>
          <Text fontSize={15} isTruncated>
            {row.original.cliente || '—'}
          </Text>
          {row.original.empresaNome && (
            <Text fontSize="11px" color="gray.400">
              {row.original.empresaNome}
            </Text>
          )}
        </Flex>
      ),
    },
    {
      Header: 'Pedido',
      accessor: 'pedidoErp',
      Cell: ({ row }: any) => <span>{row.original.pedidoErp || '—'}</span>,
    },
    {
      Header: 'NF',
      accessor: 'notaErp',
      Cell: ({ row }: any) => <span>{row.original.notaErp || '—'}</span>,
    },
    {
      Header: 'Canhoto',
      accessor: 'temCanhoto',
      disableFilters: true,
      disableSortBy: true,
      Cell: ({ row }: any) => {
        const entrega: EntregaHistorico = row.original;
        // Sem arquivo não há o que abrir: o botão fica visível (para deixar
        // claro o que falta) mas desabilitado.
        return (
          <Tooltip
            label={entrega.temCanhoto ? 'Ver canhoto assinado' : 'Entrega ainda sem canhoto'}
            hasArrow
          >
            <Flex>
              <IconButton
                aria-label="Ver canhoto assinado"
                icon={<FiEye />}
                size="sm"
                variant="ghost"
                colorScheme="orange"
                isDisabled={!entrega.temCanhoto}
                onClick={() => verCanhoto(entrega)}
              />
            </Flex>
          </Tooltip>
        );
      },
    },
  ];

  return columns;
}
