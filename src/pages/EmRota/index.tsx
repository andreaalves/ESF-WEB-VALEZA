import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Flex, Heading, HStack, Icon, Spinner, Text } from '@chakra-ui/react';
import { FaSyncAlt } from 'react-icons/fa';
import { Header } from '../../components/Header';
import { SiderbarResponsive } from '../../components/SiderbarResponsive';
import { useSidebar } from '../../context/SidebarContext';
import { MotoristaList } from './MotoristaList';
import { MapaEntrega } from './MapaEntrega';
import { NotasEntregaModal } from './NotasEntregaModal';
import { MotoristaEmRota } from './tipos';
import {
  destinoJaConsultado,
  destinoJaResolvido,
  resolverDestinoComCache,
} from './destinoHospital';
import {
  EntregaEmRotaApi,
  ModuloEntregasIndisponivelError,
  PosicaoEntregaApi,
  StatusEntregaApi,
  adaptarMotoristaEmRota,
  agruparPorMotorista,
  listarEntregasParaMapa,
  obterHistoricoRota,
  obterPosicaoEntrega,
} from '../../service/entregas';

// Quem está em rota muda pouco; a posição de cada um mudaria a cada 10s (é o
// ritmo em que o app do motorista publica). A rota de posição ainda não existe
// na API, então hoje esse polling não traz nada — ver src/service/entregas.ts.
const INTERVALO_LISTA_MS = 20000;
const INTERVALO_POSICAO_MS = 10000;

/**
 * Esta tela é só a carga que está na rua — é o item "Em Rota" do menu. O resto
 * da esteira (coletada, entregue) se acompanha em Canhotos, que lista a
 * entrega inteira com o comprovante.
 */
const STATUS_DO_MAPA: StatusEntregaApi[] = ['EM_ROTA'];

