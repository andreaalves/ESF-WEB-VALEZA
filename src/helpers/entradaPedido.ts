import { DateTime } from 'luxon';

// Data e hora em que o pedido entrou no Essencial. Usado pela lista de
// pedidos e pelo Mapa de Expedição/Kanban, para os dois mostrarem o mesmo.

// Data calendário de um campo que o backend manda como "dia", lida SEMPRE em
// UTC. Motivo (bug real, 2026-08-19): data_faturamento é `@db.Date` no Prisma,
// que serializa como MEIA-NOITE UTC ("2026-08-19T00:00:00.000Z"). Lido no fuso
// local (UTC-3) isso vira 21:00 do DIA ANTERIOR — e aplicar a hora da NF em
// cima desse dia errado fazia o fim cair antes do início, zerando o tempo
// (Math.max(0, ...)) e imprimindo "agora" em vez dos minutos/horas reais.
export function dataCalendario(valor: string | undefined): string | null {
    if (!valor) return null;
    const d = DateTime.fromISO(String(valor), { zone: "utc" });
    return d.isValid ? d.toISODate() : null;
}

// Junta a data calendário (UTC, ver acima) com uma hora "HH:mm[:ss]" que o
// ERP grava já em horário de Brasília — por isso a hora é aplicada no fuso
// local, e só a data vem do UTC.
export function combinarDataHora(data: string | undefined, hora: string | undefined): DateTime | null {
    const dia = dataCalendario(data);
    if (!dia || !hora) return null;
    const m = String(hora).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const combinado = DateTime.fromISO(`${dia}T${m[1].padStart(2, "0")}:${m[2]}:${m[3] ?? "00"}`);
    return combinado.isValid ? combinado : null;
}

// Data e hora de inclusão do pedido, no horário local, para EXIBIR (lista,
// Kanban) e para o dia usado no filtro de período. Mesma regra de inicioReal (SurgicalMap),
// com duas diferenças:
// - pedido do App: o instante vem em UTC; o dia sai do horário local (sem isso,
//   pedido incluído às 22h30 aparecia no dia seguinte);
// - pedido antigo do Protheus, sem hora_emissao: só o dia é conhecido. A hora
//   fica de fora (temHora=false), em vez de aparecer "00:00" ou "21:00" falso.
export function entradaDoPedido(dataEmissao?: string, horaEmissao?: string): { momento: DateTime; temHora: boolean } | null {
    if (!dataEmissao) return null;
    const dt = DateTime.fromISO(dataEmissao);
    if (!dt.isValid) return null;
    const utc = dt.toUTC();
    const soData = utc.hour === 0 && utc.minute === 0 && utc.second === 0 && utc.millisecond === 0;
    if (!soData) return { momento: dt, temHora: true };
    const combinado = combinarDataHora(dataEmissao, horaEmissao);
    if (combinado) return { momento: combinado, temHora: true };
    const dia = dataCalendario(dataEmissao);
    return dia ? { momento: DateTime.fromISO(dia), temHora: false } : null;
}
