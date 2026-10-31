import { Box as BoxBase, Flex as FlexBase } from '@chakra-ui/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import Chart from 'react-apexcharts';
import { Grafico as DadosGrafico } from '../../context/AssistenteContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import {
  alturaDe,
  destaque,
  detalheDe,
  larguraDoCalor,
  opcoesDe,
  Ponto,
  Preparado,
  preparar,
  seriesDe,
} from './opcoesDoGrafico';
import {
  CORES_CLARO,
  CORES_ESCURO,
  percentual,
  RGB_DO_DADO,
  useLargura,
  valorCurto,
  valorExato,
  variaveisDoTema,
} from './visual';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;
const ApexChart = Chart as any;

// O gráfico que vem junto da resposta do assistente, abaixo do texto: no balão
// flutuante e na conversa da página. Desenhado com o ApexCharts, que dá a dica,
// a animação e a legenda que liga e desliga cada série; o clique abre o
// detalhe logo abaixo e apaga o resto. As regras ficam em opcoesDoGrafico.ts.

// Arrastar mais que isso é o zoom da linha, não um clique.
const MOVIMENTO_DE_ARRASTE_PX = 8;

const ehMovimentoReduzido = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const DICA: Record<Preparado['forma'], string> = {
  ranking: 'Clique em uma barra para ver os detalhes',
  colunas: 'Clique em uma coluna para ver os detalhes',
  area: 'Clique em um ponto para ver os detalhes',
  rosca: 'Clique em uma fatia para ver os detalhes',
  calor: 'Clique em um quadrado para ver os detalhes',
};

function Detalhe({
  preparado,
  ponto,
  ehClaro,
  aoFechar,
}: {
  preparado: Preparado;
  ponto: Ponto | null;
  ehClaro: boolean;
  aoFechar: () => void;
}) {
  if (!ponto)
    return (
      <Box mt="8px" fontSize="12px" color="var(--pa-tinta-3)">
        {DICA[preparado.forma]}
      </Box>
    );
  const d = detalheDe(preparado, ponto, ehClaro);
  return (
    <Box
      mt="8px"
      px="12px"
      py="10px"
      borderRadius="10px"
      bg="var(--pa-superficie-2)"
      border="1px solid var(--pa-figura-linha)"
      position="relative"
    >
      <Box
        as="button"
        type="button"
        onClick={aoFechar}
        aria-label="Fechar detalhes"
        position="absolute"
        top="4px"
        right="6px"
        w="26px"
        h="26px"
        fontSize="16px"
        lineHeight="26px"
        color="var(--pa-tinta-3)"
      >
        ×
      </Box>
      <Box fontWeight={600} pr="24px" overflowWrap="anywhere">
        {d.titulo}
      </Box>
      {d.valores.map((v) => (
        <Flex key={v.nome} align="center" wrap="wrap" sx={{ gap: '2px 7px' }} mt="2px">
          {v.nome && <Box as="i" display="block" w="10px" h="10px" borderRadius="3px" flexShrink={0} bg={v.cor} />}
          {v.nome && <span>{v.nome}:</span>}
          <Box as="b" fontSize={v.nome ? '13px' : '16px'}>
            {v.valor}
          </Box>
        </Flex>
      ))}
      {d.notas.length > 0 && (
        <Box mt="3px" fontSize="12px" color="var(--pa-tinta-2)">
          {d.notas.join(' · ')}
        </Box>
      )}
    </Box>
  );
}

// Qual ponto fica sob o cursor, pela posição dentro da área do gráfico.
function pontoDoClique(e: React.MouseEvent, grafico: any, { forma, rotulos, series }: Preparado): Ponto | null {
  const svg = grafico?.el?.querySelector('.apexcharts-svg');
  const g = grafico?.w?.globals;
  if (!svg || !g || (e.target as Element).closest?.('.apexcharts-legend, .apexcharts-toolbar')) return null;
  const caixa = svg.getBoundingClientRect();
  const x = (e.clientX - caixa.left - g.translateX) / g.gridWidth;
  const y = (e.clientY - caixa.top - g.translateY) / g.gridHeight;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;
  const n = rotulos.length;
  const dentro = (v: number, limite: number) => Math.min(Math.floor(v * limite), limite - 1);
  if (forma === 'ranking') return { serie: 0, indice: dentro(y, n) };
  if (forma === 'colunas') return { serie: 0, indice: dentro(x, n) };
  if (forma === 'calor') return { serie: dentro(y, series.length), indice: dentro(x, n) };
  // Na linha, o ponto mais perto; com zoom, só o trecho visível conta.
  return { serie: 0, indice: Math.round(g.minX + x * (g.maxX - g.minX)) - 1 };
}

