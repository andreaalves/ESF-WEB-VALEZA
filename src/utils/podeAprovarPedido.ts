// Quem pode aprovar/reprovar pedido no web.
//
// Antes a checagem era `user.role === 'ROLE_MANAGER'`, o que deixava de fora
// tanto o ROLE_ADMIN (que tem acesso a tudo no sistema) quanto as variações de
// gerente cadastradas em CreateUser (ROLE_MANAGER_REGIONAL / _NACIONAL).
export function podeAprovarPedido(role?: string | null): boolean {
  const r = String(role || '');
  return r === 'ROLE_ADMIN' || r.startsWith('ROLE_MANAGER');
}
