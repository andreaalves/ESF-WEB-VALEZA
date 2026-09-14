/**
 * Onde fica o hospital de destino.
 *
 * Vive fora do MapaEntrega porque não é só o mapa que precisa: a lista ordena
 * as paradas de um motorista pela mais próxima, e para isso tem que saber onde
 * cada hospital fica. O cadastro do cliente quase nunca traz coordenada (o
 * formulário de endereço grava 0 quando o campo fica em branco), então a fonte
 * na prática é esta busca por endereço/nome.
 *
 * Cada resolução é guardada em `destinosResolvidos`: sem o cache, a lista
 * recarregando a cada 20s dispararia uma busca por parada a cada ciclo.
 */

/** Ordem da Mapbox: [lng, lat] — o oposto de todo o resto da tela. */
export type LngLat = [number, number];

const TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || '';

/** Distância aproximada em metros entre dois pontos [lng, lat]. */
export const distanciaMetros = (a: LngLat, b: LngLat): number => {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
};

/**
 * "SEP/SUL, 0, ASA SUL, BRASILIA, DF" — aquele "0" é o número do cadastro e faz
 * o geocoder procurar um logradouro que não existe. Endereço de Brasília chega
 * assim com frequência (o número mora em `descricao_endereco`).
 */
const limparEnderecoParaBusca = (endereco?: string): string =>
  (endereco || '')
    .split(',')
    .map((parte) => parte.trim())
    .filter((parte) => parte && parte !== '0')
    .join(', ');

/** Cidade e UF do fim do endereço — é o contexto que a busca precisa. */
const regiaoDoEndereco = (endereco?: string): string => {
  const partes = limparEnderecoParaBusca(endereco).split(',').map((p) => p.trim()).filter(Boolean);
  return partes.slice(-2).join(', ');
};

/**
 * "ESHO - HOSPITAL ALVORADA DE BRASILIA": o prefixo da rede não existe no
 * cadastro do POI e afunda a busca — com ele o Mapbox devolvia o Hospital
 * Oftalmológico; sem ele, acha o Alvorada.
 */
const nomeParaBusca = (nome?: string): string =>
  (nome || '').replace(/^[A-Za-z0-9]{2,6}\s*[-–]\s*/, '').trim();

