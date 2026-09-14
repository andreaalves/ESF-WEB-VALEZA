/**
 * `YYYY-MM-DD` (o formato em que as datas da API chegam para a tela) →
 * `DD/MM/AAAA`.
 *
 * De propósito não passa por `new Date()`: as colunas `@db.Date` do backend
 * chegam como meia-noite UTC, e construir um Date com elas devolve o dia
 * anterior no fuso de Brasília. Trabalhar só com a string evita isso.
 */
export const dataIsoParaBr = (iso?: string): string => {
  const partes = String(iso || '').substring(0, 10).split('-');
  return partes.length === 3 && partes[0] ? `${partes[2]}/${partes[1]}/${partes[0]}` : '';
};

/** Hoje no fuso do navegador, em `YYYY-MM-DD` — para comparar com as datas da API. */
export const hojeIso = (): string => {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
};

/** `YYYY-MM-DD` de N dias atrás, para o filtro de período. */
export const isoDiasAtras = (dias: number): string => {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
};

/**
 * Timestamp ISO completo (ex.: `2026-09-09T18:30:00.000Z`) → `{ data, hora }`
 * já convertidos para o fuso do navegador.
 *
 * Diferente de `dataIsoParaBr`, aqui o `new Date()` é obrigatório: `data_cadastro`
 * é um timestamp de verdade (não `@db.Date`) e chega em UTC, então fatiar a string
 * mostrava a hora UTC — 3h adiantada em Brasília.
 */
export const dataHoraIsoParaBr = (iso?: string | null): { data: string; hora: string } => {
  const texto = String(iso || '');
  if (!texto) return { data: '', hora: '' };

  const quando = new Date(texto);
  if (Number.isNaN(quando.getTime())) return { data: '', hora: '' };

  const doisDigitos = (valor: number) => String(valor).padStart(2, '0');
  return {
    data: `${doisDigitos(quando.getDate())}/${doisDigitos(quando.getMonth() + 1)}/${quando.getFullYear()}`,
    hora: `${doisDigitos(quando.getHours())}:${doisDigitos(quando.getMinutes())}`,
  };
};
