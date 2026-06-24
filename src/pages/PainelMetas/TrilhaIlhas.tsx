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
function brlK(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}
// geometria
const NODE = 92;       // diâmetro do nó normal
const NODE_CUR = 128;  // diâmetro do nó do mês atual
const PANEL_D = NODE_CUR;   // tela circular (TV redonda) do mês em foco
const ROW_H = 208;     // distância vertical entre linhas
const TOP = 106;       // espaço acima da 1ª linha (cabe o nome do mês sem cortar)
const PAD_X = 120;     // margem lateral (cabe a curva em U)
const RC = 48;         // raio das curvas em U
const MAX_GAP = 440;   // trecho de linha entre casas (mais espaço p/ os peões)

// ── Nó metálico (dial) ─────────────────────────────────────────────────────
// Quando o mês tem meta cadastrada (temMeta), mostra a % no miolo do nó — igual
// ao mês atual — em vez do botão metálico; a cor segue corPct (verde ≥100%).
const NoMetal: React.FC<{
  cx: number; cy: number; d: number; passado?: boolean; temMeta?: boolean; pct?: number;
}> = ({ cx, cy, d, passado, temMeta, pct = 0 }) => (
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
      {temMeta ? (
        <span style={{ color: corPct(pct), fontWeight: 900, fontSize: d * 0.19, lineHeight: 1, textShadow: '0 1px 3px rgba(0,0,0,0.85)' }}>
          {Math.round(pct)}%
        </span>
      ) : (
        <div style={{ width: d * 0.17, height: d * 0.17, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #cdd4e0, #717a88)', boxShadow: '0 1px 2px rgba(0,0,0,0.7)' }} />
      )}
    </div>
  </div>
);

// ── Nó do mês atual (estilo metálico/glow original) — display que alterna ────
const NoAtual: React.FC<{
  cx: number; cy: number; pct: number; meta: number; realizado: number;
}> = ({ cx, cy, pct, meta, realizado }) => {
  // Bateu a meta → glow verde; senão, laranja (no caminho).
  const bateu = pct >= 100;
  const cor = bateu ? VERDE : LARANJA;
  const g = bateu ? 'rgba(72,187,120,' : 'rgba(254,128,38,';
  const d = PANEL_D;
  // Arco de progresso (igual gauge "Performance Geral"): enche conforme o
  // realizado chega na meta; verde completo ao bater 100%.
  const rr = d * 0.41;                         // raio do arco interno
  const C = 2 * Math.PI * rr;                  // circunferência
  const frac = Math.min(Math.max(pct, 0), 100) / 100;
  // Arco com gradiente igual ao gauge "Performance Geral": cor-base → teal (#4fd1c5).
  const baseCor = pct >= 100 ? '#68d391' : pct >= 70 ? '#f6ad55' : '#fe8026';
  const arcCor = '#4fd1c5'; // cor de brilho/runner (fim do gradiente)
  const gradId = `arcGrad-${Math.round(cx)}-${Math.round(cy)}`;
  // Mensagens que se revezam dentro do nó, uma por vez, como uma tela de TV.
  const linhas = [
    { label: '', valor: `${Math.round(pct)}%`, cor, big: true },
    { label: 'META', valor: brlK(meta), cor: LARANJA, big: false },
    { label: 'REAL', valor: brlK(realizado), cor: '#e7e9f0', big: false },
  ];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % linhas.length), 2600);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas.length]);
  const linha = linhas[i];
  return (
    <div
      style={{
        position: 'absolute', left: cx - d / 2, top: cy - d / 2, width: d, height: d, borderRadius: '50%',
        background: 'radial-gradient(circle at 42% 34%, #2c313c, #15181f 76%)',
        boxShadow: '0 0 0 4px rgba(254,128,38,0.95), 0 0 26px 4px rgba(254,128,38,0.6), inset 0 3px 5px rgba(255,255,255,0.15), 0 26px 36px rgba(0,0,0,0.7)',
        border: '1px solid #12151c', zIndex: 9,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <style>{`@keyframes tvFade{0%{opacity:0;transform:translateY(5px)}18%{opacity:1;transform:none}82%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-5px)}}@keyframes arcSpin{to{transform:rotate(360deg)}}`}</style>
      {/* arco de progresso + segmento que circula */}
      <svg width={d} height={d} viewBox={`0 0 ${d} ${d}`} style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            {/* bateu a meta → arco todo verde; senão, gradiente teal → cor-base */}
            <stop offset="0" stopColor={bateu ? baseCor : '#4fd1c5'} />
            <stop offset="1" stopColor={baseCor} />
          </linearGradient>
        </defs>
        {/* trilho */}
        <circle cx={d / 2} cy={d / 2} r={rr} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={6} />
        {/* progresso (enche conforme a meta) com gradiente */}
        <circle
          cx={d / 2} cy={d / 2} r={rr} fill="none" stroke={`url(#${gradId})`} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
          style={{ filter: `drop-shadow(0 0 5px ${baseCor})`, transition: 'stroke-dashoffset .8s ease' }}
        />
        {/* runner brilhante que circula — para quando bate a meta */}
        {!bateu && (
          <circle
            cx={d / 2} cy={d / 2} r={rr} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round"
            strokeDasharray={`${C * 0.07} ${C}`}
            style={{ transformOrigin: `${d / 2}px ${d / 2}px`, animation: 'arcSpin 2.4s linear infinite', filter: `drop-shadow(0 0 6px ${arcCor})`, opacity: 0.9 }}
          />
        )}
      </svg>
      <div
        key={i}
        style={{ textAlign: 'center', animation: 'tvFade 2.6s ease-in-out infinite', lineHeight: 1.2 }}
      >
        {linha.label && (
          <div style={{ color: '#8a93a4', fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5 }}>{linha.label}</div>
        )}
        <div
          style={{
            color: linha.cor, fontWeight: 900,
            fontSize: linha.big ? 30 : 15,
            textShadow: linha.big ? `0 0 10px ${g}0.8)` : 'none',
          }}
        >
          {linha.valor}
        </div>
      </div>
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
  const [hover, setHover] = useState<{ v: VendedorProgresso; x: number; y: number } | null>(null);
  const brl = (n: number) =>
    `R$ ${Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

  // Corrida do mês atual: o peão corre na linha que leva ATÉ a casa do mês atual.
  // frac = % da meta do mês (0..1). frac=0 → casa do mês anterior; frac=1 → chega
  // na casa do mês atual. (v.casas carrega essa fração, vinda do index.)
  const curNode = Math.min(Math.max(mesSel - 1, 0), 11);
  const nodeR = (k: number) => (k === curNode ? NODE_CUR / 2 : NODE / 2);
  const peaoPos = (frac: number) => {
    // O peão corre no trecho de linha entre a casa anterior e a do mês atual,
    // SEMPRE entre as bordas das casas (nunca em cima de um nó).
    const p = Math.min(Math.max(frac, 0), 1);
    const i1 = curNode;
    const i0 = Math.max(curNode - 1, 0);
    const a = pos(i0);
    const b = pos(i1);
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const ax = a.cx + ux * (nodeR(i0) + 34); // sai da borda da casa anterior
    const ay = a.cy + uy * (nodeR(i0) + 34);
    const bx = b.cx - ux * (nodeR(i1) + 34); // para antes da casa do mês atual
    const by = b.cy - uy * (nodeR(i1) + 34);
    // ux/uy = direção da linha (p/ enfileirar os peões um atrás do outro)
    return { x: ax + (bx - ax) * p, y: ay + (by - ay) * p, ux, uy };
  };
  // Só rotula "sem meta" depois que houver dados (evita piscar no carregamento).
  const temAlgumaMeta = meses.some((m) => (m.meta || 0) > 0);
  // Agrupa vendedores com % parecido (passos de 5%) p/ não sobrepor.
  const buckets: Record<string, VendedorProgresso[]> = {};
  vendedores.forEach((v) => {
    const key = (Math.round(Math.min(Math.max(v.casas, 0), 1) * 20) / 20).toFixed(2);
    (buckets[key] = buckets[key] || []).push(v);
  });

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative', width: '100%', height: H, borderRadius: 16,
          background: 'radial-gradient(circle at 50% 0%, #1b2030 0%, #0e1118 60%, #0b0d13 100%)',
          border: '1px solid #20242f', overflow: 'hidden',
        }}
      >
        <style>{`@keyframes fluxoTrilha{to{stroke-dashoffset:-100}}`}</style>
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
              {/* uma única luz branca correndo a trilha até o mês atual */}
              <path
                d={dProg} fill="none" stroke="#ffffff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
                pathLength={100} strokeDasharray="12 88" opacity={0.95}
                style={{ animation: 'fluxoTrilha 2.6s linear infinite', filter: 'drop-shadow(0 0 6px #fff)' }}
              />
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
          return (
            <React.Fragment key={m}>
              <div style={{ position: 'absolute', top: cy - r / 2 - 30, left: cx - 90, width: 180, textAlign: 'center', zIndex: 10 }}>
                <span style={{ color: atual ? LARANJA : '#e7e9f0', fontWeight: 800, fontSize: 14, letterSpacing: 1, textShadow: atual ? '0 0 8px rgba(254,128,38,0.6)' : 'none' }}>
                  {NOMES[m - 1]}
                </span>
              </div>

              {atual ? (
                <NoAtual cx={cx} cy={cy} pct={pct} meta={info?.meta || 0} realizado={info?.realizado || 0} />
              ) : (
                <NoMetal cx={cx} cy={cy} d={r} passado={passado} temMeta={temMeta} pct={pct} />
              )}

              {temAlgumaMeta && !temMeta && !atual && (
                <div style={{ position: 'absolute', top: cy + r / 2 + 8, left: cx - 90, width: 180, textAlign: 'center', zIndex: 10, lineHeight: 1.3 }}>
                  <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 600 }}>sem meta</div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* peões: na linha da trilha, um atrás do outro (líder mais à frente) */}
        {Object.entries(buckets).map(([key, vs]) => {
          const { x, y, ux, uy } = peaoPos(Number(key));
          const fila = [...vs].sort((a, b) => b.casas - a.casas); // mais faturamento à frente
          return fila.map((v, idx) => {
            const off = ((fila.length - 1) / 2 - idx) * 26; // idx 0 = líder, à frente (+u)
            return (
            <div
              key={v.id}
              onMouseEnter={() => setHover({ v, x: x + ux * off, y: y + uy * off })}
              onMouseLeave={() => setHover((h) => (h?.v.id === v.id ? null : h))}
              style={{
                position: 'absolute',
                left: x + ux * off - 13,
                top: y + uy * off - 13,
                zIndex: 13,
                transition: 'left .6s ease, top .6s ease',
              }}
            >
              {/* coroa para quem bateu 100% da meta do mês */}
              {v.casas >= 0.999 && (
                <span
                  style={{
                    position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)',
                    fontSize: 16, lineHeight: 1, zIndex: 14, pointerEvents: 'none',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.7))',
                  }}
                  title="Bateu a meta!"
                >
                  👑
                </span>
              )}
              <AvatarBoneco
                cor={v.cor}
                nome={v.nome}
                size={26}
                title=" "
                onClick={onVendedorClick ? () => onVendedorClick(v.id) : undefined}
              />
            </div>
            );
          });
        })}

        {/* tooltip do peão: nome + quanto vendeu */}
        {hover && (
          <div
            style={{
              position: 'absolute', left: hover.x, top: hover.y - 24,
              transform: 'translate(-50%, -100%)', zIndex: 20, pointerEvents: 'none',
              background: 'rgba(13,16,22,0.97)', border: `1px solid ${hover.v.cor}`,
              borderRadius: 10, padding: '8px 12px', minWidth: 150,
              boxShadow: `0 8px 22px rgba(0,0,0,0.6), 0 0 10px ${hover.v.cor}55`,
            }}
          >
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>{hover.v.nome}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12 }}>
              <span style={{ color: '#9aa2b2' }}>Vendeu</span>
              <span style={{ color: '#e7e9f0', fontWeight: 700 }}>{brl(hover.v.realizado || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 12 }}>
              <span style={{ color: '#9aa2b2' }}>Meta</span>
              <span style={{ color: LARANJA, fontWeight: 700 }}>{brl(hover.v.meta || 0)}</span>
            </div>
            <div style={{ marginTop: 3, textAlign: 'right', fontSize: 11, fontWeight: 800, color: hover.v.casas >= 0.999 ? VERDE : LARANJA }}>
              {Math.round(Math.min(hover.v.casas, 1) * 100)}% da meta
            </div>
          </div>
        )}

        {/* aviso quando há dados mas ninguém tem meta no mês selecionado */}
        {temAlgumaMeta && vendedores.length === 0 && (
          <div
            style={{
              position: 'absolute', left: pos(curNode).cx - 110, top: pos(curNode).cy + NODE_CUR / 2 + 14,
              width: 220, textAlign: 'center', zIndex: 12,
              color: '#cdd3df', fontSize: 12, fontWeight: 600,
              background: 'rgba(20,24,33,0.92)', border: '1px solid #2a2f3a', borderRadius: 10, padding: '7px 12px',
            }}
          >
            Sem meta cadastrada em {NOMES[curNode].toLowerCase()} — nada para medir neste mês.
          </div>
        )}

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
