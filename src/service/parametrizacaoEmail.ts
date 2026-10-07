import axios from 'axios';
import api from './api';

/**
 * Conta de e-mail (SMTP) que a API usa para enviar mensagens — hoje o link de
 * "Esqueci minha senha" e o PDF do pedido (ESF-API, módulo
 * `parametrizacaoEmail`, tabela `parametrizacao_email`).
 *
 * ATENÇÃO ao caminho: o baseURL desta web é a RAIZ da API, não o
 * /api-essencial/v1 — cada chamada escreve o prefixo, como no resto do projeto.
 *
 * Na hora de enviar, a API procura a linha da empresa do usuário/pedido e, se
 * não achar, cai na linha GERAL (`empresa_id` nulo). Só existe uma linha ativa
 * por empresa e uma geral.
 */

const PREFIXO = '/api-essencial/v1';

/**
 * Conta que o seed da API cria quando a tabela está vazia. Não é uma conta de
 * verdade: enquanto ela estiver gravada, nenhum e-mail sai.
 */
const USUARIO_DE_EXEMPLO = 'your@email.com.br';

/**
 * A API abre a conexão SMTP sem TLS direto (`secure: false`) e sobe para
 * STARTTLS — é o que a porta 587 espera. Na 465 a conexão não fecha.
 */
export const PORTA_PADRAO = '587';

export interface ConfiguracaoEmail {
  parametrizacao_email_id: string;
  descricao?: string | null;
  host?: string | null;
  porta?: string | null;
  usuario?: string | null;
  /** Nulo = configuração geral, usada por toda empresa sem linha própria. */
  empresa_id?: string | null;
  empresas?: { empresa_id: string; fantasia?: string | null } | null;
}

export interface DadosConfiguracaoEmail {
  host: string;
  porta: string;
  usuario: string;
  /** Vazia na edição = manter a senha já salva. */
  senha: string;
  descricao: string;
}

/** A senha NUNCA vem nas respostas da API — nem na listagem, nem ao salvar. */
export async function listarConfiguracoesEmail(): Promise<ConfiguracaoEmail[]> {
  const { data } = await api.get(`${PREFIXO}/parametrizacao-email`);
  return Array.isArray(data) ? data : [];
}

/** `empresaId` nulo/vazio procura a configuração geral. */
export function configuracaoDaEmpresa(
  lista: ConfiguracaoEmail[],
  empresaId: string | null
): ConfiguracaoEmail | undefined {
  return lista.find((item) => (item.empresa_id || null) === (empresaId || null));
}

export function ehConfiguracaoDeExemplo(
  configuracao?: Pick<ConfiguracaoEmail, 'usuario'> | null
): boolean {
  return (configuracao?.usuario || '').trim().toLowerCase() === USUARIO_DE_EXEMPLO;
}

/**
 * A senha só pode ficar em branco quando já existe uma de verdade salva. A do
 * seed não conta: é um texto de exemplo que ficaria valendo junto com a conta
 * nova.
 */
export function senhaObrigatoria(configuracao?: ConfiguracaoEmail | null): boolean {
  return !configuracao || ehConfiguracaoDeExemplo(configuracao);
}

/**
 * Corpo do POST/PUT. Na edição o PUT é parcial e campo omitido mantém o valor
 * salvo — mas string VAZIA é recusada (zod `nonempty`), então a senha em branco
 * tem que sair do corpo em vez de ir como "".
 */
export function montarCorpoConfiguracaoEmail(
  dados: DadosConfiguracaoEmail,
  empresaId: string | null
) {
  return {
    host: dados.host.trim(),
    porta: dados.porta.trim(),
    usuario: dados.usuario.trim(),
    descricao: dados.descricao.trim(),
    empresa_id: empresaId || null,
    ...(dados.senha ? { senha: dados.senha } : {}),
  };
}

/** Cria quando `id` não vem; senão altera a linha existente. */
export async function salvarConfiguracaoEmail(
  id: string | undefined,
  dados: DadosConfiguracaoEmail,
  empresaId: string | null
): Promise<ConfiguracaoEmail> {
  const corpo = montarCorpoConfiguracaoEmail(dados, empresaId);
  const { data } = id
    ? await api.put(`${PREFIXO}/parametrizacao-email/${id}`, corpo)
    : await api.post(`${PREFIXO}/parametrizacao-email`, corpo);
  return data;
}

/**
 * Erros dessas rotas escritos para o usuário ler:
 *
 *   400 validação (zod)   { message: genérico, errors: [{ field, message }] }
 *   400 regra de negócio  { message: "Já existe uma configuração de e-mail..." }
 *   404                   { message: "Configuração de e-mail ... não encontrada." }
 *   409                   { message: "O empresa_id informado já está cadastrado..." }
 *
 * No primeiro o texto útil está em `errors`.
 */
export function mensagemDoErroDeEmail(erro: unknown, padrao: string): string {
  if (!axios.isAxiosError(erro)) return padrao;
  if (!erro.response) return 'Sem conexão. Verifique a internet e tente novamente.';
  if (![400, 404, 409].includes(erro.response.status)) return padrao;

  const dados: any = erro.response.data;
  const erros = dados?.errors;
  const detalhe = Array.isArray(erros) ? erros[0]?.message || '' : '';
  return detalhe || dados?.message || padrao;
}
