import { Grafico } from '../../context/AssistenteContext';
import {
  CORES_CLARO,
  CORES_ESCURO,
  corDaSerie,
  escala,
  percentual,
  RGB_DO_DADO,
  rotuloDoEixo,
  semFimDeSemanaVazio,
  Unidade,
  valorCurto,
  valorExato,
  variacao,
  variaveisDoTema,
} from './visual';

// As regras do gráfico interativo do chat, sem React: que forma cada pedido da
// LLM vira, as opções do ApexCharts e o que aparece ao clicar. O painel segue
// com as peças de Grafico.tsx.

export type Forma = 'ranking' | 'colunas' | 'area' | 'rosca' | 'calor';

type Serie = { nome: string; valores: number[] };

export interface Preparado {
  forma: Forma;
  unidade: Unidade;
  rotulos: string[];
  series: Serie[];
}

// O ponto clicado: `serie` é a linha do mapa de calor; nos outros, 0.
export interface Ponto {
  serie: number;
  indice: number;
}

export interface Detalhe {
  titulo: string;
  valores: { nome: string; valor: string; cor: string }[];
  notas: string[];
}

const ehAnterior = (s: Serie, i: number) => i > 0 && /anterior/i.test(s.nome);

// Rótulos de tempo (horas, dias, meses): barras deles vão em colunas.
const TEMPO =
  /^(\d{1,2}h|\d{2}\/\d{2}(\/\d{2,4})?|(seg|ter|qua|qui|sex|s[áa]b|dom)\S*( \d{2}\/\d{2})?|(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\S*)$/i;

const DIA_CURTO: Record<string, string> = {
  segunda: 'seg',
  terça: 'ter',
  quarta: 'qua',
  quinta: 'qui',
  sexta: 'sex',
  sábado: 'sáb',
  domingo: 'dom',
};

// "qui 08/10" vira "08/10"; o dia da semana fica na dica.
const dataDoRotulo = (r: string) => r.match(/^\S+\s+(\d{2}\/\d{2})$/)?.[1] || r;

const maiusculo = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Quem compara itens fica do maior para o menor, pela primeira série. O ranking
// é regra da tela: a ordem não depende de a LLM ter mandado em ordem.
function ordenado(g: Grafico): Preparado {
  const ordem = g.rotulos.map((_, j) => j).sort((a, b) => g.series[0].valores[b] - g.series[0].valores[a]);
  return {
    forma: 'ranking',
    unidade: g.unidade,
    rotulos: ordem.map((j) => g.rotulos[j]),
    series: g.series.map((s) => ({ ...s, valores: ordem.map((j) => s.valores[j]) })),
  };
}

export function preparar(g: Grafico): Preparado {
  const { unidade, rotulos, series } = g;
  if (g.tipo === 'pizza') return { forma: 'rosca', unidade, rotulos, series };
  if (g.tipo === 'mapa_de_calor') return { forma: 'calor', unidade, rotulos, series };
  if (g.tipo === 'linha') return { forma: 'area', unidade, ...semFimDeSemanaVazio(rotulos, series) };
  if (rotulos.every((r) => TEMPO.test(r.trim())) && rotulos.length <= 31)
    return { forma: 'colunas', unidade, rotulos, series };
  return ordenado(g);
}

// A altura em pixels: o ranking cresce com os itens, para o nome sempre caber.
export function alturaDe({ forma, rotulos, series }: Preparado): number {
  if (forma === 'ranking') return Math.max(120, rotulos.length * (series.length > 1 ? 18 + 16 * series.length : 42) + 12);
  if (forma === 'calor') return series.length * 32 + 44;
  if (forma === 'rosca') return 200;
  return 230;
}

// Largura mínima do mapa de calor: abaixo disso, ele rola de lado.
export const larguraDoCalor = (colunas: number) => 44 + colunas * 27;

function coresDe(p: Preparado, ehClaro: boolean): string[] {
  const cores = ehClaro ? CORES_CLARO : CORES_ESCURO;
  const tema = variaveisDoTema(ehClaro) as Record<string, string>;
  if (p.forma === 'rosca') return p.rotulos.map((_, i) => cores[i % cores.length]);
  return p.series.map((s, i) => {
    const cor = corDaSerie(s.nome, i, cores);
    // A tinta do período anterior vem em CSS variable; o ApexCharts quer a cor.
    // Na linha ele é um pontilhado: a cor apagada da barra sumiria.
    if (!cor.startsWith('var(')) return cor;
    return p.forma === 'area' ? tema['--pa-tinta-3'] : tema['--pa-dado-fantasma'];
  });
}

export function detalheDe(p: Preparado, ponto: Ponto, ehClaro: boolean): Detalhe {
  const { forma, unidade, rotulos, series } = p;
  const j = ponto.indice;
  const cores = coresDe(p, ehClaro);
  const notas: string[] = [];

  if (forma === 'calor') {
    const v = series[ponto.serie].valores[j];
    const total = series.flatMap((s) => s.valores).reduce((a, b) => a + b, 0);
    if (total > 0 && v > 0) notas.push(`${percentual((v / total) * 100)} do total`);
    return {
      titulo: `${maiusculo(series[ponto.serie].nome)}, ${rotulos[j]}`,
      valores: [{ nome: '', valor: valorExato(unidade, v), cor: cores[0] }],
      notas,
    };
  }

  const principal = series[0].valores;
  const v = principal[j];
  const somaFazSentido = unidade !== 'percentual' && principal.every((x) => x >= 0);
  const total = principal.reduce((a, b) => a + b, 0);
  if (forma === 'ranking' && rotulos.length > 1) {
    notas.push(`${j + 1}º de ${rotulos.length}`);
    if (j > 0 && unidade !== 'percentual' && principal[0] > v)
      notas.push(`${valorExato(unidade, principal[0] - v)} abaixo do 1º`);
  }
  if (somaFazSentido && series.length === 1 && forma !== 'area' && total > 0)
    notas.push(`${percentual((v / total) * 100)} do total`);
  const anterior = series.findIndex(ehAnterior);
  if (anterior > 0 && series[anterior].valores[j] > 0) {
    notas.push(`${variacao((v / series[anterior].valores[j] - 1) * 100)} vs. período anterior`);
  } else if ((forma === 'area' || forma === 'colunas') && j > 0 && principal[j - 1] > 0) {
    notas.push(`${variacao((v / principal[j - 1] - 1) * 100)} vs. ${dataDoRotulo(rotulos[j - 1])}`);
  }

  const fatias = forma === 'rosca';
  return {
    titulo: rotulos[j],
    valores: fatias
      ? [{ nome: '', valor: valorExato(unidade, v), cor: cores[j] }]
      : series.map((s, i) => ({
          nome: series.length > 1 ? s.nome : '',
          valor: valorExato(unidade, s.valores[j]),
          cor: cores[i],
        })),
    notas,
  };
}

// As opções que todas as formas dividem. Animação só ao aparecer, e curta.
function comuns(p: Preparado, ehClaro: boolean, zoom: boolean, reduzido: boolean) {
  const tema = variaveisDoTema(ehClaro) as Record<string, string>;
  const legenda = p.series.length > 1 && p.forma !== 'rosca' && p.forma !== 'calor';
  return {
    chart: {
      background: 'transparent',
      foreColor: tema['--pa-tinta-3'],
      fontFamily: 'inherit',
      parentHeightOffset: 0,
      toolbar: {
        show: zoom,
        tools: { download: false, selection: false, zoom: true, zoomin: false, zoomout: false, pan: false, reset: true },
      },
      zoom: { enabled: zoom, type: 'x' },
      animations: {
        enabled: !reduzido,
        speed: 420,
        animateGradually: { enabled: false },
        dynamicAnimation: { enabled: !reduzido, speed: 220 },
      },
    },
    theme: { mode: ehClaro ? 'light' : 'dark' },
    colors: coresDe(p, ehClaro),
    // Sem isto o ApexCharts deixa toda cor 15% transparente.
    fill: { opacity: 1 },
    dataLabels: { enabled: false },
    grid: {
      borderColor: tema['--pa-grade'],
      padding: { top: 0, right: 8, bottom: 0, left: 12 },
    },
    legend: {
      show: legenda,
      position: 'top',
      horizontalAlign: 'left',
      fontSize: '12px',
      labels: { colors: tema['--pa-tinta-2'] },
      markers: { width: 10, height: 10, radius: 3 },
      itemMargin: { horizontal: 8, vertical: 2 },
    },
    // O clique destaca pela classe do quadro (ver `destaque`), não pelo filtro.
    states: {
      hover: { filter: { type: 'none' } },
      active: { filter: { type: 'none' }, allowMultipleDataPointsSelection: false },
    },
    tooltip: {
      // A dica é o inverso do fundo, como no painel.
      theme: ehClaro ? 'dark' : 'light',
      y: { formatter: (v: number) => valorExato(p.unidade, v) },
    },
  };
}

// Cada linha do ranking tem o nome e, embaixo, o valor. Nome longo termina em
// "…" (o ApexCharts o cortaria pela esquerda): inteiro, na dica e no detalhe.
function ranking(p: Preparado, tema: Record<string, string>, largura: number) {
  const { unidade, rotulos, series } = p;
  const larguraDoNome = Math.min(170, Math.round(largura * 0.42));
  const letras = Math.floor(larguraDoNome / 7.2);
  const curto = (r: string) => (r.length > letras ? `${r.slice(0, letras - 1).trimEnd()}…` : r);
  const valorDaLinha = (j: number) => {
    const todos = series.map((s) => valorCurto(unidade, s.valores[j])).join(' / ');
    return todos.length > letras ? valorCurto(unidade, series[0].valores[j]) : todos;
  };
  return {
    chart: { type: 'bar' },
    series,
    plotOptions: {
      bar: { horizontal: true, borderRadius: 4, barHeight: series.length > 1 ? '76%' : '58%' },
    },
    xaxis: {
      categories: rotulos.map((r, j) => [curto(r), valorDaLinha(j)]),
      labels: { show: false },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { maxWidth: larguraDoNome, style: { colors: tema['--pa-tinta-2'], fontSize: '12px' } },
    },
    grid: { show: false, padding: { top: -8, right: 8, bottom: -8, left: 12 } },
    tooltip: { shared: true, intersect: false, x: { formatter: tituloDaDica(rotulos) } },
  };
}

function colunas(p: Preparado, tema: Record<string, string>) {
  const { unidade, rotulos, series } = p;
  const { min, max, linhas } = escala(...limites(series), 5);
  const comValor = series.length === 1 && rotulos.length <= 8;
  return {
    chart: { type: 'bar' },
    series,
    plotOptions: {
      bar: {
        columnWidth: series.length > 1 ? '74%' : '58%',
        borderRadius: 4,
        dataLabels: { position: 'top' },
      },
    },
    dataLabels: {
      enabled: comValor,
      offsetY: -18,
      formatter: (v: number) => valorCurto(unidade, v),
      style: { colors: [tema['--pa-tinta']], fontSize: '11px', fontWeight: 600 },
      dropShadow: { enabled: false },
    },
    // Folga em cima para o número da coluna mais alta.
    grid: { padding: { top: comValor ? 14 : 0, right: 8, bottom: 0, left: 12 } },
    xaxis: eixoDeTempo(rotulos),
    yaxis: eixoDeValor(unidade, min, max, linhas.length),
    tooltip: { shared: true, intersect: false, x: { formatter: tituloDaDica(rotulos) } },
  };
}

function area(p: Preparado, tema: Record<string, string>) {
  const { unidade, rotulos, series } = p;
  const { min, max, linhas } = escala(...limites(series), 5);
  const principal = series[0].valores;
  const pico = principal.indexOf(Math.max(...principal));
  const unica = series.length === 1;
  return {
    chart: { type: 'area' },
    series,
    // Reta entre os pontos: a curva do ApexCharts passa do valor do dia e
    // desenha um vale que não existe.
    stroke: {
      curve: 'straight',
      width: series.map((s, i) => (ehAnterior(s, i) ? 2 : 2.5)),
      dashArray: series.map((s, i) => (ehAnterior(s, i) ? 4 : 0)),
    },
    fill: unica
      ? { type: 'gradient', gradient: { shadeIntensity: 0, opacityFrom: 0.28, opacityTo: 0.03, stops: [0, 100] } }
      : { type: 'solid', opacity: series.map((_, i) => (i ? 0 : 0.12)) },
    markers: {
      size: rotulos.length > 20 ? 2.5 : 3.5,
      strokeColors: tema['--pa-figura'],
      strokeWidth: 2,
      hover: { size: 6 },
      // O maior dia em destaque, sem precisar passar o mouse.
      discrete:
        principal[pico] > 0
          ? [{ seriesIndex: 0, dataPointIndex: pico, fillColor: tema['--pa-dado'], strokeColor: tema['--pa-tinta'], size: 5 }]
          : [],
    },
    xaxis: { ...eixoDeTempo(rotulos), tooltip: { enabled: false } },
    yaxis: eixoDeValor(unidade, min, max, linhas.length),
    tooltip: { shared: true, intersect: false, x: { formatter: tituloDaDica(rotulos) } },
  };
}

function rosca(p: Preparado, tema: Record<string, string>) {
  const { unidade, rotulos, series } = p;
  const total = series[0].valores.reduce((a, b) => a + b, 0);
  return {
    chart: { type: 'donut' },
    series: series[0].valores,
    labels: rotulos,
    stroke: { width: 2, colors: [tema['--pa-figura']] },
    plotOptions: {
      pie: {
        expandOnClick: true,
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { fontSize: '12px', color: tema['--pa-tinta-3'], offsetY: 18 },
            value: {
              fontSize: '17px',
              fontWeight: 700,
              color: tema['--pa-tinta'],
              offsetY: -14,
              formatter: (v: string) => valorCurto(unidade, Number(v)),
            },
            total: {
              show: unidade !== 'percentual',
              showAlways: true,
              label: 'total',
              color: tema['--pa-tinta-3'],
              fontSize: '12px',
              formatter: () => valorCurto(unidade, total),
            },
          },
        },
      },
    },
    tooltip: { enabled: false },
  };
}

