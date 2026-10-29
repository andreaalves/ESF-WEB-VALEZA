import { useEffect, useRef, useState } from 'react';

// O visual comum ao painel e aos gráficos do assistente: as cores (em CSS
// variables, uma tabela por tema) e o jeito de escrever cada número. As cores
// não seguem a escala gray.* do Chakra, que o tema claro inverte
// (styles/light-theme.css): o painel precisa de superfícies e tons de texto que
// passem o contraste nos dois temas.

export type Unidade = 'reais' | 'percentual' | 'quantidade';

// As 8 cores categóricas, validadas para daltonismo nos dois temas. A primeira
// é a cor dos dados; a cor segue a série, sempre na mesma ordem.
export const CORES_ESCURO = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767',
];
export const CORES_CLARO = [
  '#2a78d6', '#eb6834', '#1baf7a', '#eda100',
  '#e87ba4', '#008300', '#6250d6', '#e34948',
];

// A cor dos dados em RGB, para o mapa de calor variar só a opacidade.
export const RGB_DO_DADO = { claro: '42,120,214', escuro: '57,135,229' };

const CLARO: Record<string, string> = {
  '--pa-superficie': '#ffffff',
  '--pa-superficie-2': '#f6f7f9',
  '--pa-linha': '#e4e7ec',
  '--pa-grade': '#eef0f3',
  '--pa-tinta': '#101828',
  '--pa-tinta-2': '#475467',
  '--pa-tinta-3': '#5f6779',
  '--pa-dado': CORES_CLARO[0],
  '--pa-dado-fantasma': '#bfd5f1',
  '--pa-marca': '#fe8026',
  '--pa-marca-tinta': '#b54c00',
  '--pa-marca-suave': '#fff1e6',
  '--pa-sobe': '#067647',
  '--pa-sobe-fundo': '#e7f8ee',
  '--pa-desce': '#b42318',
  '--pa-desce-fundo': '#fdeeec',
  '--pa-critico': '#b42318',
  '--pa-critico-fundo': '#fdeeec',
  '--pa-atencao': '#a94a04',
  '--pa-atencao-fundo': '#fef4e2',
  '--pa-oportunidade': '#067647',
  '--pa-oportunidade-fundo': '#e7f8ee',
  '--pa-informativo': '#475467',
  '--pa-informativo-fundo': '#eef0f3',
  '--pa-dica': '#101828',
  '--pa-dica-tinta': '#ffffff',
  '--pa-dica-2': '#b9c0cc',
  '--pa-sombra': '0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)',
  // A célula de pico do mapa de calor.
  '--pa-pico': '#0b2a6b',
  '--pa-pico-tinta': '#ffffff',
  // O gráfico dentro do balão de resposta (gray.700).
  '--pa-figura': '#ffffff',
  '--pa-figura-linha': '#dfe3ea',
};

const ESCURO: Record<string, string> = {
  '--pa-superficie': '#272936',
  '--pa-superficie-2': '#2e3140',
  '--pa-linha': '#383b4d',
  '--pa-grade': '#303344',
  '--pa-tinta': '#f2f4f7',
  '--pa-tinta-2': '#bac1cd',
  '--pa-tinta-3': '#9aa1b2',
  '--pa-dado': CORES_ESCURO[0],
  '--pa-dado-fantasma': '#34496e',
  '--pa-marca': '#fe8026',
  '--pa-marca-tinta': '#ff9c52',
  '--pa-marca-suave': 'rgba(254,128,38,.14)',
  '--pa-sobe': '#47cd89',
  '--pa-sobe-fundo': 'rgba(23,178,106,.16)',
  '--pa-desce': '#f97066',
  '--pa-desce-fundo': 'rgba(240,68,56,.16)',
  '--pa-critico': '#f97066',
  '--pa-critico-fundo': 'rgba(240,68,56,.16)',
  '--pa-atencao': '#fdb022',
  '--pa-atencao-fundo': 'rgba(247,144,9,.16)',
  '--pa-oportunidade': '#47cd89',
  '--pa-oportunidade-fundo': 'rgba(23,178,106,.16)',
  '--pa-informativo': '#a4adbd',
  '--pa-informativo-fundo': 'rgba(152,162,179,.16)',
  '--pa-dica': '#f2f4f7',
  '--pa-dica-tinta': '#101828',
  '--pa-dica-2': '#475467',
  '--pa-sombra': 'none',
  '--pa-pico': '#bcd4ff',
  '--pa-pico-tinta': '#0b1b3a',
  '--pa-figura': '#2b2c3a',
  '--pa-figura-linha': '#44465a',
};

