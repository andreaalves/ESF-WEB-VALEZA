import React from 'react';

export type VendedorProgresso = {
  id: string;
  nome: string;
  casas: number; // 0..12 (quantas metas mensais já bateu)
  cor: string;
};

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const mesAtual = new Date().getMonth() + 1;

// ── Detecção de gênero (igual ao app Ionic) ────────────────────────────────
const FEMININOS = [
  'ana','amanda','beatriz','bianca','bruna','camila','carla','carolina','claudia',
  'daniela','eduarda','fernanda','gabriela','giovana','jessica','joana','julia',
  'juliana','karina','larissa','leticia','luana','luciana','marcela','marcia',
  'maria','mariana','monica','natalia','paula','priscila','rafaela','renata',
  'sabrina','simone','tatiana','thais','vanessa',
];
const MASCULINOS = [
  'afonso','alex','andre','antonio','bruno','carlos','daniel','diego','eduardo',
  'felipe','fernando','francisco','gabriel','guilherme','henrique','jair','joao',
  'jose','leandro','lucas','luiz','marcelo','marcos','mario','mateus','paulo',
  'pedro','rafael','ricardo','roberto','rodrigo','thiago','vinicius','vitor',
];

function normalizar(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isFeminino(nome: string): boolean {
  const primeiro = normalizar((nome || '').trim().split(/\s+/)[0] || '');
  if (FEMININOS.includes(primeiro)) return true;
  if (MASCULINOS.includes(primeiro)) return false;
  return primeiro.endsWith('a');
}

// ── Boneco SVG — mesmo visual do app ──────────────────────────────────────
export const AvatarBoneco: React.FC<{
  cor: string;
  nome: string;
  size?: number;
  onClick?: () => void;
  title?: string;
}> = ({ cor, nome, size = 34, onClick, title }) => {
  const menina = isFeminino(nome);

  // Proporções baseadas em size=34
  const s = size / 34;

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    isolation: 'isolate', // cria stacking context próprio: os zIndex internos (rosto/cabelo) não vazam por cima da sidebar
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size,
    height: size,
    minWidth: size,
    borderRadius: Math.round(14 * s),
    background: `radial-gradient(circle at 50% 12%, rgba(255,255,255,0.22), transparent 28%),
      linear-gradient(160deg, ${cor}, rgba(22,27,39,0.88))`,
    border: '1.5px solid rgba(255,255,255,0.55)',
    boxShadow: `0 6px 16px rgba(0,0,0,0.32), 0 0 0 2px ${cor}44`,
    overflow: 'hidden',
    cursor: onClick ? 'pointer' : 'default',
    flexShrink: 0,
  };

  // Cabelo
  const cabeloW = menina ? Math.round(30 * s) : Math.round(25 * s);
  const cabeloH = menina ? Math.round(22 * s) : Math.round(14 * s);
  const cabeloTop = menina ? Math.round(5 * s) : Math.round(4 * s);
  const cabeloBR = menina ? '18px 18px 14px 14px' : '14px 14px 8px 8px';
  const cabeloBg = menina
    ? 'linear-gradient(180deg, #34243b, #201724)'
    : 'linear-gradient(180deg, #2b2430, #17111b)';

  // Rosto
  const rostoW = Math.round(20 * s);
  const rostoH = Math.round(20 * s);
  const rostoTop = menina ? Math.round(12 * s) : Math.round(10 * s);

  // Olhos
  const olhosW = Math.round(10 * s);
  const olhoW = Math.round(3 * s);
  const olhoH = Math.round(3 * s);

  // Sorriso
  const sorrisoW = Math.round(8 * s);
  const sorrisoH = Math.round(4 * s);

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={containerStyle}
    >
      {/* Cabelo */}
      <span
        style={{
          position: 'absolute',
          top: cabeloTop,
          width: cabeloW,
          height: cabeloH,
          borderRadius: cabeloBR,
          background: cabeloBg,
          zIndex: 1,
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />
      {/* Rosto */}
      <span
        style={{
          position: 'absolute',
          top: rostoTop,
          left: '50%',
          transform: 'translateX(-50%)',
          width: rostoW,
          height: rostoH,
          borderRadius: '50%',
          background: 'linear-gradient(180deg, #ffd7b0, #f2b986)',
          boxShadow: `inset 0 ${-Math.round(3*s)}px 0 rgba(151,84,44,0.14)`,
          zIndex: 2,
        }}
      >
        {/* Olhos */}
        <span
          style={{
            position: 'absolute',
            top: Math.round(6 * s),
            left: '50%',
            width: olhosW,
            height: olhoH,
            transform: 'translateX(-50%)',
          }}
        >
          {/* olho esquerdo */}
          <span style={{
            position: 'absolute',
            left: 0,
            width: olhoW,
            height: olhoH,
            borderRadius: '50%',
            background: '#332233',
          }} />
          {/* olho direito */}
          <span style={{
            position: 'absolute',
            right: 0,
            width: olhoW,
            height: olhoH,
            borderRadius: '50%',
            background: '#332233',
          }} />
        </span>
        {/* Sorriso */}
        <span
          style={{
            position: 'absolute',
            bottom: Math.round(4 * s),
            left: '50%',
            transform: 'translateX(-50%)',
            width: sorrisoW,
            height: sorrisoH,
            borderBottom: `${Math.max(1, Math.round(2*s))}px solid rgba(91,48,43,0.72)`,
            borderRadius: '0 0 12px 12px',
          }}
        />
      </span>
    </button>
  );
};

// ── Tabuleiro ─────────────────────────────────────────────────────────────
export const TabuleiroTrilha: React.FC<{
  vendedores: VendedorProgresso[];
  onVendedorClick?: (id: string) => void;
}> = ({ vendedores, onVendedorClick }) => {
  // agrupa os peões por casa: 0 = PARTIDA, 1..12 = meses
  const porCasa: Record<number, VendedorProgresso[]> = {};
  vendedores.forEach((v) => {
    const c = Math.min(Math.max(Math.round(v.casas), 0), 12);
    (porCasa[c] = porCasa[c] || []).push(v);
  });

  const peoes = (casa: number) =>
    (porCasa[casa] || []).map((v) => (
      <AvatarBoneco
        key={v.id}
        cor={v.cor}
        nome={v.nome}
        size={26}
        title={`${v.nome} — ${Math.round((v.casas / 12) * 100)}%`}
        onClick={onVendedorClick ? () => onVendedorClick(v.id) : undefined}
      />
    ));

  const celulaBase: React.CSSProperties = {
    flex: '1 1 0',
    minWidth: 0,
    minHeight: 120,
    borderRadius: 12,
    background: '#171922',
    border: '1px solid #2a2e3a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 3px 6px',
    position: 'relative',
  };

  const portal = (cor: string): React.CSSProperties => ({
    ...celulaBase,
    background: `linear-gradient(160deg, ${cor} 0%, #10131b 120%)`,
    border: `1px solid ${cor}`,
  });

  return (
    <div style={{ width: '100%', overflowX: 'hidden', padding: '14px 2px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
        {/* PARTIDA */}
        <div style={portal('#3a4256')}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>🚩</div>
          <div style={{ marginTop: 4, color: '#eeeef2', fontWeight: 900, fontSize: 10, letterSpacing: 0 }}>
            PARTIDA
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 'auto', minHeight: 30 }}>
            {peoes(0)}
          </div>
        </div>

        {/* seta + 12 meses */}
        {MESES.map((mes, i) => {
          const numero = i + 1;
          const ehAtual = numero === mesAtual;
          return (
            <React.Fragment key={mes}>
              <div style={{ alignSelf: 'center', color: '#fe8026', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>›</div>
              <div
                style={{
                  ...celulaBase,
                  border: ehAtual ? '2px solid #fe8026' : celulaBase.border,
                  boxShadow: ehAtual ? '0 0 0 3px rgba(254,128,38,.18)' : 'none',
                }}
              >
                {/* número do mês */}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: ehAtual ? '#fe8026' : '#2a2e3a',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {numero}
                </div>
                {/* nome do mês */}
                <div style={{ marginTop: 4, color: ehAtual ? '#fe8026' : '#eeeef2', fontWeight: 900, fontSize: 11, letterSpacing: 0 }}>
                  {mes}
                </div>
                {/* bonecos */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    justifyContent: 'center',
                    marginTop: 'auto',
                    minHeight: 30,
                  }}
                >
                  {peoes(numero)}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        {/* CHEGADA */}
        <div style={{ alignSelf: 'center', color: '#fe8026', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>›</div>
        <div style={portal('#9c3d0f')}>
          <div style={{ fontSize: 18, lineHeight: 1 }}>🏁</div>
          <div style={{ marginTop: 4, color: '#eeeef2', fontWeight: 900, fontSize: 10, letterSpacing: 0 }}>
            CHEGADA
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center', marginTop: 'auto', minHeight: 30 }}>
            {peoes(13)}
          </div>
        </div>
      </div>
    </div>
  );
};
