import { Box as BoxBase, Flex as FlexBase } from '@chakra-ui/react';
import { useState } from 'react';
import { Grafico as DadosGrafico } from '../../context/AssistenteContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import {
  CORES_CLARO,
  CORES_ESCURO,
  corDaSerie,
  escala,
  percentual,
  reaisInteiros,
  RGB_DO_DADO,
  rotuloDoEixo,
  semFimDeSemanaVazio,
  Unidade,
  useLargura,
  valorCurto,
  valorExato,
  variacao,
} from './visual';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;

// Os gráficos do painel, sem biblioteca: as peças que ele monta nos cartões
// dele (o do balão de resposta está em GraficoInterativo.tsx). Tudo é desenhado
// na largura real, com a letra no tamanho da tela:
// - linha (evolução no tempo) vira área: curva suave, o período anterior
//   pontilhado, o maior valor anotado e o dia de hoje como faixa parcial;
// - barras (comparar itens) vira ranking: nome, valor e participação numa
//   linha, a barra embaixo; barras de horas ou dias da semana vão em colunas;
// - pizza vira rosca com o total no meio; o mapa de calor varia só a opacidade.

type Serie = { nome: string; valores: number[] };

const ehAnterior = (s: Serie, i: number) => i > 0 && /anterior/i.test(s.nome);

export function Marca({ cor, redonda }: { cor: string; redonda?: boolean }) {
  return (
    <Box
      as="i"
      display="block"
      w="10px"
      h="10px"
      borderRadius={redonda ? '50%' : '3px'}
      flexShrink={0}
      bg={cor}
    />
  );
}

// Na legenda de linha, o período anterior aparece pontilhado, como no gráfico.
export function Legenda({
  series,
  cores,
  linha,
}: {
  series: Serie[];
  cores: string[];
  linha?: boolean;
}) {
  return (
    <Flex wrap="wrap" sx={{ gap: '4px 16px' }} fontSize="13px" color="var(--pa-tinta-2)">
      {series.map((s, i) => (
        <Flex key={i} align="center" sx={{ gap: '7px' }}>
          {linha && ehAnterior(s, i) ? (
            <Box as="i" display="block" w="18px" borderTop="2px dotted var(--pa-tinta-3)" />
          ) : (
            <Marca cor={corDaSerie(s.nome, i, cores)} redonda={linha} />
          )}
          {s.nome}
        </Flex>
      ))}
    </Flex>
  );
}

// "qui 08/10": o dia da semana e a data.
function partesDoRotulo(rotulo: string): [string, string] {
  const m = rotulo.match(/^(\S+)\s+(\d{2}\/\d{2})$/);
  return m ? [m[1], m[2]] : [rotulo, ''];
}

