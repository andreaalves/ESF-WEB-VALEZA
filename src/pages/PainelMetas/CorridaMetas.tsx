import React, { useMemo, useState } from 'react';
import { FiStar, FiTrendingUp, FiTarget, FiAward } from 'react-icons/fi';
import { AvatarBoneco, VendedorProgresso } from './TabuleiroTrilha';
import { TrilhaIlhas } from './TrilhaIlhas';

export type ParticipanteCorrida = {
  id: string;
  nome: string;
  cor: string;
  realizado: number;
  meta: number;
  pct: number;
  deltaPct: number | null; // crescimento vs mês anterior; null = sem mês anterior
};

export type MesCorrida = { mes: number; meta: number; realizado: number; pct: number };

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

const card: React.CSSProperties = { background: '#171923', borderRadius: 12, padding: 16 };

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
// Versão compacta p/ o tabuleiro: R$ 100K
function brlK(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}K`;
  return brl(v);
}

function corPct(pct: number) {
  if (pct >= 100) return '#48bb78'; // verde — bateu/passou a meta
  if (pct >= 60) return '#ed8936'; // laranja — no caminho
  return '#f56565'; // vermelho — longe
}

function formatDelta(d: number | null): { text: string; cor: string } {
  if (d === null) return { text: 'novo', cor: '#48bb78' };
  const r = Math.round(d);
  if (r === 0) return { text: '=', cor: '#9699B0' };
  if (r > 0) return { text: `+${r}%`, cor: '#48bb78' };
  return { text: `${r}%`, cor: '#f56565' };
}

function calcDestaques(participantes: ParticipanteCorrida[]) {
  if (participantes.length === 0) return null;
  const porPct = [...participantes].sort((a, b) => b.pct - a.pct);
  const comDelta = participantes.filter((p) => p.deltaPct !== null);
  const maiorCrescimento = comDelta.length
    ? comDelta.reduce((mx, p) => ((p.deltaPct as number) > (mx.deltaPct as number) ? p : mx))
    : null;
  return { maior: porPct[0], crescimento: maiorCrescimento, foco: porPct[porPct.length - 1] };
}

// ── Tabuleiro + trilha (seção "Corrida das Metas") ─────────────────────────
export const CorridaTabuleiro: React.FC<{
  meses: MesCorrida[];
  progresso: VendedorProgresso[];
  mesSel: number;
  ano: number;
  onVendedorClick?: (id: string) => void;
}> = ({ meses, progresso, mesSel, ano, onVendedorClick }) => (
  <div style={{ ...card, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <FiAward size={16} color="#fe8026" />
      <span style={{ color: '#e7e9f0', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
        Jornada das Metas — {ano}
      </span>
    </div>
    <TrilhaIlhas
      meses={meses.map((m) => ({ mes: m.mes, meta: m.meta, realizado: m.realizado, pct: m.pct }))}
      vendedores={progresso}
      mesSel={mesSel}
      onVendedorClick={onVendedorClick}
    />
  </div>
);

// ── Tabela de classificação ────────────────────────────────────────────────
export const CorridaTabelaClassificacao: React.FC<{
  participantes: ParticipanteCorrida[];
  onParticipanteClick?: (id: string) => void;
}> = ({ participantes, onParticipanteClick }) => {
  const [ordenarPor, setOrdenarPor] = useState<'pct' | 'realizado' | 'nome'>('pct');
  const gridCols = '44px minmax(210px, 2fr) minmax(100px, 1fr) minmax(96px, 1fr) 64px minmax(150px, 1.2fr) 44px';

  const ordenados = useMemo(() => {
    const arr = [...participantes];
    if (ordenarPor === 'pct') arr.sort((a, b) => b.pct - a.pct);
    else if (ordenarPor === 'realizado') arr.sort((a, b) => b.realizado - a.realizado);
    else arr.sort((a, b) => a.nome.localeCompare(b.nome));
    return arr;
  }, [participantes, ordenarPor]);

  const medalha = (pos: number) => (pos === 0 ? '🥇' : pos === 1 ? '🥈' : pos === 2 ? '🥉' : `${pos + 1}º`);

  return (
    <div style={{ ...card }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <span style={{ color: '#e7e9f0', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
          Classificação dos participantes
        </span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9699B0', fontSize: 12 }}>
          Ordenar por:
          <select
            aria-label="Ordenar participantes"
            value={ordenarPor}
            onChange={(e) => setOrdenarPor(e.target.value as any)}
            style={{ background: '#1a1d28', color: '#e7e9f0', border: '1px solid #2a2e3a', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
          >
            <option value="pct">% da meta</option>
            <option value="realizado">A faturar</option>
            <option value="nome">Nome</option>
          </select>
        </label>
      </div>

      {ordenados.length === 0 ? (
        <div style={{ color: '#7c8093', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          Nenhum participante com meta neste mês.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* cabeçalho */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, alignItems: 'center', columnGap: 12, color: '#7c8093', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 0 8px', borderBottom: '1px solid #1d2130' }}>
            <span>Pos</span>
            <span>Participante</span>
            <span style={{ textAlign: 'right' }}>A faturar</span>
            <span style={{ textAlign: 'right' }}>Meta</span>
            <span style={{ textAlign: 'right' }}>% Meta</span>
            <span style={{ textAlign: 'center' }}>Progresso</span>
            <span> </span>
          </div>
          {ordenados.map((p, idx) => {
            const cor = corPct(p.pct);
            const d = formatDelta(p.deltaPct);
            return (
              <div
                key={p.id}
                onClick={onParticipanteClick ? () => onParticipanteClick(p.id) : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  alignItems: 'center',
                  columnGap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid #1d2130',
                  cursor: onParticipanteClick ? 'pointer' : 'default',
                }}
              >
                <span style={{ fontSize: idx < 3 ? 18 : 13, color: '#cfd2dc', fontWeight: 700 }}>{medalha(idx)}</span>
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AvatarBoneco cor={p.cor} nome={p.nome} size={26} />
                  <span style={{ color: '#e7e9f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
                </span>
                <span style={{ textAlign: 'right', color: cor, fontSize: 13, fontWeight: 700 }}>{brl(p.realizado)}</span>
                <span style={{ textAlign: 'right', color: '#9699B0', fontSize: 13 }}>{brl(p.meta)}</span>
                <span style={{ textAlign: 'right', color: cor, fontSize: 13, fontWeight: 800 }}>{Math.round(p.pct)}%</span>
                <span style={{ padding: '0 10px' }}>
                  <span style={{ display: 'block', height: 8, borderRadius: 6, background: '#1d2130', overflow: 'hidden' }}>
                    <span
                      style={{
                        display: 'block', height: '100%', width: `${Math.min(p.pct, 100)}%`, borderRadius: 6,
                        background: `linear-gradient(to right, ${
                          p.pct >= 100 ? '#68d391' : p.pct >= 70 ? '#f6ad55' : '#fe8026'
                        }, #4fd1c5)`,
                        transition: 'width .6s ease',
                      }}
                    />
                  </span>
                </span>
                <span style={{ textAlign: 'right', color: d.cor, fontSize: 12, fontWeight: 700 }}>{d.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Destaques ───────────────────────────────────────────────────────────────
export const CorridaDestaques: React.FC<{ participantes: ParticipanteCorrida[] }> = ({ participantes }) => {
  const destaques = useMemo(() => calcDestaques(participantes), [participantes]);

  // item de destaque (linha interna do card)
  const item = (
    icone: React.ReactNode,
    accent: string,
    label: string,
    nome: string,
    sub: string,
    subCor: string,
  ) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#1a202c', borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${accent}` }}>
      <span style={{ width: 24, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>{icone}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: '#7c8093', fontSize: 11 }}>{label}</div>
        <div style={{ color: '#e7e9f0', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nome}</div>
        <div style={{ color: subCor, fontSize: 12 }}>{sub}</div>
      </div>
    </div>
  );

  return (
    <div style={{ ...card, width: '100%', display: 'flex', flexDirection: 'column' }}>
      <span style={{ color: '#e7e9f0', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Destaques
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {destaques ? (
          <>
            {item(
              <FiStar size={20} color="#f6c343" />,
              '#f6c343',
              'Maior destaque',
              destaques.maior.nome,
              `${Math.round(destaques.maior.pct)}% da meta`,
              corPct(destaques.maior.pct),
            )}
            {destaques.crescimento &&
              item(
                <FiTrendingUp size={20} color="#fe8026" />,
                '#fe8026',
                'Em crescimento',
                destaques.crescimento.nome,
                `${formatDelta(destaques.crescimento.deltaPct).text} vs mês anterior`,
                '#48bb78',
              )}
            {item(
              <FiTarget size={20} color="#f56565" />,
              '#f56565',
              'Foco necessário',
              destaques.foco.nome,
              `${Math.round(destaques.foco.pct)}% da meta`,
              '#f56565',
            )}
          </>
        ) : (
          <div style={{ color: '#7c8093', fontSize: 13, padding: '12px 0' }}>Sem participantes para destacar.</div>
        )}

        <div style={{ background: 'rgba(99,179,237,0.08)', border: '1px solid rgba(99,179,237,0.25)', borderRadius: 10, padding: 12 }}>
          <div style={{ color: '#63b3ed', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Dica para vencer</div>
          <div style={{ color: '#aeb2c2', fontSize: 12, marginTop: 4 }}>
            Mantenha o ritmo e foque nas oportunidades — você está no caminho para alcançar a meta!
          </div>
        </div>
      </div>
    </div>
  );
};
