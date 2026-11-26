/**
 * Ritmo da meta por dias uteis — compartilhado pelos paineis no padrao do GAV
 * (GAV e Direto). Puro: pode ser usado em componente de servidor ou cliente.
 */
import { COLOR } from "./brand";
import { businessDaysElapsed, businessDaysInMonth, nowRecife } from "./calc";

/** % do mes (em dias uteis) que ja passou: onde o resultado "deveria" estar hoje. */
export function idealPctDoMes(year: number, month: number): number {
  const total = businessDaysInMonth(year, month);
  return total > 0 ? (businessDaysElapsed(year, month) / total) * 100 : 100;
}

export function ehMesCorrente(year: number, month: number): boolean {
  const h = nowRecife();
  return h.getFullYear() === year && h.getMonth() + 1 === month;
}

/**
 * Cor do resultado contra o ritmo esperado para hoje:
 * verde = no ritmo ou meta batida · amarelo = ate 15% abaixo · vermelho = mais · cinza = sem meta.
 */
export function tomRitmo(pct: number, idealPct: number, temMeta: boolean): string {
  if (!temMeta) return COLOR.mute;
  if (pct >= 100 || pct >= idealPct) return COLOR.ok;
  if (pct >= idealPct * 0.85) return COLOR.warning;
  return COLOR.danger;
}
