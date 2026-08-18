import api from '../service/api';

const CHAVE_VERSAO = '@Aplication:logoVersion';
const EVENTO_ATUALIZADA = 'app:logo-empresa-atualizada';

export function lerVersaoLogo(): string {
  return localStorage.getItem(CHAVE_VERSAO) || '';
}

/**
 * URL pública da logomarca da empresa (a mesma que é enviada em "Cadastro
 * Empresas"). O `?v=` é cache-buster: sem ele o navegador continua servindo a
 * logo antiga do cache mesmo depois de a API já ter gravado a nova.
 */
export function urlLogoEmpresa(empresaId?: string, versao = ''): string {
  if (!empresaId) return '';
  const base = `${api.defaults.baseURL}/empresa/${empresaId}/logo`;
  return versao ? `${base}?v=${versao}` : base;
}

/**
 * Chamar depois que a API confirmar o upload da logo: grava uma versão nova e
 * avisa quem estiver exibindo a imagem (hoje o Header) para trocar na hora,
 * sem precisar de F5 nem de novo login. Devolve a versão gerada.
 */
export function notificarLogoAtualizada(): number {
  const versao = Date.now();
  localStorage.setItem(CHAVE_VERSAO, String(versao));
  window.dispatchEvent(new Event(EVENTO_ATUALIZADA));
  return versao;
}

/** Assina as trocas de logo (mesma aba via evento próprio, outras abas via
 * `storage`). Devolve a função de cancelamento para usar no cleanup do effect. */
export function ouvirLogoAtualizada(handler: () => void): () => void {
  const handlerStorage = (e: StorageEvent) => {
    if (e.key === CHAVE_VERSAO) handler();
  };

  window.addEventListener(EVENTO_ATUALIZADA, handler);
  window.addEventListener('storage', handlerStorage);

  return () => {
    window.removeEventListener(EVENTO_ATUALIZADA, handler);
    window.removeEventListener('storage', handlerStorage);
  };
}
