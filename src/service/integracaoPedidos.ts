import api from './api';

/**
 * Envio manual dos pedidos ao ERP (ESF-API, `IntegrarPedidoERPController`).
 *
 * O backend já faz isso sozinho a cada 15 min (cron, das 7h às 22h); a rota
 * serve para não esperar a próxima rodada. Sem `pedido_id` ela pega TODOS os
 * pedidos PENDENTE e ERRO_INTEGRACAO, responde 202 na hora e envia em segundo
 * plano — a resposta não diz quantos integraram, é preciso rebuscar a lista.
 *
 * ATENÇÃO ao caminho: as rotas do integrador são montadas na RAIZ da API
 * (`app.use(routesIntegrador)`), sem o /api-essencial/v1.
 */
export async function integrarPedidosPendentes(): Promise<void> {
  await api.post('/post-pedido-to-erp');
}

/**
 * Só o administrador dispara a integração na mão. A rota em si aceita
 * qualquer usuário logado — a restrição é desta tela.
 */
export function podeIntegrarPedidos(role?: string | null): boolean {
  return String(role || '') === 'ROLE_ADMIN';
}

/**
 * Depois do disparo, em quantos ms rebuscar a lista: o envio corre em segundo
 * plano e cada pedido pode levar até 100s no ERP, então uma busca só, logo em
 * seguida, ainda mostraria tudo como estava.
 */
export const RECARGAS_APOS_INTEGRAR_MS = [10000, 40000];
