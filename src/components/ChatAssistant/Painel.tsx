import {
  Box as BoxBase,
  Button as ButtonBase,
  Flex as FlexBase,
  Grid as GridBase,
  keyframes,
  Text as TextBase,
  Tooltip as TooltipBase,
} from '@chakra-ui/react';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
  FiArrowRight,
  FiBarChart2,
  FiCalendar,
  FiChevronDown,
  FiClock,
  FiInfo,
  FiLink,
  FiMessageCircle,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  Grafico as DadosGrafico,
  PAINEL_URL,
  TIPOS_DE_GRAFICO,
} from '../../context/AssistenteContext';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import api from '../../service/api';
import { Area, caminhoSuave, Calor, Colunas, CorpoDoGrafico, Legenda, Ranking } from './Grafico';
import {
  CORES_CLARO,
  CORES_ESCURO,
  percentual,
  reaisInteiros,
  semFimDeSemanaVazio,
  valorCurto,
  variacao,
  variaveisDoTema,
} from './visual';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Button = ButtonBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;
const Grid = GridBase as React.ComponentType<any>;
const Text = TextBase as React.ComponentType<any>;
const Tooltip = TooltipBase as React.ComponentType<any>;

// O painel de inteligência comercial da página do assistente. Os números e a
// classificação vêm prontos do MCP (valeza_mcp/painel.py), com o que quem está
// logado pode ver: o vendedor, só o dele. Esta tela só desenha; as contas
// daqui (média do dia com venda, participação, pico) saem dos mesmos números.
//
// São duas análises, independentes: a semanal (os últimos 7 dias contra os 7
// anteriores) e a tendência de 28 dias. Os dois cartões do topo escolhem qual
// aparece embaixo (números, gráficos e alertas dela); a situação de hoje
// (pedidos parados, meta do mês, clientes sem comprar) vale para as duas e
// aparece sempre, uma vez só.

type Classe = 'critico' | 'atencao' | 'oportunidade' | 'informativo';

interface Alerta {
  chave: string;
  classe: Classe;
  natureza: 'fato' | 'tendencia' | 'hipotese' | 'previsao';
  titulo: string;
  periodo: string;
  comparacao: string;
  justificativa: string;
  acao: string;
  itens?: Record<string, unknown>[];
  itens_fora_da_lista?: number;
  pergunta: string;
  // "Também na tendência de 28 dias, como atenção: ...": o mesmo alerta na outra análise.
  relacao?: string;
  acompanhamento?: { desde: string; vezes: number };
}

interface Resumo {
  venda: number;
  pedidos: number;
  ticket_medio: number;
  clientes_atendidos: number;
  margem_percentual?: number | null;
}

interface Periodo {
  inicio: string;
  fim: string;
  dias: number;
}

// Uma das duas análises. Sem o período inteiro no sistema (`disponivel` falso),
// só o aviso de quando a comparação começa; sem histórico para comparar
// (`comparavel` falso), os números do período, sem variação.
interface Analise {
  analise: string;
  titulo: string;
  descricao: string;
  disponivel: boolean;
  comparavel: boolean;
  primeira_comparacao_em?: string;
  periodo: { atual: Periodo | null; anterior: Periodo | null };
  indicadores?: {
    atual: Resumo;
    anterior?: Resumo;
    variacao?: Partial<Record<string, number | null>>;
  };
  resumo_dos_alertas?: Record<Classe, number>;
  alertas?: Record<Classe, Alerta[]>;
  alertas_fora_da_lista?: number;
  graficos?: DadosGrafico[];
  limitacoes: string[];
}

interface SituacaoDeHoje {
  titulo: string;
  descricao: string;
  indicadores: {
    mes_corrente?: { desde: string; venda: number; pedidos: number };
    hoje_ate_agora?: { venda: number; pedidos: number };
  };
  alertas: Record<Classe, Alerta[]>;
  alertas_fora_da_lista?: number;
  limitacoes: string[];
}

interface DadosDoPainel {
  disponivel: boolean;
  mensagem?: string;
  gerado_em?: string;
  analises?: Analise[];
  situacao_de_hoje?: SituacaoDeHoje;
  recomendacoes?: { acao: string; motivo: string; classe: Classe; origem?: string }[];
  limitacoes_gerais?: string[];
}

const CLASSES: [Classe, string][] = [
  ['critico', 'Crítico'],
  ['atencao', 'Atenção'],
  ['oportunidade', 'Oportunidade'],
  ['informativo', 'Informativo'],
];
const ROTULO_DA_CLASSE = Object.fromEntries(CLASSES) as Record<Classe, string>;

const NATUREZA: Record<Alerta['natureza'], string> = {
  fato: 'fato',
  tendencia: 'tendência',
  hipotese: 'hipótese',
  previsao: 'previsão',
};

// Perguntas que abrem a conversa a partir do painel.
const PERGUNTAS = [
  'Por que a venda variou neste período?',
  'Quais clientes deixaram de comprar?',
  'Como está a margem por vendedor?',
];

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const numero = (v: number, casas = 1) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: casas });

// Um campo da lista de um alerta, pelo nome: valor em reais, percentual ou pontos.
const pedidos = (n: number) => `${numero(n, 0)} ${n === 1 ? 'pedido' : 'pedidos'}`;

function campo(chave: string, valor: unknown): string {
  if (Array.isArray(valor)) return valor.join(', ');
  if (typeof valor !== 'number') return String(valor ?? '');
  if (/percentual/.test(chave)) return `${numero(valor)}%`;
  if (/pontos/.test(chave)) return `${numero(valor)} p.p.`;
  if (/venda|valor|ticket|preco|diferenca/.test(chave)) return reais(valor);
  return numero(valor);
}

