import api from './api';
import { MotoristaEmRota, NotaEntrega, ParadaEntrega } from '../pages/EmRota/tipos';

/**
 * Módulo de entregas da ESF-API.
 *
 * ATENÇÃO ao caminho: o baseURL desta web é a RAIZ da API, não o
 * /api-essencial/v1 — cada chamada escreve o prefixo (é assim no resto do
 * projeto, ver SurgicalMap). As rotas antigas deste arquivo iam sem o prefixo e
 * batiam num caminho que não existe em servidor nenhum.
 *
 * O contrato real está em ESF-API `src/routes/Entrega/entrega.routes.ts` — NÃO
 * é o que o CONTRATO-BACKEND-TELAS-AGENDAMENTO.md pedia. O que muda para esta
 * tela:
 *
 * - Não existe `GET /entregas/em-rota`. A visão do escritório se monta com
 *   `GET /entregas/empresa/:empresa_id` (uma chamada por empresa, porque a
 *   Suplen e a NeuroVasc são empresas distintas e as duas entregam) e o filtro
 *   de status é feito aqui — por isso as três visões (mapa, canhotos e a baia
 *   do Kanban) saem todas do mesmo `buscarEntregasCruas`.
 * - O retorno é snake_case e MAGRO: entrega_id, status, datas/horas de cada
 *   etapa e um `pedido` aninhado com pedido_erp, nota_erp e o nome do cliente.
 *   Endereço e coordenadas do hospital saem de `GET /pedidos/:id`.
 * - O NOME DO MOTORISTA vem junto, no relacionamento `motorista`
 *   (`{ usuario_id, name }`): `entregas.motorista_id` referencia **usuarios**,
 *   não `colaboradores`, e o nome mora em `name`. O rótulo genérico
 *   "Motorista" só aparece se a API responder sem esse relacionamento.
 * - A posição ao vivo é um módulo à parte: `/rotas-entregas`, NÃO
 *   `/entregas/:id/posicao`. Cada leitura de GPS grava uma linha nova, então
 *   existe tanto "onde ele está agora" quanto o trajeto inteiro percorrido.
 */

const PREFIXO = '/api-essencial/v1';

/** Status da entrega no Postgres (enum STATUS_ENTREGA). */
export type StatusEntregaApi = 'COLETADO' | 'EM_ROTA' | 'ENTREGUE' | 'CANCELADO';

/** Uma nota da carga, como vem na listagem em rota. */
export interface NotaEntregaApi {
  numeroNf?: string;
  chaveNf?: string;
}

/** Uma entrega em rota, já normalizada a partir do retorno snake_case da API. */
export interface EntregaEmRotaApi {
  entregaId: string;
  motoristaId?: string;
  nomeMotorista?: string;
  fotoMotorista?: string;
  veiculo?: string;
  placa?: string;
  status?: string;
  cliente?: string;
  enderecoEntrega?: string;
  latitude?: number;
  longitude?: number;
  notas?: NotaEntregaApi[];
  /** Empresa dona da nota — o mesmo hospital recebe carga da Suplen e da NeuroVasc. */
  empresaNome?: string;
  pedidoId?: string;
  pedidoErp?: string;
}

/** Corpo do GET /entregas/:id/posicao. `timestamp` é epoch em MILISSEGUNDOS. */
export interface PosicaoEntregaApi {
  entregaId: string;
  lat: number;
  lng: number;
  precisao: number;
  timestamp: number;
}

/** Erro de rota inexistente — o módulo de entregas ainda não subiu no backend. */
export class ModuloEntregasIndisponivelError extends Error {
  constructor() {
    super('Módulo de entregas ainda não publicado no backend.');
    this.name = 'ModuloEntregasIndisponivelError';
  }
}

const ehRotaInexistente = (erro: any) =>
  erro?.response?.status === 404 || erro?.response?.status === 405 || erro?.response?.status === 501;

const numeroOuNulo = (valor: any): number | null => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
};

/** Só os status que a lista sabe colorir; qualquer outro entra como EM ROTA. */
/**
 * Uma linha de `rotas_entregas` no formato que a tela usa. `capturado_em` é o
 * instante da LEITURA do GPS (o app manda como timestamp em ms; o banco guarda
 * como data), não a hora em que o ponto chegou no servidor.
 */