// A lista ao lado da rosca: clicar no nome é o mesmo que clicar na fatia.
function ListaDaRosca({
  preparado,
  ponto,
  ehClaro,
  aoEscolher,
}: {
  preparado: Preparado;
  ponto: Ponto | null;
  ehClaro: boolean;
  aoEscolher: (indice: number) => void;
}) {
  const { rotulos, series, unidade } = preparado;
  const valores = series[0].valores;
  const cores = ehClaro ? CORES_CLARO : CORES_ESCURO;
  const total = valores.reduce((a, b) => a + b, 0) || 1;
  return (
    <Box as="ul" listStyleType="none" m={0} p={0} flex="1" minW="170px">
      {rotulos.map((r, i) => (
        <li key={i}>
          <Flex
            as="button"
            type="button"
            w="100%"
            align="center"
            textAlign="left"
            sx={{ gap: '8px' }}
            py="4px"
            px="4px"
            borderRadius="6px"
            bg={ponto?.indice === i ? 'var(--pa-superficie-2)' : undefined}
            opacity={ponto && ponto.indice !== i ? 0.55 : 1}
            aria-pressed={ponto?.indice === i}
            onClick={() => aoEscolher(i)}
          >
            <Box as="i" display="block" w="10px" h="10px" borderRadius="50%" flexShrink={0} bg={cores[i % cores.length]} />
            <Box whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis" title={r}>
              {r}
            </Box>
            <Box ml="auto" fontWeight={600} whiteSpace="nowrap">
              {valorCurto(unidade, valores[i])}
            </Box>
            <Box minW="44px" textAlign="right" color="var(--pa-tinta-3)" whiteSpace="nowrap">
              {percentual((valores[i] / total) * 100)}
            </Box>
          </Flex>
        </li>
      ))}
    </Box>
  );
}

