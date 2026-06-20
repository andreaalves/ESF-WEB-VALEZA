import React from 'react';

export type VendedorProgresso = {
  id: string;
  nome: string;
  casas: number; // 0..12 (quantas metas mensais já bateu)
  cor: string;
};

// iniciais do vendedor (1ª letra do 1º e do último nome)
function iniciais(nome: string): string {
  const parts = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Avatar: ficha metálica escura com iniciais + anel na cor do vendedor ────
// (combina com o visual dos nós/dials do painel — sem rostinho cartoon)
export const AvatarBoneco: React.FC<{
  cor: string;
  nome: string;
  size?: number;
  onClick?: () => void;
  title?: string;
}> = ({ cor, nome, size = 34, onClick, title }) => (
  <button
    type="button"
    title={title || nome}
    onClick={onClick}
    style={{
      position: 'relative',
      width: size,
      height: size,
      minWidth: size,
      flexShrink: 0,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 38% 30%, #424a59 0%, #20242d 68%, #14171e 100%)',
      border: `2px solid ${cor}`,
      boxShadow: `inset 0 2px 3px rgba(255,255,255,0.25), inset 0 -3px 5px rgba(0,0,0,0.6), 0 3px 7px rgba(0,0,0,0.55), 0 0 7px ${cor}55`,
      color: '#eef1f6',
      fontWeight: 800,
      fontSize: Math.max(9, Math.round(size * 0.36)),
      letterSpacing: 0.2,
      lineHeight: 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: onClick ? 'pointer' : 'default',
      padding: 0,
      textShadow: '0 1px 2px rgba(0,0,0,0.7)',
    }}
  >
    {iniciais(nome)}
  </button>
);
