// Rótulo legível no lugar do código gravado em pedido.situacao.
const ROTULO_SITUACAO: Record<string, string> = {
  EM_ANALISE: 'Em análise',
  ERRO_INTEGRACAO: 'Erro de integração',
  AGUARDANDO_INTEGRACAO: 'Aguardando integração',
  PENDENTE: 'Pendente',
  PROCESSANDO: 'Processando',
  INTEGRADO: 'Integrado',
  BLOQUEADO: 'Bloqueado',
  FATURADO: 'Faturado',
  NOTA_CANCELADA: 'Nota cancelada',
  EXCLUIDO_ERP: 'Excluído no ERP',
  CANCELADO_ERP: 'Cancelado no ERP',
};

/** Código da situação normalizado (maiúsculo, sem espaços nas pontas). */
export function codigoSituacao(pedido: any): string {
  return String(pedido?.situacao || '').trim().toUpperCase();
}

/** Situação que o ERP devolver e não estiver no mapa sai como "Texto assim". */
export function rotuloSituacao(codigo: string): string {
  if (ROTULO_SITUACAO[codigo]) return ROTULO_SITUACAO[codigo];
  const texto = codigo.replace(/_/g, ' ').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// Situações em que alguém precisa agir: ficam sempre no filtro, mesmo zeradas.
const SITUACOES_FIXAS = ['EM_ANALISE', 'ERRO_INTEGRACAO'];

/**
 * Opções do filtro "Situação" da Lista de Pedidos: as fixas primeiro, depois
 * as demais situações que existem nos pedidos, cada uma com a sua contagem.
 * `selecionada` entra sempre, senão o select perderia a opção marcada quando
 * a contagem dela zera numa recarga.
 */
export function opcoesDeSituacao(
  pedidos: any[],
  selecionada = ''
): { codigo: string; rotulo: string; total: number }[] {
  const totais: Record<string, number> = {};
  pedidos.forEach((p) => {
    const codigo = codigoSituacao(p);
    if (codigo) totais[codigo] = (totais[codigo] || 0) + 1;
  });

  const demais = Object.keys(totais)
    .concat(selecionada ? [selecionada] : [])
    .filter((c, i, lista) => !SITUACOES_FIXAS.includes(c) && lista.indexOf(c) === i)
    .sort((a, b) => rotuloSituacao(a).localeCompare(rotuloSituacao(b)));

  return [...SITUACOES_FIXAS, ...demais].map((codigo) => ({
    codigo,
    rotulo: rotuloSituacao(codigo),
    total: totais[codigo] || 0,
  }));
}