// Rótulos de tempo (horas, dias, meses): barras deles vão em colunas.
const TEMPO =
  /^(\d{1,2}h|\d{2}\/\d{2}(\/\d{2,4})?|(seg|ter|qua|qui|sex|s[áa]b|dom)\S*( \d{2}\/\d{2})?|(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\S*)$/i;

// A dica ao passar o mouse: em cima do ponto, ou embaixo quando não cabe.
function DicaFlutuante({
  esquerda,
  topo,
  embaixo,
  children,
}: {
  esquerda: string;
  topo: string;
  embaixo?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      role="status"
      position="absolute"
      left={esquerda}
      top={topo}
      transform={embaixo ? 'translate(-50%, 14px)' : 'translate(-50%, calc(-100% - 10px))'}
      bg="var(--pa-dica)"
      color="var(--pa-dica-tinta)"
      borderRadius="10px"
      px="12px"
      py="9px"
      fontSize="12px"
      lineHeight="18px"
      whiteSpace="nowrap"
      pointerEvents="none"
      boxShadow="0 8px 24px rgba(16,24,40,.2)"
      zIndex={2}
    >
      {children}
    </Box>
  );
}

interface Parcial {
  rotulo: string;
  titulo: string;
  valor: number;
}

// O que a dica de um ponto (ou coluna) mostra.
function ConteudoDaDica({
  titulo,
  unidade,
  series,
  valores,
  cores,
  media,
  parcial,
}: {
  titulo: string;
  unidade: Unidade;
  series: Serie[];
  valores: number[];
  cores: string[];
  media?: { valor: number; nome: string };
  parcial?: boolean;
}) {
  const unica = series.length === 1 || parcial;
  const anterior = series.length === 2 && ehAnterior(series[1], 1) && !parcial ? valores[1] : null;
  return (
    <>
      <Box color="var(--pa-dica-2)" fontWeight={500}>
        {titulo}
      </Box>
      {unica ? (
        <Box fontSize="15px" fontWeight={700} mt="2px">
          {valorExato(unidade, valores[0])}
        </Box>
      ) : (
        series.map((s, i) => (
          <Flex key={i} align="center" sx={{ gap: '6px' }} mt="2px">
            <Marca cor={corDaSerie(s.nome, i, cores)} />
            <span>{s.nome}:</span>
            <b>{valorExato(unidade, valores[i])}</b>
          </Flex>
        ))
      )}
      {anterior !== null && anterior > 0 && (
        <Box color="var(--pa-dica-2)">
          {variacao((valores[0] / anterior - 1) * 100)} vs. período anterior
        </Box>
      )}
      {media && !anterior && !parcial && valores[0] > 0 && media.valor > 0 && (
        <Box color="var(--pa-dica-2)">
          {variacao((valores[0] / media.valor - 1) * 100)} vs. {media.nome}
        </Box>
      )}
    </>
  );
}

// Curva suave que não passa do valor dos pontos (cúbica monótona,
// Fritsch–Carlson): sem isso, a curva entre um dia alto e um baixo afunda
// abaixo do menor valor e inventa um vale.
export function caminhoSuave(p: [number, number][]): string {
  if (!p.length) return '';
  if (p.length === 1) return `M${p[0][0]},${p[0][1]}`;
  const n = p.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = p[i + 1][0] - p[i][0] || 1;
    m[i] = (p[i + 1][1] - p[i][1]) / dx[i];
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${p[i][0] + h},${p[i][1] + t[i] * h} ${p[i + 1][0] - h},${p[i + 1][1] - t[i + 1] * h} ${p[i + 1][0]},${p[i + 1][1]}`;
  }
  return d;
}

export interface AreaProps {
  unidade: Unidade;
  rotulos: string[];
  series: Serie[];
  cores: string[];
  // Altura da área do gráfico, em pixels.
  altura?: number;
  // Um ponto a mais no fim, numa faixa: o dia de hoje, ainda em andamento.
  parcial?: Parcial;
  // Referência da dica: "+12% vs. a média do dia com venda".
  media?: { valor: number; nome: string };
  // Anota o maior valor numa caixa fixa ("Maior venda · 09/10").
  pico?: string;
  compacto?: boolean;
}

export function Area(props: AreaProps) {
  const { unidade, cores, altura = 240, parcial, media, pico, compacto } = props;
  const { rotulos, series } = semFimDeSemanaVazio(props.rotulos, props.series);
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const reais = rotulos.length;
  const n = reais + (parcial ? 1 : 0);
  const todos = [...series.flatMap((s) => s.valores), parcial?.valor ?? 0];
  const { min, max, linhas } = escala(Math.min(...todos), Math.max(...todos), compacto ? 4 : 5);
  const W = Math.max(largura, 1);
  const folgaX = 14;
  const folgaY = compacto ? 8 : 12;
  const x = (j: number) => (n === 1 ? W / 2 : folgaX + (j * (W - 2 * folgaX)) / (n - 1));
  const y = (v: number) => folgaY + ((max - v) / (max - min)) * (altura - folgaY);
  const fonte = compacto ? '11px' : '12px';
  const passo = largura ? Math.max(1, Math.ceil((compacto ? 40 : 46) / (W / n))) : 1;
  const principal = series.findIndex((s, i) => !ehAnterior(s, i));
  const valores = series[principal]?.valores || [];
  const iPico = pico && valores.length ? valores.indexOf(Math.max(...valores)) : -1;
  const idArea = `pa-area-${compacto ? 'c' : 'p'}`;

  const valoresEm = (j: number) => (j < reais ? series.map((s) => s.valores[j]) : [parcial!.valor]);
  const pontos = (s: Serie) => s.valores.map((v, j) => [x(j), y(v)] as [number, number]);
  const curva = valores.length ? caminhoSuave(pontos(series[principal])) : '';
  const base = y(Math.max(min, 0));

  const caixaDoPico = () => {
    if (iPico < 0 || foco !== null) return null;
    const px = x(iPico);
    const py = y(valores[iPico]);
    const direita = px < W * 0.62;
    const ant = series.find((s, i) => ehAnterior(s, i))?.valores[iPico];
    const [, data] = partesDoRotulo(rotulos[iPico]);
    return (
      <Box
        position="absolute"
        left={`${direita ? px + 14 : px - 14}px`}
        top={`${Math.max(py - 30, 0)}px`}
        transform={direita ? undefined : 'translateX(-100%)'}
        bg="var(--pa-superficie)"
        border="1px solid var(--pa-linha)"
        borderRadius="10px"
        boxShadow="0 4px 14px rgba(16,24,40,.10)"
        px="12px"
        py="8px"
        fontSize="12px"
        lineHeight="17px"
        whiteSpace="nowrap"
        pointerEvents="none"
      >
        <Box fontWeight={600}>
          {pico} · {data || rotulos[iPico]}
        </Box>
        <Box fontSize="15px" lineHeight="20px" fontWeight={700}>
          {unidade === 'reais' ? reaisInteiros(valores[iPico]) : valorExato(unidade, valores[iPico])}
        </Box>
        {ant ? (
          <Box color="var(--pa-tinta-3)">({variacao((valores[iPico] / ant - 1) * 100)} vs. período anterior)</Box>
        ) : (
          media &&
          media.valor > 0 && (
            <Box color="var(--pa-tinta-3)">({variacao((valores[iPico] / media.valor - 1) * 100)} vs. a média)</Box>
          )
        )}
      </Box>
    );
  };

  const dica = () => {
    if (foco === null) return null;
    const vs = valoresEm(foco);
    const ehParcial = foco >= reais;
    const topo = y(Math.max(...vs));
    const esquerda = Math.min(Math.max(x(foco), compacto ? 70 : 90), W - (compacto ? 70 : 90));
    return (
      <DicaFlutuante esquerda={`${esquerda}px`} topo={`${topo}px`} embaixo={topo < 84}>
        <ConteudoDaDica
          titulo={ehParcial ? parcial!.titulo : rotulos[foco]}
          unidade={unidade}
          series={series}
          valores={vs}
          cores={cores}
          media={media}
          parcial={ehParcial}
        />
      </DicaFlutuante>
    );
  };

  const mostrarRotulo = (j: number) =>
    j >= reais || (j % passo === 0 && (!parcial || reais - j >= passo));

  return (
    <Flex sx={{ gap: compacto ? '6px' : '10px' }}>
      <Box w={compacto ? '36px' : '66px'} h={`${altura}px`} position="relative" flexShrink={0} aria-hidden="true">
        {linhas.map((v) => (
          <Box
            key={v}
            position="absolute"
            right={0}
            top={`${y(v)}px`}
            transform="translateY(-50%)"
            fontSize={fonte}
            color="var(--pa-tinta-3)"
            whiteSpace="nowrap"
          >
            {!compacto && unidade === 'reais' ? `R$ ${rotuloDoEixo(unidade, v)}` : rotuloDoEixo(unidade, v)}
          </Box>
        ))}
      </Box>
      <Box ref={ref} flex="1" minW={0}>
        <Box position="relative" h={`${altura}px`}>
          {largura > 0 && (
            <svg
              width={W}
              height={altura}
              style={{ display: 'block', overflow: 'visible' }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const j = Math.round(((e.clientX - r.left - folgaX) / (W - 2 * folgaX)) * (n - 1));
                setFoco(Math.min(Math.max(j, 0), n - 1));
              }}
              onMouseLeave={() => setFoco(null)}
              aria-hidden="true"
            >
              <defs>
                <linearGradient id={idArea} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--pa-dado)" stopOpacity={0.28} />
                  <stop offset="1" stopColor="var(--pa-dado)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {Array.from({ length: n }, (_, j) =>
                mostrarRotulo(j) ? (
                  <line key={j} x1={x(j)} x2={x(j)} y1={folgaY} y2={altura} stroke="var(--pa-grade)" />
                ) : null,
              )}
              {linhas.map((v) => (
                <line
                  key={v}
                  x1={0}
                  x2={W}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? 'var(--pa-linha)' : 'var(--pa-grade)'}
                />
              ))}
              {parcial && (
                <g>
                  <rect
                    x={(x(reais - 1) + x(reais)) / 2}
                    y={folgaY}
                    width={W - (x(reais - 1) + x(reais)) / 2}
                    height={altura - folgaY}
                    fill="var(--pa-dado)"
                    fillOpacity={0.07}
                  />
                  <line x1={x(reais)} x2={x(reais)} y1={folgaY} y2={altura} stroke="var(--pa-dado)" strokeOpacity={0.5} strokeDasharray="3 4" />
                </g>
              )}
              {curva && (
                <path
                  d={`${curva} L${x(reais - 1)},${base} L${x(0)},${base} Z`}
                  fill={`url(#${idArea})`}
                />
              )}
              {series.map((s, i) =>
                i === principal ? null : (
                  <path
                    key={i}
                    d={caminhoSuave(pontos(s))}
                    fill="none"
                    stroke={ehAnterior(s, i) ? 'var(--pa-tinta-3)' : corDaSerie(s.nome, i, cores)}
                    strokeWidth={2}
                    strokeDasharray={ehAnterior(s, i) ? '1 5' : undefined}
                    strokeLinecap="round"
                  />
                ),
              )}
              {curva && (
                <path d={curva} fill="none" stroke="var(--pa-dado)" strokeWidth={compacto ? 2 : 2.5} strokeLinecap="round" />
              )}
              {parcial && valores.length > 0 && (
                <line
                  x1={x(reais - 1)}
                  y1={y(valores[reais - 1])}
                  x2={x(reais)}
                  y2={y(parcial.valor)}
                  stroke="var(--pa-dado)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              )}
              {series.map((s, i) =>
                s.valores.map((v, j) => (
                  <circle
                    key={`${i}-${j}`}
                    cx={x(j)}
                    cy={y(v)}
                    r={ehAnterior(s, i) ? 2.5 : foco === j ? 5 : compacto || n > 20 ? 3 : 4}
                    fill={ehAnterior(s, i) ? 'var(--pa-tinta-3)' : corDaSerie(s.nome, i, cores)}
                    stroke={ehAnterior(s, i) ? 'none' : 'var(--pa-superficie)'}
                    strokeWidth={2}
                  />
                )),
              )}
              {parcial && (
                <circle cx={x(reais)} cy={y(parcial.valor)} r={5} fill="var(--pa-superficie)" stroke="var(--pa-dado)" strokeWidth={2.5} />
              )}
              {iPico >= 0 && foco === null && (
                <circle cx={x(iPico)} cy={y(valores[iPico])} r={8} fill="var(--pa-superficie)" stroke="var(--pa-dado)" strokeWidth={2.5} />
              )}
              {iPico >= 0 && foco === null && (
                <circle cx={x(iPico)} cy={y(valores[iPico])} r={3.5} fill="var(--pa-dado)" />
              )}
              {foco !== null && (
                <line x1={x(foco)} x2={x(foco)} y1={folgaY} y2={altura} stroke="var(--pa-tinta-3)" strokeDasharray="2 3" />
              )}
            </svg>
          )}
          {largura > 0 && caixaDoPico()}
          {largura > 0 && dica()}
        </Box>
        <Box position="relative" h={parcial && !compacto ? '34px' : '18px'} mt="8px" aria-hidden="true">
          {largura > 0 &&
            Array.from({ length: n }, (_, j) => {
              if (!mostrarRotulo(j)) return null;
              const ehParcial = j >= reais;
              const [semana, data] = ehParcial ? ['', ''] : partesDoRotulo(rotulos[j]);
              return (
                <Box
                  key={j}
                  position="absolute"
                  left={`${x(j)}px`}
                  transform="translateX(-50%)"
                  textAlign="center"
                  whiteSpace="nowrap"
                  fontSize={fonte}
                  lineHeight="16px"
                  color={ehParcial ? 'var(--pa-tinta)' : 'var(--pa-tinta-3)'}
                  fontWeight={ehParcial ? 600 : 400}
                >
                  {ehParcial ? (
                    <>
                      <div>{parcial!.rotulo}</div>
                      {!compacto && (
                        <Box fontWeight={400} color="var(--pa-tinta-3)">
                          (parcial)
                        </Box>
                      )}
                    </>
                  ) : (
                    data || semana
                  )}
                </Box>
              );
            })}
        </Box>
      </Box>
    </Flex>
  );
}

