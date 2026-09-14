import { useEffect, useRef, useState } from 'react';
import { Badge, Box, Button, Flex, Grid, Text } from '@chakra-ui/react';
import { FaCube } from 'react-icons/fa';
import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp';
// eslint-disable-next-line import/no-webpack-loader-syntax
import MapboxWorker from 'worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MotoristaEmRota } from './tipos';
import { resumoNotas } from './NotasEntregaModal';
import { FotoMotorista, FotoVeiculo, iniciaisDe } from './MotoristaList';
import {
  LngLat,
  distanciaMetros,
  resolverDestinoComCache,
} from './destinoHospital';

// O CRA 4 roda webpack 4, que não empacota o worker do mapbox-gl sozinho. O build
// "csp" + worker-loader é o caminho suportado pela própria Mapbox nesse cenário
// (ver src/types/mapbox-gl-csp.d.ts para os tipos desses dois imports).
(mapboxgl as any).workerClass = MapboxWorker;

// Token público (pk.*), restrito por URL no console da Mapbox. Sem ele a tela
// mostra um aviso em vez de um mapa quebrado.
const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || '';
mapboxgl.accessToken = TOKEN;

/**
 * Daqui pra baixo as coordenadas seguem a ordem da Mapbox: [lng, lat].
 * O resto do app guarda [lat, lng] (mais legível), então a conversão acontece
 * só na fronteira, em `paraLngLat`.
 *
 * `LngLat`, `distanciaMetros` e a resolução do hospital moram em
 * ./destinoHospital: a lista também precisa saber onde cada parada fica, para
 * ordenar as paradas do motorista pela mais próxima.
 */

const paraLngLat = (p: [number, number]): LngLat => [p[1], p[0]];

/**
 * Coordenada do cadastro do cliente ([lat, lng]) na ordem da Mapbox
 * ([lng, lat]). Descarta (0,0), que fica no Atlântico e não é endereço de
 * ninguém — é como um cadastro sem coordenada aparece quando foi preenchido
 * com zero em vez de ficar vazio.
 */
const cadastroParaLngLat = (p: [number, number] | null | undefined): LngLat | null => {
  if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) return null;
  if (p[0] === 0 && p[1] === 0) return null;
  return paraLngLat(p as [number, number]);
};

const ESTILO_MAPA = 'mapbox://styles/mapbox/streets-v12';
const VELOCIDADE_MEDIA_URBANA_MPS = 8.33; // ~30 km/h — fallback quando a Directions não responde
// Limites do recálculo. A rota precisa sair de ONDE O MOTORISTA ESTÁ, mas a
// Directions é paga: refazer a cada ponto publicado (10s) seria uma requisição
// a cada 10 segundos por aba aberta. Então só refaz quando ele realmente saiu
// do traçado, ou de dois em dois minutos para atualizar trânsito e ETA.
const DISTANCIA_FORA_DA_ROTA_M = 120;
const INTERVALO_MINIMO_RECALCULO_MS = 15000;
const INTERVALO_ATUALIZACAO_TRAFEGO_MS = 120000;
// Na visão geral são N motoristas por ciclo, então o gatilho é mais folgado que
// o do card selecionado: o traçado ali serve para enxergar quem vai para onde.
const DISTANCIA_RECALCULO_VISAO_GERAL_M = 400;
const ZOOM_3D = 16;
const INCLINACAO_3D = 60;
const ROTACAO_3D = 25;

// Níveis de congestionamento — os mesmos nomes na anotação `congestion` da
// Directions API e no tileset de trânsito da Mapbox.
const coresPorCongestionamento = (semDado: string) => [
  'match',
  ['get', 'congestion'],
  'low', '#2e9e4f',
  'moderate', '#f0a800',
  'heavy', '#e0592b',
  'severe', '#c62828',
  semDado,
];

// Na rota, trecho sem dado de trânsito segue no laranja normal do trajeto.
const CORES_ROTA = coresPorCongestionamento('#f47216');
// Nas ruas em volta, rua sem dado não pinta nada — pintar tudo de laranja daria
// a impressão de trânsito pesado na cidade inteira.
const CORES_TRAFEGO = coresPorCongestionamento('rgba(0,0,0,0)');

/**
 * Uma cor por motorista na visão geral. Com dois ou mais na rua ao mesmo tempo,
 * todas as rotas em laranja viram um novelo: não dá para dizer qual trajeto é
 * de quem. A mesma cor pinta o anel do pino, então mapa e motorista se
 * correspondem sem precisar clicar em nada.
 */
const CORES_MOTORISTAS = [
  '#f47216', '#2e7d32', '#1565c0', '#8e24aa',
  '#c62828', '#00838f', '#ef6c00', '#4527a0',
];
const corDoMotorista = (indice: number): string =>
  CORES_MOTORISTAS[((indice % CORES_MOTORISTAS.length) + CORES_MOTORISTAS.length) % CORES_MOTORISTAS.length];

const SRC_ROTAS_GERAL = 'entregas-rotas-geral';
const LAYER_ROTAS_GERAL_CASING = 'entregas-rotas-geral-casing';
const LAYER_ROTAS_GERAL = 'entregas-rotas-geral-linha';
const SRC_TRAFEGO = 'entrega-trafego';
const SRC_ROTA = 'entrega-rota';
const SRC_PERCORRIDO = 'entrega-percorrido';
const LAYER_TRAFEGO = 'entrega-trafego-linha';
const LAYER_CASING = 'entrega-rota-casing';
const LAYER_ROTA = 'entrega-rota-linha';
const LAYER_PERCORRIDO = 'entrega-percorrido-linha';
const LAYER_PREDIOS = 'entrega-predios-3d';

const COLECAO_VAZIA: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** O Mapbox devolve NaN ao calcular câmera num container sem área. */
const mapaTemArea = (mapa: mapboxgl.Map): boolean => {
  const container = mapa.getContainer();
  return container.clientWidth > 0 && container.clientHeight > 0;
};

/**
 * Enquadra sem risco de derrubar a página: um erro lançado dentro do efeito
 * desmonta a árvore inteira do React e o escritório fica com a tela branca.
 */
const enquadrarComSeguranca = (
  mapa: mapboxgl.Map,
  limites: mapboxgl.LngLatBounds,
  opcoes: mapboxgl.FitBoundsOptions
): void => {
  if (!mapaTemArea(mapa)) return;
  try {
    mapa.fitBounds(limites, opcoes);
  } catch (erro) {
    console.warn('Não foi possível enquadrar o mapa:', erro);
  }
};

