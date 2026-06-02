import React, { useEffect, useRef } from 'react';

export type VendedorProgresso = {
  id: string;
  nome: string;
  casas: number; // 0..12 (quantas metas mensais ja bateu)
  cor: string;
};

type Ponto = { x: number; z: number };
type Casa = Ponto & { i: number; mes: string; side: 'left' | 'right' };
type Projetado = { x: number; y: number; s: number; t: number };

const INICIO: Ponto = { x: -3.15, z: 6.2 };

const CASAS: Casa[] = [
  { i: 1, mes: 'JAN', x: -2.15, z: 5.28, side: 'right' },
  { i: 2, mes: 'FEV', x: -0.78, z: 4.48, side: 'left' },
  { i: 3, mes: 'MAR', x: 1.12, z: 3.78, side: 'right' },
  { i: 4, mes: 'ABR', x: 2.3, z: 2.46, side: 'left' },
  { i: 5, mes: 'MAI', x: 0.38, z: 1.38, side: 'right' },
  { i: 6, mes: 'JUN', x: -1.55, z: 0.24, side: 'left' },
  { i: 7, mes: 'JUL', x: -0.42, z: -1.18, side: 'right' },
  { i: 8, mes: 'AGO', x: 1.82, z: -2.18, side: 'right' },
  { i: 9, mes: 'SET', x: 3.05, z: -3.6, side: 'left' },
  { i: 10, mes: 'OUT', x: 0.78, z: -4.72, side: 'right' },
  { i: 11, mes: 'NOV', x: -1.3, z: -5.92, side: 'left' },
  { i: 12, mes: 'DEZ', x: 0.42, z: -7.35, side: 'right' },
];

const CAMINHO: Ponto[] = [INICIO, ...CASAS, { x: 1.55, z: -8.55 }];

const CORES = {
  fundo: '#1f2029',
  sombra: '#10131b',
  texto: '#eeeef2',
  textoSuave: '#d1d2dc',
  laranja: '#fe8026',
  laranjaClaro: '#ffb066',
  laranjaEscuro: '#9c3d0f',
  marrom: '#69300f',
  poste: '#f0f2f6',
};

function iniciais(nome: string) {
  const p = String(nome || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function catmull(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: number): Ponto {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
  };
}

function amostrarCaminho() {
  const pontos: Ponto[] = [];
  for (let i = 0; i < CAMINHO.length - 1; i++) {
    const p0 = CAMINHO[Math.max(0, i - 1)];
    const p1 = CAMINHO[i];
    const p2 = CAMINHO[i + 1];
    const p3 = CAMINHO[Math.min(CAMINHO.length - 1, i + 2)];
    for (let j = 0; j < 14; j++) pontos.push(catmull(p0, p1, p2, p3, j / 14));
  }
  pontos.push(CAMINHO[CAMINHO.length - 1]);
  return pontos;
}

function projetar(p: Ponto, w: number, h: number, y = 0): Projetado {
  const t = clamp((p.z + 8.7) / 15.2, 0, 1);
  const curvaProfundidade = Math.pow(t, 0.86);
  const s = 0.36 + curvaProfundidade * 1.18;
  const centroX = w * 0.56 + (curvaProfundidade - 0.5) * -170;
  const x = centroX + p.x * (46 + curvaProfundidade * 74);
  const telaY = h * 0.11 + curvaProfundidade * h * 0.82 - y * (72 + curvaProfundidade * 28);
  return { x, y: telaY, s, t: curvaProfundidade };
}

function faixaProjetada(ctx: CanvasRenderingContext2D, pts: Ponto[], w: number, h: number, largura: number, cor: string, dy = 0, alpha = 1) {
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];

  pts.forEach((p, i) => {
    const a = projetar(pts[Math.max(0, i - 1)], w, h);
    const b = projetar(pts[Math.min(pts.length - 1, i + 1)], w, h);
    const cur = projetar(p, w, h);
    const dx = b.x - a.x;
    const dyy = b.y - a.y;
    const len = Math.hypot(dx, dyy) || 1;
    const nx = -dyy / len;
    const ny = dx / len;
    const meia = largura * cur.s;
    left.push({ x: cur.x + nx * meia, y: cur.y + ny * meia + dy * cur.s });
    right.push({ x: cur.x - nx * meia, y: cur.y - ny * meia + dy * cur.s });
  });

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  left.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  right.reverse().forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
}