const semAcento = (texto?: string): string =>
  (texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

const PALAVRAS_SEM_VALOR = new Set([
  'HOSPITAL', 'HOSPITALAR', 'UNIDADE', 'CENTRO', 'CLINICA', 'MEDICO', 'MEDICA',
  'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'LTDA', 'SA', 'EIRELI',
]);

const tokensDoNome = (nome?: string): string[] =>
  semAcento(nome)
    .split(/[^A-Z0-9]+/)
    .filter((token) => token.length > 2 && !PALAVRAS_SEM_VALOR.has(token));

/**
 * O resultado tem que ser O hospital pedido, não outro da mesma cidade.
 *
 * Sem coordenada cadastrada não há como descartar por distância — e a busca
 * responde qualquer coisa: "Hospital Alvorada" trazia Santa Lúcia e Hospital
 * Urológico. Aceitar o primeiro resultado mandaria o escritório para o
 * endereço errado, que é pior do que não traçar rota.
 */
const resultadoCombinaComNome = (textoDoResultado: string, nome?: string): boolean => {
  const tokens = tokensDoNome(nome);
  if (!tokens.length) return false;
  const alvo = semAcento(textoDoResultado);
  const acertos = tokens.filter((token) => alvo.includes(token)).length;
  return acertos >= Math.max(1, Math.ceil(tokens.length * 0.75));
};

/** Raio de sanidade quando o destino sai da busca: mesma cidade/região. */
const RAIO_MAXIMO_DESTINO_M = 150000;

/**
 * Resolve o destino pelo ENDEREÇO textual que já é exibido ao motorista.
 *
 * Extraído para ser usado tanto pela rota detalhada (motorista selecionado)
 * quanto pelas rotas da visão geral, que precisam do mesmo destino — e do mesmo
 * critério, senão o mesmo hospital cairia em dois pontos diferentes no mapa.
 */
export const resolverDestinoDoHospital = async (
  nomeHospital: string,
  endereco: string | undefined,
  origem: LngLat
): Promise<LngLat | null> => {
  const nomeLimpo = nomeParaBusca(nomeHospital);
  const enderecoLimpo = limparEnderecoParaBusca(endereco);
  const regiao = regiaoDoEndereco(endereco);
  // A posição real do motorista serve apenas como proximidade para desempatar
  // endereços homônimos. A coordenada do cadastro do hospital não participa.
  const referencia = origem;

  // Endereço primeiro, exatamente como o app do motorista apresenta. A busca
  // por nome fica apenas como contingência para cadastros sem endereço. Um
  // resultado de endereço não precisa repetir o nome do hospital: "SGAS 613"
  // é válido mesmo que a feature retornada seja apenas a rua/quadra.
  const consultas: Array<{ texto: string; exigirNome: boolean; tipos?: string }> = [
    { texto: enderecoLimpo, exigirNome: false },
    { texto: nomeLimpo, exigirNome: true, tipos: 'poi' },
    { texto: [nomeLimpo, regiao].filter(Boolean).join(', '), exigirNome: true, tipos: 'poi' },
  ].filter((consulta, indice, lista) =>
    !!consulta.texto && lista.findIndex((item) => item.texto === consulta.texto) === indice
  );

  for (const consulta of consultas) {
    try {
      const parametrosBusca = new URLSearchParams({
        q: consulta.texto,
        country: 'br',
        limit: '5',
        language: 'pt',
        auto_complete: 'true',
        proximity: `${referencia[0]},${referencia[1]}`,
        access_token: TOKEN,
      });
      if (consulta.tipos) parametrosBusca.set('types', consulta.tipos);
      const respostaBusca = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/forward?${parametrosBusca.toString()}`
      );
      const resultadoBusca = await respostaBusca.json();

      for (const feature of resultadoBusca?.features || []) {
        const coordenadas = feature?.geometry?.coordinates;
        if (
          !Array.isArray(coordenadas) ||
          !Number.isFinite(coordenadas[0]) ||
          !Number.isFinite(coordenadas[1])
        ) {
          continue;
        }
        const ponto: LngLat = [coordenadas[0], coordenadas[1]];
        const texto = [
          feature?.properties?.name,
          feature?.properties?.full_address,
          feature?.properties?.place_formatted,
        ]
          .filter(Boolean)
          .join(' ');
        if (consulta.exigirNome && !resultadoCombinaComNome(texto, nomeLimpo)) continue;
        if (distanciaMetros(ponto, referencia) > RAIO_MAXIMO_DESTINO_M) continue;
        return ponto;
      }
    } catch {
      // Busca indisponível: cai para o cadastro/OSM abaixo.
    }
  }

  // Sem Mapbox útil, tenta o OpenStreetMap: primeiro pelo endereço e depois
  // pelo nome. Mantém a mesma regra de validação de cada tipo de consulta.
  for (const consulta of consultas) {
    try {
      const parametros = new URLSearchParams({
        q: consulta.texto,
        format: 'json',
        countrycodes: 'br',
        limit: '5',
        'accept-language': 'pt-BR',
      });
      const resposta = await fetch(
        `https://nominatim.openstreetmap.org/search?${parametros.toString()}`
      );
      const resultados = await resposta.json();
      for (const item of Array.isArray(resultados) ? resultados : []) {
        const lat = Number(item?.lat);
        const lon = Number(item?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const ponto: LngLat = [lon, lat];
        if (consulta.exigirNome && !resultadoCombinaComNome(item?.display_name || '', nomeLimpo)) continue;
        if (distanciaMetros(ponto, referencia) > RAIO_MAXIMO_DESTINO_M) continue;
        return ponto;
      }
    } catch {
      // Tenta a próxima consulta/fonte.
    }
  }

  return null;
};
/**
 * Chave do cache: o par nome+endereço é o que identifica um hospital para a
 * busca. A origem entra só como proximidade de desempate, então não faz parte
 * da chave — o mesmo hospital não pode resolver em dois pontos diferentes só
 * porque dois motoristas estão em bairros distintos.
 */
const chaveDestino = (nome: string, endereco?: string) =>
  `${semAcento(nome)}|${semAcento(endereco)}`;

/** [lng, lat] numérico e fora do (0,0), que fica no Atlântico. */
const coordenadaUtilizavel = (ponto?: LngLat | null): boolean =>
  Array.isArray(ponto) &&
  Number.isFinite(ponto[0]) &&
  Number.isFinite(ponto[1]) &&
  !(ponto[0] === 0 && ponto[1] === 0);

/** null = já buscamos e não achamos; undefined = ainda não buscamos. */
const destinosResolvidos = new Map<string, LngLat | null>();
const buscasEmAndamento = new Map<string, Promise<LngLat | null>>();

/**
 * Igual a `resolverDestinoDoHospital`, com cache em memória e sem repetir
 * busca já em andamento para o mesmo hospital.
 */
export const resolverDestinoComCache = (
  nomeHospital: string,
  endereco: string | undefined,
  origem: LngLat,
  cadastro?: LngLat | null
): Promise<LngLat | null> => {
  // Coordenada do cadastro vence, sem geocodificar e sem passar pelo cache:
  // foi conferida uma a uma contra CNPJ/CEP no CNES e na Receita, então
  // nenhuma busca por nome ou endereço é mais confiável do que ela. Era isso
  // que faltava para o Prontonorte (SHLN, Asa Norte) parar de ser desenhado
  // em Planaltina, a ~30 km do endereço certo.
  if (coordenadaUtilizavel(cadastro)) return Promise.resolve(cadastro as LngLat);

  const chave = chaveDestino(nomeHospital, endereco);
  if (destinosResolvidos.has(chave)) {
    return Promise.resolve(destinosResolvidos.get(chave) as LngLat | null);
  }
  const emAndamento = buscasEmAndamento.get(chave);
  if (emAndamento) return emAndamento;

  const busca = resolverDestinoDoHospital(nomeHospital, endereco, origem)
    .then((ponto) => {
      destinosResolvidos.set(chave, ponto);
      return ponto;
    })
    .catch(() => {
      // `resolverDestinoDoHospital` já trata falha de busca devolvendo null
      // (que É resposta: "procurei e não existe", e fica no cache). Aqui só
      // chega erro inesperado — esse não vira cache, para o ciclo seguinte
      // poder tentar de novo.
      return null;
    })
    .finally(() => {
      buscasEmAndamento.delete(chave);
    });

  buscasEmAndamento.set(chave, busca);
  return busca;
};

/** O que já está resolvido, sem disparar busca — para leitura síncrona. */
export const destinoJaResolvido = (nome: string, endereco?: string): LngLat | null =>
  destinosResolvidos.get(chaveDestino(nome, endereco)) ?? null;

/**
 * Já tentamos buscar este hospital? Distingue "busquei e não achei" (cacheado
 * como null) de "ainda não busquei". Sem essa diferença, um hospital que a
 * busca não encontra seria reconsultado a cada ciclo de posição, para sempre.
 */
export const destinoJaConsultado = (nome: string, endereco?: string): boolean =>
  destinosResolvidos.has(chaveDestino(nome, endereco));