/** Índice do ponto da rota mais próximo de um fix de GPS real. */
const indiceMaisProximo = (pontos: LngLat[], alvo: LngLat): number => {
  let melhorIndice = 0;
  let melhorDistancia = Number.POSITIVE_INFINITY;
  pontos.forEach((ponto, indice) => {
    const distancia = distanciaMetros(ponto, alvo);
    if (distancia < melhorDistancia) {
      melhorDistancia = distancia;
      melhorIndice = indice;
    }
  });
  return melhorIndice;
};

/** Distância acumulada (m) da origem até cada ponto de `pontos`, no mesmo índice. */
const calcularDistanciasAcumuladas = (pontos: LngLat[]): number[] => {
  const acumuladas: number[] = pontos.length > 0 ? [0] : [];
  for (let i = 1; i < pontos.length; i++) {
    acumuladas.push(acumuladas[i - 1] + distanciaMetros(pontos[i - 1], pontos[i]));
  }
  return acumuladas;
};

/**
 * Quebra a rota em segmentos de dois pontos, cada um carregando o seu nível de
 * congestionamento — é o que permite pintar o trajeto por trânsito real.
 */
const construirSegmentos = (coords: LngLat[], congestion: string[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: coords.slice(1).map((ponto, i) => ({
    type: 'Feature',
    properties: { congestion: congestion[i] || 'unknown' },
    geometry: { type: 'LineString', coordinates: [coords[i], ponto] },
  })),
});

const criarMarcador = (emoji: string): HTMLDivElement => {
  const el = document.createElement('div');
  el.textContent = emoji;
  el.style.fontSize = '28px';
  el.style.lineHeight = '1';
  el.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,.4))';
  return el;
};

/**
 * Foto circular do motorista com um anel pulsando atrás dela.
 *
 * A cor é a MESMA da rota dele na visão geral — é o que liga o pino ao traçado
 * quando há mais de um motorista no mapa.
 */
const criarMarcadorMotorista = (
  motorista: MotoristaEmRota,
  cor: string = CORES_MOTORISTAS[0]
): HTMLDivElement => {
  const marcador = document.createElement('div');
  marcador.style.position = 'relative';
  marcador.style.width = '58px';
  marcador.style.height = '58px';
  marcador.style.display = 'flex';
  marcador.style.alignItems = 'center';
  marcador.style.justifyContent = 'center';
  marcador.setAttribute('aria-label', `Motorista ${motorista.nome}`);

  const pulso = document.createElement('div');
  pulso.style.position = 'absolute';
  pulso.style.inset = '3px';
  pulso.style.borderRadius = '50%';
  pulso.style.border = `3px solid ${cor}`;
  pulso.style.background = 'rgba(255, 255, 255, 0.18)';
  pulso.animate(
    [
      { transform: 'scale(0.82)', opacity: 0.95 },
      { transform: 'scale(1.42)', opacity: 0 },
    ],
    { duration: 1400, iterations: Infinity, easing: 'ease-out' }
  );

  const foto = document.createElement('div');
  foto.style.position = 'relative';
  foto.style.zIndex = '1';
  foto.style.width = '46px';
  foto.style.height = '46px';
  foto.style.borderRadius = '50%';
  foto.style.border = `3px solid ${cor}`;
  foto.style.backgroundColor = '#1f2029';
  foto.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.48)';
  if (motorista.fotoMotorista) {
    foto.style.backgroundImage = `url(${motorista.fotoMotorista})`;
    foto.style.backgroundRepeat = 'no-repeat';
    foto.style.backgroundSize = 'cover';
    foto.style.backgroundPosition = 'center';
  } else {
    // Cadastro sem foto: iniciais, no mesmo lugar do retrato.
    foto.style.display = 'flex';
    foto.style.alignItems = 'center';
    foto.style.justifyContent = 'center';
    foto.style.color = '#fe8026';
    foto.style.fontWeight = 'bold';
    foto.style.fontSize = '15px';
    foto.textContent = iniciaisDe(motorista.nome);
  }

  marcador.appendChild(pulso);
  marcador.appendChild(foto);
  return marcador;
};

interface Props {
  motorista: MotoristaEmRota;
  motoristas: MotoristaEmRota[];
  mostrarTodos: boolean;
  visao3d: boolean;
  onAlternarVisao3d: () => void;
  onVerDetalhes: () => void;
  /**
   * [lat, lng] do último GPS publicado pelo app do motorista
   * (GET /entregas/:id/posicao). Com ele, o motorista no mapa deixa de ser
   * simulado. null = o motorista ainda não publicou nenhum fix.
   */
  posicaoAoVivo?: [number, number] | null;
}

