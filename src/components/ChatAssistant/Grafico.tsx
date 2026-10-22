import { Box as BoxBase, Flex as FlexBase } from '@chakra-ui/react';
import { Grafico as DadosGrafico } from '../../context/AssistenteContext';

// Cast Chakra components to bypass TS2590 ("union type too complex").
const Box = BoxBase as React.ComponentType<any>;
const Flex = FlexBase as React.ComponentType<any>;

// O gráfico que vem junto da resposta do assistente, no mesmo desenho do app
// e da tela de teste do MCP: barras horizontais com o valor em cada linha
// (cabem no balão estreito), linha e pizza em SVG. Sem biblioteca: o gráfico
// é pequeno e precisa caber tanto no balão quanto na página.
//
// As 8 cores categóricas, validadas para daltonismo sobre fundo escuro (o
// balão é gray.700). A cor segue a série, sempre na mesma ordem.
const CORES = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767',
];
const cor = (i: number) => CORES[i % CORES.length];
const TINTA_FRACA = 'var(--chakra-colors-gray-300)';
const LINHA_GRADE = 'var(--chakra-colors-gray-600)';

function formatar(unidade: DadosGrafico['unidade'], v: number): string {
  if (unidade === 'reais')
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (unidade === 'percentual')
    return (
      v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
    );
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function Marca({ i }: { i: number }) {
  return <Box as="i" w="10px" h="10px" borderRadius="3px" flexShrink={0} bg={cor(i)} />;
}

function Barras({ g }: { g: DadosGrafico }) {
  const max = Math.max(...g.series.flatMap((s) => s.valores.map(Math.abs))) || 1;
  return (
    <>
      {g.rotulos.map((rotulo, j) => (
        <Box key={j} my="6px">
          <Box>{rotulo}</Box>
          {g.series.map((s, i) => (
            <Flex key={i} align="center" sx={{ gap: '8px' }} mt="3px">
              <Box flex="1" h="10px">
                <Box
                  h="100%"
                  minW="2px"
                  borderRadius="0 4px 4px 0"
                  bg={cor(i)}
                  width={`${(Math.abs(s.valores[j]) / max) * 100}%`}
                />
              </Box>
              <Box color={TINTA_FRACA} whiteSpace="nowrap" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatar(g.unidade, s.valores[j])}
              </Box>
            </Flex>
          ))}
        </Box>
      ))}
    </>
  );
}

function Linha({ g }: { g: DadosGrafico }) {
  const W = 320, H = 150, T = 14, B = 18;
  const n = g.rotulos.length;
  const todos = g.series.flatMap((s) => s.valores);
  const lo = Math.min(0, ...todos), hi = Math.max(...todos), amp = hi - lo || 1;
  const x = (j: number) => (n === 1 ? W / 2 : 4 + (j * (W - 8)) / (n - 1));
  const y = (v: number) => T + ((hi - v) / amp) * (H - T - B);
  const eixo = Array.from(new Set([0, Math.floor((n - 1) / 2), n - 1]));
  const ancora = (j: number) =>
    n === 1 ? 'middle' : j === 0 ? 'start' : j === n - 1 ? 'end' : 'middle';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}>
      {Array.from(new Set([hi, lo])).map((v) => (
        <g key={v}>
          <line x1={0} x2={W} y1={y(v)} y2={y(v)} style={{ stroke: LINHA_GRADE }} />
          <text x={0} y={y(v) - 3} fontSize={10} style={{ fill: TINTA_FRACA }}>
            {formatar(g.unidade, v)}
          </text>
        </g>
      ))}
      {g.series.map((s, i) => (
        <g key={i}>
          <polyline
            fill="none"
            stroke={cor(i)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.valores.map((v, j) => `${x(j)},${y(v)}`).join(' ')}
          />
          {s.valores.map((v, j) => (
            <circle
              key={j}
              cx={x(j)}
              cy={y(v)}
              r={n > 20 ? 2.5 : 3.5}
              fill={cor(i)}
              style={{ stroke: 'var(--chakra-colors-gray-700)' }}
              strokeWidth={1.5}
            >
              <title>{`${g.rotulos[j]} · ${s.nome}: ${formatar(g.unidade, v)}`}</title>
            </circle>
          ))}
          {/* O último valor escrito ao lado do ponto: dá para ler sem passar o mouse. */}
          <text
            x={x(n - 1)}
            y={y(s.valores[n - 1]) - 7}
            fontSize={10}
            fontWeight={600}
            textAnchor="end"
            style={{ fill: 'var(--chakra-colors-gray-50)' }}
          >
            {formatar(g.unidade, s.valores[n - 1])}
          </text>
        </g>
      ))}
      {eixo.map((j) => (
        <text key={j} x={x(j)} y={H - 4} fontSize={10} textAnchor={ancora(j)} style={{ fill: TINTA_FRACA }}>
          {g.rotulos[j]}
        </text>
      ))}
    </svg>
  );
}

function Pizza({ g }: { g: DadosGrafico }) {
  // Rosca: cada fatia é um traço do círculo de perímetro 100, a partir do meio-dia.
  const valores = g.series[0].valores;
  const total = valores.reduce((a, b) => a + b, 0) || 1;
  const pct = (v: number) =>
    ((v / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  let acumulado = 0;
  return (
    <Flex wrap="wrap" align="center" sx={{ gap: '16px' }}>
      <svg viewBox="0 0 42 42" style={{ width: 140, flexShrink: 0 }}>
        {valores.map((v, i) => {
          const p = (v / total) * 100;
          const traco = Math.max(p - 0.8, 0);
          const inicio = acumulado;
          acumulado += p;
          return (
            <circle
              key={i}
              r={15.915}
              cx={21}
              cy={21}
              fill="none"
              stroke={cor(i)}
              strokeWidth={7}
              strokeDasharray={`${traco} ${100 - traco}`}
              strokeDashoffset={25 - inicio}
            >
              <title>{`${g.rotulos[i]}: ${formatar(g.unidade, v)}`}</title>
            </circle>
          );
        })}
      </svg>
      <Box as="ul" listStyleType="none" m={0} p={0} flex="1" minW="160px">
        {valores.map((v, i) => (
          <Flex as="li" key={i} align="center" sx={{ gap: '8px' }} my="4px">
            <Marca i={i} />
            {g.rotulos[i]}
            <Box ml="auto" color={TINTA_FRACA} whiteSpace="nowrap">
              {formatar(g.unidade, v)} · {pct(v)}%
            </Box>
          </Flex>
        ))}
      </Box>
    </Flex>
  );
}

export function Grafico({ g }: { g: DadosGrafico }) {
  return (
    <Box
      mt="10px"
      p="12px"
      border="1px solid"
      borderColor="gray.600"
      borderRadius="10px"
      fontSize="0.9em"
      role="figure"
      aria-label={g.titulo}
    >
      <Box fontWeight={700} mb="8px">
        {g.titulo}
      </Box>
      {g.series.length > 1 && g.tipo !== 'pizza' && (
        <Flex wrap="wrap" sx={{ gap: '4px 14px' }} mb="8px" color={TINTA_FRACA}>
          {g.series.map((s, i) => (
            <Flex key={i} align="center" sx={{ gap: '6px' }}>
              <Marca i={i} />
              {s.nome}
            </Flex>
          ))}
        </Flex>
      )}
      {g.tipo === 'pizza' ? <Pizza g={g} /> : g.tipo === 'linha' ? <Linha g={g} /> : <Barras g={g} />}
    </Box>
  );
}
