import axios from 'axios';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import api from '../service/api';
import { useAuth } from './AuthContext';

// A conversa com o Assistente ESF vive aqui, e não no balão, para que o balão
// flutuante e a página /assistente mostrem a MESMA conversa: começa num, segue
// no outro. Também por isso a resposta continua sendo escrita ao trocar de tela.

// Endereço do assistente (o MCP da Valeza, repositório ESF-AGENTE-VLZ).
// Em `npm start`, fala com o MCP rodando na máquina
// (`python -m valeza_mcp.web`); no build publicado, com o MCP no servidor.
// REACT_APP_ASSISTENTE_URL troca o destino nos dois casos.
const ASSISTENTE_URL =
  process.env.REACT_APP_ASSISTENTE_URL ||
  (process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:8010/api/assistente/chat'
    : 'https://valeza-mcp-valeza-agt-mcp.rxlirp.easypanel.host/api/assistente/chat');

// Como cada tela pede a resposta ao MCP: as duas desenham Markdown; o balão,
// estreito, pede uma resposta curta e sem tabela.
export type FormatoResposta = 'balao_markdown' | 'pagina';

export interface Mensagem {
  autor: 'ia' | 'usuario';
  texto: string;
}

// Sugestões de "acesso rápido" exibidas quando a conversa está vazia.
export const SUGESTOES = [
  'Como estão minhas metas este mês?',
  'Resumo dos pedidos a faturar',
  'Quais vendedores estão abaixo da meta?',
];

// A resposta aparece como se alguém digitasse: palavra por palavra, cada uma
// no tempo de digitá-la, com um ritmo um pouco irregular e pausas depois de
// vírgula, de ponto e na quebra de linha. Resposta longa acelera por igual
// para terminar em até 4 s, para o usuário não achar que travou.
const MS_POR_LETRA = 28;
const VARIACAO_MS = 40;
const PAUSA_VIRGULA_MS = 90;
const PAUSA_FRASE_MS = 220;
const PAUSA_LINHA_MS = 300;
const DURACAO_MAX_ESCRITA_MS = 4000;

// Divide a resposta em palavras (cada uma com o espaço que vem depois) e diz,
// para cada uma, até onde mostrar o texto e quanto esperar antes da próxima.
// Cortar só entre palavras também evita partir um emoji ao meio.
function planoDeEscrita(texto: string): { ate: number; espera: number }[] {
  const palavras = texto.match(/\S+\s*|\s+/g) ?? [texto];
  let ate = 0;
  const plano = palavras.map((palavra) => {
    ate += palavra.length;
    const semEspaco = palavra.trimEnd();
    let espera = semEspaco.length * MS_POR_LETRA + Math.random() * VARIACAO_MS;
    if (/[.!?…]$/.test(semEspaco)) espera += PAUSA_FRASE_MS;
    else if (/[,;:]$/.test(semEspaco)) espera += PAUSA_VIRGULA_MS;
    if (palavra.includes('\n')) espera += PAUSA_LINHA_MS;
    return { ate, espera };
  });
  const total = plano.reduce((soma, passo) => soma + passo.espera, 0);
  const fator = total > DURACAO_MAX_ESCRITA_MS ? DURACAO_MAX_ESCRITA_MS / total : 1;
  return plano.map((passo) => ({ ate: passo.ate, espera: passo.espera * fator }));
}

interface AssistenteContextData {
  mensagens: Mensagem[];
  // A pergunta foi enviada e a resposta ainda não chegou.
  carregando: boolean;
  // A resposta já chegou e está aparecendo aos poucos.
  escrevendo: boolean;
  enviar: (pergunta: string, formato: FormatoResposta) => void;
  novaConversa: () => void;
}

const AssistenteContext = createContext<AssistenteContextData>(
  {} as AssistenteContextData
);

interface AssistenteProviderProps {
  children: ReactNode;
}