const adaptarPonto = (ponto: any, entregaId: string): PosicaoEntregaApi | null => {
  const lat = numeroOuNulo(ponto?.latitude ?? ponto?.lat);
  const lng = numeroOuNulo(ponto?.longitude ?? ponto?.lng);
  if (lat === null || lng === null) return null;
  const capturadoEm = ponto?.capturado_em ? Date.parse(ponto.capturado_em) : NaN;
  return {
    entregaId: String(ponto?.entrega_id || entregaId),
    lat,
    lng,
    precisao: numeroOuNulo(ponto?.precisao) ?? 0,
    timestamp: Number.isFinite(capturadoEm) ? capturadoEm : numeroOuNulo(ponto?.timestamp) ?? Date.now(),
  };
};

const normalizarStatus = (status?: string): MotoristaEmRota['status'] => {
  // A API manda o enum do Postgres com underline (EM_ROTA); a tela escreve e
  // colore por 'EM ROTA'.
  const valor = String(status || '').toUpperCase().replace('_', ' ');
  if (valor === 'COLETADO' || valor === 'ENTREGUE' || valor === 'CANCELADO' || valor === 'CHEGANDO') {
    return valor;
  }
  return 'EM ROTA';
};

/**
 * A listagem traz só número e chave da NF. Paciente, médico, convênio e itens
 * são do detalhamento do pedido e ainda não vêm nessa rota — ficam em branco em
 * vez de inventados, porque o modal mostra esses campos para o escritório.
 */
const adaptarNotas = (notas?: NotaEntregaApi[], pedidoErp?: string): NotaEntrega[] =>
  (notas || []).map((nota) => ({
    numero: String(nota?.numeroNf || nota?.chaveNf || ''),
    pedido: pedidoErp || '',
    paciente: '',
    medico: '',
    convenio: '',
    status: 'PENDENTE',
    volumes: 0,
    valor: 0,
    itens: [],
  }));

/**
 * Distância aproximada, em metros, entre dois pares [lat, lng].
 *
 * Haversine em linha reta — não é distância de rua. Serve só para ORDENAR as
 * paradas de um motorista: para dizer se ele está indo ao Sírio ou ao DF Star
 * agora, o erro da linha reta é irrelevante, e assim não se gasta uma chamada
 * paga da Directions por parada só para descobrir a ordem.
 */
