import React from 'react';
import tabuleiro from '../../assets/tabuleiro.png';

export type VendedorProgresso = {
  id: string;
  nome: string;
  casas: number; // 0..12 (mês/casa em que o vendedor está)
  cor: string;
};

// Centro de cada casa em % da imagem (calibrado pela arte tabuleiro.png).
// Ajuste fino aqui se algum peão sair levemente fora da casa.
const CASAS: Record<number, { x: number; y: number }> = {
  4: { x: 18.5, y: 17 },
  5: { x: 38, y: 14 },
  6: { x: 56, y: 15 },
  7: { x: 74.5, y: 17 },
  3: { x: 13, y: 33 },
  8: { x: 82, y: 33 },
  2: { x: 12, y: 48 },
  9: { x: 83, y: 48 },
  1: { x: 16.5, y: 64 },
  12: { x: 38, y: 65 },
  11: { x: 57.5, y: 64 },
  10: { x: 78, y: 63 },
};
const INICIO = { x: 50, y: 80 };

function iniciais(nome: string) {
  const p = String(nome || '').trim().split(/\s+/);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

function posDe(casas: number) {
  if (casas <= 0) return INICIO;
  return CASAS[Math.min(casas, 12)] || INICIO;
}

const Peao: React.FC<{ cor: string; nome: string; onClick?: () => void }> = ({
  cor,
  nome,
  onClick,
}) => (
  <svg
    width="34"
    height="46"
    viewBox="0 0 30 40"
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default', filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.5))' }}
  >
    <title>{nome}</title>
    <ellipse cx="15" cy="38" rx="11" ry="3.2" fill="#000" opacity="0.28" />
    <path d="M5 38 C5 32 10 31 10 28 L20 28 C20 31 25 32 25 38 Z" fill={cor} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
    <path d="M10 29 C8 22 12 20 12 17 L18 17 C18 20 22 22 20 29 Z" fill={cor} stroke="rgba(0,0,0,.35)" strokeWidth="1" />
    <circle cx="15" cy="11" r="7" fill={cor} stroke="#ffffffcc" strokeWidth="1.5" />
    <circle cx="12.5" cy="8.5" r="2.2" fill="#fff" opacity="0.45" />
    <text x="15" y="13.5" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#fff">
      {iniciais(nome)}
    </text>
  </svg>
);

export const TabuleiroImagem: React.FC<{
  vendedores: VendedorProgresso[];
  onVendedorClick?: (id: string) => void;
}> = ({ vendedores, onVendedorClick }) => {
  // agrupa por casa pra distribuir os peões lado a lado
  const grupos = new Map<number, VendedorProgresso[]>();
  vendedores.forEach((v) => {
    const c = Math.min(Math.max(v.casas, 0), 12);
    if (!grupos.has(c)) grupos.set(c, []);
    grupos.get(c)!.push(v);
  });

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 980, margin: '0 auto' }}>
      <img src={tabuleiro} alt="Tabuleiro de metas" style={{ width: '100%', display: 'block', borderRadius: 12 }} />

      {Array.from(grupos.entries()).map(([casa, lista]) => {
        const pos = posDe(casa);
        const n = lista.length;
        return lista.map((v, idx) => {
          const ox = (idx - (n - 1) / 2) * 24; // espalha lado a lado
          return (
            <div
              key={v.id}
              style={{
                position: 'absolute',
                left: `calc(${pos.x}% + ${ox}px)`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <Peao cor={v.cor} nome={v.nome} onClick={onVendedorClick ? () => onVendedorClick(v.id) : undefined} />
            </div>
          );
        });
      })}
    </div>
  );
};
