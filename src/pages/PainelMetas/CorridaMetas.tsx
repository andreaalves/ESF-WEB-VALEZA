import React, { useMemo, useState } from 'react';
import { FiCheck, FiStar, FiTrendingUp, FiTarget, FiAward } from 'react-icons/fi';
import { AvatarBoneco } from './TabuleiroTrilha';

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
  if (pct >= 85) return '#48bb78'; // verde
  if (pct >= 60) return '#ed8936'; // laranja
  return '#f56565'; // vermelho
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

// ── Tabuleiro (PARTIDA → meses → CHEGADA) ──────────────────────────────────
const Tabuleiro: React.FC<{
  meses: MesCorrida[];
  participantes: ParticipanteCorrida[];
  mesSel: number;
}> = ({ meses, participantes, mesSel }) => {
  const celula = (extra?: React.CSSProperties): React.CSSProperties => ({
    flex: '1 1 0',
    minWidth: 0,
    minHeight: 150,
    borderRadius: 12,
    background: '#1a202c',
    border: '1px solid #2a2e3a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '8px 3px',
    position: 'relative',
    ...extra,
  });

  const portal = (cor: string): React.CSSProperties =>
    celula({ background: `linear-gradient(160deg, ${cor} 0%, #1a202c 130%)`, border: `1px solid ${cor}`, justifyContent: 'center' });

  return (
    <div style={{ width: '100%', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
        {/* PARTIDA */}
        <div style={portal('#2f7d4f')}>
          <div style={{ fontSize: 18 }}>🚩</div>
          <div style={{ color: '#eafaf0', fontWeight: 900, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>PARTIDA</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
            {participantes.slice(0, 8).map((p) => (
              <AvatarBoneco key={p.id} cor={p.cor} nome={p.nome} size={22} title={p.nome} />
            ))}
          </div>
        </div>

        {/* 12 meses */}
        {meses.map((m) => {
          const passado = m.mes < mesSel;
          const atual = m.mes === mesSel;
          const temMeta = m.meta > 0;
          const cor = temMeta ? corPct(m.pct) : '#4a5568';
          return (
            <div
              key={m.mes}
              style={celula({
                border: atual ? '2px solid #fe8026' : '1px solid #2a2e3a',
                boxShadow: atual ? '0 0 0 3px rgba(254,128,38,.18)' : 'none',
              })}
            >
              {/* número do mês */}
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: atual ? '#fe8026' : '#2a2e3a',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {m.mes}
              </div>
              <div style={{ color: atual ? '#fe8026' : '#cfd2dc', fontWeight: 900, fontSize: 11 }}>{MESES[m.mes - 1]}</div>

              <div style={{ marginTop: 2, color: '#7c8093', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Meta</div>
              <div style={{ color: '#e7e9f0', fontSize: 10, fontWeight: 700 }}>{temMeta ? brlK(m.meta) : '—'}</div>

              {temMeta && (passado || atual) && (
                <>
                  <div style={{ marginTop: 1, color: '#7c8093', fontSize: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Realizado</div>
                  <div style={{ color: '#e7e9f0', fontSize: 10, fontWeight: 700 }}>{brlK(m.realizado)}</div>
                </>
              )}

              <div style={{ marginTop: 'auto', color: temMeta ? cor : '#5b5f70', fontWeight: 900, fontSize: 13 }}>
                {temMeta ? `${Math.round(m.pct)}%` : '0%'}
              </div>

              {/* status no rodapé */}
              <div style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {passado && temMeta ? (
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: corPct(m.pct),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FiCheck size={11} color="#0c1018" />
                  </span>
                ) : atual ? (
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #fe8026', boxShadow: '0 0 0 3px rgba(254,128,38,.2)' }} />
                ) : null}
              </div>
            </div>
          );
        })}

        {/* CHEGADA */}
        <div style={portal('#9c3d0f')}>
          <div style={{ fontSize: 18 }}>🏁</div>
          <div style={{ color: '#fbe9dd', fontWeight: 900, fontSize: 10, letterSpacing: 1 }}>CHEGADA</div>
          <div style={{ marginTop: 4 }}>
            <FiAward size={18} color="#ffd9a8" />
          </div>
        </div>
      </div>

      {/* trilha de progresso */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 6% 2px' }}>
        {meses.map((m, i) => {
          const feito = m.mes < mesSel;
          const atual = m.mes === mesSel;
          return (
            <React.Fragment key={m.mes}>
              {i > 0 && <div style={{ flex: '1 1 0', height: 3, background: m.mes <= mesSel ? '#48bb78' : '#2a2e3a' }} />}
              <span
                style={{
                  width: feito ? 16 : 14,
                  height: feito ? 16 : 14,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: feito ? '#48bb78' : atual ? '#fe8026' : '#1a1d28',
                  border: atual ? '2px solid #fe8026' : feito ? 'none' : '2px solid #2a2e3a',
                  boxShadow: atual ? '0 0 0 4px rgba(254,128,38,.18)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {feito && <FiCheck size={10} color="#0c1018" />}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ── Tabuleiro + trilha (seção "Corrida das Metas") ─────────────────────────
export const CorridaTabuleiro: React.FC<{
  meses: MesCorrida[];
  participantes: ParticipanteCorrida[];
  mesSel: number;
  ano: number;
}> = ({ meses, participantes, mesSel, ano }) => (
  <div style={{ ...card, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <FiAward size={16} color="#fe8026" />
      <span style={{ color: '#e7e9f0', fontWeight: 800, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
        Corrida das Metas — {MESES[mesSel - 1]}/{ano}
      </span>
    </div>
    <Tabuleiro meses={meses} participantes={participantes} mesSel={mesSel} />
  </div>
);

// ── Tabela de classificação ────────────────────────────────────────────────
export const CorridaTabelaClassificacao: React.FC<{
  participantes: ParticipanteCorrida[];
  onParticipanteClick?: (id: string) => void;
}> = ({ participantes, onParticipanteClick }) => {
  const [ordenarPor, setOrdenarPor] = useState<'pct' | 'realizado' | 'nome'>('pct');

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
            <option value="realizado">Realizado</option>
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
          <div style={{ display: 'flex', alignItems: 'center', color: '#7c8093', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, padding: '0 0 8px', borderBottom: '1px solid #1d2130' }}>
            <span style={{ width: 52 }}>Pos</span>
            <span style={{ flex: '2 1 0', minWidth: 0 }}>Participante</span>
            <span style={{ flex: '1 1 0', textAlign: 'right' }}>Realizado</span>
            <span style={{ flex: '1 1 0', textAlign: 'right' }}>Meta</span>
            <span style={{ width: 64, textAlign: 'right' }}>% Meta</span>
            <span style={{ flex: '1.4 1 0', textAlign: 'center' }}>Progresso</span>
            <span style={{ width: 56, textAlign: 'right' }}> </span>
          </div>
          {ordenados.map((p, idx) => {
            const cor = corPct(p.pct);
            const d = formatDelta(p.deltaPct);
            return (
              <div
                key={p.id}
                onClick={onParticipanteClick ? () => onParticipanteClick(p.id) : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: '1px solid #1d2130',
                  cursor: onParticipanteClick ? 'pointer' : 'default',
                }}
              >
                <span style={{ width: 52, fontSize: idx < 3 ? 18 : 13, color: '#cfd2dc', fontWeight: 700 }}>{medalha(idx)}</span>
                <span style={{ flex: '2 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AvatarBoneco cor={p.cor} nome={p.nome} size={26} />
                  <span style={{ color: '#e7e9f0', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</span>
                </span>
                <span style={{ flex: '1 1 0', textAlign: 'right', color: cor, fontSize: 13, fontWeight: 700 }}>{brl(p.realizado)}</span>
                <span style={{ flex: '1 1 0', textAlign: 'right', color: '#9699B0', fontSize: 13 }}>{brl(p.meta)}</span>
                <span style={{ width: 64, textAlign: 'right', color: cor, fontSize: 13, fontWeight: 800 }}>{Math.round(p.pct)}%</span>
                <span style={{ flex: '1.4 1 0', padding: '0 10px' }}>
                  <span style={{ display: 'block', height: 8, borderRadius: 6, background: '#1d2130', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(p.pct, 100)}%`, background: cor, borderRadius: 6 }} />
                  </span>
                </span>
                <span style={{ width: 56, textAlign: 'right', color: d.cor, fontSize: 12, fontWeight: 700 }}>{d.text}</span>
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
