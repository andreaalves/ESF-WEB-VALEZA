import axios from 'axios';
import api from './api';

/**
 * Recuperação e troca de senha (ESF-API, módulos `autenticacao` e `usuario`).
 *
 * ATENÇÃO ao caminho: o baseURL desta web é a RAIZ da API, não o
 * /api-essencial/v1 — cada chamada escreve o prefixo, como no resto do projeto.
 */

const PREFIXO = '/api-essencial/v1';

/** Mínimo do backend (zod: `nova_senha` min 6) — a tela valida antes de enviar. */
export const TAMANHO_MINIMO_SENHA = 6;

const AVISO_PADRAO_DO_ENVIO =
  'Se o e-mail informado estiver cadastrado, você receberá um link de recuperação em breve.';

/**
 * Teto de espera do pedido de link. Quando o e-mail existe, o backend só
 * responde depois de terminar o envio pelo SMTP — e essa conexão não tem tempo
 * limite lá. Com o servidor de e-mail lento ou fora do ar o botão ficava
 * girando por minutos.
 */
export const ESPERA_DO_ENVIO_MS = 10000;

/**
 * Pede o e-mail com o link de redefinição (vale 30 minutos) e devolve o aviso
 * do backend. A resposta é SEMPRE a mesma, exista ou não o e-mail — é de
 * propósito, para ninguém descobrir quais e-mails estão cadastrados. Por isso
 * a tela nunca pode afirmar que a mensagem foi enviada.
 *
 * É também por isso que dá para parar de esperar: passado o teto, o aviso
 * mostrado é o mesmo que a resposta traria. O pedido NÃO é cancelado — o
 * servidor segue tentando enviar. Erro de verdade (e-mail malformado, sem
 * internet) volta na hora, bem antes do teto, e continua chegando à tela.
 */
export function solicitarLinkDeSenha(email: string): Promise<string> {
  const pedido: Promise<string> = api
    .post(`${PREFIXO}/auth/esqueci-senha`, { email })
    .then(({ data }) => data?.message || AVISO_PADRAO_DO_ENVIO);

  const teto = new Promise<string>((resolve) => {
    setTimeout(() => resolve(AVISO_PADRAO_DO_ENVIO), ESPERA_DO_ENVIO_MS);
  });

  // Falha que chegar depois do teto não tem mais tela para aparecer.
  pedido.catch(() => undefined);

  return Promise.race([pedido, teto]);
}

/** `token` é o que veio no link do e-mail; só pode ser usado uma vez. */
export async function redefinirSenha(
  token: string,
  novaSenha: string,
  confirmacao: string
): Promise<void> {
  await api.post(`${PREFIXO}/auth/resetar-senha`, {
    token,
    nova_senha: novaSenha,
    confirmacao_nova_senha: confirmacao,
  });
}

/**
 * Troca a senha de quem está logado — o usuário sai do token, nunca do corpo.
 * Senha atual errada volta **400**, não 401 — o interceptor do AuthContext
 * derruba a sessão em qualquer 401, e aqui isso não acontece.
 */
export async function alterarSenha(
  senhaAtual: string,
  novaSenha: string,
  confirmacao: string
): Promise<void> {
  await api.put(`${PREFIXO}/usuarios/alterarsenha`, {
    senha_atual: senhaAtual,
    nova_senha: novaSenha,
    confirmacao_nova_senha: confirmacao,
  });
}

const detalheDeValidacao = (dados: any): string => {
  const erros = dados?.errors;
  return Array.isArray(erros) ? erros[0]?.message || '' : '';
};

/**
 * O 400 das rotas de senha vem em dois formatos:
 *
 *   regra de negócio  { message: "Senha atual incorreta." }
 *   validação (zod)   { message: "Erro de validação...", errors: [{ field, message }] }
 *
 * No segundo o `message` é genérico e o texto útil está em `errors`. Fora do
 * 400 o corpo não foi escrito para o usuário ler, então vale o texto padrão.
 */
export function mensagemDoErroDeSenha(erro: unknown, padrao: string): string {
  if (!axios.isAxiosError(erro)) return padrao;
  if (!erro.response) return 'Sem conexão. Verifique a internet e tente novamente.';
  if (erro.response.status !== 400) return padrao;

  const dados: any = erro.response.data;
  return detalheDeValidacao(dados) || dados?.message || padrao;
}

/**
 * `POST /auth/resetar-senha` responde 400 SEM `errors` quando o token não
 * serve mais (inválido, vencido após 30 minutos ou já usado). Com `errors` o
 * problema é o que foi digitado, e o link continua valendo.
 */
export function ehLinkDeSenhaInvalido(erro: unknown): boolean {
  return (
    axios.isAxiosError(erro) &&
    erro.response?.status === 400 &&
    !detalheDeValidacao(erro.response.data)
  );
}