// O desenho é só para quem enxerga: o leitor de tela lê esta tabela.
function TabelaOculta({ preparado }: { preparado: Preparado }) {
  const { rotulos, series, unidade } = preparado;
  return (
    <Box
      as="table"
      position="absolute"
      w="1px"
      h="1px"
      overflow="hidden"
      sx={{ clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)' }}
    >
      <tbody>
        {rotulos.map((r, j) => (
          <tr key={j}>
            <th scope="row">{r}</th>
            {series.map((s) => (
              <td key={s.nome}>
                {s.nome}: {valorExato(unidade, s.valores[j])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </Box>
  );
}

export function Grafico({ g }: { g: DadosGrafico }) {
  const { ehClaro } = useThemeMode();
  const preparado = useMemo(() => preparar(g), [g]);
  const [ref, largura] = useLargura<HTMLDivElement>();
  const [ponto, setPonto] = useState<Ponto | null>(null);
  const grafico = useRef<any>(null);
  const inicioDoArraste = useRef<{ x: number; y: number } | null>(null);
  // Só a faixa da largura entra nas opções: redimensionar não redesenha.
  const estreito = largura > 0 && largura < 420;
  const larguraBase = estreito ? 280 : 560;

  const alternar = useCallback((proximo: Ponto) => {
    setPonto((atual) =>
      atual?.indice === proximo.indice && atual.serie === proximo.serie ? null : proximo,
    );
  }, []);

  const opcoes = useMemo<Record<string, any>>(() => {
    const base = opcoesDe(preparado, ehClaro, larguraBase, ehMovimentoReduzido());
    const rosca = preparado.forma === 'rosca';
    return {
      ...base,
      chart: {
        ...base.chart,
        events: {
          mounted: (c: any) => {
            grafico.current = c;
          },
          // A fatia tem clique próprio; nas outras formas vale `aoClicar`.
          dataPointSelection: rosca
            ? (_: unknown, __: unknown, c: any) =>
                setPonto(c.selectedDataPoints?.[0]?.length ? { serie: 0, indice: c.dataPointIndex } : null)
            : undefined,
        },
      },
    };
  }, [preparado, ehClaro, larguraBase]);

  // O clique do navegador vale para o mouse e para o dedo, e não dispara ao
  // rolar a conversa; o do ApexCharts, no toque, não diz em que ponto foi.
  const aoClicar = (e: React.MouseEvent) => {
    const inicio = inicioDoArraste.current;
    if (inicio && Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) > MOVIMENTO_DE_ARRASTE_PX) return;
    const achado = pontoDoClique(e, grafico.current, preparado);
    if (achado) alternar(achado);
  };

  const rosca = preparado.forma === 'rosca';
  // Na rosca a fatia guarda o próprio estado: fecha por ela, senão fica aberta.
  const fechar = () => {
    if (rosca && ponto) grafico.current?.toggleDataPointSelection(ponto.indice);
    else setPonto(null);
  };

  const { series: _dados, ...semSeries } = opcoes;
  const altura = alturaDe(preparado);
  const calor = preparado.forma === 'calor';

  const desenho = largura > 0 && (
    <ApexChart
      // Trocar o tema ou a faixa de largura desenha de novo, do zero.
      key={`${ehClaro}-${larguraBase}`}
      type={opcoes.chart.type}
      height={altura}
      width={rosca ? 200 : '100%'}
      series={seriesDe(opcoes)}
      options={semSeries}
    />
  );

  return (
    <Box
      as="figure"
      role="figure"
      aria-label={g.titulo}
      m={0}
      mt="12px"
      p="14px"
      bg="var(--pa-figura)"
      border="1px solid var(--pa-figura-linha)"
      borderRadius="12px"
      color="var(--pa-tinta)"
      fontSize="13px"
      lineHeight="18px"
      style={variaveisDoTema(ehClaro)}
      sx={{ fontVariantNumeric: 'tabular-nums' }}
    >
      <Box fontWeight={600} mb="10px">
        {g.titulo}
      </Box>
      <Box ref={ref} sx={destaque(preparado.forma, ponto, preparado.series.length)}>
        <TabelaOculta preparado={preparado} />
        {rosca ? (
          <Flex wrap="wrap" align="center" justify="center" sx={{ gap: '12px' }}>
            <Box w="200px" h={`${altura}px`} flexShrink={0} aria-hidden="true">
              {desenho}
            </Box>
            <ListaDaRosca
              preparado={preparado}
              ponto={ponto}
              ehClaro={ehClaro}
              aoEscolher={(i) => grafico.current?.toggleDataPointSelection(i)}
            />
          </Flex>
        ) : (
          <Box
            aria-hidden="true"
            overflowX={calor ? 'auto' : undefined}
            onMouseDown={(e: React.MouseEvent) => {
              inicioDoArraste.current = { x: e.clientX, y: e.clientY };
            }}
            onClick={aoClicar}
            sx={{ '& .apexcharts-canvas': { cursor: 'pointer' } }}
          >
            <Box
              minW={calor ? `${larguraDoCalor(preparado.rotulos.length)}px` : undefined}
              h={`${altura}px`}
            >
              {desenho}
            </Box>
          </Box>
        )}
      </Box>
      {calor && <EscalaDoCalor ehClaro={ehClaro} />}
      <Detalhe preparado={preparado} ponto={ponto} ehClaro={ehClaro} aoFechar={fechar} />
    </Box>
  );
}

function EscalaDoCalor({ ehClaro }: { ehClaro: boolean }) {
  const rgb = ehClaro ? RGB_DO_DADO.claro : RGB_DO_DADO.escuro;
  return (
    <Flex align="center" sx={{ gap: '8px' }} mt="6px" fontSize="11px" color="var(--pa-tinta-3)" aria-hidden="true">
      Menos
      <Flex sx={{ gap: '2px' }}>
        {[0.2, 0.4, 0.6, 0.8].map((a) => (
          <Box key={a} as="i" display="block" w="18px" h="10px" borderRadius="2px" bg={`rgba(${rgb},${a})`} />
        ))}
        <Box as="i" display="block" w="18px" h="10px" borderRadius="2px" bg="var(--pa-pico)" />
      </Flex>
      Mais
    </Flex>
  );
}
