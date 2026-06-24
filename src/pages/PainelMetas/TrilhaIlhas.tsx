import React, { useEffect, useRef, useState } from 'react';
import { AvatarBoneco, VendedorProgresso } from './TabuleiroTrilha';

// Jornada das Metas — visual "HUD metálico": trilho contínuo de metal escovado com
// curvas em U, nós circulares (dial) e o mês atual num anel laranja brilhante.
// Tudo em CSS/SVG (sem Three.js). Mostra Meta, A faturar e % por mês + peões.

export type IlhaMes = { mes: number; meta: number; realizado: number; pct: number };

const NOMES = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];
const LARANJA = '#fe8026';
const VERDE = '#48bb78';

function corPct(pct: number) {
  if (pct >= 100) return VERDE; // bateu/passou a meta
  if (pct >= 60) return '#ed8936'; // no caminho
  return '#f56565'; // longe
}
// geometria
const NODE = 92;       // diâmetro do nó normal
const NODE_CUR = 128;  // diâmetro do nó do mês atual
const ROW_H = 208;     // distância vertical entre linhas
const TOP = 106;       // espaço acima da 1ª linha (cabe o nome do mês sem cortar)
const PAD_X = 120;     // margem lateral (cabe a curva em U)
const RC = 48;         // raio das curvas em U
const MAX_GAP = 340;