export interface ColunasProps {
  unidade: Unidade;
  rotulos: string[];
  series: Serie[];
  cores: string[];
  // Altura da área das colunas, em pixels.
  altura?: number;
  compacto?: boolean;
}

export function Colunas({ unidade, rotulos, series, cores, altura = 220, compacto }: ColunasProps) {
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [foco, setFoco] = useState<number | null>(null);
  const n = rotulos.length;
  const todos = series.flatMap((s) => s.valores);
  const { min, max, linhas } = escala(Math.min(...todos), Math.max(...todos), compacto ? 4 : 5);
  const topo = (v: number) => ((max - v) / (max - min)) * 100;
  const zero = topo(0);
  const porColuna = largura / Math.max(n, 1);
  // Rótulo do eixo X a cada `passo` colunas, para não encostarem.
  const passo = largura ? Math.max(1, Math.ceil(34 / porColuna)) : 1;
  const unica = series.length === 1;
  const maior = unica ? Math.max(...series[0].valores) : NaN;
  const fonte = compacto ? '11px' : '12px';
  // Valor em cima de cada coluna quando cabe; senão, só no maior.
  const texto = (v: number) => rotuloDoEixo(unidade, v);
  const maisLongo = unica ? Math.max(...series[0].valores.map((v) => texto(v).length)) : 0;
  const todosOsValores = unica && porColuna >= maisLongo * 6.6 + 4;

  return (
    <Flex sx={{ gap: compacto ? '6px' : '10px' }}>
      <Box w={compacto ? '32px' : '44px'} h={`${altura}px`} position="relative" flexShrink={0} aria-hidden="true">
        {linhas.map((v) => (
          <Box
            key={v}
            position="absolute"
            right={0}
            top={`${topo(v)}%`}
            transform="translateY(-50%)"
            fontSize={fonte}
            color="var(--pa-tinta-3)"
            whiteSpace="nowrap"
          >
            {rotuloDoEixo(unidade, v)}
          </Box>
        ))}
      </Box>
      <Box ref={ref} flex="1" minW={0}>
        <Box
          position="relative"
          h={`${altura}px`}
          sx={{
            '&:hover .barra': { opacity: 0.45 },
            '& .coluna:hover .barra': { opacity: 1 },
          }}
        >
          {linhas.map((v) => (
            <Box
              key={v}
              position="absolute"
              left={0}
              right={0}
              top={`${topo(v)}%`}
              borderTop={`1px solid ${v === 0 ? 'var(--pa-linha)' : 'var(--pa-grade)'}`}
              aria-hidden="true"
            />
          ))}
          <Flex position="absolute" top={0} bottom={0} left={0} right={0}>
            {rotulos.map((rotulo, j) => {
              const v = series[0].valores[j];
              const mostrarValor = unica && v !== 0 && (todosOsValores || v === maior);
              return (
                <Box
                  key={j}
                  className="coluna"
                  flex="1 1 0"
                  minW={0}
                  position="relative"
                  onMouseEnter={() => setFoco(j)}
                  onMouseLeave={() => setFoco(null)}
                  onClick={() => setFoco(foco === j ? null : j)}
                >
                  <Flex
                    position="absolute"
                    top={0}
                    bottom={0}
                    left="50%"
                    transform="translateX(-50%)"
                    w={unica ? '66%' : `${Math.min(88, 32 * series.length)}%`}
                    maxW={unica ? '40px' : `${20 * series.length}px`}
                    sx={{ gap: '3px' }}
                  >
                    {series.map((s, i) => {
                      const w = s.valores[j];
                      const vazia = w === 0;
                      return (
                        <Box key={i} flex="1" position="relative" h="100%" minW={0}>
                          <Box
                            className="barra"
                            position="absolute"
                            left={0}
                            right={0}
                            top={`${vazia ? zero : topo(Math.max(w, 0))}%`}
                            h={vazia ? '2px' : `${Math.abs(topo(w) - zero)}%`}
                            mt={vazia ? '-1px' : 0}
                            borderRadius={vazia ? '2px' : w > 0 ? '4px 4px 0 0' : '0 0 4px 4px'}
                            bg={vazia ? 'var(--pa-linha)' : corDaSerie(s.nome, i, cores)}
                            transition="opacity .15s"
                          />
                        </Box>
                      );
                    })}
                  </Flex>
                  {mostrarValor && (
                    <Box
                      position="absolute"
                      left="50%"
                      transform="translateX(-50%)"
                      bottom={v > 0 ? `calc(${100 - topo(v)}% + 4px)` : undefined}
                      top={v < 0 ? `calc(${topo(v)}% + 4px)` : undefined}
                      fontSize={fonte}
                      fontWeight={600}
                      color="var(--pa-tinta)"
                      whiteSpace="nowrap"
                      pointerEvents="none"
                    >
                      {todosOsValores ? texto(v) : valorCurto(unidade, v)}
                    </Box>
                  )}
                  {foco === j && (
                    <DicaFlutuante
                      esquerda="50%"
                      topo={`${topo(Math.max(0, ...series.map((s) => s.valores[j])))}%`}
                      embaixo={topo(Math.max(0, ...series.map((s) => s.valores[j]))) < 35}
                    >
                      <ConteudoDaDica
                        titulo={rotulo}
                        unidade={unidade}
                        series={series}
                        valores={series.map((s) => s.valores[j])}
                        cores={cores}
                      />
                    </DicaFlutuante>
                  )}
                </Box>
              );
            })}
          </Flex>
        </Box>
        <Flex mt="8px" aria-hidden="true">
          {rotulos.map((rotulo, j) => {
            const [cima, baixo] = partesDoRotulo(rotulo);
            const vazio = series.every((s) => s.valores[j] === 0);
            return (
              <Box
                key={j}
                flex="1 1 0"
                minW={0}
                textAlign="center"
                fontSize={fonte}
                lineHeight="16px"
                whiteSpace="nowrap"
                color={vazio ? 'var(--pa-tinta-3)' : 'var(--pa-tinta-2)'}
              >
                {j % passo === 0 && (
                  <>
                    <div>{cima}</div>
                    {baixo && <Box color="var(--pa-tinta-3)">{baixo}</Box>}
                  </>
                )}
              </Box>
            );
          })}
        </Flex>
      </Box>
    </Flex>
  );
}