export function AssistenteProvider({ children }: AssistenteProviderProps) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [escrevendo, setEscrevendo] = useState(false);
  const timerEscrita = useRef<number>();
  // Cada conversa tem um número: a resposta de uma conversa já apagada (nova
  // conversa, troca de usuário) é descartada quando chega.
  const conversa = useRef(0);

  function novaConversa() {
    window.clearTimeout(timerEscrita.current);
    conversa.current += 1;
    setMensagens([]);
    setCarregando(false);
    setEscrevendo(false);
  }

  // Outro login (ou logout) começa do zero: a conversa é de quem perguntou.
  useEffect(novaConversa, [user?.id]);

  // Para a escrita se o provedor sair da tela.
  useEffect(() => () => window.clearTimeout(timerEscrita.current), []);

  // Mostra a resposta aos poucos, seguindo o planoDeEscrita.
  function escreverResposta(textoCompleto: string) {
    const plano = planoDeEscrita(textoCompleto);
    let passo = 0;

    setMensagens((m) => [...m, { autor: 'ia', texto: '' }]);
    setEscrevendo(true);

    const escreverProxima = () => {
      const { ate, espera } = plano[passo];
      const parcial = textoCompleto.slice(0, ate);
      setMensagens((m) => [...m.slice(0, -1), { autor: 'ia', texto: parcial }]);
      passo += 1;
      if (passo < plano.length) {
        timerEscrita.current = window.setTimeout(escreverProxima, espera);
      } else {
        setEscrevendo(false);
      }
    };
    timerEscrita.current = window.setTimeout(escreverProxima, 0);
  }

  async function enviar(pergunta: string, formato: FormatoResposta) {
    const texto_limpo = pergunta.trim();
    // Enquanto a resposta anterior é escrita, não envia: o histórico iria com
    // a resposta pela metade.
    if (!texto_limpo || carregando || escrevendo) return;

    const minhaConversa = conversa.current;
    setMensagens((m) => [...m, { autor: 'usuario', texto: texto_limpo }]);
    setCarregando(true);

    try {
      // CONTRATO BACKEND (Murilo): POST /api-essencial/v1/assistente/chat
      // body: { empresa_id, usuario_id, mensagem, historico, formato }
      // retorno: { resposta: string }
      const corpo = {
        empresa_id: user?.empresa?.id,
        usuario_id: user?.id,
        mensagem: texto_limpo,
        historico: mensagens,
        formato,
      };
      // O MCP só responde a quem está logado: vai junto o mesmo login
      // (Bearer) que o `api` usa com o ESF, e o MCP o confere com o ESF.
      const response = ASSISTENTE_URL
        ? await axios.post(ASSISTENTE_URL, corpo, {
            headers: { Authorization: api.defaults.headers.authorization },
            timeout: 120000,
          })
        : await api.post('/api-essencial/v1/assistente/chat', corpo);

      if (minhaConversa !== conversa.current) return;
      const resposta = response?.data?.resposta;
      escreverResposta(
        resposta || 'Não consegui entender. Pode reformular a pergunta?'
      );
    } catch (error: any) {
      if (minhaConversa !== conversa.current) return;
      // 401: login expirado. 429: limite de perguntas por minuto do MCP.
      // Outros (MCP fora do ar ou ainda não publicado): aviso de integração.
      const status = error?.response?.status;
      const texto =
        status === 401
          ? 'Sua sessão expirou. Saia e entre de novo para continuar.'
          : status === 429
            ? 'Muitas perguntas em pouco tempo. Aguarde um minuto e tente de novo.'
            : 'O assistente ainda está sendo integrado. Em breve vou responder ' +
              'com os dados de metas, pedidos e desempenho da sua equipe.';
      setMensagens((m) => [...m, { autor: 'ia', texto }]);
    } finally {
      if (minhaConversa === conversa.current) setCarregando(false);
    }
  }

  return (
    <AssistenteContext.Provider
      value={{ mensagens, carregando, escrevendo, enviar, novaConversa }}
    >
      {children}
    </AssistenteContext.Provider>
  );
}

export function useAssistente() {
  return useContext(AssistenteContext);
}
