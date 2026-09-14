import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Flex,
  Heading,
  Icon,
  Input,
  Select,
  Spinner,
  Text,
} from '@chakra-ui/react';
import { FaSyncAlt } from 'react-icons/fa';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import ReactTableComponent from '../../components/TableComponent';
import { useSidebar } from '../../context/SidebarContext';
import { getColumn as getCanhotoColumn, STATUS_ENTREGA_CFG } from '../../utils/getCanhotoColumn';
import { isoDiasAtras } from '../../helpers/dataBr';
import {
  EntregaHistorico,
  ModuloEntregasIndisponivelError,
  listarHistoricoEntregas,
} from '../../service/entregas';
import { CanhotoModal } from './CanhotoModal';

const PERIODOS = [
  { dias: 7, rotulo: 'Últimos 7 dias' },
  { dias: 30, rotulo: 'Últimos 30 dias' },
  { dias: 90, rotulo: 'Últimos 90 dias' },
  { dias: 0, rotulo: 'Todo o período' },
];

// Sem CANCELADO de propósito — ver listarHistoricoEntregas: carga cancelada
// não gera canhoto e não entra nesta tela.
const STATUS_FILTROS = ['TODOS', 'COLETADO', 'EM_ROTA', 'ENTREGUE'];

/**
 * Histórico de entregas com o comprovante assinado.
 *
 * A esteira aparece inteira (coletado, em rota e entregue) de propósito: a
 * pergunta do escritório costuma ser o que AINDA não voltou assinado, e isso só
 * se enxerga vendo quem ainda não chegou ao fim. Cancelada não entra — não vai
 * gerar canhoto nenhum.
 */
const Canhotos = () => {
  const { larguraAtual } = useSidebar();
  const [entregas, setEntregas] = useState<EntregaHistorico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [moduloIndisponivel, setModuloIndisponivel] = useState(false);
  const [statusFiltro, setStatusFiltro] = useState('TODOS');
  const [periodoDias, setPeriodoDias] = useState(30);
  const [busca, setBusca] = useState('');
  const [entregaSelecionada, setEntregaSelecionada] = useState<EntregaHistorico | null>(null);

  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setEntregas(await listarHistoricoEntregas());
      setModuloIndisponivel(false);
      setHasError(false);
    } catch (erro) {
      setEntregas([]);
      setModuloIndisponivel(erro instanceof ModuloEntregasIndisponivelError);
      setHasError(!(erro instanceof ModuloEntregasIndisponivelError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Período e busca valem para todo mundo; o status é aplicado depois para que
  // a contagem de cada pill mostre quanto existe dentro do recorte atual.
  const noRecorte = useMemo(() => {
    const limite = periodoDias ? isoDiasAtras(periodoDias) : '';
    const termo = busca.trim().toLowerCase();

    return entregas.filter((entrega) => {
      if (limite && entrega.ordenacao.substring(0, 10) < limite) return false;
      if (!termo) return true;
      const alvo = [
        entrega.cliente,
        entrega.motorista,
        entrega.notaErp,
        entrega.pedidoErp,
        entrega.empresaNome,
      ]
        .join(' ')
        .toLowerCase();
      return alvo.includes(termo);
    });
  }, [entregas, periodoDias, busca]);

  const filtradas = useMemo(
    () => (statusFiltro === 'TODOS' ? noRecorte : noRecorte.filter((e) => e.status === statusFiltro)),
    [noRecorte, statusFiltro]
  );

  const contagem = useMemo(() => {
    const total: Record<string, number> = { TODOS: noRecorte.length };
    noRecorte.forEach((entrega) => {
      total[entrega.status] = (total[entrega.status] || 0) + 1;
    });
    return total;
  }, [noRecorte]);

  const colunas = useMemo(() => getCanhotoColumn(setEntregaSelecionada), []);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex
        direction="column"
        ml={larguraAtual}
        mt="80px"
        minH="calc(100vh - 80px)"
        bg="gray.700"
        p={6}
      >
        <Flex justify="space-between" align="center" mb={6} gap={4} wrap="wrap">
          <Heading size="md">Canhotos</Heading>
          <Flex align="center" gap={3} color="gray.400" fontSize="xs">
            {isRefreshing && <Icon as={FaSyncAlt} />}
            <Text>{filtradas.length} entregas</Text>
            {moduloIndisponivel && (
              <Badge colorScheme="yellow" variant="subtle" fontSize="10px">
                aguardando backend
              </Badge>
            )}
            <Button size="sm" colorScheme="orange" variant="outline" onClick={fetchData}>
              Atualizar
            </Button>
          </Flex>
        </Flex>

        <Flex gap={3} mb={5} wrap="wrap" align="center">
          {STATUS_FILTROS.map((status) => {
            const cfg = STATUS_ENTREGA_CFG[status];
            const ativo = statusFiltro === status;
            return (
              <Button
                key={status}
                size="sm"
                borderRadius="full"
                colorScheme={ativo ? cfg?.cor || 'orange' : 'gray'}
                variant={ativo ? 'solid' : 'outline'}
                onClick={() => setStatusFiltro(status)}
              >
                {cfg?.label || 'TODOS'} ({contagem[status] || 0})
              </Button>
            );
          })}

          <Select
            size="sm"
            w="200px"
            borderRadius="md"
            value={periodoDias}
            onChange={(evento) => setPeriodoDias(Number(evento.target.value))}
          >
            {PERIODOS.map((periodo) => (
              <option key={periodo.dias} value={periodo.dias}>
                {periodo.rotulo}
              </option>
            ))}
          </Select>

          <Input
            size="sm"
            w={{ base: '100%', md: '280px' }}
            borderRadius="md"
            placeholder="Buscar hospital, motorista, NF ou pedido"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
          />
        </Flex>

        {isLoading ? (
          <Flex flex={1} align="center" justify="center">
            <Spinner size="xl" color="orange.200" />
          </Flex>
        ) : hasError ? (
          <Text color="red.300">Não foi possível carregar as entregas.</Text>
        ) : moduloIndisponivel ? (
          <Flex flex={1} align="center" justify="center" direction="column" gap={2}>
            <Text color="gray.300">O módulo de entregas ainda não foi publicado na API.</Text>
            <Text color="gray.500" fontSize="sm">
              A tela liga sozinha assim que GET /entregas/empresa/:id responder.
            </Text>
          </Flex>
        ) : filtradas.length === 0 ? (
          <Flex flex={1} align="center" justify="center">
            <Text color="orange.200">Nenhuma entrega no filtro selecionado</Text>
          </Flex>
        ) : (
          <ReactTableComponent columns={colunas} data={filtradas} isPagenable />
        )}
      </Flex>

      {entregaSelecionada && (
        <CanhotoModal
          entrega={entregaSelecionada}
          onClose={() => setEntregaSelecionada(null)}
        />
      )}
    </>
  );
};

export default Canhotos;