const Entregas = () => {
  const { larguraAtual } = useSidebar();
  const [entregas, setEntregas] = useState<EntregaEmRotaApi[]>([]);
  const [posicoes, setPosicoes] = useState<Record<string, PosicaoEntregaApi>>({});
  // Primeiro fix conhecido de cada entrega: é dele que sai o traçado da rota.
  // Ver o comentário em adaptarEntregaEmRota — a Directions da Mapbox é paga.
  const origensRef = useRef<Record<string, [number, number]>>({});
  // O módulo de entregas ainda pode não existir no backend. Quando é esse o
  // caso, a tela diz isso — não existe conjunto de demonstração.
  const [moduloIndisponivel, setModuloIndisponivel] = useState(false);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  // A rota continua visível quando o card é desselecionado; só o destaque e o
  // modo 3D são removidos. Assim, clicar fora devolve o mapa ao estado 2D.
  const [motoristaExibidoId, setMotoristaExibidoId] = useState<string | null>(null);
  const [visao3d, setVisao3d] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  // Motorista com o modal de notas aberto — o modal vive aqui (e não no card)
  // porque tanto a lista quanto o rodapé do mapa abrem o mesmo detalhamento.
  const [detalhesId, setDetalhesId] = useState<string | null>(null);

  // Entregas de todas as empresas (Suplen e NeuroVasc) no recorte de status
  // escolhido. Não existe uma rota "em-rota" na API: o serviço monta a visão
  // buscando empresa a empresa.
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const lista = await listarEntregasParaMapa(STATUS_DO_MAPA);
      setEntregas(lista);
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
    const timer = setInterval(fetchData, INTERVALO_LISTA_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  // Chave por valor: a lista é recriada a cada ciclo de 20s e comparar por
  // referência reiniciaria o polling de posição sem necessidade.
  const idsEntregas = useMemo(
    () => entregas.map((entrega) => entrega.entregaId).join(','),
    [entregas]
  );

  // Idem, restrito a quem ainda está na rua — é o único estado em que o app do
  // motorista continua publicando posição.
  const idsComGpsAoVivo = useMemo(
    () =>
      entregas
        .filter((entrega) => entrega.status === 'EM_ROTA')
        .map((entrega) => entrega.entregaId)
        .join(','),
    [entregas]
  );

  // Origem do traçado: o PRIMEIRO ponto que o motorista registrou naquela
  // entrega, buscado uma vez por entrega no histórico. Antes era o primeiro fix
  // que esta aba tinha visto — dar F5 no meio da viagem perdia o começo e a
  // rota nascia de onde o motorista estava naquele instante.
  useEffect(() => {
    const ids = idsEntregas ? idsEntregas.split(',') : [];
    const pendentes = ids.filter((id) => id && !origensRef.current[id]);
    if (pendentes.length === 0) return;

    let ativo = true;
    Promise.all(pendentes.map(async (id) => [id, await obterHistoricoRota(id)] as const)).then(
      (resultados) => {
        if (!ativo) return;
        resultados.forEach(([id, pontos]) => {
          const primeiro = pontos[0];
          if (primeiro && !origensRef.current[id]) {
            origensRef.current[id] = [primeiro.lat, primeiro.lng];
          }
        });
        // Só para reprocessar `motoristas`, que lê origensRef.
        setPosicoes((atuais) => ({ ...atuais }));
      }
    );

    return () => {
      ativo = false;
    };
  }, [idsEntregas]);

  // Posição de cada entrega EM ROTA. Quem publica é o app do motorista, a cada
  // 10s; o portal só lê. Sem nenhum ponto ainda, a API responde 404 e o serviço
  // devolve null — normal no começo da viagem, e o mapa segue esperando.
  //
  // Carga coletada (ainda na base) e carga já entregue não publicam mais nada:
  // ficar consultando a posição delas seria uma requisição a cada 10s por card
  // sem nenhuma novidade possível. O trajeto delas vem do histórico, acima.
  useEffect(() => {
    const ids = idsComGpsAoVivo ? idsComGpsAoVivo.split(',') : [];
    if (ids.length === 0) return undefined;

    let ativo = true;
    const consultarPosicoes = async () => {
      const resultados = await Promise.all(
        ids.map(async (id) => [id, await obterPosicaoEntrega(id)] as const)
      );
      if (!ativo) return;
      setPosicoes((atuais) => {
        const proximas = { ...atuais };
        resultados.forEach(([id, posicao]) => {
          if (!posicao) return;
          proximas[id] = posicao;
          // Fallback: se o histórico não respondeu, o primeiro fix visto aqui
          // ainda serve de origem — melhor um traçado parcial que nenhum.
          if (!origensRef.current[id]) origensRef.current[id] = [posicao.lat, posicao.lng];
        });
        return proximas;
      });
    };

    consultarPosicoes();
    const timer = setInterval(consultarPosicoes, INTERVALO_POSICAO_MS);
    return () => {
      ativo = false;
      clearInterval(timer);
    };
  }, [idsComGpsAoVivo]);

  // Onde fica cada hospital. É a mesma resolução que o mapa usa para desenhar o
  // pino (cache compartilhado em destinoHospital.ts), trazida para cá porque a
  // ORDEM das paradas de um motorista depende de saber a distância até cada
  // uma. O contador só existe para reprocessar `motoristas` quando uma busca
  // termina — o resultado em si mora no cache do módulo.
  const [destinosResolvidosEm, setDestinosResolvidosEm] = useState(0);

  useEffect(() => {
    // Sem GPS não há de onde medir distância, e a busca precisa de um ponto de
    // proximidade para desempatar homônimos.
    const pendentes = entregas.filter((entrega) => {
      const destino = entrega.cliente || '';
      const endereco = entrega.enderecoEntrega || '';
      // `destinoJaConsultado`, não `destinoJaResolvido`: hospital que a busca
      // não encontrou fica cacheado como null e não pode ser reconsultado a
      // cada tick de GPS.
      return destino && !destinoJaConsultado(destino, endereco);
    });
    if (pendentes.length === 0) return undefined;

    const referencia = Object.values(posicoes).sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!referencia) return undefined;

    let ativo = true;
    Promise.all(
      pendentes.map((entrega) =>
        resolverDestinoComCache(entrega.cliente || '', entrega.enderecoEntrega, [
          referencia.lng,
          referencia.lat,
        ])
      )
    ).then(() => {
      if (ativo) setDestinosResolvidosEm(Date.now());
    });

    return () => {
      ativo = false;
    };
  }, [entregas, posicoes]);

  // A geocodificação devolve [lng, lat] (ordem da Mapbox); o resto da tela usa
  // [lat, lng]. A troca acontece aqui, na fronteira.
  const coordenadaDaParada = useCallback((destino: string, endereco: string) => {
    const ponto = destinoJaResolvido(destino, endereco);
    return ponto ? ([ponto[1], ponto[0]] as [number, number]) : null;
  }, []);

  // Um card por MOTORISTA, não por nota nem por hospital: quem leva carga para
  // dois hospitais é uma pessoa só na rua, com duas paradas na mesma viagem
  // (`motorista.paradas`, já ordenadas pela mais próxima).
  const motoristas = useMemo<MotoristaEmRota[]>(
    () =>
      agruparPorMotorista(entregas).map((doMotorista) => {
        // A posição é publicada para TODAS as entregas da viagem; vale a mais
        // recente que tiver chegado, venha da nota que vier.
        const maisRecente = doMotorista
          .map((entrega) => posicoes[entrega.entregaId])
          .filter(Boolean)
          .sort((a, b) => b.timestamp - a.timestamp)[0];
        const origem = doMotorista
          .map((entrega) => origensRef.current[entrega.entregaId])
          .find(Boolean);
        return adaptarMotoristaEmRota(
          doMotorista,
          origem,
          maisRecente?.timestamp,
          maisRecente ? [maisRecente.lat, maisRecente.lng] : null,
          coordenadaDaParada
        );
      }),
    // `posicoes` entra na dependência porque é o que preenche origensRef;
    // `destinosResolvidosEm` porque a ordem das paradas muda quando uma
    // geocodificação termina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entregas, posicoes, destinosResolvidosEm, coordenadaDaParada]
  );

  // Trocar o filtro troca a lista inteira: se o card exibido não sobreviveu ao
  // recorte, o mapa cai no primeiro em vez de ficar apontando para o nada.
  useEffect(() => {
    setMotoristaExibidoId((atual) =>
      atual && motoristas.some((motorista) => motorista.id === atual)
        ? atual
        : motoristas[0]?.id ?? null
    );
  }, [motoristas]);

  const motoristaExibido = motoristas.find((m) => m.id === motoristaExibidoId) ?? null;
  const motoristaDetalhes = motoristas.find((m) => m.id === detalhesId) ?? null;
  // Idem para a posição ao vivo do card selecionado: qualquer entrega da
  // viagem serve, o app publica o mesmo ponto em todas. A chave é sempre um
  // entrega_id — `motorista.id` é o id do MOTORISTA e não indexa `posicoes`.
  const posicaoExibida = motoristaExibido
    ? (motoristaExibido.entregaIds || [])
        .map((id) => posicoes[id])
        .filter(Boolean)
        .sort((a, b) => b.timestamp - a.timestamp)[0] ?? null
    : null;
  const posicaoAoVivo: [number, number] | null = posicaoExibida
    ? [posicaoExibida.lat, posicaoExibida.lng]
    : null;

  const selecionarMotorista = (id: string) => {
    setSelecionadoId(id);
    setMotoristaExibidoId(id);
    setVisao3d(true);
  };

  // O Mapbox trata eventos diretamente no canvas e pode impedir que o onClick do
  // contêiner React seja chamado. A captura no document enxerga o clique antes
  // disso e permite desselecionar em qualquer área da página.
  useEffect(() => {
    const aoClicarNaPagina = (event: PointerEvent) => {
      const elemento = event.target instanceof Element ? event.target : null;
      const devePreservar = elemento?.closest(
        '[data-motorista-card="true"], [data-preservar-selecao="true"], [role="dialog"]'
      );

      if (devePreservar) return;
      setSelecionadoId(null);
      setVisao3d(false);
    };

    document.addEventListener('pointerdown', aoClicarNaPagina, true);
    return () => document.removeEventListener('pointerdown', aoClicarNaPagina, true);
  }, []);

  return (
    <>
      <Header />
      <SiderbarResponsive />

      <Flex direction="column" ml={larguraAtual} mt="80px" minH="calc(100vh - 80px)" bg="gray.700" p={6}>
        <HStack justify="space-between" mb={6}>
          <Heading size="md">Entregas</Heading>
          <HStack spacing={2} color="gray.400" fontSize="xs">
            {isRefreshing && <Icon as={FaSyncAlt} />}
            <Text>
              {motoristas.length} {motoristas.length === 1 ? 'entrega' : 'entregas'}
            </Text>
            {moduloIndisponivel && (
              <Badge colorScheme="yellow" variant="subtle" fontSize="10px">
                aguardando backend
              </Badge>
            )}
          </HStack>
        </HStack>

        {isLoading ? (
          <Flex flex={1} align="center" justify="center">
            <Spinner size="xl" color="orange.200" />
          </Flex>
        ) : hasError ? (
          <Text color="red.300">Não foi possível carregar as entregas em andamento.</Text>
        ) : moduloIndisponivel ? (
          <Flex flex={1} align="center" justify="center" direction="column" gap={2}>
            <Text color="gray.300">O módulo de entregas ainda não foi publicado na API.</Text>
            <Text color="gray.500" fontSize="sm">
              A tela liga sozinha assim que GET /entregas/empresa/:id responder.
            </Text>
          </Flex>
        ) : (
          <Flex
            direction={{ base: 'column', xl: 'row' }}
            flex={1}
            gap={6}
            minH="0"
          >
            <MotoristaList
              motoristas={motoristas}
              selecionadoId={selecionadoId}
              onSelecionar={selecionarMotorista}
            />
            {motoristaExibido ? (
              <MapaEntrega
                motorista={motoristaExibido}
                motoristas={motoristas}
                mostrarTodos={selecionadoId === null}
                visao3d={visao3d}
                onAlternarVisao3d={() => setVisao3d((atual) => !atual)}
                onVerDetalhes={() => setDetalhesId(motoristaExibido.id)}
                posicaoAoVivo={posicaoAoVivo}
              />
            ) : (
              <Flex flex={1} align="center" justify="center" color="gray.400">
                <Text>
              {motoristas.length === 0
                ? 'Nenhum motorista em rota agora.'
                : 'Selecione um motorista para acompanhar a rota.'}
            </Text>
              </Flex>
            )}
          </Flex>
        )}
      </Flex>

      {motoristaDetalhes && (
        <NotasEntregaModal
          isOpen
          onClose={() => setDetalhesId(null)}
          motorista={motoristaDetalhes.nome}
          paradas={motoristaDetalhes.paradas}
        />
      )}
    </>
  );
};

export default Entregas;