export interface RankingProps {
  unidade: Unidade;
  rotulos: string[];
  series: Serie[];
  cores: string[];
  // Com o total, cada linha mostra a participação nele.
  total?: number;
  // A versão do painel: letra e barra maiores.
  grande?: boolean;
}

export function Ranking({ unidade, rotulos, series, cores, total, grande }: RankingProps) {
  const maxAbs = Math.max(...series.flatMap((s) => s.valores.map(Math.abs))) || 1;
  const anterior = series.length === 2 && ehAnterior(series[1], 1) ? series[1].valores : null;
  const complemento = !!anterior || !!total;
  return (
    <Box
      as="ol"
      listStyleType="none"
      m={0}
      p={0}
      display="flex"
      flexDirection="column"
      sx={{ gap: grande ? '20px' : '12px' }}
    >
      {rotulos.map((rotulo, j) => {
        const v = series[0].valores[j];
        const ant = anterior ? anterior[j] : null;
        const delta = ant ? (v / ant - 1) * 100 : null;
        return (
          <Box
            as="li"
            key={j}
            display="grid"
            gridTemplateColumns={complemento ? 'minmax(0, 1fr) auto 52px' : 'minmax(0, 1fr) auto'}
            columnGap={grande ? '16px' : '10px'}
            rowGap={grande ? '8px' : '5px'}
            alignItems="center"
            fontSize={grande ? '15px' : '13px'}
          >
            <Box
              fontWeight={600}
              whiteSpace="nowrap"
              overflow="hidden"
              textOverflow="ellipsis"
              title={rotulo}
            >
              {rotulo}
            </Box>
            <Box
              fontWeight={700}
              whiteSpace="nowrap"
              textAlign="right"
              title={series
                .map((s) => `${s.nome}: ${valorExato(unidade, s.valores[j])}`)
                .join('\n')}
            >
              {grande && unidade === 'reais' ? reaisInteiros(v) : valorCurto(unidade, v)}
            </Box>
            {complemento && (
              <Box textAlign="right" whiteSpace="nowrap">
                {delta !== null ? (
                  <Box
                    as="span"
                    px="6px"
                    py="1px"
                    borderRadius="6px"
                    fontSize="12px"
                    fontWeight={600}
                    color={delta >= 0 ? 'var(--pa-sobe)' : 'var(--pa-desce)'}
                    bg={delta >= 0 ? 'var(--pa-sobe-fundo)' : 'var(--pa-desce-fundo)'}
                  >
                    {variacao(delta)}
                  </Box>
                ) : (
                  <Box as="span" color="var(--pa-tinta-3)" fontWeight={500}>
                    {percentual((v / total!) * 100, 0)}
                  </Box>
                )}
              </Box>
            )}
            <Box gridColumn="1 / -1" display="flex" flexDirection="column" sx={{ gap: '3px' }}>
              {series.map((s, i) => (
                <Box
                  key={i}
                  h={i ? (grande ? '5px' : '4px') : grande ? '14px' : '7px'}
                  borderRadius="999px"
                  bg="var(--pa-grade)"
                >
                  <Box
                    h="100%"
                    minW="2px"
                    borderRadius="999px"
                    bg={s.valores[j] < 0 ? 'var(--pa-desce)' : corDaSerie(s.nome, i, cores)}
                    w={`${(Math.abs(s.valores[j]) / maxAbs) * 100}%`}
                  />
                </Box>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const DIA_CURTO: Record<string, string> = {
  segunda: 'seg',
  terça: 'ter',
  quarta: 'qua',
  quinta: 'qui',
  sexta: 'sex',
  sábado: 'sáb',
  domingo: 'dom',
};

// Mapa de calor: uma cor só, mais forte onde há mais. O número fica só no
// pico, que se destaca; os outros aparecem ao passar o mouse.
// Cada série é uma linha (o dia), cada rótulo uma coluna (a hora).
export function Calor({
  rotulos,
  series,
  unidade,
  compacto,
  escalaDe = 'Menos',
  escalaAte = 'Mais',
}: {
  rotulos: string[];
  series: Serie[];
  unidade: Unidade;
  compacto?: boolean;
  escalaDe?: string;
  escalaAte?: string;
}) {
  const { ehClaro } = useThemeMode();
  const rgb = ehClaro ? RGB_DO_DADO.claro : RGB_DO_DADO.escuro;
  const max = Math.max(...series.flatMap((s) => s.valores)) || 1;
  const forca = (v: number) => 0.1 + (0.8 * v) / max;
  const grade = `${compacto ? 34 : 72}px repeat(${rotulos.length}, minmax(${compacto ? 20 : 26}px, 1fr))`;
  const fonte = compacto ? '11px' : '13px';
  const nomeDoDia = (nome: string) =>
    compacto ? DIA_CURTO[nome] || nome : nome.charAt(0).toUpperCase() + nome.slice(1);
  let jaDestacou = false;
  return (
    <Box>
      <Box overflowX="auto">
        <Flex direction="column" sx={{ gap: '2px' }}>
          <Box display="grid" gridTemplateColumns={grade} sx={{ gap: '2px' }} mb="4px" aria-hidden="true">
            <span />
            {rotulos.map((r) => (
              <Box key={r} textAlign="center" fontSize={compacto ? '11px' : '12px'} color="var(--pa-tinta-3)">
                {r}
              </Box>
            ))}
          </Box>
          {series.map((s) => (
            <Box key={s.nome} display="grid" gridTemplateColumns={grade} sx={{ gap: '2px' }}>
              <Box alignSelf="center" fontSize={fonte} color="var(--pa-tinta-2)" whiteSpace="nowrap">
                {nomeDoDia(s.nome)}
              </Box>
              {s.valores.map((v, j) => {
                const ehPico = v === max && v > 0 && !jaDestacou;
                if (ehPico) jaDestacou = true;
                return (
                  <Box
                    key={j}
                    h={compacto ? '24px' : '32px'}
                    borderRadius="3px"
                    display="grid"
                    placeItems="center"
                    fontSize={compacto ? '11px' : '13px'}
                    fontWeight={700}
                    bg={ehPico ? 'var(--pa-pico)' : v ? `rgba(${rgb},${forca(v).toFixed(2)})` : 'var(--pa-grade)'}
                    color={ehPico ? 'var(--pa-pico-tinta)' : undefined}
                    title={`${s.nome}, ${rotulos[j]}: ${valorExato(unidade, v)}`}
                  >
                    {ehPico ? valorCurto(unidade, v) : ''}
                  </Box>
                );
              })}
            </Box>
          ))}
        </Flex>
      </Box>
      <Flex align="center" sx={{ gap: '10px' }} mt="14px" fontSize="12px" color="var(--pa-tinta-3)" aria-hidden="true">
        {escalaDe}
        <Flex sx={{ gap: '2px' }}>
          {[0.15, 0.35, 0.55, 0.75, 0.9].map((a) => (
            <Box key={a} as="i" display="block" w="22px" h="14px" borderRadius="2px" bg={`rgba(${rgb},${a})`} />
          ))}
          <Box as="i" display="block" w="22px" h="14px" borderRadius="2px" bg="var(--pa-pico)" />
        </Flex>
        {escalaAte}
      </Flex>
    </Box>
  );
}

// Rosca: cada fatia é um traço do círculo de perímetro 100, a partir do meio-dia.
export function Rosca({
  rotulos,
  valores,
  unidade,
  cores,
}: {
  rotulos: string[];
  valores: number[];
  unidade: Unidade;
  cores: string[];
}) {
  const total = valores.reduce((a, b) => a + b, 0) || 1;
  let acumulado = 0;
  return (
    <Flex wrap="wrap" align="center" sx={{ gap: '16px' }}>
      <Box position="relative" w="120px" h="120px" flexShrink={0}>
        <svg
          viewBox="0 0 42 42"
          style={{ width: 120, height: 120, transform: 'rotate(-90deg)' }}
          aria-hidden="true"
        >
          <circle r={15.915} cx={21} cy={21} fill="none" stroke="var(--pa-grade)" strokeWidth={5} />
          {valores.map((v, i) => {
            const p = (v / total) * 100;
            const traco = Math.max(p - 0.8, 0.4);
            const inicio = acumulado;
            acumulado += p;
            return (
              <circle
                key={i}
                r={15.915}
                cx={21}
                cy={21}
                fill="none"
                stroke={cores[i % cores.length]}
                strokeWidth={5}
                strokeDasharray={`${traco} ${100 - traco}`}
                strokeDashoffset={-inicio}
              >
                <title>{`${rotulos[i]}: ${valorExato(unidade, v)}`}</title>
              </circle>
            );
          })}
        </svg>
        {unidade !== 'percentual' && (
          <Box
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            display="grid"
            placeItems="center"
            textAlign="center"
            pointerEvents="none"
          >
            <div>
              <Box fontSize="15px" fontWeight={700} lineHeight="18px">
                {valorCurto(unidade, total)}
              </Box>
              <Box fontSize="11px" color="var(--pa-tinta-3)">
                total
              </Box>
            </div>
          </Box>
        )}
      </Box>
      <Box
        as="ul"
        listStyleType="none"
        m={0}
        p={0}
        flex="1"
        minW="170px"
        display="flex"
        flexDirection="column"
        sx={{ gap: '6px' }}
      >
        {valores.map((v, i) => (
          <Flex as="li" key={i} align="center" sx={{ gap: '8px' }}>
            <Marca cor={cores[i % cores.length]} redonda />
            <Box whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis" title={rotulos[i]}>
              {rotulos[i]}
            </Box>
            <Box ml="auto" fontWeight={600} whiteSpace="nowrap" title={valorExato(unidade, v)}>
              {valorCurto(unidade, v)}
            </Box>
            <Box minW="44px" textAlign="right" color="var(--pa-tinta-3)" whiteSpace="nowrap">
              {percentual((v / total) * 100)}
            </Box>
          </Flex>
        ))}
      </Box>
    </Flex>
  );
}

// O conteúdo de um gráfico, sem moldura: o painel põe no cartão dele.
export function CorpoDoGrafico({ g, compacto }: { g: DadosGrafico; compacto?: boolean }) {
  const { ehClaro } = useThemeMode();
  const cores = ehClaro ? CORES_CLARO : CORES_ESCURO;
  if (g.tipo === 'pizza')
    return (
      <Rosca rotulos={g.rotulos} valores={g.series[0].valores} unidade={g.unidade} cores={cores} />
    );
  if (g.tipo === 'mapa_de_calor')
    return <Calor rotulos={g.rotulos} series={g.series} unidade={g.unidade} compacto={compacto} />;
  if (g.tipo === 'linha')
    return (
      <Area
        unidade={g.unidade}
        rotulos={g.rotulos}
        series={g.series}
        cores={cores}
        altura={compacto ? 150 : 240}
        compacto={compacto}
      />
    );
  if (g.rotulos.every((r) => TEMPO.test(r.trim())) && g.rotulos.length <= 31)
    return (
      <Colunas
        unidade={g.unidade}
        rotulos={g.rotulos}
        series={g.series}
        cores={cores}
        altura={compacto ? 150 : 220}
        compacto={compacto}
      />
    );
  return <Ranking unidade={g.unidade} rotulos={g.rotulos} series={g.series} cores={cores} />;
}