export const MapaEntrega = ({
  motorista,
  motoristas,
  mostrarTodos,
  visao3d,
  onAlternarVisao3d,
  onVerDetalhes,
  posicaoAoVivo = null,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapaRef = useRef<mapboxgl.Map | null>(null);
  const marcadorMotoristaRef = useRef<mapboxgl.Marker | null>(null);
  const marcadorMotoristaChaveRef = useRef<string | null>(null);
  const marcadoresVisaoGeralRef = useRef<mapboxgl.Marker[]>([]);
  const marcadorDestinoRef = useRef<mapboxgl.Marker | null>(null);
  // Pinos dos hospitais que ele ainda vai visitar DEPOIS da parada atual.
  // Ficam separados do marcador de destino porque não têm rota traçada: a
  // Directions só desenha o caminho até a próxima parada.
  const marcadoresProximasParadasRef = useRef<mapboxgl.Marker[]>([]);
  const distanciasRef = useRef<number[]>([]);

  const [mapaPronto, setMapaPronto] = useState(false);
  const [rota, setRota] = useState<LngLat[]>([]);
  const [congestionamento, setCongestionamento] = useState<string[]>([]);
  const [carregandoRota, setCarregandoRota] = useState(true);
  const [erroRota, setErroRota] = useState(false);
  // Qual etapa falhou. "Não foi possível carregar a rota" não diz se o problema
  // foi achar o hospital ou traçar o caminho até ele — e são coisas diferentes:
  // uma se resolve com cadastro, a outra é indisponibilidade do serviço.
  const [motivoErroRota, setMotivoErroRota] = useState<'destino' | 'rota' | null>(null);
  const [posicaoIndice, setPosicaoIndice] = useState(0);
  const [velocidadeMediaMps, setVelocidadeMediaMps] = useState(VELOCIDADE_MEDIA_URBANA_MPS);
  const [destinoResolvido, setDestinoResolvido] = useState<LngLat | null>(null);

  // Ponto de partida do traçado. Começa no primeiro fix conhecido e passa a
  // acompanhar a posição ao vivo — o escritório quer ver o caminho que falta
  // DAQUI até o hospital, não o trajeto a partir de onde a viagem começou.
  // Rotas da visão geral (uma por motorista) e os pinos de destino delas.
  // Declaradas aqui, e não junto do efeito que as preenche: o array de
  // dependências é avaliado durante o render, antes daquele ponto do arquivo.
  const [rotasVisaoGeral, setRotasVisaoGeral] = useState<
    Record<string, { coords: LngLat[]; destino: LngLat }>
  >({});
  const marcadoresDestinoGeralRef = useRef<mapboxgl.Marker[]>([]);
  const rotasGeralRef = useRef<Record<string, { origem: LngLat; ts: number }>>({});

  const [origemRota, setOrigemRota] = useState<[number, number] | null>(motorista.origem);
  const ultimoRecalculoMsRef = useRef(0);
  // Maior trajeto já medido nesta viagem. Como a rota passa a ser redesenhada a
  // partir da posição atual, `distanciaTotal` vira só O QUE FALTA — sem esta
  // régua o "% do trajeto" ficaria preso em 0% a viagem inteira.
  const distanciaDoTrajetoRef = useRef(0);
  // Régua boa do "% do trajeto": a viagem INTEIRA, medida uma única vez desde o
  // primeiro ponto que o motorista registrou (o do histórico, não o primeiro que
  // esta aba viu). Sem ela o percentual dependia de quando a página foi aberta:
  // abrir com o motorista já na porta do hospital fazia a régua nascer do
  // tamanho do que faltava, e o rodapé mostrava "2% do trajeto" a 2 minutos da
  // entrega.
  const trajetoMedidoRef = useRef<string | null>(null);
  const [reguaTrajetoM, setReguaTrajetoM] = useState(0);

  // Trocou de motorista: o traçado recomeça do ponto conhecido dele.
  useEffect(() => {
    setOrigemRota(motorista.origem);
    ultimoRecalculoMsRef.current = 0;
    distanciaDoTrajetoRef.current = 0;
    trajetoMedidoRef.current = null;
    setReguaTrajetoM(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motorista.id]);

  // Chave por VALOR das coordenadas. Comparando por referência, o polling
  // (que recria os objetos a cada ciclo) refaria a rota toda vez — uma requisição
  // paga da Directions a cada ciclo, por aba aberta.
  // Sem nenhum GPS publicado ainda não há de onde traçar a rota.
  const semPosicaoConhecida = !motorista.origem;
  const chaveRota = `${(origemRota || []).join(',')}|${motorista.destinoEndereco}|${motorista.destinoBusca}`;

  // Decide quando o traçado precisa ser refeito a partir da posição atual.
  useEffect(() => {
    if (!posicaoAoVivo) return;
    const agora = Date.now();
    // Ainda sem origem nenhuma (o histórico não respondeu): o ponto ao vivo é o
    // que existe, e sem ele não há rota alguma.
    if (!origemRota) {
      ultimoRecalculoMsRef.current = agora;
      setOrigemRota(posicaoAoVivo);
      return;
    }
    if (agora - ultimoRecalculoMsRef.current < INTERVALO_MINIMO_RECALCULO_MS) return;

    const pontoAoVivo = paraLngLat(posicaoAoVivo);
    // Sem rota desenhada, a referência é a própria origem usada na última
    // tentativa; com rota, é o quanto ele está afastado do traçado.
    const distancia =
      rota.length >= 2
        ? distanciaMetros(rota[indiceMaisProximo(rota, pontoAoVivo)], pontoAoVivo)
        : distanciaMetros(paraLngLat(origemRota), pontoAoVivo);
    const saiuDoTrajeto = distancia > DISTANCIA_FORA_DA_ROTA_M;
    const transitoDesatualizado =
      agora - ultimoRecalculoMsRef.current >= INTERVALO_ATUALIZACAO_TRAFEGO_MS;
    if (!saiuDoTrajeto && !transitoDesatualizado) return;

    ultimoRecalculoMsRef.current = agora;
    setOrigemRota(posicaoAoVivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicaoAoVivo?.[0], posicaoAoVivo?.[1], rota]);

  // Instância única do mapa: trocar de motorista NÃO recria o mapa, porque cada
  // inicialização do GL JS conta como um "map load" cobrado pela Mapbox.
  useEffect(() => {
    if (!TOKEN || !containerRef.current || mapaRef.current) return undefined;

    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: ESTILO_MAPA,
      center: paraLngLat(motorista.origem || [-14.235, -51.925]),
      zoom: 12,
    });
    mapa.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    mapaRef.current = mapa;

    mapa.on('load', () => {
      // Trânsito real da Mapbox (as mesmas cores do Waze/Google): fica por baixo
      // da rota, dando o contexto do fluxo nas ruas em volta.
      mapa.addSource(SRC_TRAFEGO, { type: 'vector', url: 'mapbox://mapbox.mapbox-traffic-v1' });
      mapa.addLayer({
        id: LAYER_TRAFEGO,
        type: 'line',
        source: SRC_TRAFEGO,
        'source-layer': 'traffic',
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 16, 4],
          'line-color': CORES_TRAFEGO as any,
          'line-opacity': 0.75,
        },
      });

      mapa.addSource(SRC_ROTA, { type: 'geojson', data: COLECAO_VAZIA });
      mapa.addSource(SRC_PERCORRIDO, { type: 'geojson', data: COLECAO_VAZIA });

      mapa.addLayer({
        id: LAYER_CASING,
        type: 'line',
        source: SRC_ROTA,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 11, 'line-color': '#ffffff', 'line-opacity': 0.9 },
      });
      // Trajeto restante pintado pelo trânsito daquele trecho.
      mapa.addLayer({
        id: LAYER_ROTA,
        type: 'line',
        source: SRC_ROTA,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 7, 'line-color': CORES_ROTA as any },
      });
      // Uma linha por motorista na visão geral, cada uma na cor dele. Fica numa
      // fonte própria para não brigar com a rota detalhada do card selecionado.
      mapa.addSource(SRC_ROTAS_GERAL, { type: 'geojson', data: COLECAO_VAZIA });
      mapa.addLayer({
        id: LAYER_ROTAS_GERAL_CASING,
        type: 'line',
        source: SRC_ROTAS_GERAL,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 9, 'line-color': '#ffffff', 'line-opacity': 0.85 },
      });
      mapa.addLayer({
        id: LAYER_ROTAS_GERAL,
        type: 'line',
        source: SRC_ROTAS_GERAL,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 5, 'line-color': ['get', 'cor'] as any, 'line-opacity': 0.95 },
      });

      // Trecho já percorrido por cima, em azul escuro.
      mapa.addLayer({
        id: LAYER_PERCORRIDO,
        type: 'line',
        source: SRC_PERCORRIDO,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-width': 7, 'line-color': '#0b3260' },
      });

      // Prédios em 3D — extrusão da mesma vector tile que o estilo já baixa, ou
      // seja, sem requisição nova e sem custo extra (a cobrança é por map load).
      // Entra abaixo do primeiro layer de rótulo pra não cobrir os nomes de rua.
      const camadas = mapa.getStyle().layers || [];
      const primeiroRotulo = camadas.find(
        (c) => c.type === 'symbol' && (c.layout as any)?.['text-field']
      )?.id;

      mapa.addLayer(
        {
          id: LAYER_PREDIOS,
          type: 'fill-extrusion',
          source: 'composite',
          'source-layer': 'building',
          filter: ['==', 'extrude', 'true'],
          minzoom: 14,
          layout: { visibility: 'none' },
          paint: {
            'fill-extrusion-color': '#c8cbd6',
            'fill-extrusion-height': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              15, ['get', 'height'],
            ],
            'fill-extrusion-base': [
              'interpolate', ['linear'], ['zoom'],
              14, 0,
              15, ['get', 'min_height'],
            ],
            'fill-extrusion-opacity': 0.7,
          },
        },
        primeiroRotulo
      );

      setMapaPronto(true);
    });

    // O mapa nasce dentro de um flex que ainda redimensiona depois do primeiro
    // paint; sem o resize o canvas fica cortado.
    const observador = new ResizeObserver(() => mapa.resize());
    observador.observe(containerRef.current);

    return () => {
      observador.disconnect();
      mapa.remove();
      mapaRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rota pelas ruas com trânsito real (perfil driving-traffic): a geometria vem
  // anotada com o congestionamento trecho a trecho e a duração já considera o
  // trânsito do momento.
  useEffect(() => {
    if (!TOKEN) return undefined;

    let ativo = true;
    setCarregandoRota(true);
    setErroRota(false);
    setMotivoErroRota(null);
    setPosicaoIndice(0);
    setRota([]);
    setCongestionamento([]);
    distanciasRef.current = [];

    if (!origemRota) {
      setRota([]);
      setCarregandoRota(false);
      return undefined;
    }
    const origem = paraLngLat(origemRota);
    // O destino é sempre resolvido pelo endereço textual do hospital.
    setDestinoResolvido(null);

    const carregarRotaReal = async () => {
      const destino = await resolverDestinoComCache(
        motorista.destinoBusca,
        motorista.destinoEndereco,
        origem,
        cadastroParaLngLat(motorista.paradas?.[0]?.coordenada)
      );

      if (!ativo) return;
      if (!destino) {
        console.warn(
          '[entregas] Hospital não localizado no mapa:',
          motorista.destinoBusca,
          '|',
          motorista.destinoEndereco,
          '— endereço não encontrado pelos serviços de busca.'
        );
        setDestinoResolvido(null);
        setRota([]);
        setErroRota(true);
        setMotivoErroRota('destino');
        setCarregandoRota(false);
        return;
      }
      setDestinoResolvido(destino);

      const url =
        'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' +
        `${origem[0]},${origem[1]};${destino[0]},${destino[1]}` +
        '?geometries=geojson&overview=full&annotations=congestion' +
        `&access_token=${TOKEN}`;

      try {
        const respostaRota = await fetch(url);
        const res = await respostaRota.json();
        if (!ativo) return;
        const rotaApi = res?.routes?.[0];
        if (!rotaApi) throw new Error('Directions sem rota');

        const coords: LngLat[] = rotaApi.geometry.coordinates;
        const distancias = calcularDistanciasAcumuladas(coords);
        const distanciaTotalM: number = rotaApi.distance ?? distancias[distancias.length - 1] ?? 0;
        const duracaoTotalS: number = rotaApi.duration ?? distanciaTotalM / VELOCIDADE_MEDIA_URBANA_MPS;

        distanciasRef.current = distancias;
        if (distanciaTotalM > distanciaDoTrajetoRef.current) {
          distanciaDoTrajetoRef.current = distanciaTotalM;
        }
        setVelocidadeMediaMps(
          duracaoTotalS > 0 ? distanciaTotalM / duracaoTotalS : VELOCIDADE_MEDIA_URBANA_MPS
        );
        setCongestionamento(rotaApi.legs?.[0]?.annotation?.congestion || []);
        setRota(coords);
        setCarregandoRota(false);
      } catch (erro) {
        if (!ativo) return;
        console.warn('[entregas] Directions falhou para', motorista.destinoBusca, erro);
        // Nunca desenha uma linha reta fictícia quando a Directions falha.
        distanciasRef.current = [];
        setVelocidadeMediaMps(VELOCIDADE_MEDIA_URBANA_MPS);
        setCongestionamento([]);
        setRota([]);
        setErroRota(true);
        setMotivoErroRota('rota');
        setCarregandoRota(false);
      }
    };

    carregarRotaReal();

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveRota]);

  // A posição do mapa é sempre o ponto da rota mais próximo do GPS publicado
  // pelo app do motorista (GET /entregas/:id/posicao). Não existe animação
  // simulada: sem fix real, o motorista não se move na tela.
  useEffect(() => {
    if (!posicaoAoVivo || rota.length < 2) return;
    setPosicaoIndice(indiceMaisProximo(rota, paraLngLat(posicaoAoVivo)));
    // Dependência por VALOR: o array é recriado a cada polling e comparar por
    // referência reprojetaria a posição em todo render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicaoAoVivo?.[0], posicaoAoVivo?.[1], rota]);

  // Desenha a rota assim que ela chega.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;

    if (mostrarTodos) {
      (mapa.getSource(SRC_ROTA) as mapboxgl.GeoJSONSource)?.setData(COLECAO_VAZIA);
      (mapa.getSource(SRC_PERCORRIDO) as mapboxgl.GeoJSONSource)?.setData(COLECAO_VAZIA);
      return;
    }

    if (rota.length < 2) {
      (mapa.getSource(SRC_ROTA) as mapboxgl.GeoJSONSource)?.setData(COLECAO_VAZIA);
      (mapa.getSource(SRC_PERCORRIDO) as mapboxgl.GeoJSONSource)?.setData(COLECAO_VAZIA);
      return;
    }
    (mapa.getSource(SRC_ROTA) as mapboxgl.GeoJSONSource)?.setData(
      construirSegmentos(rota, congestionamento)
    );
  }, [rota, congestionamento, mapaPronto, mostrarTodos]);

  // Visão geral: sem card selecionado, mostra todos os motoristas e enquadra o
  // grupo inteiro. Cada marcador fica no último GPS publicado por aquele
  // motorista; quem ainda não publicou nada não aparece.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;

    marcadoresVisaoGeralRef.current.forEach((marcador) => marcador.remove());
    marcadoresVisaoGeralRef.current = [];

    if (!mostrarTodos || motoristas.length === 0) return;

    marcadorMotoristaRef.current?.remove();
    marcadorMotoristaRef.current = null;
    marcadorMotoristaChaveRef.current = null;

    // Só entra na visão geral quem já publicou posição. O par item+posição anda
    // JUNTO de propósito: filtrar as posições e depois percorrer `motoristas`
    // inteiro desalinhava os índices assim que alguém não tinha origem, e o
    // marcador seguinte recebia `undefined` — era o "LngLatLike argument must be
    // specified..." que derrubava o mapa inteiro ao abrir a rota.
    // O índice vem de `motoristas`, não da lista filtrada: é ele que decide a
    // cor, e ela precisa ser a mesma da rota desse motorista.
    const comPosicao = motoristas
      .map((item, indice) => ({ item, indice, ponto: item.posicaoAtual || item.origem }))
      .filter(({ ponto }) => Array.isArray(ponto))
      .map(({ item, indice, ponto }) => ({
        item,
        indice,
        posicao: paraLngLat(ponto as [number, number]),
      }))
      .filter(({ posicao }) => Number.isFinite(posicao[0]) && Number.isFinite(posicao[1]));

    // Ninguém publicou posição ainda: sem ponto não há marcador nem
    // enquadramento (LngLatBounds com undefined também quebrava aqui).
    if (comPosicao.length === 0) return;

    marcadoresVisaoGeralRef.current = comPosicao.map(({ item, indice, posicao }) =>
      new mapboxgl.Marker({ element: criarMarcadorMotorista(item, corDoMotorista(indice)) })
        .setLngLat(posicao)
        .setPopup(
          new mapboxgl.Popup({ offset: 30, closeButton: false }).setText(
            `${item.nome} • ${item.placa}`
          )
        )
        .addTo(mapa)
    );

    const limites = comPosicao.reduce(
      (bounds, { posicao }) => bounds.extend(posicao),
      new mapboxgl.LngLatBounds(comPosicao[0].posicao, comPosicao[0].posicao)
    );
    // O hospital entra no enquadramento: com só os pinos dos motoristas, a
    // câmera fechava em cima deles e a rota inteira ficava fora da tela.
    motoristas.forEach((item) => {
      const destino = rotasVisaoGeral[item.id]?.destino;
      if (Array.isArray(destino)) limites.extend(destino);
    });
    mapa.stop();
    mapa.jumpTo({ pitch: 0, bearing: 0 });
    enquadrarComSeguranca(mapa, limites, {
      padding: { top: 100, bottom: 100, left: 100, right: 100 },
      maxZoom: 13,
      duration: 900,
    });

    return () => {
      marcadoresVisaoGeralRef.current.forEach((marcador) => marcador.remove());
      marcadoresVisaoGeralRef.current = [];
    };
  }, [mapaPronto, mostrarTodos, motoristas, rotasVisaoGeral]);

  // Uma rota por motorista na visão geral. Sem isso, com dois ou mais na rua o
  // escritório só via os pinos e não sabia para onde cada um estava indo.

  useEffect(() => {
    if (!TOKEN || !mostrarTodos) return undefined;
    let ativo = true;

    const carregarRotasDaVisaoGeral = async () => {
      for (const item of motoristas) {
        if (!ativo) return;
        const ponto = item.posicaoAtual || item.origem;
        if (!Array.isArray(ponto)) continue;
        const origem = paraLngLat(ponto as [number, number]);
        // A Directions é cobrada por requisição e aqui são N motoristas a cada
        // ciclo de 10s: só refaz quando ele realmente andou ou o trânsito
        // envelheceu.
        const cache = rotasGeralRef.current[item.id];
        if (
          cache &&
          distanciaMetros(cache.origem, origem) < DISTANCIA_RECALCULO_VISAO_GERAL_M &&
          Date.now() - cache.ts < INTERVALO_ATUALIZACAO_TRAFEGO_MS
        ) {
          continue;
        }

        const destino = await resolverDestinoComCache(
          item.destinoBusca,
          item.destinoEndereco,
          origem,
          cadastroParaLngLat(item.paradas?.[0]?.coordenada)
        );
        if (!ativo) return;
        if (!destino) continue;

        try {
          // `overview=simplified`: a visão geral não precisa da geometria cheia,
          // e sem a anotação de congestionamento a resposta é bem menor.
          const url =
            'https://api.mapbox.com/directions/v5/mapbox/driving-traffic/' +
            `${origem[0]},${origem[1]};${destino[0]},${destino[1]}` +
            `?geometries=geojson&overview=simplified&access_token=${TOKEN}`;
          const resposta = await fetch(url);
          const dados = await resposta.json();
          if (!ativo) return;
          const coords: LngLat[] = dados?.routes?.[0]?.geometry?.coordinates || [];
          if (coords.length < 2) continue;
          rotasGeralRef.current[item.id] = { origem, ts: Date.now() };
          setRotasVisaoGeral((atuais) => ({ ...atuais, [item.id]: { coords, destino } }));
        } catch {
          // Um motorista sem rota não pode impedir o traçado dos outros.
        }
      }
    };

    void carregarRotasDaVisaoGeral();
    return () => {
      ativo = false;
    };
  }, [mostrarTodos, motoristas]);

  // Desenha as rotas da visão geral, cada uma com a cor do seu motorista.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;
    const fonte = mapa.getSource(SRC_ROTAS_GERAL) as mapboxgl.GeoJSONSource | undefined;
    if (!fonte) return;

    if (!mostrarTodos) {
      fonte.setData(COLECAO_VAZIA);
      return;
    }

    fonte.setData({
      type: 'FeatureCollection',
      features: motoristas
        .map((item, indice) => ({ item, indice, rota: rotasVisaoGeral[item.id] }))
        .filter(({ rota }) => (rota?.coords?.length ?? 0) >= 2)
        .map(({ item, indice, rota }) => ({
          type: 'Feature' as const,
          properties: { cor: corDoMotorista(indice), motorista: item.nome },
          geometry: { type: 'LineString' as const, coordinates: rota.coords },
        })),
    });
  }, [mostrarTodos, motoristas, rotasVisaoGeral, mapaPronto]);

  // Pino do hospital de cada motorista na visão geral. Sem ele o escritório vê
  // a linha sair do motorista e morrer no nada — o destino é metade da resposta.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;

    marcadoresDestinoGeralRef.current.forEach((marcador) => marcador.remove());
    marcadoresDestinoGeralRef.current = [];
    if (!mostrarTodos) return;

    marcadoresDestinoGeralRef.current = motoristas
      .map((item) => ({ item, rota: rotasVisaoGeral[item.id] }))
      .filter(({ rota }) => Array.isArray(rota?.destino))
      .map(({ item, rota }) =>
        new mapboxgl.Marker({ element: criarMarcador('🏥'), anchor: 'bottom' })
          .setLngLat(rota.destino)
          .setPopup(
            new mapboxgl.Popup({ offset: 28, closeButton: false }).setText(
              `${item.destino}\n${item.destinoEndereco}`
            )
          )
          .addTo(mapa)
      );
  }, [mostrarTodos, motoristas, rotasVisaoGeral, mapaPronto]);

  // Enquadramento. Em 2D mostra o trajeto inteiro; em 3D a câmera desce perto do
  // veículo, que é onde os prédios têm volume (a camada só existe do zoom 14 pra cima).
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto || mostrarTodos || rota.length < 2) return;

    if (visao3d) {
      // Cancela qualquer animação anterior (inclusive a que acompanha a van) e
      // aplica todos os parâmetros juntos. Isso evita a câmera parar no meio da
      // transição e parecer que o botão não funcionou.
      mapa.stop();
      mapa.easeTo({
        center: rota[posicaoIndice] ?? rota[0],
        zoom: ZOOM_3D,
        pitch: INCLINACAO_3D,
        bearing: ROTACAO_3D,
        duration: 1000,
        essential: true,
      });
      return;
    }

    const limites = rota.reduce(
      (bounds, ponto) => bounds.extend(ponto),
      new mapboxgl.LngLatBounds(rota[0], rota[0])
    );
    mapa.stop();
    mapa.jumpTo({ pitch: 0, bearing: 0 });
    enquadrarComSeguranca(mapa, limites, {
      padding: { top: 70, bottom: 140, left: 60, right: 60 },
      duration: 900,
    });
    // posicaoIndice fica de fora de propósito: reenquadrar a cada passo da
    // animação brigaria com o "seguir o veículo" logo abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rota, visao3d, mapaPronto, mostrarTodos]);

  // Liga/desliga a extrusão dos prédios junto com o modo.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto || !mapa.getLayer(LAYER_PREDIOS)) return;
    mapa.setLayoutProperty(
      LAYER_PREDIOS,
      'visibility',
      visao3d && !mostrarTodos ? 'visible' : 'none'
    );
    mapa.triggerRepaint();
  }, [visao3d, mapaPronto, mostrarTodos]);

  // Move o retrato do motorista e vai "comendo" a rota conforme ele avança.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;

    if (mostrarTodos) {
      marcadorMotoristaRef.current?.remove();
      marcadorMotoristaRef.current = null;
      marcadorMotoristaChaveRef.current = null;
      return;
    }

    // O pino fica na COORDENADA REAL publicada pelo motorista — é assim que o
    // app do vendedor mostra, e é o que o escritório precisa ver.
    //
    // Antes ele ficava grudado na linha da rota (`rota[posicaoIndice]`): com o
    // traçado errado ou desatualizado, o motorista aparecia numa rua onde nunca
    // esteve. O ponto da rota agora é só contingência, para o instante entre
    // abrir o card e o primeiro ponto chegar.
    const posicao = posicaoAoVivo
      ? paraLngLat(posicaoAoVivo)
      : rota[posicaoIndice] ?? rota[0] ?? (motorista.origem ? paraLngLat(motorista.origem) : null);
    if (!posicao) {
      marcadorMotoristaRef.current?.remove();
      marcadorMotoristaRef.current = null;
      marcadorMotoristaChaveRef.current = null;
      return;
    }

    const chaveFoto = `${motorista.id}|${motorista.fotoMotorista}|${motorista.nome}`;

    // Ao trocar de card, recria o elemento para que a foto acompanhe o motorista
    // selecionado; a instância do mapa continua sendo reaproveitada.
    if (!marcadorMotoristaRef.current || marcadorMotoristaChaveRef.current !== chaveFoto) {
      marcadorMotoristaRef.current?.remove();
      marcadorMotoristaRef.current = new mapboxgl.Marker({
        element: criarMarcadorMotorista(motorista),
      })
        .setLngLat(posicao)
        .setPopup(
          new mapboxgl.Popup({ offset: 30, closeButton: false }).setText(
            `${motorista.nome} • ${motorista.placa}`
          )
        )
        .addTo(mapa);
      marcadorMotoristaChaveRef.current = chaveFoto;
    } else {
      marcadorMotoristaRef.current.setLngLat(posicao);
    }

    (mapa.getSource(SRC_PERCORRIDO) as mapboxgl.GeoJSONSource)?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: rota.slice(0, posicaoIndice + 1) },
    });

    // Em 3D a câmera acompanha o motorista a cada ponto novo, reafirmando zoom,
    // inclinação e rotação (antes esta animação podia interromper o movimento do
    // botão e deixar a câmera quase plana). Em 2D mantemos a rota enquadrada.
    //
    // Não depende mais de `posicaoIndice > 0`: com a rota sendo redesenhada a
    // partir da posição atual, o índice fica quase sempre em 0 e a câmera
    // deixava de seguir justamente quem ela deveria seguir.
    if (visao3d) {
      mapa.easeTo({
        center: posicao,
        zoom: ZOOM_3D,
        pitch: INCLINACAO_3D,
        bearing: ROTACAO_3D,
        duration: 900,
        essential: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rota,
    posicaoIndice,
    // O pino segue o GPS: sem estas duas, ele só se mexia quando o índice na
    // rota mudava — ou seja, quase nunca.
    posicaoAoVivo?.[0],
    posicaoAoVivo?.[1],
    mapaPronto,
    visao3d,
    motorista.id,
    motorista.nome,
    motorista.placa,
    motorista.fotoMotorista,

    mostrarTodos,
  ]);

  // Marcador do hospital, refeito quando troca o destino.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return;

    if (mostrarTodos) {
      marcadorDestinoRef.current?.remove();
      marcadorDestinoRef.current = null;
      return;
    }

    const destino = destinoResolvido;
    if (!destino) {
      marcadorDestinoRef.current?.remove();
      marcadorDestinoRef.current = null;
      return;
    }
    const popup = new mapboxgl.Popup({ offset: 28, closeButton: false }).setText(
      `${motorista.destino}\n${motorista.destinoEndereco}`
    );

    if (!marcadorDestinoRef.current) {
      marcadorDestinoRef.current = new mapboxgl.Marker({
        element: criarMarcador('🏥'),
        anchor: 'bottom',
      })
        .setLngLat(destino)
        .setPopup(popup)
        .addTo(mapa);
    } else {
      marcadorDestinoRef.current.setLngLat(destino).setPopup(popup);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chaveRota,
    motorista.destino,
    motorista.destinoEndereco,
    mapaPronto,
    mostrarTodos,
    destinoResolvido,
  ]);

  // Pinos das PRÓXIMAS paradas — os hospitais da viagem que não são o destino
  // atual. Aparecem apagados e sem rota: o traçado continua indo só até a
  // parada da vez (a Directions é paga por chamada, e a ordem seguinte pode
  // mudar quando ele terminar esta entrega).
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !mapaPronto) return undefined;

    const limpar = () => {
      marcadoresProximasParadasRef.current.forEach((marcador) => marcador.remove());
      marcadoresProximasParadasRef.current = [];
    };

    limpar();
    // Na visão geral cada motorista já tem o pino do próprio destino; somar as
    // paradas seguintes de todos entulharia o mapa.
    if (mostrarTodos || motorista.paradas.length < 2 || !origemRota) return limpar;

    let ativo = true;
    const origem = paraLngLat(origemRota);

    Promise.all(
      motorista.paradas.slice(1).map(async (parada) => ({
        parada,
        ponto: await resolverDestinoComCache(
          parada.destinoBusca,
          parada.destinoEndereco,
          origem,
          cadastroParaLngLat(parada.coordenada)
        ),
      }))
    ).then((resolvidas) => {
      if (!ativo) return;
      resolvidas.forEach(({ parada, ponto }, indice) => {
        if (!ponto) return;
        // O emoji fica num filho próprio: o `drop-shadow` de `criarMarcador`
        // é aplicado ao elemento inteiro, e sem essa separação ele borraria
        // também o número da ordem.
        const elemento = document.createElement('div');
        elemento.style.position = 'relative';
        elemento.style.opacity = '0.65';
        elemento.appendChild(criarMarcador('🏥'));

        // A ordem da parada no pino: no mapa, "2" e "3" é o que diz em que
        // sequência ele passa por aqui.
        const ordem = document.createElement('div');
        ordem.textContent = String(indice + 2);
        ordem.style.cssText =
          'position:absolute;top:-6px;right:-8px;width:18px;height:18px;border-radius:9999px;' +
          'background:#2d3748;color:#fff;font:bold 11px/18px sans-serif;text-align:center;' +
          'box-shadow:0 1px 4px rgba(0,0,0,.4)';
        elemento.appendChild(ordem);

        const marcador = new mapboxgl.Marker({ element: elemento, anchor: 'bottom' })
          .setLngLat(ponto)
          .setPopup(
            new mapboxgl.Popup({ offset: 28, closeButton: false }).setText(
              `${indice + 2}ª parada: ${parada.destino}\n${parada.destinoEndereco}`
            )
          )
          .addTo(mapa);
        marcadoresProximasParadasRef.current.push(marcador);
      });
    });

    return () => {
      ativo = false;
      limpar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapaPronto,
    mostrarTodos,
    motorista.id,
    motorista.paradas.map((parada) => parada.id).join(','),
    origemRota?.[0],
    origemRota?.[1],
  ]);

  // Mede a viagem inteira (origem da entrega → hospital) UMA vez por motorista,
  // só para servir de régua ao percentual. É uma requisição da Directions por
  // entrega, não por ciclo: a chave inclui as coordenadas, então o polling de
  // 10s não a refaz. O traçado desenhado continua sendo o que falta daqui até o
  // hospital — são coisas diferentes e é justamente por isso que o traçado não
  // serve de régua.
  useEffect(() => {
    const origemViagem = motorista.origem;
    if (!TOKEN || !origemViagem || !destinoResolvido) return undefined;

    const origem = paraLngLat(origemViagem);
    const chave = `${motorista.id}|${origem.join(',')}|${destinoResolvido.join(',')}`;
    if (trajetoMedidoRef.current === chave) return undefined;
    trajetoMedidoRef.current = chave;

    let ativo = true;
    fetch(
      'https://api.mapbox.com/directions/v5/mapbox/driving/' +
        `${origem[0]},${origem[1]};${destinoResolvido[0]},${destinoResolvido[1]}` +
        `?overview=false&access_token=${TOKEN}`
    )
      .then((resposta) => resposta.json())
      .then((res) => {
        const distancia = res?.routes?.[0]?.distance;
        if (ativo && typeof distancia === 'number' && distancia > 0) setReguaTrajetoM(distancia);
      })
      .catch(() => {
        // Sem a medição o percentual cai no comportamento antigo (o maior
        // trecho já visto nesta aba) em vez de sumir da tela.
      });

    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motorista.id, motorista.origem?.[0], motorista.origem?.[1], destinoResolvido]);

  const distancias = distanciasRef.current;
  const distanciaTotal = distancias[distancias.length - 1] ?? 0;
  const distanciaPercorrida = distancias[posicaoIndice] ?? 0;
  const distanciaRestanteM = Math.max(0, distanciaTotal - distanciaPercorrida);
  // Medido contra o trajeto inteiro, não contra o trecho que ainda falta — se ele
  // andar para longe, o restante passa a régua e o progresso fica em 0, nunca negativo.
  const distanciaDoTrajeto = Math.max(
    reguaTrajetoM,
    distanciaDoTrajetoRef.current,
    distanciaRestanteM
  );
  const progresso =
    distanciaDoTrajeto > 0 ? Math.min(1, 1 - distanciaRestanteM / distanciaDoTrajeto) : 0;
  const etaMinutos =
    velocidadeMediaMps > 0 ? Math.max(1, Math.round(distanciaRestanteM / velocidadeMediaMps / 60)) : 0;

  // Carga entregue (ou cancelada) não tem mais previsão nem progresso: o app do
  // motorista para de publicar posição nesse instante, então qualquer ETA aqui
  // seria uma conta sobre o último ponto conhecido, congelado. O mapa continua
  // mostrando o trajeto que foi percorrido.
  const viagemEncerrada = motorista.status === 'ENTREGUE' || motorista.status === 'CANCELADO';
  const rotuloViagemEncerrada =
    motorista.status === 'ENTREGUE' ? 'Entrega concluída' : 'Entrega cancelada';

  if (!TOKEN) {
    return (
      <Flex
        flex={1}
        direction="column"
        align="center"
        justify="center"
        bg="gray.800"
        borderRadius="lg"
        p={8}
        textAlign="center"
      >
        <Text fontWeight="bold" mb={2}>
          Mapa não configurado
        </Text>
        <Text fontSize="sm" color="gray.400" maxW="420px">
          Falta a variável <b>REACT_APP_MAPBOX_TOKEN</b> no build da aplicação. Configure um token
          público da Mapbox no ambiente do serviço e publique uma nova versão.
        </Text>
      </Flex>
    );
  }

  return (
    <Box
      position="relative"
      flex={1}
      borderRadius="lg"
      overflow="hidden"
      minH={{ base: '620px', xl: '0' }}
    >
      <Button
        position="absolute"
        data-preservar-selecao="true"
        display={mostrarTodos ? 'none' : 'inline-flex'}
        top={3}
        left={3}
        zIndex={20}
        size="sm"
        leftIcon={<FaCube />}
        isDisabled={!mapaPronto || carregandoRota || rota.length < 2}
        bg={visao3d ? 'orange.200' : 'gray.900'}
        color={visao3d ? 'gray.900' : 'white'}
        border="2px solid"
        borderColor={visao3d ? 'orange.200' : 'blue.300'}
        fontWeight="bold"
        boxShadow="0 3px 10px rgba(0, 0, 0, 0.38)"
        _hover={{
          bg: visao3d ? '#ff9a52' : 'gray.800',
          color: visao3d ? 'gray.900' : 'white',
        }}
        _active={{ transform: 'translateY(1px)' }}
        _disabled={{ bg: 'gray.700', color: 'gray.200', opacity: 1, cursor: 'wait' }}
        aria-pressed={visao3d}
        onClick={(event) => {
          event.stopPropagation();
          onAlternarVisao3d();
        }}
      >
        {!mapaPronto || carregandoRota ? 'Carregando mapa' : visao3d ? 'Ver em 2D' : 'Ver em 3D'}
      </Button>

      {semPosicaoConhecida && !mostrarTodos && (
        <Badge
          position="absolute"
          top="56px"
          left={3}
          zIndex={20}
          colorScheme="yellow"
          px={3}
          py={1}
          borderRadius="md"
        >
          Aguardando o primeiro GPS do motorista
        </Badge>
      )}

      {erroRota && !semPosicaoConhecida && !mostrarTodos && (
        <Badge
          position="absolute"
          top="56px"
          left={3}
          zIndex={20}
          colorScheme="red"
          px={3}
          py={1}
          borderRadius="md"
        >
          {motivoErroRota === 'destino'
            ? 'Endereço do hospital não localizado no mapa'
            : 'Não foi possível carregar a rota real'}
        </Badge>
      )}

      <Box ref={containerRef} position="absolute" inset={0} />

      {!mostrarTodos && (
        <Grid
          data-preservar-selecao="true"
          position="absolute"
          bottom={4}
          left={4}
          right={4}
          zIndex={10}
          templateColumns={{
            base: 'minmax(0, 1fr) auto',
            xl: 'minmax(210px, 0.8fr) 120px minmax(360px, 2fr) minmax(170px, 0.55fr)',
          }}
          alignItems="center"
          columnGap={{ base: 3, xl: 4 }}
          bg="gray.800"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="xl"
          px={{ base: 3, xl: 4 }}
          py={3}
          boxShadow="dark-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <Flex
            display={{ base: 'none', xl: 'flex' }}
            align="center"
            gap={3}
            minW={0}
            pr={4}
            borderRight="1px solid"
            borderColor="whiteAlpha.200"
          >
            <FotoMotorista src={motorista.fotoMotorista} nome={motorista.nome} size="52px" />
            <Box minW={0}>
              <Text fontSize="10px" color="gray.400" letterSpacing="wide">
                MOTORISTA
              </Text>
              <Text fontSize="sm" fontWeight="bold" isTruncated>
                {motorista.nome}
              </Text>
              <Text fontSize="xs" color="orange.200" fontWeight="bold">
                {motorista.placa}
              </Text>
            </Box>
          </Flex>

          <Flex
            display={{ base: 'none', xl: 'flex' }}
            direction="column"
            align="center"
            minW={0}
            pr={4}
            borderRight="1px solid"
            borderColor="whiteAlpha.200"
          >
            <Text mb={1} fontSize="10px" color="gray.400" letterSpacing="wide">
              VEÍCULO
            </Text>
            <FotoVeiculo width="84px" height="54px" />
          </Flex>

          <Box minW={0}>
            {/* Com mais de uma parada, o rodapé é sobre a PRÓXIMA — é dela que
                é o traçado e o tempo estimado ao lado. */}
            <Text fontSize="10px" color="gray.400" letterSpacing="wide">
              {motorista.paradas.length > 1 ? 'PRÓXIMO DESTINO' : 'DESTINO'}
            </Text>
            <Text fontSize={{ base: 'sm', xl: 'md' }} fontWeight="bold" isTruncated>
              {motorista.destino}
            </Text>
            <Text
              display={{ base: 'none', md: 'block' }}
              fontSize="xs"
              color="gray.400"
              isTruncated
            >
              {motorista.destinoEndereco}
            </Text>
            <Flex align="center" justify="space-between" gap={3} mt={2}>
              <Text fontSize="xs" color="gray.500" isTruncated>
                {/* As notas desta parada, não as da viagem inteira: é o que
                    desce aqui. O restante está em Detalhes. */}
                {resumoNotas(motorista.paradas[0]?.notas || motorista.notas)}
                {motorista.paradas.length > 1 &&
                  ` · +${motorista.paradas.length - 1} ${
                    motorista.paradas.length === 2 ? 'parada' : 'paradas'
                  }`}
              </Text>
              <Button
                flexShrink={0}
                size="xs"
                variant="outline"
                colorScheme="orange"
                onClick={onVerDetalhes}
              >
                Detalhes
              </Button>
            </Flex>
          </Box>

          <Box
            minW={{ base: '92px', md: '150px' }}
            pl={{ base: 3, xl: 4 }}
            textAlign="right"
            borderLeft="1px solid"
            borderColor="whiteAlpha.200"
          >
            <Text
              fontSize={{ base: 'xl', xl: '2xl' }}
              fontWeight="black"
              color="orange.200"
              lineHeight="1"
              whiteSpace="nowrap"
            >
              {viagemEncerrada
                ? '✓'
                : carregandoRota || erroRota || semPosicaoConhecida
                ? '--'
                : etaMinutos}
              <Text as="span" fontSize="sm" fontWeight="bold">
                {viagemEncerrada ? '' : ' min'}
              </Text>
            </Text>
            <Text
              mt={1}
              display={{ base: 'none', md: 'block' }}
              fontSize="xs"
              color="gray.400"
              whiteSpace="nowrap"
            >
              {viagemEncerrada
                ? rotuloViagemEncerrada
                : semPosicaoConhecida
                ? 'Sem posição do motorista'
                : erroRota
                ? 'Rota indisponível'
                : `${Math.round(progresso * 100)}% do trajeto • com trânsito`}
            </Text>
          </Box>
        </Grid>
      )}
    </Box>
  );
};