// As faixas de cor do mapa de calor: uma cor só, mais forte onde há mais, e o
// pico à parte.
function faixasDoCalor(max: number, ehClaro: boolean, tema: Record<string, string>) {
  const rgb = ehClaro ? RGB_DO_DADO.claro : RGB_DO_DADO.escuro;
  const passos = [0.2, 0.4, 0.6, 0.8];
  const faixas = passos.map((forca, i) => ({
    from: i ? (max * i) / passos.length : 0.0001,
    to: (max * (i + 1)) / passos.length - 0.0001,
    color: `rgba(${rgb},${forca})`,
  }));
  return [
    { from: 0, to: 0, color: tema['--pa-grade'] },
    ...faixas,
    { from: max - 0.0001, to: max, color: tema['--pa-pico'] },
  ];
}

function calor(p: Preparado, ehClaro: boolean, tema: Record<string, string>) {
  const { unidade, rotulos, series } = p;
  const max = Math.max(...series.flatMap((s) => s.valores), 0);
  return {
    chart: { type: 'heatmap' },
    // O ApexCharts desenha de baixo para cima: a primeira série vai por último.
    series: [...series].reverse().map((s) => ({
      name: DIA_CURTO[s.nome] || s.nome,
      data: s.valores.map((y, j) => ({ x: rotulos[j], y })),
    })),
    stroke: { width: 2, colors: [tema['--pa-figura']] },
    plotOptions: {
      heatmap: { radius: 3, enableShades: false, colorScale: { ranges: faixasDoCalor(max, ehClaro, tema) } },
    },
    dataLabels: {
      enabled: true,
      // O número só no pico; os outros, na dica ou no clique.
      formatter: (v: number) => (v === max && v > 0 ? valorCurto(unidade, v) : ''),
      style: { colors: [tema['--pa-pico-tinta']], fontSize: '11px', fontWeight: 700 },
    },
    xaxis: {
      labels: { rotate: 0, style: { fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
      tooltip: { enabled: false },
    },
    yaxis: { labels: { style: { fontSize: '11px', colors: tema['--pa-tinta-2'] } } },
    grid: { show: false, padding: { top: -12, right: 0, bottom: 0, left: 10 } },
  };
}

function limites(series: Serie[]): [number, number] {
  const todos = series.flatMap((s) => s.valores);
  return [Math.min(...todos), Math.max(...todos)];
}

const eixoDeTempo = (rotulos: string[]) => ({
  categories: rotulos.map(dataDoRotulo),
  tickPlacement: 'on',
  labels: { rotate: 0, hideOverlappingLabels: true, trim: false, style: { fontSize: '11px' } },
  axisBorder: { show: false },
  axisTicks: { show: false },
});

const eixoDeValor = (unidade: Unidade, min: number, max: number, marcas: number) => ({
  min,
  max,
  tickAmount: marcas - 1,
  labels: { formatter: (v: number) => rotuloDoEixo(unidade, v), style: { fontSize: '11px' } },
});

// O rótulo inteiro na dica ("qui 08/10"), mesmo com o eixo só com a data.
const tituloDaDica = (rotulos: string[]) => (valor: string | number, ctx?: { dataPointIndex?: number }) =>
  rotulos[ctx?.dataPointIndex ?? -1] ?? String(valor);

// Mescla em dois níveis: `chart`, `grid` e `tooltip` de cada forma somam aos comuns.
function juntar(a: Record<string, any>, b: Record<string, any>) {
  const fim = { ...a, ...b };
  ['chart', 'grid', 'tooltip', 'dataLabels'].forEach((c) => {
    if (a[c] && b[c]) fim[c] = { ...a[c], ...b[c] };
  });
  return fim;
}

export function opcoesDe(
  p: Preparado,
  ehClaro: boolean,
  largura: number,
  reduzido: boolean,
): Record<string, any> {
  const tema = variaveisDoTema(ehClaro) as Record<string, string>;
  // Zoom só onde há espaço: no balão, arrastar o dedo é rolar a conversa.
  const zoom = p.forma === 'area' && p.rotulos.length >= 14 && largura >= 420;
  const especificas =
    p.forma === 'ranking'
      ? ranking(p, tema, largura)
      : p.forma === 'colunas'
        ? colunas(p, tema)
        : p.forma === 'area'
          ? area(p, tema)
          : p.forma === 'rosca'
            ? rosca(p, tema)
            : calor(p, ehClaro, tema);
  return juntar(comuns(p, ehClaro, zoom, reduzido), especificas);
}

// Os dados no formato do ApexCharts, separados das opções.
export function seriesDe(opcoes: Record<string, any>) {
  return opcoes.series.map((s: any) => (s.valores ? { name: s.nome, data: s.valores } : s));
}

// Apaga o resto para o ponto clicado ficar em evidência. Vai no quadro, em CSS:
// não redesenha o gráfico.
export function destaque(forma: Forma, ponto: Ponto | null, linhas: number) {
  if (!ponto) return {};
  const j = ponto.indice;
  const apagar = (seletor: string, ativo: string) => ({
    [seletor]: { opacity: 0.32, transition: 'opacity .15s' },
    [ativo]: { opacity: 1 },
  });
  if (forma === 'ranking' || forma === 'colunas')
    return apagar('& .apexcharts-bar-area', `& .apexcharts-bar-area[j="${j}"]`);
  if (forma === 'rosca')
    return apagar('& .apexcharts-pie-area', `& .apexcharts-pie-area[j="${j}"]`);
  if (forma === 'calor')
    return apagar(
      '& .apexcharts-heatmap-rect',
      `& .apexcharts-series[data\\:realIndex="${linhas - 1 - ponto.serie}"] .apexcharts-heatmap-rect[j="${j}"]`,
    );
  return { [`& .apexcharts-marker[rel="${j}"]`]: { strokeWidth: '4px', stroke: 'var(--pa-tinta)' } };
}