export function variaveisDoTema(ehClaro: boolean): React.CSSProperties {
  return (ehClaro ? CLARO : ESCURO) as React.CSSProperties;
}

// A cor de cada série: o período anterior é a cor dos dados, apagada.
export function corDaSerie(nome: string, i: number, cores: string[]): string {
  if (i > 0 && /anterior/i.test(nome)) return 'var(--pa-dado-fantasma)';
  return cores[i % cores.length];
}

const br = (v: number, casas = 0, max = casas) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: max });

// O valor exato, com centavos: na dica e onde o número é lido de perto.
export function valorExato(unidade: Unidade, v: number): string {
  if (unidade === 'reais')
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (unidade === 'percentual') return `${br(v, 1)}%`;
  return br(v, 0, 2);
}

// Reais sem centavos: o indicador grande.
export function reaisInteiros(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// O valor curto, para caber ao lado da barra: R$ 849 mil, R$ 1,13 mi.
export function valorCurto(unidade: Unidade, v: number): string {
  if (unidade === 'percentual') return `${br(v, 1)}%`;
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  const r = unidade === 'reais' ? 'R$ ' : '';
  if (a >= 1e6) return `${s}${r}${br(a / 1e6, 2)} mi`;
  if (a >= 1e4) return `${s}${r}${br(Math.round(a / 1e3))} mil`;
  if (a >= 1e3 && unidade === 'reais') return `${s}${r}${br(a / 1e3, 1)} mil`;
  return `${s}${r}${br(a, 0, unidade === 'reais' ? 0 : 1)}`;
}

// O rótulo do eixo: sem "R$", que se repetiria em cada linha.
export function rotuloDoEixo(unidade: Unidade, v: number): string {
  if (unidade === 'percentual') return `${br(v, 0, 1)}%`;
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}${br(a / 1e6, 0, 2)} mi`;
  if (a >= 1e3) return `${s}${br(a / 1e3, 0, 1)} mil`;
  return `${s}${br(a, 0, 1)}`;
}

export function variacao(v: number, sufixo = '%'): string {
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${br(Math.abs(v), 1)}${sufixo}`;
}

export function percentual(v: number, casas = 1): string {
  return `${br(v, casas)}%`;
}

// Escala "redonda" do eixo: passos de 1, 2, 2,5 ou 5 vezes uma potência de 10,
// com até `marcas` linhas, sempre passando pelo zero.
export function escala(lo: number, hi: number, marcas = 5) {
  lo = Math.min(0, lo);
  hi = Math.max(0, hi);
  if (hi === lo) hi = lo + 1;
  const bruto = (hi - lo) / (marcas - 1);
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const passo =
    [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) || 10 * potencia;
  const min = Math.floor(lo / passo) * passo;
  const max = Math.ceil(hi / passo) * passo;
  const linhas: number[] = [];
  for (let v = min; v <= max + passo / 2; v += passo) linhas.push(Math.round(v * 1e6) / 1e6);
  return { min, max, linhas };
}

// Sábado e domingo sem venda saem da série diária: a Valeza não vende no fim
// de semana, e o zero de todo sábado desenha um serrote que parece queda. Dia
// útil sem venda (um feriado, um problema) continua.
const FIM_DE_SEMANA = /^(s[áa]b|dom)/i;

export function semFimDeSemanaVazio<S extends { valores: number[] }>(
  rotulos: string[],
  series: S[],
) {
  const manter = rotulos.map(
    (r, j) => !(FIM_DE_SEMANA.test(r) && series.every((s) => !s.valores[j])),
  );
  const tirados = manter.filter((m) => !m).length;
  if (!tirados) return { rotulos, series, tirados };
  return {
    rotulos: rotulos.filter((_, j) => manter[j]),
    series: series.map((s) => ({ ...s, valores: s.valores.filter((_, j) => manter[j]) })),
    tirados,
  };
}

// A largura real do elemento, em pixels: o gráfico desenha na largura que tem,
// com a letra sempre do mesmo tamanho (antes o SVG esticava e a letra crescia).
export function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largura, setLargura] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLargura(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(([e]) => setLargura(e.contentRect.width));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);
  return [ref, largura] as const;
}