// ── Nó metálico (dial) ─────────────────────────────────────────────────────
const NoMetal: React.FC<{ cx: number; cy: number; d: number; passado?: boolean }> = ({ cx, cy, d, passado }) => (
  <div
    style={{
      position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%',
      background: 'conic-gradient(from 215deg, #2c313c, #555d6c, #2b303b, #565e6d, #2a2f39, #4b5160, #2c313c)',
      boxShadow: passado
        ? 'inset 0 3px 4px rgba(255,255,255,0.18), inset 0 -6px 10px rgba(0,0,0,0.6), 0 18px 28px rgba(0,0,0,0.75), 0 0 0 3px rgba(254,128,38,0.55)'
        : 'inset 0 3px 4px rgba(255,255,255,0.18), inset 0 -6px 10px rgba(0,0,0,0.65), 0 18px 28px rgba(0,0,0,0.75)',
      border: '1px solid #12151c', zIndex: 5,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}
  >
    <div
      style={{
        width: d * 0.66, height: d * 0.66, borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 32%, #3c424f 0%, #1a1e26 74%)',
        boxShadow: 'inset 0 2px 3px rgba(255,255,255,0.16), inset 0 -4px 6px rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{ width: d * 0.17, height: d * 0.17, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #cdd4e0, #717a88)', boxShadow: '0 1px 2px rgba(0,0,0,0.7)' }} />
    </div>
  </div>
);

// ── Nó do mês atual (anel laranja brilhante) ───────────────────────────────
const NoAtual: React.FC<{ cx: number; cy: number; pct: number }> = ({ cx, cy, pct }) => {
  const d = NODE_CUR;
  // Bateu a meta no mês atual → anel interno + número verdes; o anel externo
  // (raio maior) continua laranja, igual aos demais meses.
  const bateu = pct >= 100;
  const cor = bateu ? VERDE : LARANJA;
  const glowCor = bateu ? 'rgba(72,187,120,' : 'rgba(254,128,38,';
  return (
    <div
      style={{
        position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%',
        background: 'radial-gradient(circle at 42% 34%, #2c313c, #15181f 76%)',
        boxShadow: '0 0 0 4px rgba(254,128,38,0.95), 0 0 26px 4px rgba(254,128,38,0.6), inset 0 3px 5px rgba(255,255,255,0.15), 0 26px 36px rgba(0,0,0,0.7)',
        border: '1px solid #12151c', zIndex: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute', width: d * 0.82, height: d * 0.82, borderRadius: '50%',
          border: `6px solid ${cor}`,
          boxShadow: `0 0 12px ${cor}, inset 0 0 10px ${glowCor}0.7)`,
        }}
      />
      <span style={{ color: cor, fontWeight: 900, fontSize: 26, textShadow: `0 0 10px ${glowCor}0.8)` }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
};

// ── Trilha ─────────────────────────────────────────────────────────────────
export const TrilhaIlhas: React.FC<{
  meses: IlhaMes[];
  vendedores: VendedorProgresso[];
  mesSel: number;
  onVendedorClick?: (id: string) => void;
}> = ({ meses, vendedores, mesSel, onVendedorClick }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(1040);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setW(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cols = W >= 1040 ? 4 : W >= 760 ? 3 : 2;
  const rows = Math.ceil(12 / cols);
  const gap = cols > 1 ? Math.min((W - 2 * PAD_X) / (cols - 1), MAX_GAP) : 0;
  const rowW = (cols - 1) * gap;
  const startX = (W - rowW) / 2;

  const rowOf = (k: number) => Math.floor(k / cols);
  const pos = (k: number) => {
    const r = rowOf(k);
    const inRow = k % cols;
    const c = r % 2 === 0 ? inRow : cols - 1 - inRow;
    return { cx: startX + c * gap, cy: TOP + r * ROW_H };
  };

  const buildPath = (upto: number) => {
    if (upto < 0) return '';
    const p0 = pos(0);
    let d = `M ${p0.cx} ${p0.cy}`;
    for (let i = 1; i <= upto; i++) {
      const a = pos(i - 1);
      const b = pos(i);
      if (rowOf(i - 1) === rowOf(i)) {
        d += ` L ${b.cx} ${b.cy}`;
      } else {
        const right = rowOf(i - 1) % 2 === 0;
        const sweep = right ? 1 : 0;
        const dir = right ? 1 : -1;
        d += ` A ${RC} ${RC} 0 0 ${sweep} ${a.cx + dir * RC} ${a.cy + RC}`;
        d += ` L ${a.cx + dir * RC} ${b.cy - RC}`;
        d += ` A ${RC} ${RC} 0 0 ${sweep} ${b.cx} ${b.cy}`;
      }
    }
    return d;
  };

  const curIdx = Math.min(Math.max(mesSel - 1, 0), 11);
  const dFull = buildPath(11);
  const dProg = buildPath(curIdx);

  const H = TOP + (rows - 1) * ROW_H + NODE_CUR / 2 + 56 + 64;
  const mesInfo = (m: number) => meses.find((x) => x.mes === m);

  const porMes: Record<number, VendedorProgresso[]> = {};
  vendedores.forEach((v) => {
    const m = Math.min(Math.max(Math.round(v.casas), 1), 12);
    (porMes[m] = porMes[m] || []).push(v);
  });
  const peoes = (m: number) =>
    (porMes[m] || []).map((v) => (
      <AvatarBoneco key={v.id} cor={v.cor} nome={v.nome} size={26} title={`${v.nome} — ${v.casas}/12 metas`} onClick={onVendedorClick ? () => onVendedorClick(v.id) : undefined} />
    ));

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative', width: '100%', height: H, borderRadius: 16,
          background: 'radial-gradient(circle at 50% 0%, #1b2030 0%, #0e1118 60%, #0b0d13 100%)',
          border: '1px solid #20242f', overflow: 'hidden',
        }}
      >
        {/* trilho */}
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0, zIndex: 1 }}>
          <defs>
            <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#737c8c" />
              <stop offset="0.4" stopColor="#3c4250" />
              <stop offset="0.7" stopColor="#262b34" />
              <stop offset="1" stopColor="#10131a" />
            </linearGradient>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          <path d={dFull} fill="none" stroke="#05070b" strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
          <path d={dFull} fill="none" stroke="url(#metal)" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
          <path d={dFull} fill="none" stroke="#9aa2b2" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} transform="translate(0,-7)" />

          {curIdx >= 1 && (
            <>
              <path d={dProg} fill="none" stroke={LARANJA} strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" opacity={0.55} filter="url(#glow)" />
              <path d={dProg} fill="none" stroke="#ff9a3d" strokeWidth={13} strokeLinecap="round" strokeLinejoin="round" />
              <path d={dProg} fill="none" stroke="#ffe0b8" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.85} />
            </>
          )}
        </svg>

        {/* nós + textos */}
        {Array.from({ length: 12 }, (_, k) => {
          const m = k + 1;
          const { cx, cy } = pos(k);
          const info = mesInfo(m);
          const pct = info?.pct || 0;
          const temMeta = (info?.meta || 0) > 0;
          const atual = m === mesSel;
          const passado = k < curIdx;
          const r = atual ? NODE_CUR : NODE;
          const ps = peoes(m);
          return (
            <React.Fragment key={m}>
              <div style={{ position: 'absolute', top: cy - r / 2 - 30, left: cx - 90, width: 180, textAlign: 'center', zIndex: 10 }}>
                <span style={{ color: atual ? LARANJA : '#e7e9f0', fontWeight: 800, fontSize: 14, letterSpacing: 1, textShadow: atual ? '0 0 8px rgba(254,128,38,0.6)' : 'none' }}>
                  {NOMES[m - 1]}
                </span>
              </div>

              {atual ? <NoAtual cx={cx} cy={cy} pct={pct} /> : <NoMetal cx={cx} cy={cy} d={r} passado={passado} />}

              {temMeta && !atual && (
                <div style={{ position: 'absolute', left: cx + r / 2 - 18, top: cy - r / 2 - 6, background: pct >= 100 ? VERDE : corPct(pct), color: '#fff', fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.6)', zIndex: 11 }}>
                  {Math.round(pct)}%
                </div>
              )}

              {ps.length > 0 && (
                <div style={{ position: 'absolute', left: cx - 84, top: cy + r / 2 + 6, width: 168, display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', zIndex: 11 }}>
                  {ps}
                </div>
              )}

              {!temMeta && (
                <div style={{ position: 'absolute', top: cy + r / 2 + (ps.length > 0 ? 40 : 8), left: cx - 90, width: 180, textAlign: 'center', zIndex: 10, lineHeight: 1.3 }}>
                  <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>sem meta</div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* legenda */}
        <div style={{ position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 26, background: 'rgba(20,24,33,0.9)', border: '1px solid #2a2f3a', borderRadius: 12, padding: '8px 22px', zIndex: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cdd3df', fontSize: 12 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: `3px solid ${LARANJA}`, boxShadow: `0 0 8px ${LARANJA}` }} /> Mês atual
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cdd3df', fontSize: 12 }}>
            <span style={{ width: 26, height: 6, borderRadius: 4, background: LARANJA, boxShadow: `0 0 8px ${LARANJA}` }} /> Progresso
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cdd3df', fontSize: 12 }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'radial-gradient(circle at 40% 32%, #4b5160, #1a1e26)', border: '1px solid #12151c' }} /> Não iniciado
          </span>
        </div>
      </div>
    </div>
  );
};