function cabecalho(chave: string): string {
  const texto = chave.replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

// "17/10 a 23/10": o período sem o ano, como os cartões escrevem.
const curto = (p: Periodo) => `${p.inicio.slice(0, 5)} a ${p.fim.slice(0, 5)}`;

// Por que a análise não compara: ainda sem histórico, ou poucos pedidos.
function semComparacao(a: Analise): string {
  if (a.primeira_comparacao_em) {
    return `Ainda não há histórico para comparar: a primeira comparação será em ${a.primeira_comparacao_em}. Até lá, os números do período, sem variação.`;
  }
  return a.limitacoes.find((t) => /^Poucos pedidos/.test(t)) || 'Sem período anterior para comparar.';
}

// "21/10/2026" mais um dia é hoje? Então o período deixou hoje de fora e a
// venda de hoje entra no gráfico como coluna parcial.
function ehVespera(fim: string, agora: Date): boolean {
  const [d, m, a] = fim.split('/').map(Number);
  const dia = new Date(a, m - 1, d + 1);
  return (
    dia.getFullYear() === agora.getFullYear() &&
    dia.getMonth() === agora.getMonth() &&
    dia.getDate() === agora.getDate()
  );
}

const pulso = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
`;

function Cartao({ children, ...props }: any) {
  return (
    <Box
      bg="var(--pa-superficie)"
      border="1px solid var(--pa-linha)"
      borderRadius="14px"
      boxShadow="var(--pa-sombra)"
      minW={0}
      {...props}
    >
      {children}
    </Box>
  );
}

// O ícone ao lado de um título: o que o número ou o gráfico mostra e como ler,
// no balão (mouse em cima, foco ou toque).
function Explicacao({ texto }: { texto: string }) {
  return (
    <Tooltip label={texto} hasArrow placement="top" maxW="320px" openDelay={150}>
      <Box
        as="button"
        type="button"
        aria-label={`O que isto mostra: ${texto}`}
        display="inline-grid"
        placeItems="center"
        w="24px"
        h="24px"
        p={0}
        flexShrink={0}
        border="none"
        borderRadius="999px"
        bg="transparent"
        color="var(--pa-tinta-3)"
        cursor="help"
        _hover={{ color: 'var(--pa-tinta)' }}
        _focusVisible={{ outline: '2px solid var(--pa-dado)', outlineOffset: '1px' }}
      >
        <FiInfo size={16} aria-hidden="true" />
      </Box>
    </Tooltip>
  );
}

// `legenda` é o destaque do período; `explicacao`, o que o gráfico mostra.
function TituloDoCartao({ titulo, legenda, explicacao, children }: any) {
  return (
    <Flex justify="space-between" align="flex-start" wrap="wrap" sx={{ gap: '12px' }} mb="20px">
      <Box minW={0}>
        <Flex align="center" sx={{ gap: '6px' }}>
          <Box as="h2" m={0} fontSize="18px" fontWeight={700} lineHeight="24px" letterSpacing="-0.01em">
            {titulo}
          </Box>
          {explicacao && <Explicacao texto={explicacao} />}
        </Flex>
        {legenda && (
          <Box fontSize="14px" color="var(--pa-tinta-3)" mt="2px">
            {legenda}
          </Box>
        )}
      </Box>
      {children}
    </Flex>
  );
}

// O que um gráfico que o painel não conhece mostra, pelo tipo.
const EXPLICACAO_DO_TIPO: Record<string, string> = {
  linha: 'Mostra como o valor muda ao longo do tempo. Passe o mouse sobre a linha para ver cada ponto.',
  barras: 'Compara os itens entre si: quanto maior a barra, maior o valor.',
  pizza: 'Mostra a parte de cada item no total.',
  mapa_de_calor: 'Quanto mais forte a cor do quadrado, maior o valor naquele cruzamento.',
};

function Botao({ children, ...props }: any) {
  return (
    <Button
      size="sm"
      h="36px"
      px="14px"
      borderRadius="9px"
      fontSize="13px"
      fontWeight={600}
      bg="var(--pa-superficie)"
      color="var(--pa-tinta)"
      border="1px solid var(--pa-linha)"
      _hover={{ bg: 'var(--pa-superficie-2)' }}
      _active={{ bg: 'var(--pa-superficie-2)' }}
      {...props}
    >
      {children}
    </Button>
  );
}

function Selo({ classe, pequeno, quantidade }: { classe: Classe; pequeno?: boolean; quantidade?: number }) {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      sx={{ gap: '6px' }}
      px={pequeno ? '7px' : '9px'}
      py={pequeno ? '1px' : '3px'}
      borderRadius="999px"
      fontSize="12px"
      fontWeight={600}
      lineHeight="16px"
      whiteSpace="nowrap"
      color={`var(--pa-${classe})`}
      bg={`var(--pa-${classe}-fundo)`}
    >
      <Box as="i" display="block" w="7px" h="7px" borderRadius="50%" bg="currentColor" />
      {ROTULO_DA_CLASSE[classe]}
      {quantidade != null && ` · ${quantidade}`}
    </Box>
  );
}

function Variacao({ valor, sufixo = '%' }: { valor: number; sufixo?: string }) {
  const sobe = valor >= 0;
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      px="7px"
      py="2px"
      borderRadius="6px"
      fontSize="12px"
      fontWeight={600}
      lineHeight="16px"
      color={sobe ? 'var(--pa-sobe)' : 'var(--pa-desce)'}
      bg={sobe ? 'var(--pa-sobe-fundo)' : 'var(--pa-desce-fundo)'}
    >
      {sobe ? '↑' : '↓'} {variacao(valor, sufixo).replace(/^[+−]/, '')}
    </Box>
  );
}

function Indicador({
  rotulo,
  valor,
  titulo,
  delta,
  sufixo,
  legenda,
  explicacao,
  ...props
}: {
  rotulo: string;
  valor: string;
  titulo?: string;
  delta?: number | null;
  sufixo?: string;
  legenda?: string;
  explicacao?: string;
  [k: string]: any;
}) {
  return (
    <Cartao px="20px" py="18px" display="flex" flexDirection="column" sx={{ gap: '6px' }} {...props}>
      <Flex align="center" sx={{ gap: '4px' }} fontSize="14px" fontWeight={500} color="var(--pa-tinta-2)">
        {rotulo}
        {explicacao && <Explicacao texto={explicacao} />}
      </Flex>
      <Box
        fontSize="28px"
        lineHeight="34px"
        fontWeight={700}
        letterSpacing="-0.02em"
        whiteSpace="nowrap"
        title={titulo}
      >
        {valor}
      </Box>
      <Flex align="center" sx={{ gap: '8px' }} minH="20px" fontSize="13px" color="var(--pa-tinta-3)">
        {delta != null ? (
          <>
            <Variacao valor={delta} sufixo={sufixo} />
            <span>vs. anterior</span>
          </>
        ) : (
          legenda && <span>{legenda}</span>
        )}
      </Flex>
    </Cartao>
  );
}

// A venda dia a dia, pequena, no cartão da venda.
function Minitendencia({ valores }: { valores: number[] }) {
  const max = Math.max(...valores) || 1;
  const curva = caminhoSuave(
    valores.map((v, i) => [(i / Math.max(valores.length - 1, 1)) * 100, 40 - (v / max) * 36]),
  );
  return (
    <svg
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}
    >
      <defs>
        <linearGradient id="pa-minitendencia" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--pa-dado)" stopOpacity={0.22} />
          <stop offset="1" stopColor="var(--pa-dado)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${curva} L100,40 L0,40 Z`} fill="url(#pa-minitendencia)" />
      <path
        d={curva}
        fill="none"
        stroke="var(--pa-dado)"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function CartaoDeAlerta({
  alerta,
  onPerguntar,
}: {
  alerta: Alerta;
  onPerguntar: (texto: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const itens = alerta.itens || [];
  const colunas = itens.length ? Object.keys(itens[0]) : [];
  const grade = `minmax(0, 1.6fr) repeat(${Math.max(colunas.length - 1, 0)}, minmax(0, 1fr))`;
  const fora = alerta.itens_fora_da_lista || 0;
  const porQue = /^Por que/.test(alerta.pergunta);
  const acompanhamento = alerta.acompanhamento;
  return (
    <Cartao as="article" px="20px" py="18px">
      <Flex wrap="wrap" align="center" sx={{ gap: '8px' }}>
        <Selo classe={alerta.classe} />
        <Box
          as="span"
          px="8px"
          py="2px"
          borderRadius="999px"
          border="1px solid var(--pa-linha)"
          fontSize="12px"
          fontWeight={500}
          lineHeight="16px"
          color="var(--pa-tinta-2)"
        >
          {NATUREZA[alerta.natureza]}
        </Box>
        <Box as="span" ml="auto" fontSize="12px" color="var(--pa-tinta-3)">
          {alerta.periodo}
          {alerta.comparacao ? ` · ${alerta.comparacao}` : ''}
        </Box>
      </Flex>
      <Box as="h3" m={0} mt="12px" fontSize="16px" lineHeight="22px" fontWeight={600}>
        {alerta.titulo}
      </Box>
      <Box as="p" m={0} mt="6px" fontSize="14px" lineHeight="21px" color="var(--pa-tinta-2)">
        {alerta.justificativa}
      </Box>
      {alerta.relacao && (
        <Flex mt="8px" align="flex-start" sx={{ gap: '8px' }} fontSize="13px" lineHeight="19px" color="var(--pa-tinta-2)">
          <Box as="span" mt="2px" flexShrink={0} color="var(--pa-tinta-3)">
            <FiLink size={14} aria-hidden="true" />
          </Box>
          <span>{alerta.relacao}</span>
        </Flex>
      )}
      <Flex
        mt="12px"
        px="12px"
        py="10px"
        borderRadius="10px"
        bg="var(--pa-superficie-2)"
        border="1px solid var(--pa-grade)"
        align="flex-start"
        sx={{ gap: '10px' }}
      >
        <Box as="span" color="var(--pa-marca-tinta)" mt="3px" flexShrink={0}>
          <FiArrowRight size={15} aria-hidden="true" />
        </Box>
        <Box fontSize="14px" lineHeight="21px">
          <b>O que fazer: </b>
          {alerta.acao}
        </Box>
      </Flex>
      {aberto && itens.length > 0 && (
        <Box mt="12px" border="1px solid var(--pa-linha)" borderRadius="10px" overflowX="auto">
          <Box minW={`${Math.max(colunas.length * 120, 420)}px`} pt="6px">
            <Box
              display="grid"
              gridTemplateColumns={grade}
              sx={{ gap: '12px' }}
              px="12px"
              pb="6px"
              fontSize="12px"
              fontWeight={500}
              color="var(--pa-tinta-3)"
            >
              {colunas.map((c) => (
                <Box key={c} textAlign={typeof itens[0][c] === 'number' ? 'right' : 'left'}>
                  {cabecalho(c)}
                </Box>
              ))}
            </Box>
            {itens.map((item, i) => (
              <Box
                key={i}
                display="grid"
                gridTemplateColumns={grade}
                sx={{ gap: '12px' }}
                px="12px"
                py="9px"
                borderTop="1px solid var(--pa-grade)"
                fontSize="13px"
              >
                {colunas.map((c) => (
                  <Box
                    key={c}
                    textAlign={typeof item[c] === 'number' ? 'right' : 'left'}
                    overflow="hidden"
                    textOverflow="ellipsis"
                  >
                    {campo(c, item[c])}
                  </Box>
                ))}
              </Box>
            ))}
            {fora > 0 && (
              <Box
                px="12px"
                py="9px"
                borderTop="1px solid var(--pa-grade)"
                fontSize="12px"
                color="var(--pa-tinta-3)"
              >
                e mais {fora} fora da lista
              </Box>
            )}
          </Box>
        </Box>
      )}
      <Flex justify="space-between" align="center" wrap="wrap" sx={{ gap: '8px' }} mt="12px">
        <Flex align="center" wrap="wrap" sx={{ gap: '4px' }}>
          {itens.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              h="34px"
              px="8px"
              fontSize="13px"
              fontWeight={600}
              color="var(--pa-tinta-2)"
              _hover={{ bg: 'var(--pa-superficie-2)', color: 'var(--pa-tinta)' }}
              aria-expanded={aberto}
              rightIcon={
                <Box
                  as="span"
                  transition="transform .15s"
                  transform={aberto ? 'rotate(180deg)' : undefined}
                >
                  <FiChevronDown aria-hidden="true" />
                </Box>
              }
              onClick={() => setAberto(!aberto)}
            >
              {aberto
                ? 'Esconder a lista'
                : `Ver a lista · ${itens.length}${fora ? ` de ${itens.length + fora}` : ''}`}
            </Button>
          )}
          {acompanhamento && (
            <Box as="span" fontSize="12px" color="var(--pa-tinta-3)" px="8px">
              {acompanhamento.vezes > 1
                ? `Aberto desde ${new Date(acompanhamento.desde).toLocaleDateString('pt-BR')} · em ${acompanhamento.vezes} análises`
                : 'Novo nesta análise'}
            </Box>
          )}
        </Flex>
        <Button
          size="sm"
          variant="ghost"
          h="34px"
          px="10px"
          fontSize="13px"
          fontWeight={600}
          color="var(--pa-marca-tinta)"
          _hover={{ bg: 'var(--pa-marca-suave)' }}
          leftIcon={<FiMessageCircle aria-hidden="true" />}
          onClick={() => onPerguntar(alerta.pergunta)}
        >
          {porQue ? 'Por que isto aconteceu?' : 'Perguntar ao assistente'}
        </Button>
      </Flex>
    </Cartao>
  );
}

// Uma análise no topo, como aba: o período, a venda com a variação e os alertas
// dela. Sem o período no sistema, não abre; só diz quando a comparação começa.
function CartaoDaAnalise({
  analise,
  ativa,
  onEscolher,
}: {
  analise: Analise;
  ativa: boolean;
  onEscolher: () => void;
}) {
  const { atual, anterior } = analise.periodo;
  const venda = analise.indicadores?.atual.venda;
  const delta = analise.comparavel ? analise.indicadores?.variacao?.venda_percentual : null;
  const resumo = analise.resumo_dos_alertas;
  const classes = resumo ? CLASSES.filter(([c]) => resumo[c] > 0) : [];
  return (
    <Box
      as="button"
      type="button"
      role="tab"
      id={`pa-aba-${analise.analise}`}
      aria-selected={ativa}
      aria-controls="pa-analise"
      disabled={!analise.disponivel}
      onClick={onEscolher}
      display="flex"
      flexDirection="column"
      alignItems="stretch"
      textAlign="left"
      minW={0}
      px="20px"
      py="16px"
      bg="var(--pa-superficie)"
      color="var(--pa-tinta)"
      border="1px solid"
      borderColor={ativa ? 'var(--pa-tinta)' : 'var(--pa-linha)'}
      borderRadius="14px"
      boxShadow={ativa ? '0 0 0 1px var(--pa-tinta)' : 'var(--pa-sombra)'}
      cursor={analise.disponivel ? 'pointer' : 'default'}
      _hover={analise.disponivel && !ativa ? { borderColor: 'var(--pa-tinta-3)' } : undefined}
      _focusVisible={{ outline: '2px solid var(--pa-dado)', outlineOffset: '2px' }}
    >
      <Flex align="center" justify="space-between" sx={{ gap: '8px' }}>
        <Box fontSize="15px" fontWeight={700}>
          {analise.titulo}
        </Box>
        {ativa && (
          <Box as="span" fontSize="12px" fontWeight={600} color="var(--pa-tinta-2)">
            Mostrando abaixo
          </Box>
        )}
      </Flex>
      <Flex as="span" align="center" sx={{ gap: '6px' }} mt="4px" fontSize="13px" color="var(--pa-tinta-3)">
        <FiCalendar aria-hidden="true" />
        {atual
          ? `${curto(atual)} · ${anterior ? `vs. ${curto(anterior)}` : 'sem comparação'}`
          : analise.descricao}
      </Flex>
      {venda != null && (
        <Flex align="center" wrap="wrap" sx={{ gap: '8px' }} mt="10px">
          <Box fontSize="22px" lineHeight="28px" fontWeight={700} letterSpacing="-0.02em" title={reais(venda)}>
            {reaisInteiros(venda)}
          </Box>
          {delta != null && <Variacao valor={delta} />}
        </Flex>
      )}
      {!analise.comparavel && analise.primeira_comparacao_em && (
        <Box mt="8px" fontSize="13px" color="var(--pa-tinta-2)">
          {analise.disponivel
            ? `Primeira comparação em ${analise.primeira_comparacao_em}`
            : `Ainda sem histórico: a primeira comparação será em ${analise.primeira_comparacao_em}`}
        </Box>
      )}
      {analise.disponivel && (
        <Flex wrap="wrap" sx={{ gap: '6px' }} mt="10px" minH="20px" fontSize="12px" color="var(--pa-tinta-3)">
          {classes.length
            ? classes.map(([c]) => <Selo key={c} classe={c} pequeno quantidade={resumo![c]} />)
            : 'Nenhum alerta nesta análise'}
        </Flex>
      )}
    </Box>
  );
}

function Carregando() {
  const bloco = (props: any) => (
    <Box
      bg="var(--pa-superficie)"
      border="1px solid var(--pa-linha)"
      borderRadius="14px"
      animation={`${pulso} 1.4s ease-in-out infinite`}
      {...props}
    />
  );
  return (
    <Box aria-busy="true" aria-label="Montando o diagnóstico">
      <Box h="32px" w="280px" maxW="70%" mb="8px" borderRadius="8px" bg="var(--pa-linha)" />
      <Box h="18px" w="220px" maxW="50%" mb="24px" borderRadius="6px" bg="var(--pa-grade)" />
      <Grid
        templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }}
        gap="16px"
        mb="16px"
      >
        {bloco({ gridColumn: { base: '1 / -1', lg: 'span 2' }, gridRow: { lg: 'span 2' }, h: { base: '180px', lg: 'auto' } })}
        {[0, 1, 2, 3].map((i) => bloco({ key: i, h: '118px' }))}
      </Grid>
      <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }} gap="16px">
        {bloco({ gridColumn: { lg: 'span 2' }, h: '340px' })}
        {bloco({ h: '340px' })}
      </Grid>
    </Box>
  );
}

