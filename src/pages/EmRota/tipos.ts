/**
 * Formato que a tela de Entregas renderiza.
 *
 * A fonte é sempre a API (src/service/entregas.ts): GET /entregas/em-rota para a
 * lista e GET /entregas/:id/posicao para a posição ao vivo. Campo que o backend
 * ainda não manda fica vazio — a tela mostra vazio, não inventa exemplo.
 */

export interface ItemNota {
  descricao: string;
  quantidade: number;
}

/** Uma nota fiscal da carga — um mesmo hospital pode receber várias na mesma viagem. */
export interface NotaEntrega {
  numero: string;
  /** Pedido de origem no ERP. */
  pedido: string;
  paciente: string;
  medico: string;
  convenio: string;
  status: 'PENDENTE' | 'ENTREGUE';
  /** Horário confirmado da entrega, preenchido pelo backend ao finalizar a nota. */
  horarioEntrega?: string;
  volumes: number;
  valor: number;
  itens: ItemNota[];
}

/**
 * Uma parada da viagem: um hospital, com as notas que descem nele.
 *
 * O card é do MOTORISTA, e um motorista pode ter mais de uma entrega aberta ao
 * mesmo tempo. Antes cada hospital virava um card, e a lista mostrava o mesmo
 * motorista repetido — parecia dois entregadores na rua quando existe um só.
 */
export interface ParadaEntrega {
  /** entrega_id da primeira entrega desta parada — chave de render e do GPS. */
  id: string;
  /** entrega_id de todas as entregas que descem neste mesmo hospital. */
  entregaIds: string[];
  destino: string;
  destinoBusca: string;
  destinoEndereco: string;
  /** Empresa(s) dona(s) da carga desta parada (Suplen / NeuroVasc). */
  empresa: string;
  status: MotoristaEmRota['status'];
  notas: NotaEntrega[];
  /**
   * [lat, lng] do hospital quando o pedido traz coordenada. null obriga o mapa
   * a geocodificar pelo endereço — e impede ordenar esta parada por distância.
   */
  coordenada: [number, number] | null;
  /**
   * Metros em linha reta entre o GPS atual do motorista e esta parada, quando
   * as duas pontas são conhecidas. É a régua da ordem das paradas: aproximação
   * (não é distância de rua), suficiente para dizer para onde ele vai primeiro.
   */
  distanciaM: number | null;
}

export interface MotoristaEmRota {
  /** entrega_id — é por ele que o mapa consulta a posição. */
  id: string;
  nome: string;
  /** URL da foto do cadastro do colaborador; vazio mostra as iniciais. */
  fotoMotorista: string;
  veiculo: string;
  modeloVeiculo: string;
  corVeiculo: string;
  placa: string;
  anoVeiculo: string;
  fotoVeiculo: string;
  /**
   * Etapa da carga. COLETADO e CANCELADO vêm do enum STATUS_ENTREGA do banco;
   * CHEGANDO é um estado só da tela (ainda não existe no backend).
   */
  status: 'COLETADO' | 'EM ROTA' | 'CHEGANDO' | 'ENTREGUE' | 'CANCELADO';
  /**
   * Paradas da viagem, JÁ ORDENADAS: a primeira é para onde ele vai agora
   * (a mais próxima do GPS atual). Sempre tem ao menos uma.
   */
  paradas: ParadaEntrega[];
  /** Hospital da parada ATUAL (`paradas[0]`) — o que o card destaca. */
  destino: string;
  /**
   * Empresa(s) dona(s) da carga da parada atual (Suplen / NeuroVasc). O mesmo
   * hospital recebe carga das duas por causa do desmembramento de pedido, e o
   * nome do hospital não diferencia uma entrega da outra. Com notas das duas na
   * mesma parada, vêm as duas separadas por " · ".
   */
  empresa: string;
  /** entrega_id de TODAS as entregas da viagem — o card é do MOTORISTA, não da nota. */
  entregaIds: string[];
  /** Quantos hospitais diferentes esta viagem atende (1 na maioria das vezes). */
  qtdDestinos: number;
  /** Nome usado para localizar o POI do hospital da parada atual na Mapbox. */
  destinoBusca: string;
  destinoEndereco: string;
  /** Notas de TODAS as paradas — é a carga inteira que ele leva. */
  notas: NotaEntrega[];
  /**
   * [lat, lng] do primeiro GPS conhecido — início do traçado da rota.
   * null enquanto o motorista não publicou nenhuma posição: sem isso não existe
   * rota para desenhar, e a tela diz que está aguardando o primeiro sinal.
   */
  origem: [number, number] | null;
  /**
   * [lat, lng] do GPS MAIS RECENTE publicado — onde o motorista está agora.
   * Diferente de `origem`, que é o primeiro fix e existe só para traçar a rota:
   * é esta que o pino da visão geral tem que seguir, senão o escritório vê o
   * motorista parado no ponto de partida a viagem inteira.
   */
  posicaoAtual: [number, number] | null;
  /** timestamp (ms) do último GPS publicado; null enquanto não houver nenhum. */
  atualizadoEm: number | null;
}
