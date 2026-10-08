import api from './api';

/**
 * Aprovação do pedido pelo gestor (ESF-API, `alterarStatusPedido`): tira o
 * pedido de EM_ANALISE e o deixa PENDENTE, que é o que dispara a integração
 * com o ERP.
 *
 * ATENÇÃO ao caminho: o baseURL desta web é a RAIZ da API, não o
 * /api-essencial/v1 — cada chamada escreve o prefixo, como no resto do projeto.
 */

const PREFIXO = '/api-essencial/v1';

/** Teto do backend (zod: `nome_aprovador` max 255) — acima disso a rota responde 400. */
const TAMANHO_MAXIMO_NOME = 255;

/**
 * Corpo do PATCH. O nome só vai quando existe: o backend mantém o que já
 * estava gravado quando o campo não vem, e uma string vazia apagaria o
 * aprovador anterior.
 */
export function corpoDaAprovacao(nomeAprovador?: string | null) {
  const nome = (nomeAprovador || '').trim().slice(0, TAMANHO_MAXIMO_NOME);

  return nome ? { nome_aprovador: nome } : {};
}

/** `nomeAprovador` é o nome de quem está logado (`user.name`). */
export async function aprovarPedido(
  pedidoId: string,
  nomeAprovador?: string | null
): Promise<void> {
  await api.patch(
    `${PREFIXO}/pedidos/update-status/${pedidoId}`,
    corpoDaAprovacao(nomeAprovador)
  );
}

/**
 * Nome de quem aprovou (`pedido.nome_aprovador`), ou vazio quando não há o que
 * mostrar.
 *
 * Pedido EM_ANALISE fica de fora mesmo com nome gravado: editar um pedido já
 * aprovado recalcula a margem e pode devolvê-lo para análise, e o nome que
 * sobrou é o da aprovação anterior — a tela diria "Aprovado por" num pedido
 * que está aguardando o gestor.
 */
export function nomeDoAprovador(pedido: any): string {
  const nome = String(pedido?.nome_aprovador ?? '').trim();
  const emAnalise =
    String(pedido?.situacao ?? '').trim().toUpperCase() === 'EM_ANALISE';

  return emAnalise ? '' : nome;
}