const distanciaAproximadaM = (a: [number, number], b: [number, number]): number => {
  const R = 6371000;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Onde fica o hospital de uma parada, quando quem chama já sabe.
 *
 * O cadastro do cliente quase nunca traz coordenada válida, então a posição
 * real vem da geocodificação que a tela já faz para desenhar o mapa
 * (`destinoHospital.ts`). A tela injeta isso aqui para que a ordem das paradas
 * use a mesma posição que o mapa desenha.
 */
export type ResolverCoordenadaParada = (
  destino: string,
  endereco: string
) => [number, number] | null;

/** Converte as entregas de UM HOSPITAL numa parada da viagem. */
const adaptarParada = (
  entregas: EntregaEmRotaApi[],
  posicaoAtual?: [number, number] | null,
  resolverCoordenada?: ResolverCoordenadaParada
): ParadaEntrega => {
  const principal = entregas[0];
  const cliente = principal?.cliente || 'Destino não informado';

  // Todas as entregas daqui descem no mesmo hospital; a empresa é que muda,
  // por causa do desmembramento de pedido entre Suplen e NeuroVasc.
  const empresas = Array.from(
    new Set(entregas.map((entrega) => entrega.empresaNome).filter(Boolean) as string[])
  );

  const cadastroLat = numeroOuNulo(principal?.latitude);
  const cadastroLng = numeroOuNulo(principal?.longitude);
  const endereco = principal?.enderecoEntrega || '';
  // A coordenada do cadastro vem primeiro: foi conferida uma a uma contra
  // CNPJ/CEP no CNES e na Receita, então nenhuma busca por nome ou endereço é
  // mais confiável do que ela. A geocodificação fica para quem ainda não tem
  // coordenada cadastrada. Antes era o contrário, e o Hospital Prontonorte
  // (SHLN, Asa Norte) era desenhado em Planaltina, a ~30 km do endereço certo.
  const coordenada: [number, number] | null =
    (cadastroLat !== null && cadastroLng !== null ? [cadastroLat, cadastroLng] : null) ||
    resolverCoordenada?.(cliente, endereco) ||
    null;

  return {
    id: String(principal?.entregaId || ''),
    entregaIds: entregas.map((entrega) => String(entrega.entregaId)).filter(Boolean),
    destino: cliente,
    destinoBusca: cliente,
    destinoEndereco: endereco,
    empresa: empresas.join(' · '),
    status: normalizarStatus(principal?.status),
    notas: entregas.reduce<NotaEntrega[]>(
      (acc, entrega) => acc.concat(adaptarNotas(entrega.notas, entrega.pedidoErp)),
      []
    ),
    coordenada,
    distanciaM: coordenada && posicaoAtual ? distanciaAproximadaM(posicaoAtual, coordenada) : null,
  };
};

/**
 * Converte as entregas de UM MOTORISTA no card da tela.
 *
 * O card é do MOTORISTA, não da nota nem da parada: na rua existe uma pessoa
 * dirigindo uma Fiorino, e é assim que o escritório enxerga. Antes o
 * agrupamento era motorista+hospital, então quem levava carga para dois
 * hospitais aparecia duas vezes na lista — parecia dois entregadores.
 *
 * As paradas saem ORDENADAS pela mais próxima do GPS atual (`paradas[0]` é para
 * onde ele vai agora). É uma aproximação em linha reta, não a ordem que ele
 * declarou: o backend não registra sequência de rota, e iniciar as entregas
 * juntas deixa as horas de início idênticas.
 *
 * `origem` é o ponto de partida do traçado — o PRIMEIRO fix conhecido, não o
 * mais recente. A rota é recalculada sempre que a origem muda, e a Directions
 * da Mapbox é paga: alimentar a origem com o GPS ao vivo geraria uma requisição
 * a cada 10 segundos por aba aberta. O movimento entra pela prop `posicaoAoVivo`
 * do MapaEntrega.
 */
export const adaptarMotoristaEmRota = (
  entregas: EntregaEmRotaApi[],
  origemConhecida?: [number, number] | null,
  atualizadoEm?: number | null,
  posicaoAtual?: [number, number] | null,
  resolverCoordenada?: ResolverCoordenadaParada
): MotoristaEmRota => {
  const principal = entregas[0];

  const paradas = agruparPorParada(entregas)
    .map((doHospital) => adaptarParada(doHospital, posicaoAtual, resolverCoordenada))
    // Parada sem coordenada não tem como entrar na ordem por distância; vai
    // para o fim em vez de fingir que é a próxima do motorista.
    .sort((a, b) => (a.distanciaM ?? Infinity) - (b.distanciaM ?? Infinity));

  const atual = paradas[0];

  return {
    // A identidade do card é a do motorista: assim a seleção sobrevive ao
    // ciclo de 20s mesmo quando a parada da vez muda de lugar na ordem.
    id: String(principal?.motoristaId || principal?.entregaId || ''),
    entregaIds: entregas.map((entrega) => String(entrega.entregaId)).filter(Boolean),
    qtdDestinos: paradas.length,
    // O nome vem do relacionamento `motorista` da entrega. Vale qualquer uma da
    // viagem (o agrupamento já é por motorista), então basta a primeira que veio
    // preenchida; o rótulo genérico é só o caso de a API não mandar o nome.
    nome: entregas.map((entrega) => entrega.nomeMotorista).find(Boolean) || 'Motorista',
    fotoMotorista: principal?.fotoMotorista || '',
    veiculo: principal?.veiculo || '',
    modeloVeiculo: principal?.veiculo || 'Veículo não informado',
    corVeiculo: '',
    placa: principal?.placa || '',
    anoVeiculo: '',
    fotoVeiculo: '',
    // O status é o da PARADA ATUAL, não o da primeira entrega que a API listou:
    // depois da ordenação essas duas podem ser paradas diferentes, e o badge
    // ficaria descrevendo uma entrega que o card não está mostrando.
    status: atual?.status || normalizarStatus(principal?.status),
    paradas,
    // Os campos abaixo são os da PARADA ATUAL: é o que o card destaca e o que o
    // mapa traça. As demais paradas ficam em `paradas`.
    destino: atual?.destino || 'Destino não informado',
    empresa: atual?.empresa || '',
    destinoBusca: atual?.destinoBusca || '',
    destinoEndereco: atual?.destinoEndereco || '',
    // A carga INTEIRA da viagem, de todas as paradas — é o que o modal lista.
    notas: paradas.reduce<NotaEntrega[]>((acc, parada) => acc.concat(parada.notas), []),
    origem: origemConhecida || null,
    posicaoAtual: posicaoAtual || null,
    atualizadoEm: atualizadoEm ?? null,
  };
};

/** Chave de destino: coordenada quando existe, senão o texto normalizado. */
const chaveDoDestino = (entrega: EntregaEmRotaApi): string => {
  const lat = numeroOuNulo(entrega.latitude);
  const lng = numeroOuNulo(entrega.longitude);
  if (lat !== null && lng !== null) return `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const porTexto = `${entrega.cliente || ''}|${entrega.enderecoEntrega || ''}`
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
  return porTexto || `entrega:${entrega.entregaId}`;
};

/**
 * Junta as entregas de um mesmo motorista por HOSPITAL — são as paradas da
 * viagem dele. Duas NFs/cirurgias para o mesmo hospital viram uma parada só.
 */
export const agruparPorParada = (entregas: EntregaEmRotaApi[]): EntregaEmRotaApi[][] => {
  const grupos = new Map<string, EntregaEmRotaApi[]>();
  entregas.forEach((entrega) => {
    const chave = chaveDoDestino(entrega);
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(entrega);
    else grupos.set(chave, [entrega]);
  });
  return Array.from(grupos.values());
};

/**
 * Junta as entregas por MOTORISTA — um card por pessoa na rua.
 *
 * Hospitais diferentes do mesmo motorista NÃO se separam mais: viram paradas da
 * mesma viagem (ver `adaptarMotoristaEmRota`). Sem motorista identificado, cada
 * entrega fica isolada, para não fundir entregadores distintos num card só.
 */
export const agruparPorMotorista = (entregas: EntregaEmRotaApi[]): EntregaEmRotaApi[][] => {
  const grupos = new Map<string, EntregaEmRotaApi[]>();
  entregas.forEach((entrega) => {
    const chave = entrega.motoristaId || `sem-motorista:${entrega.entregaId}`;
    const grupo = grupos.get(chave);
    if (grupo) grupo.push(entrega);
    else grupos.set(chave, [entrega]);
  });
  return Array.from(grupos.values());
};

/** Uma empresa do cadastro (GET /empresas fica na RAIZ, sem o prefixo). */
interface EmpresaApi {
  empresa_id: string;
  fantasia?: string;
  razao_social?: string;
  filial?: string;
  excluido?: boolean;
}

/** Cache do detalhamento do pedido — a lista recarrega a cada 20s e o pedido não muda. */
const pedidosEmCache: Record<string, any> = {};

const empresasDoTenant = async (): Promise<EmpresaApi[]> => {
  const { data } = await api.get<EmpresaApi[]>('/empresas');
  return (Array.isArray(data) ? data : []).filter((empresa) => empresa?.empresa_id && !empresa?.excluido);
};

/**
 * Endereço e coordenadas do hospital, do pedido da entrega. A listagem de
 * entregas devolve só o nome do cliente; sem isto o mapa não tem para onde
 * apontar. Uma busca por pedido, guardada em cache.
 */
const detalharPedido = async (pedidoId: string): Promise<any | null> => {
  if (!pedidoId) return null;
  if (pedidoId in pedidosEmCache) return pedidosEmCache[pedidoId];
  try {
    const { data } = await api.get<any>(`${PREFIXO}/pedidos/${pedidoId}`);
    pedidosEmCache[pedidoId] = data || null;
  } catch {
    // Sem o pedido a entrega continua na lista, só sem destino no mapa.
    pedidosEmCache[pedidoId] = null;
  }
  return pedidosEmCache[pedidoId];
};

/** Converte um item cru de `GET /entregas/empresa/:id` para o formato da tela. */
const normalizarEntrega = (entrega: any, empresaNome: string): EntregaEmRotaApi => {
  const pedido = entrega?.pedido || {};
  const cliente = pedido?.clientes || {};
  const notaErp = pedido?.nota_erp || '';
  return {
    entregaId: String(entrega?.entrega_id || ''),
    motoristaId: entrega?.motorista_id || entrega?.motorista?.usuario_id || '',
    // O motorista é um `usuarios` (não um colaborador): o nome vem em `name`.
    nomeMotorista: entrega?.motorista?.name || '',
    fotoMotorista: '',
    veiculo: '',
    placa: '',
    status: String(entrega?.status || ''),
    cliente: cliente?.fantasia || cliente?.razao_social || '',
    empresaNome,
    pedidoId: pedido?.pedido_id || entrega?.pedido_id || '',
    pedidoErp: pedido?.pedido_erp || '',
    notas: notaErp ? [{ numeroNf: notaErp }] : [],
  };
};

/** Uma entrega como a API devolveu, junto do nome da empresa que a listou. */
interface EntregaCrua {
  bruto: any;
  empresaNome: string;
}

/**
 * TODAS as entregas do tenant, sem filtro de status — é o tronco comum das duas
 * telas: o mapa ao vivo (que fica só com as EM_ROTA) e o histórico de canhotos
 * (que quer a esteira inteira).
 *
 * Não existe rota que devolva o tenant de uma vez: a API lista por empresa,
 * então buscamos empresa a empresa. São poucas (Suplen e NeuroVasc), e é
 * justamente por serem duas que não dá para olhar só a do usuário logado.
 *
 * Lança ModuloEntregasIndisponivelError quando NENHUMA empresa respondeu — aí a
 * tela avisa que o módulo não está no ar, em vez de mostrar lista vazia como se
 * ninguém estivesse na rua.
 */
const buscarEntregasCruas = async (): Promise<EntregaCrua[]> => {
  let empresas: EmpresaApi[] = [];
  try {
    empresas = await empresasDoTenant();
  } catch (erro: any) {
    if (ehRotaInexistente(erro)) throw new ModuloEntregasIndisponivelError();
    throw erro;
  }
  if (!empresas.length) return [];

  const respostas = await Promise.all(
    empresas.map(async (empresa) => {
      try {
        const { data } = await api.get<any[]>(`${PREFIXO}/entregas/empresa/${empresa.empresa_id}`);
        const nome = empresa.fantasia || empresa.razao_social || empresa.filial || '';
        return {
          ok: true,
          itens: (Array.isArray(data) ? data : []).map((bruto) => ({ bruto, empresaNome: nome })),
        };
      } catch (erro: any) {
        return { ok: !ehRotaInexistente(erro), itens: [] as EntregaCrua[] };
      }
    })
  );

  if (respostas.every((resposta) => !resposta.ok)) throw new ModuloEntregasIndisponivelError();

  return respostas.flatMap((resposta) => resposta.itens);
};

/**
 * Entregas do mapa, filtradas pelos status pedidos pela tela.
 *
 * O acompanhamento não para na carga que está na rua: COLETADO (separada, ainda
 * na base) e ENTREGUE (já assinada) também aparecem quando a tela pede — a
 * diferença é que só quem está EM_ROTA publica GPS ao vivo; das outras o mapa
 * mostra o trajeto já registrado.
 */
export const listarEntregasParaMapa = async (
  statusDesejados: StatusEntregaApi[],
  enriquecerDestino = true
): Promise<EntregaEmRotaApi[]> => {
  const emRota = (await buscarEntregasCruas())
    .filter(({ bruto }) => statusDesejados.includes(String(bruto?.status || '') as StatusEntregaApi))
    .map(({ bruto, empresaNome }) => normalizarEntrega(bruto, empresaNome));

  // O Kanban precisa apenas saber quais pedidos estão na rua. Nesse uso, evita
  // um GET de detalhamento por entrega, pois endereço/coordenadas não participam
  // da definição da baia.
  if (!enriquecerDestino) return emRota;

  // O destino só existe no pedido; completa antes de devolver para a tela.
  await Promise.all(
    emRota.map(async (entrega) => {
      const pedido = await detalharPedido(entrega.pedidoId || '');
      const endereco = pedido?.clientes?.endereco;
      if (!endereco) return;
      entrega.enderecoEntrega = [
        endereco?.logradouro || endereco?.descricao_endereco,
        endereco?.numero,
        endereco?.bairro,
        endereco?.cidade,
        endereco?.uf,
      ]
        .filter(Boolean)
        .join(', ');
      if (!entrega.cliente) {
        entrega.cliente = pedido?.clientes?.fantasia || pedido?.clientes?.razao_social || '';
      }
      // Coordenada do hospital, quando o cadastro tem. É o que permite ordenar
      // as paradas de um motorista pela mais próxima. Zero NÃO é coordenada
      // válida aqui: o cadastro de endereço grava 0 quando o campo fica em
      // branco (ver CreateParams), e 0,0 fica no meio do Atlântico.
      const lat = numeroOuNulo(endereco?.latitude);
      const lng = numeroOuNulo(endereco?.longitude);
      if (lat && lng) {
        entrega.latitude = lat;
        entrega.longitude = lng;
      }
    })
  );

  return emRota;
};

/**
 * Ordem da esteira da entrega. CANCELADO fica no começo de propósito: uma carga
 * cancelada não pode ganhar de uma que saiu, quando o pedido tem as duas.
 */
const ORDEM_STATUS_ENTREGA: StatusEntregaApi[] = ['CANCELADO', 'COLETADO', 'EM_ROTA', 'ENTREGUE'];

/**
 * Status da entrega POR PEDIDO — é o que alimenta as baias EM ROTA e ENTREGUE
 * do Kanban.
 *
 * Um pedido pode ser desmembrado em mais de uma carga (Suplen e NeuroVasc na
 * mesma cirurgia), então vale a etapa mais avançada entre as entregas dele: o
 * pedido só é "entregue" para o Kanban quando não há carga dele ainda na rua.
 */
export const listarStatusEntregaPorPedido = async (): Promise<Record<string, StatusEntregaApi>> => {
  const porPedido: Record<string, StatusEntregaApi> = {};

  (await buscarEntregasCruas()).forEach(({ bruto }) => {
    const pedidoId = String(bruto?.pedido?.pedido_id || bruto?.pedido_id || '').trim();
    const status = String(bruto?.status || '') as StatusEntregaApi;
    const posicao = ORDEM_STATUS_ENTREGA.indexOf(status);
    if (!pedidoId || posicao < 0) return;

    const atual = porPedido[pedidoId];
    if (!atual || posicao > ORDEM_STATUS_ENTREGA.indexOf(atual)) porPedido[pedidoId] = status;
  });

  return porPedido;
};

// ─── Histórico de entregas / canhotos ────────────────────────────────────────

/** Uma etapa cumprida da entrega (coleta, saída para a rota, chegada). */
export interface EtapaEntrega {
  /** ISO `YYYY-MM-DD`, exatamente como veio do banco — ver `dataIso`. */
  data: string;
  /** `HH:MM`. */
  hora: string;
}

/** Uma linha da lista de canhotos. */
export interface EntregaHistorico {
  entregaId: string;
  status: StatusEntregaApi;
  motorista: string;
  cliente: string;
  empresaNome: string;
  pedidoErp: string;
  notaErp: string;
  /** Há arquivo de canhoto gravado para essa entrega (`canhoto_img` no banco). */
  temCanhoto: boolean;
  coleta: EtapaEntrega | null;
  inicioRota: EtapaEntrega | null;
  entrega: EtapaEntrega | null;
  motivoCancelamento: string;
  /** Chave de ordenação: a etapa mais recente já registrada. */
  ordenacao: string;
}

/**
 * As colunas `data_*` das entregas são `@db.Date` no Prisma e chegam como
 * meia-noite UTC (`2026-09-01T00:00:00.000Z`). Passar isso por `new Date()` no
 * fuso de Brasília (-3) devolve o DIA ANTERIOR — o mesmo tropeço que já
 * apareceu no Mapa Cirúrgico. Por isso ficamos com os 10 primeiros caracteres
 * da string, sem construir Date nenhum.
 */
const dataIso = (valor: any): string => String(valor || '').substring(0, 10);

/** `hora_*` é VARCHAR "HH:MM:SS", já gravado no fuso de Brasília pelo backend. */
const horaCurta = (valor: any): string => String(valor || '').substring(0, 5);

const montarEtapa = (data: any, hora: any): EtapaEntrega | null => {
  const iso = dataIso(data);
  return iso ? { data: iso, hora: horaCurta(hora) } : null;
};

const normalizarHistorico = ({ bruto, empresaNome }: EntregaCrua): EntregaHistorico => {
  const pedido = bruto?.pedido || {};
  const cliente = pedido?.clientes || {};
  const coleta = montarEtapa(bruto?.data_coleta, bruto?.hora_coleta);
  const inicioRota = montarEtapa(bruto?.data_inicio_rota, bruto?.hora_inicio_rota);
  const entrega = montarEtapa(bruto?.data_entrega, bruto?.hora_entrega);
  // A esteira é sequencial, então a etapa mais recente é a última preenchida.
  const ultima = entrega || inicioRota || coleta;

  return {
    entregaId: String(bruto?.entrega_id || ''),
    status: String(bruto?.status || 'COLETADO') as StatusEntregaApi,
    motorista: bruto?.motorista?.name || '',
    cliente: cliente?.fantasia || cliente?.razao_social || '',
    empresaNome,
    pedidoErp: pedido?.pedido_erp || '',
    notaErp: pedido?.nota_erp || '',
    // `canhoto_img` é só o caminho do arquivo no servidor; a imagem sai de
    // GET /entregas/:id/canhoto.
    temCanhoto: Boolean(bruto?.canhoto_img),
    coleta,
    inicioRota,
    entrega,
    motivoCancelamento: bruto?.motivo_cancelamento || '',
    ordenacao: ultima ? `${ultima.data} ${ultima.hora}` : dataIso(bruto?.data_cadastro),
  };
};

/**
 * Histórico de entregas do tenant, da mais recente para a mais antiga.
 *
 * Entrega CANCELADA fica DE FORA: é a carga que o motorista coletou e devolveu
 * sem entregar, então nunca vai existir canhoto dela — na tela de comprovantes
 * ela só somaria linha que jamais sai do "sem canhoto". O cancelamento continua
 * visível no acompanhamento do mapa.
 */
export const listarHistoricoEntregas = async (): Promise<EntregaHistorico[]> => {
  const entregas = (await buscarEntregasCruas())
    .map(normalizarHistorico)
    .filter((entrega) => entrega.status !== 'CANCELADO');
  return entregas.sort((a, b) => b.ordenacao.localeCompare(a.ordenacao));
};

/**
 * A imagem do canhoto assinado, como object URL pronto para um `<img>`.
 *
 * `GET /entregas/:id/canhoto` responde o ARQUIVO (res.sendFile) e passa pelo
 * middleware de autenticação, então não dá para apontar o `src` da imagem
 * direto para a URL: o browser não manda o header Authorization numa tag img.
 * Baixamos como blob pela instância do axios (que já leva o Bearer) e quem
 * chama fica responsável por revogar o object URL.
 *
 * Um 404 aqui não significa só "entrega inexistente": o backend grava o canhoto
 * no disco do próprio container (UPLOADS_DIR), então o arquivo pode ter sumido
 * num redeploy mesmo com `canhoto_img` preenchido no banco.
 */
export const obterCanhoto = async (entregaId: string): Promise<string> => {
  const { data } = await api.get(`${PREFIXO}/entregas/${entregaId}/canhoto`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(data as Blob);
};

/**
 * GET /rotas-entregas/entrega/:entrega_id — o ponto mais recente da entrega.
 *
 * **404 é resposta normal**: quer dizer que o motorista ainda não publicou
 * ponto nenhum dessa entrega. Continua valendo consultar no próximo ciclo — ele
 * publica a cada 10s. O corpo é a linha do banco (latitude/longitude/precisao/
 * capturado_em), não lat/lng/timestamp.
 */
export const obterPosicaoEntrega = async (entregaId: string): Promise<PosicaoEntregaApi | null> => {
  try {
    const { data } = await api.get<any>(`${PREFIXO}/rotas-entregas/entrega/${entregaId}`);
    return adaptarPonto(data, entregaId);
  } catch {
    // Inclui o 404 de "ainda sem posição": para a tela, é o mesmo que não ter.
    return null;
  }
};

/**
 * GET /rotas-entregas/entrega/:entrega_id/historico — todos os pontos, do mais
 * antigo para o mais recente.
 *
 * É daqui que sai a ORIGEM do traçado: o primeiro ponto realmente registrado.
 * Antes a origem era o primeiro fix que a aba tinha visto, guardado em memória
 * — recarregar a página perdia o começo da rota e o traçado nascia do meio do
 * caminho. Devolve array vazio quando ainda não há ponto (não 404).
 */
export const obterHistoricoRota = async (entregaId: string): Promise<PosicaoEntregaApi[]> => {
  try {
    const { data } = await api.get<any[]>(`${PREFIXO}/rotas-entregas/entrega/${entregaId}/historico`);
    return (Array.isArray(data) ? data : [])
      .map((ponto) => adaptarPonto(ponto, entregaId))
      .filter((ponto): ponto is PosicaoEntregaApi => ponto !== null);
  } catch {
    return [];
  }
};