export function PainelInteligencia({ onPerguntar }: { onPerguntar: (texto: string) => void }) {
  const { user } = useAuth();
  const { ehClaro } = useThemeMode();
  const cores = ehClaro ? CORES_CLARO : CORES_ESCURO;
  const [painel, setPainel] = useState<DadosDoPainel | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<Classe | 'todos'>('todos');
  const [sobre, setSobre] = useState(false);
  // A análise mostrada embaixo; sem escolha, a primeira que há (a semanal).
  const [escolhida, setEscolhida] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!PAINEL_URL) {
      setPainel({
        disponivel: false,
        mensagem: 'O painel não está disponível neste ambiente.',
      });
      return;
    }
    setCarregando(true);
    try {
      // O mesmo login (Bearer) do chat: o MCP confere com o ESF quem é.
      const resposta = await axios.post(
        PAINEL_URL,
        {
          empresa_id: user?.empresa?.id,
          usuario_id: user?.id,
          graficos: TIPOS_DE_GRAFICO,
        },
        {
          headers: { Authorization: api.defaults.headers.authorization },
          timeout: 120000,
        },
      );
      setPainel(resposta.data);
    } catch (error: any) {
      const status = error?.response?.status;
      setPainel({
        disponivel: false,
        mensagem:
          status === 401
            ? 'Sua sessão expirou. Saia e entre de novo para ver o painel.'
            : status === 429
              ? 'Muitas consultas em pouco tempo. Aguarde um minuto e atualize.'
              : 'Não foi possível montar o painel agora.',
      });
    } finally {
      setCarregando(false);
    }
  }, [user?.id, user?.empresa?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const raiz = (conteudo: React.ReactNode) => (
    <Box
      style={variaveisDoTema(ehClaro)}
      color="var(--pa-tinta)"
      fontSize="14px"
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {conteudo}
    </Box>
  );

  if (!painel) return raiz(<Carregando />);
  if (!painel.disponivel) {
    return raiz(
      <Box textAlign="center" pt="10">
        <Text color="var(--pa-tinta-2)" mb="4">
          {painel.mensagem}
        </Text>
        <Botao leftIcon={<FiRefreshCw />} isLoading={carregando} onClick={carregar}>
          Tentar de novo
        </Botao>
      </Box>,
    );
  }

  const analises = painel.analises || [];
  const situacao = painel.situacao_de_hoje;
  const sel = analises.find((x) => x.disponivel && x.analise === escolhida) || analises.find((x) => x.disponivel);
  const escolher = (nome: string) => {
    setEscolhida(nome);
    setFiltro('todos');
  };

  const ind = sel?.indicadores;
  const v = ind?.variacao || {};
  const atual = sel?.periodo.atual || undefined;
  const anterior = sel?.periodo.anterior;
  const comparacao = !!sel?.comparavel;
  const geradoEm = painel.gerado_em ? new Date(painel.gerado_em) : new Date();
  const hora = geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Os gráficos que o painel desenha nos cartões dele; o resto vai embaixo.
  const graficos = sel?.graficos || [];
  const porDia = graficos.find((g) => g.tipo === 'linha' && /^Venda por dia/.test(g.titulo));
  const porVendedor = graficos.find((g) => g.tipo === 'barras' && /^Venda por vendedor/.test(g.titulo));
  // O mapa de calor vem uma vez, na maior análise que há: vale para a página toda.
  const origemDoCalor = analises.find((x) => x.graficos?.some((g) => g.tipo === 'mapa_de_calor'));
  const calor = origemDoCalor?.graficos?.find((g) => g.tipo === 'mapa_de_calor');
  const periodoDoCalor = origemDoCalor?.periodo.atual;
  const outros = graficos.filter((g) => g !== porDia && g !== porVendedor && g.tipo !== 'mapa_de_calor');

  const vendaDia = porDia?.series[0].valores || [];
  const diasUteis = porDia ? semFimDeSemanaVazio(porDia.rotulos, porDia.series) : null;
  const fimDeSemanaFora = !!diasUteis?.tirados;
  const diasComVenda = vendaDia.filter((x) => x > 0).length;
  const mediaDia = diasComVenda ? vendaDia.reduce((a, b) => a + b, 0) / diasComVenda : 0;
  const iMaior = vendaDia.length ? vendaDia.indexOf(Math.max(...vendaDia)) : -1;
  const hoje = situacao?.indicadores.hoje_ate_agora;
  const mes = situacao?.indicadores.mes_corrente;
  const parcial =
    porDia && hoje && atual && ehVespera(atual.fim, geradoEm)
      ? {
          rotulo: 'Hoje',
          titulo: `Hoje, ${geradoEm.toLocaleDateString('pt-BR').slice(0, 5)} · até ${hora}`,
          valor: hoje.venda,
        }
      : undefined;

  // Pedidos por hora: a soma de cada coluna do mapa de calor.
  const porHora = calor ? calor.rotulos.map((_, j) => calor.series.reduce((s, d) => s + d.valores[j], 0)) : [];
  const totalPedidos = porHora.reduce((a, b) => a + b, 0);
  let janela = { inicio: 0, soma: -1 };
  for (let j = 0; j + 3 <= porHora.length; j++) {
    const soma = porHora[j] + porHora[j + 1] + porHora[j + 2];
    if (soma > janela.soma) janela = { inicio: j, soma };
  }
  const horaDe = (r: string) => parseInt(r, 10);
  let pico = { dia: '', j: 0, v: -1 };
  calor?.series.forEach((s) =>
    s.valores.forEach((x, j) => {
      if (x > pico.v) pico = { dia: s.nome, j, v: x };
    }),
  );

  const a = ind?.atual;
  const pequenos = a
    ? [
        {
          rotulo: 'Pedidos',
          valor: numero(a.pedidos, 0),
          delta: v.pedidos_percentual,
          legenda: diasComVenda
            ? `${numero(a.pedidos / diasComVenda, 0)} por dia com venda, em média`
            : undefined,
          explicacao: 'Quantos pedidos entraram no período: os mesmos que somam a venda.',
        },
        {
          rotulo: 'Ticket médio',
          valor: reaisInteiros(a.ticket_medio),
          titulo: reais(a.ticket_medio),
          delta: v.ticket_medio_percentual,
          legenda: 'venda ÷ pedidos',
          explicacao: 'O valor médio de cada pedido: a venda do período dividida pelo número de pedidos.',
        },
        {
          rotulo: 'Clientes atendidos',
          valor: numero(a.clientes_atendidos, 0),
          delta: v.clientes_atendidos_percentual,
          legenda: a.clientes_atendidos
            ? `${numero(a.pedidos / a.clientes_atendidos)} pedido por cliente`
            : undefined,
          explicacao:
            'Quantos clientes diferentes compraram no período. Quem fez vários pedidos conta uma vez só.',
        },
        ...(a.margem_percentual != null
          ? [
              {
                rotulo: 'Margem',
                valor: `${numero(a.margem_percentual)}%`,
                delta: v.margem_pontos,
                sufixo: ' p.p.',
                legenda: 'ponderada pelo valor',
                explicacao:
                  'Quanto sobra da venda depois do custo dos produtos, em média. Os pedidos maiores pesam mais na conta.',
              },
            ]
          : []),
      ]
    : [];

  const ritmo = [
    mes && {
      icone: <FiCalendar />,
      rotulo: `No mês, desde ${mes.desde.slice(0, 5)}`,
      valor: reaisInteiros(mes.venda),
      titulo: reais(mes.venda),
      legenda: pedidos(mes.pedidos),
      explicacao: 'Tudo o que foi vendido no mês até agora, sem frete e sem pedidos cancelados.',
    },
    hoje && {
      icone: <FiClock />,
      rotulo: `Hoje até ${hora}`,
      valor: reaisInteiros(hoje.venda),
      titulo: reais(hoje.venda),
      legenda:
        pedidos(hoje.pedidos) +
        (mediaDia ? ` · ${percentual((hoje.venda / mediaDia) * 100, 0)} da média do dia` : ''),
      explicacao:
        'A venda de hoje até a hora da atualização. A porcentagem compara com a média de um dia com venda.',
    },
    mediaDia > 0 && {
      icone: <FiBarChart2 />,
      rotulo: 'Média por dia com venda',
      valor: reaisInteiros(mediaDia),
      titulo: reais(mediaDia),
      legenda: `${diasComVenda} dias com venda`,
      explicacao: 'A venda do período dividida pelos dias em que houve venda. Dias sem nenhuma venda não entram na conta.',
    },
  ].filter(Boolean) as {
    icone: JSX.Element;
    rotulo: string;
    valor: string;
    titulo: string;
    legenda: string;
    explicacao: string;
  }[];

  // Os alertas em dois grupos: os de hoje (valem para as duas análises) e os da
  // análise escolhida, cada um com o período dele.
  const grupos = [
    {
      chave: 'hoje',
      titulo: situacao?.titulo || 'Situação de hoje',
      legenda: 'não depende do período',
      alertas: situacao?.alertas,
      fora: situacao?.alertas_fora_da_lista,
    },
    ...(sel
      ? [
          {
            chave: sel.analise,
            titulo: sel.titulo,
            legenda: atual ? `${curto(atual)}${anterior ? ` · vs. ${curto(anterior)}` : ''}` : '',
            alertas: sel.alertas,
            fora: sel.alertas_fora_da_lista,
          },
        ]
      : []),
  ];
  const doGrupo = (g: (typeof grupos)[number], c: Classe | 'todos') =>
    CLASSES.flatMap(([k]) => (c === 'todos' || c === k ? g.alertas?.[k] || [] : []));
  const contagem = (c: Classe | 'todos') => grupos.reduce((s, g) => s + doGrupo(g, c).length, 0);
  const recomendacoes = painel.recomendacoes || [];
  const limitacoes = [
    ...(painel.limitacoes_gerais || []),
    ...(situacao?.limitacoes || []),
    ...analises.flatMap((x) => x.limitacoes.map((t) => `${x.titulo}: ${t}`)),
  ];
  // A primeira pergunta leva as datas da análise escolhida: o chat investiga esse período.
  const perguntas = atual
    ? [`Por que a venda variou de ${atual.inicio} a ${atual.fim}?`, ...PERGUNTAS.slice(1)]
    : PERGUNTAS;
  const ranking = porVendedor && porVendedor.rotulos.length > 1;
  const top2 =
    porVendedor && a?.venda && porVendedor.rotulos.length >= 3
      ? ((porVendedor.series[0].valores[0] + porVendedor.series[0].valores[1]) / a.venda) * 100
      : null;

  return raiz(
    <Flex direction="column" sx={{ gap: '24px' }}>
      {/* ── Título ── */}
      <Flex justify="space-between" align="flex-end" wrap="wrap" sx={{ gap: '16px' }}>
        <Box>
          <Box as="h1" m={0} fontSize="26px" lineHeight="32px" fontWeight={700} letterSpacing="-0.02em">
            Inteligência comercial
          </Box>
          <Box mt="6px" color="var(--pa-tinta-2)">
            A semana mostra o que mudou agora; os 28 dias, se é tendência. Hoje fica de fora das
            comparações: o dia ainda está em andamento.
          </Box>
        </Box>
        <Flex align="center" sx={{ gap: '12px' }}>
          <Box as="span" fontSize="13px" color="var(--pa-tinta-3)">
            Atualizado às {hora}
          </Box>
          <Botao leftIcon={<FiRefreshCw />} isLoading={carregando} onClick={carregar}>
            Atualizar
          </Botao>
        </Flex>
      </Flex>

      {/* ── As duas análises ── */}
      {analises.length > 0 && (
        <Grid
          role="tablist"
          aria-label="Análise"
          templateColumns={{ base: '1fr', md: `repeat(${analises.length}, minmax(0, 1fr))` }}
          gap="16px"
        >
          {analises.map((x) => (
            <CartaoDaAnalise
              key={x.analise}
              analise={x}
              ativa={x === sel}
              onEscolher={() => escolher(x.analise)}
            />
          ))}
        </Grid>
      )}

      {sel && !sel.comparavel && (
        <Cartao
          px="20px"
          py="14px"
          display="flex"
          alignItems="flex-start"
          sx={{ gap: '10px' }}
          bg="var(--pa-superficie-2)"
          fontSize="14px"
          lineHeight="21px"
          color="var(--pa-tinta-2)"
        >
          <Box as="span" mt="3px" flexShrink={0}>
            <FiInfo size={15} aria-hidden="true" />
          </Box>
          <span>
            <b>{sel.titulo}:</b> {semComparacao(sel)}
          </span>
        </Cartao>
      )}

      {/* ── A análise escolhida: indicadores, ritmo e gráficos ── */}
      <Flex
        id="pa-analise"
        role="tabpanel"
        aria-labelledby={sel ? `pa-aba-${sel.analise}` : undefined}
        direction="column"
        sx={{ gap: '24px' }}
      >
        {/* ── Indicadores ── */}
        {a && (
          <Grid
            as="section"
            templateColumns={{ base: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }}
            gap="16px"
          >
            <Cartao
              gridColumn={{ base: '1 / -1', lg: 'span 2' }}
              gridRow={{ lg: 'span 2' }}
              px="24px"
              pt="22px"
              pb="18px"
              display="flex"
              flexDirection="column"
            >
              <Flex justify="space-between" align="center" sx={{ gap: '12px' }}>
                <Flex align="center" sx={{ gap: '4px' }} fontSize="14px" fontWeight={500} color="var(--pa-tinta-2)">
                  {atual ? `Venda de ${curto(atual)}` : 'Venda no período'}
                  <Explicacao texto="Tudo o que foi vendido no período, sem o frete e sem os pedidos cancelados. A linha embaixo mostra a venda de cada dia: quanto mais alta, mais se vendeu naquele dia." />
                </Flex>
                <Box fontSize="12px" color="var(--pa-tinta-3)">
                  sem frete · sem cancelados
                </Box>
              </Flex>
              <Box
                mt="8px"
                fontSize={{ base: '36px', md: '44px' }}
                lineHeight={{ base: '44px', md: '52px' }}
                fontWeight={700}
                letterSpacing="-0.03em"
                title={reais(a.venda)}
              >
                {reaisInteiros(a.venda)}
              </Box>
              <Flex align="center" wrap="wrap" sx={{ gap: '8px' }} mt="8px" minH="20px" fontSize="13px" color="var(--pa-tinta-3)">
                {comparacao && v.venda_percentual != null && ind?.anterior ? (
                  <>
                    <Variacao valor={v.venda_percentual} />
                    <span>
                      vs. {anterior ? curto(anterior) : 'período anterior'} · {reaisInteiros(ind.anterior.venda)}
                    </span>
                  </>
                ) : (
                  iMaior >= 0 &&
                  porDia && (
                    <span>
                      Maior dia: {porDia.rotulos[iMaior]} · {valorCurto('reais', vendaDia[iMaior])}
                    </span>
                  )
                )}
              </Flex>
              {diasUteis && diasUteis.rotulos.length > 1 && (
                <>
                  <Box flex="1" minH="88px" mt="18px">
                    <Minitendencia valores={diasUteis.series[0].valores} />
                  </Box>
                  <Flex justify="space-between" mt="8px" fontSize="12px" color="var(--pa-tinta-3)">
                    <span>{diasUteis.rotulos[0]}</span>
                    <span>venda por dia</span>
                    <span>{diasUteis.rotulos[diasUteis.rotulos.length - 1]}</span>
                  </Flex>
                </>
              )}
            </Cartao>
            {pequenos.map((k, i) => (
              <Indicador
                key={k.rotulo}
                {...k}
                delta={comparacao ? k.delta : null}
                gridColumn={pequenos.length === 3 && i === 2 ? { lg: 'span 2' } : undefined}
              />
            ))}
          </Grid>
        )}

        {/* ── Ritmo ── */}
        {ritmo.length > 0 && (
          <Cartao
            as="section"
            aria-label="Ritmo"
            display="grid"
            gridTemplateColumns={{ base: '1fr', md: `repeat(${ritmo.length}, minmax(0, 1fr))` }}
            px="24px"
            py="4px"
          >
            {ritmo.map((r, i) => (
              <Flex
                key={r.rotulo}
                align="center"
                sx={{ gap: '14px' }}
                py="16px"
                pl={{ base: 0, md: i ? '24px' : 0 }}
                pr={{ md: '16px' }}
                borderLeft={{ md: i ? '1px solid var(--pa-linha)' : 'none' }}
                borderTop={{ base: i ? '1px solid var(--pa-linha)' : 'none', md: 'none' }}
              >
                <Box
                  w="36px"
                  h="36px"
                  borderRadius="10px"
                  bg="var(--pa-superficie-2)"
                  border="1px solid var(--pa-linha)"
                  display="grid"
                  placeItems="center"
                  color="var(--pa-tinta-2)"
                  flexShrink={0}
                  aria-hidden="true"
                >
                  {r.icone}
                </Box>
                <Box minW={0}>
                  <Flex align="center" sx={{ gap: '4px' }} fontSize="13px" color="var(--pa-tinta-3)">
                    {r.rotulo}
                    <Explicacao texto={r.explicacao} />
                  </Flex>
                  <Flex align="baseline" wrap="wrap" sx={{ gap: '4px 8px' }}>
                    <Box fontSize="20px" fontWeight={700} letterSpacing="-0.01em" title={r.titulo}>
                      {r.valor}
                    </Box>
                    <Box fontSize="13px" color="var(--pa-tinta-3)">
                      {r.legenda}
                    </Box>
                  </Flex>
                </Box>
              </Flex>
            ))}
          </Cartao>
        )}

        {/* ── Venda por dia e por vendedor ── */}
        {(porDia || ranking) && (
          <Grid
            templateColumns={{ base: '1fr', lg: ranking && porDia ? 'minmax(0, 1.75fr) minmax(0, 1fr)' : '1fr' }}
            gap="16px"
          >
            {porDia && (
              <Cartao px="24px" pt="22px" pb="18px">
                <TituloDoCartao
                  titulo={`Evolução da venda (${atual?.dias || porDia.rotulos.length} dias)`}
                  legenda={
                    (comparacao
                      ? 'Comparada com o período anterior'
                      : `Média de ${reaisInteiros(mediaDia)} por dia com venda`) +
                    (fimDeSemanaFora ? ' · sábado e domingo sem venda ficam de fora' : '')
                  }
                  explicacao={
                    'Cada ponto é o total vendido no dia, sem frete e sem pedidos cancelados.' +
                    (porDia.series.length > 1
                      ? ' A linha pontilhada é o mesmo dia da semana no período anterior.'
                      : '') +
                    (parcial ? ' O último ponto é hoje, ainda em andamento.' : '') +
                    ' Passe o mouse sobre a linha para ver o valor de cada dia.'
                  }
                >
                  <Legenda series={porDia.series} cores={cores} linha />
                </TituloDoCartao>
                <Area
                  unidade="reais"
                  rotulos={porDia.rotulos}
                  series={porDia.series}
                  cores={cores}
                  altura={330}
                  parcial={parcial}
                  pico="Maior venda"
                  media={mediaDia ? { valor: mediaDia, nome: 'a média do dia com venda' } : undefined}
                />
              </Cartao>
            )}
            {ranking && (
              <Cartao px="24px" pt="22px" pb="20px">
                <TituloDoCartao
                  titulo="Vendedores em destaque"
                  legenda={
                    porVendedor!.series.length > 1
                      ? 'Variação contra o período anterior'
                      : top2 !== null
                        ? `Os 2 primeiros fazem ${percentual(top2, 0)} da venda`
                        : `Total vendido nos últimos ${atual?.dias} dias`
                  }
                  explicacao={
                    `Quanto cada vendedor vendeu no período, do maior para o menor` +
                    (porVendedor!.rotulos.length >= 10 ? ' (os 10 primeiros)' : '') +
                    '. ' +
                    (porVendedor!.series.length > 1
                      ? 'Ao lado do valor, quanto a venda subiu ou caiu contra o período anterior.'
                      : 'Ao lado do valor, a parte de cada um na venda total.')
                  }
                />
                <Ranking
                  unidade="reais"
                  rotulos={porVendedor!.rotulos}
                  series={porVendedor!.series}
                  cores={cores}
                  total={a?.venda}
                  grande
                />
              </Cartao>
            )}
          </Grid>
        )}

        {outros.length > 0 && (
          <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }} gap="16px">
            {outros.map((g, n) => (
              <Cartao key={n} px="24px" py="20px" gridColumn={g.tipo === 'mapa_de_calor' ? '1 / -1' : undefined}>
                <TituloDoCartao titulo={g.titulo} explicacao={EXPLICACAO_DO_TIPO[g.tipo]}>
                  {g.series.length > 1 && g.tipo !== 'pizza' && g.tipo !== 'mapa_de_calor' && (
                    <Legenda series={g.series} cores={cores} />
                  )}
                </TituloDoCartao>
                <CorpoDoGrafico g={g} />
              </Cartao>
            ))}
          </Grid>
        )}
      </Flex>

      {/* ── Quando os pedidos entram (o mesmo nas duas análises) ── */}
      {calor && (
        <Grid templateColumns={{ base: '1fr', lg: 'minmax(0, 1.15fr) minmax(0, 1fr)' }} gap="16px">
          <Cartao px="24px" pt="22px" pb="20px">
            <TituloDoCartao
              titulo="Quando os pedidos entram"
              legenda={
                (periodoDoCalor ? `De ${curto(periodoDoCalor)} · ` : '') +
                (pico.v > 0
                  ? `pico na ${pico.dia}, das ${horaDe(calor.rotulos[pico.j])}h às ${horaDe(calor.rotulos[pico.j]) + 1}h`
                  : 'pedidos por dia da semana e hora do dia')
              }
              explicacao="Cada linha é um dia da semana e cada coluna, uma hora do dia. Quanto mais forte a cor do quadrado, mais pedidos entraram naquele horário; o quadrado com número é o horário com mais pedidos. Vem da maior análise que há e é o mesmo nas duas."
            />
            <Calor
              rotulos={calor.rotulos}
              series={calor.series}
              unidade={calor.unidade}
              escalaDe="Menos pedidos"
              escalaAte="Mais pedidos"
            />
          </Cartao>
          <Cartao px="24px" pt="22px" pb="20px">
            <TituloDoCartao
              titulo="Pedidos por hora"
              legenda={
                totalPedidos && janela.soma > 0
                  ? `${percentual((janela.soma / totalPedidos) * 100, 0)} dos pedidos entram entre ${horaDe(calor.rotulos[janela.inicio])}h e ${horaDe(calor.rotulos[janela.inicio]) + 3}h`
                  : 'Total de pedidos no período'
              }
              explicacao="Quantos pedidos entraram em cada hora do dia, somando todos os dias do período. Mostra em que horário a equipe mais lança pedidos."
            />
            <Colunas
              unidade="quantidade"
              rotulos={calor.rotulos}
              series={[{ nome: 'Pedidos', valores: porHora }]}
              cores={cores}
              altura={220}
            />
          </Cartao>
        </Grid>
      )}

      {/* ── O que pede atenção ── */}
      <Flex as="section" direction="column" sx={{ gap: '14px' }}>
        <Flex justify="space-between" align="center" wrap="wrap" sx={{ gap: '12px' }}>
          <Box as="h2" m={0} fontSize="18px" fontWeight={700} letterSpacing="-0.01em">
            O que pede atenção
          </Box>
          {contagem('todos') > 0 && (
            <Flex wrap="wrap" sx={{ gap: '8px' }} role="group" aria-label="Filtrar alertas">
              {([['todos', 'Todos'], ...CLASSES] as [Classe | 'todos', string][]).map(([c, rotulo]) => {
                const ativo = filtro === c;
                const n = contagem(c);
                if (!n && c !== 'todos') return null;
                return (
                  <Button
                    key={c}
                    size="sm"
                    h="32px"
                    px="12px"
                    borderRadius="999px"
                    fontSize="13px"
                    fontWeight={500}
                    border="1px solid"
                    borderColor={ativo ? 'var(--pa-tinta)' : 'var(--pa-linha)'}
                    bg={ativo ? 'var(--pa-tinta)' : 'var(--pa-superficie)'}
                    color={ativo ? 'var(--pa-superficie)' : 'var(--pa-tinta-2)'}
                    _hover={{ color: ativo ? 'var(--pa-superficie)' : 'var(--pa-tinta)' }}
                    _active={{}}
                    aria-pressed={ativo}
                    onClick={() => setFiltro(c)}
                  >
                    {rotulo}
                    <Box as="b" ml="8px" fontWeight={600}>
                      {n}
                    </Box>
                  </Button>
                );
              })}
            </Flex>
          )}
        </Flex>

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }} gap="16px" alignItems="start">
          <Flex direction="column" sx={{ gap: '20px' }} gridColumn={{ lg: 'span 2' }} minW={0}>
            {contagem(filtro) === 0 ? (
              <Cartao px="20px" py="28px" textAlign="center" color="var(--pa-tinta-2)">
                Nada pede atenção agora.
              </Cartao>
            ) : (
              grupos.map((g) => {
                const lista = doGrupo(g, filtro);
                if (!lista.length) return null;
                return (
                  <Flex key={g.chave} direction="column" sx={{ gap: '12px' }}>
                    <Flex align="baseline" wrap="wrap" sx={{ gap: '2px 8px' }}>
                      <Box as="h3" m={0} fontSize="15px" fontWeight={600}>
                        {g.titulo}
                      </Box>
                      <Box fontSize="13px" color="var(--pa-tinta-3)">
                        {g.legenda}
                      </Box>
                    </Flex>
                    {lista.map((al) => (
                      <CartaoDeAlerta key={al.chave} alerta={al} onPerguntar={onPerguntar} />
                    ))}
                    {filtro === 'todos' && !!g.fora && (
                      <Box fontSize="13px" color="var(--pa-tinta-3)" textAlign="center">
                        e mais {g.fora} alertas menores fora da lista
                      </Box>
                    )}
                  </Flex>
                );
              })
            )}
          </Flex>

          <Cartao as="aside" px="22px" py="20px" display="flex" flexDirection="column" sx={{ gap: '14px' }}>
            {recomendacoes.length > 0 && (
              <>
                <Box>
                  <Box as="h2" m={0} fontSize="16px" fontWeight={600}>
                    Por onde começar
                  </Box>
                  <Box fontSize="13px" color="var(--pa-tinta-3)" mt="2px">
                    Em ordem de urgência
                  </Box>
                </Box>
                <Box as="ol" listStyleType="none" m={0} p={0} display="flex" flexDirection="column" sx={{ gap: '14px' }}>
                  {recomendacoes.map((r, i) => (
                    <Box as="li" key={r.acao} display="grid" gridTemplateColumns="26px minmax(0, 1fr)" sx={{ gap: '12px' }}>
                      <Box
                        w="26px"
                        h="26px"
                        borderRadius="50%"
                        bg="var(--pa-superficie-2)"
                        border="1px solid var(--pa-linha)"
                        display="grid"
                        placeItems="center"
                        fontSize="12px"
                        fontWeight={700}
                      >
                        {i + 1}
                      </Box>
                      <Box minW={0}>
                        <Box fontSize="14px" lineHeight="20px" fontWeight={600}>
                          {r.acao}
                        </Box>
                        <Flex align="flex-start" sx={{ gap: '6px' }} mt="4px" fontSize="12px" lineHeight="18px" color="var(--pa-tinta-3)">
                          <Selo classe={r.classe} pequeno />
                          <span>
                            {r.motivo}
                            {r.origem && ` · ${r.origem}`}
                          </span>
                        </Flex>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </>
            )}
            <Box borderTop={recomendacoes.length ? '1px solid var(--pa-linha)' : undefined} pt={recomendacoes.length ? '14px' : 0}>
              <Box fontSize="13px" fontWeight={600} mb="8px">
                Perguntas para começar
              </Box>
              <Flex direction="column" sx={{ gap: '6px' }}>
                {perguntas.map((p) => (
                  <Botao
                    key={p}
                    h="auto"
                    py="8px"
                    px="12px"
                    justifyContent="flex-start"
                    textAlign="left"
                    whiteSpace="normal"
                    fontWeight={500}
                    onClick={() => onPerguntar(p)}
                  >
                    {p}
                  </Botao>
                ))}
              </Flex>
            </Box>
          </Cartao>
        </Grid>
      </Flex>

      {/* ── Sobre os dados ── */}
      {limitacoes.length > 0 && (
        <Box as="section" borderTop="1px solid var(--pa-linha)" pt="14px">
          <Button
            size="sm"
            variant="ghost"
            h="34px"
            px="6px"
            fontSize="13px"
            fontWeight={600}
            color="var(--pa-tinta-2)"
            _hover={{ bg: 'var(--pa-superficie-2)', color: 'var(--pa-tinta)' }}
            leftIcon={<FiInfo aria-hidden="true" />}
            rightIcon={
              <Box as="span" transition="transform .15s" transform={sobre ? 'rotate(180deg)' : undefined}>
                <FiChevronDown aria-hidden="true" />
              </Box>
            }
            aria-expanded={sobre}
            onClick={() => setSobre(!sobre)}
          >
            Sobre os dados
          </Button>
          {sobre && (
            <Box as="ul" m={0} mt="8px" pl="22px" fontSize="13px" lineHeight="22px" color="var(--pa-tinta-2)">
              {limitacoes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Flex>,
  );
}