function caminhoTracejado(ctx: CanvasRenderingContext2D, pts: Ponto[], w: number, h: number, tempo: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(24,27,35,.46)';
  ctx.lineCap = 'round';
  pts.forEach((p, i) => {
    if (i % 7 !== Math.floor((tempo * 5) % 7)) return;
    const a = projetar(p, w, h);
    const b = projetar(pts[Math.min(pts.length - 1, i + 3)], w, h);
    ctx.lineWidth = 3.5 * a.s;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  ctx.restore();
}

function desenharBandeira(ctx: CanvasRenderingContext2D, casa: Casa, w: number, h: number) {
  const base = projetar(casa, w, h);
  const lado = casa.side === 'left' ? -1 : 1;
  const hasteTopo = {
    x: base.x + lado * 48 * base.s,
    y: base.y - 114 * base.s,
  };
  const flagW = 120 * base.s;
  const flagH = 54 * base.s;
  const ponta = 18 * base.s;
  const esp = 12 * base.s;
  const skew = lado * 13 * base.s;
  const flagX = hasteTopo.x;
  const flagY = hasteTopo.y - flagH * 0.82;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.strokeStyle = CORES.poste;
  ctx.lineWidth = Math.max(2, 5 * base.s);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y - 6 * base.s);
  ctx.lineTo(hasteTopo.x, hasteTopo.y + flagH * 0.22);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(base.x, base.y + 11 * base.s, 15 * base.s, 6 * base.s, 0, 0, Math.PI * 2);
  ctx.fill();

  const sinal = lado;
  const front = new Path2D();
  front.moveTo(flagX, flagY);
  front.lineTo(flagX + sinal * flagW, flagY + skew * 0.18);
  front.lineTo(flagX + sinal * (flagW + ponta), flagY + flagH * 0.5 + skew * 0.14);
  front.lineTo(flagX + sinal * flagW, flagY + flagH + skew * 0.08);
  front.lineTo(flagX, flagY + flagH);
  front.closePath();

  const baixo = new Path2D();
  baixo.moveTo(flagX, flagY + flagH);
  baixo.lineTo(flagX + sinal * flagW, flagY + flagH + skew * 0.08);
  baixo.lineTo(flagX + sinal * (flagW + ponta), flagY + flagH * 0.5 + skew * 0.14);
  baixo.lineTo(flagX + sinal * (flagW + ponta * 0.6), flagY + flagH * 0.5 + esp);
  baixo.lineTo(flagX + sinal * flagW, flagY + flagH + esp);
  baixo.lineTo(flagX, flagY + flagH + esp);
  baixo.closePath();

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.translate(8 * base.s, 11 * base.s);
  ctx.fill(front);
  ctx.translate(-8 * base.s, -11 * base.s);

  ctx.fillStyle = CORES.laranjaEscuro;
  ctx.fill(baixo);

  const grad = ctx.createLinearGradient(flagX, flagY, flagX + sinal * flagW, flagY + flagH);
  grad.addColorStop(0, CORES.laranjaClaro);
  grad.addColorStop(0.34, CORES.laranja);
  grad.addColorStop(1, CORES.laranjaEscuro);
  ctx.fillStyle = grad;
  ctx.fill(front);
  ctx.strokeStyle = CORES.texto;
  ctx.lineWidth = Math.max(2, 4 * base.s);
  ctx.stroke(front);

  ctx.fillStyle = 'rgba(255,255,255,.23)';
  ctx.beginPath();
  ctx.moveTo(flagX + sinal * 8 * base.s, flagY + 8 * base.s);
  ctx.lineTo(flagX + sinal * (flagW * 0.72), flagY + 9 * base.s);
  ctx.lineWidth = Math.max(2, 5 * base.s);
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.stroke();

  ctx.fillStyle = CORES.texto;
  ctx.textBaseline = 'middle';
  ctx.textAlign = casa.side === 'left' ? 'right' : 'left';
  ctx.font = `900 ${Math.max(12, 18 * base.s)}px Arial`;
  ctx.fillText(String(casa.i), flagX + sinal * 16 * base.s, flagY + 18 * base.s);
  ctx.font = `900 ${Math.max(13, 21 * base.s)}px Arial`;
  ctx.fillText(casa.mes, flagX + sinal * 16 * base.s, flagY + 39 * base.s);

  ctx.restore();
}

function desenharVendedor(ctx: CanvasRenderingContext2D, v: VendedorProgresso, x: number, z: number, w: number, h: number, tempo: number, delay: number) {
  const p = projetar({ x, z }, w, h);
  const s = p.s * 0.8;
  const bob = Math.sin(tempo * 5 + delay) * 3 * s;

  ctx.save();
  ctx.translate(p.x, p.y + bob);
  ctx.fillStyle = 'rgba(0,0,0,.36)';
  ctx.beginPath();
  ctx.ellipse(0, 15 * s, 17 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = v.cor;
  ctx.strokeStyle = CORES.texto;
  ctx.lineWidth = Math.max(1.5, 2.2 * s);
  ctx.beginPath();
  ctx.moveTo(-10 * s, 13 * s);
  ctx.quadraticCurveTo(-6 * s, -8 * s, 0, -14 * s);
  ctx.quadraticCurveTo(7 * s, -7 * s, 10 * s, 13 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f2c9a1';
  ctx.beginPath();
  ctx.arc(0, -29 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = CORES.sombra;
  ctx.font = `900 ${Math.max(8, 10 * s)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(iniciais(v.nome), 0, -29 * s);
  ctx.restore();
}

function desenharCena(
  canvas: HTMLCanvasElement,
  vendedores: VendedorProgresso[],
  tempo: number,
  clickZones: Array<{ id: string; x: number; y: number; r: number }>,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, rect.width);
  const h = Math.max(360, rect.height);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  clickZones.length = 0;

  const pts = amostrarCaminho();
  faixaProjetada(ctx, pts, w, h, 50, 'rgba(0,0,0,.42)', 34, 1);
  faixaProjetada(ctx, pts, w, h, 44, CORES.marrom, 28, 0.82);
  faixaProjetada(ctx, pts, w, h, 46, CORES.sombra, 7, 0.95);
  faixaProjetada(ctx, pts, w, h, 36, CORES.laranjaEscuro);
  faixaProjetada(ctx, pts, w, h, 28, CORES.laranja);
  faixaProjetada(ctx, pts, w, h, 12, 'rgba(255,255,255,.16)');
  caminhoTracejado(ctx, pts, w, h, tempo);

  const vendedoresPorCasa = new Map<number, VendedorProgresso[]>();
  vendedores.forEach((v) => {
    const casa = clamp(v.casas, 0, 12);
    if (!vendedoresPorCasa.has(casa)) vendedoresPorCasa.set(casa, []);
    vendedoresPorCasa.get(casa)!.push(v);
  });

  const vendedoresProjetados: Array<{ v: VendedorProgresso; x: number; z: number; depth: number; delay: number }> = [];
  vendedoresPorCasa.forEach((lista, casaIndex) => {
    const casa = casaIndex <= 0 ? INICIO : CASAS[casaIndex - 1];
    lista.forEach((v, i) => {
      const offset = (i - (lista.length - 1) / 2) * 0.24;
      vendedoresProjetados.push({
        v,
        x: casa.x + offset,
        z: casa.z + (i % 2 === 0 ? 0.22 : -0.22),
        depth: casa.z,
        delay: i * 0.5,
      });
    });
  });

  CASAS.slice().sort((a, b) => a.z - b.z).forEach((casa) => desenharBandeira(ctx, casa, w, h));
  vendedoresProjetados
    .sort((a, b) => a.depth - b.depth)
    .forEach((item) => {
      const p = projetar({ x: item.x, z: item.z }, w, h);
      clickZones.push({ id: item.v.id, x: p.x, y: p.y - 18 * p.s, r: 34 * p.s });
      desenharVendedor(ctx, item.v, item.x, item.z, w, h, tempo, item.delay);
    });
}

export const TabuleiroJogo: React.FC<{
  vendedores: VendedorProgresso[];
  onVendedorClick?: (id: string) => void;
}> = ({ vendedores, onVendedorClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vendedoresRef = useRef(vendedores);
  const clickZonesRef = useRef<Array<{ id: string; x: number; y: number; r: number }>>([]);

  useEffect(() => {
    vendedoresRef.current = vendedores;
  }, [vendedores]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let frame = 0;
    const inicio = performance.now();
    const render = (agora: number) => {
      desenharCena(canvas, vendedoresRef.current, (agora - inicio) / 1000, clickZonesRef.current);
      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div style={{ width: '100%', height: 'min(760px, 58vw)', minHeight: 460, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: onVendedorClick ? 'pointer' : 'default' }}
        onClick={(event) => {
          if (!onVendedorClick) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left;
          const y = event.clientY - rect.top;
          const hit = clickZonesRef.current.find((zone) => Math.hypot(zone.x - x, zone.y - y) <= zone.r);
          if (hit) onVendedorClick(hit.id);
        }}
      />
    </div>
  );
};
