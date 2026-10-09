/**
 * Pedido do app que o ERP recusou: é o que alguém precisa corrigir e reenviar.
 * Usado pelo filtro "Situação" da Lista de Pedidos.
 */
export function pedidoComErroIntegracao(pedido: any): boolean {
  return String(pedido?.situacao || '').trim().toUpperCase() === 'ERRO_INTEGRACAO';
}
