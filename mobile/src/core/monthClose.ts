import { HistoryPoint } from './history';
import { toISO } from './dates';
/**
 * Fechamento do mês: como foi o mês anterior, pelo histórico (um ponto por dia em que o app abriu).
 * O rendimento não conta aportes. A porcentagem é o ganho sobre o saldo de base + metade do aporte do mês (aporte tratado como
 * feito no meio do mês), então tem sempre o mesmo sinal do ganho em reais — a conta patrimônio/aplicado do resumo da semana
 * sairia negativa num mês de ganho com aporte em carteira que já acumulava lucro.
 */
export interface MonthClose { /** AAAA-MM */ month: string; /** "outubro de 2026" */ label: string; /** aplicado no mês; negativo = resgate */ aportes: number; /** rendimento em reais, sem contar aportes */ gain: number; gainPct: number | null }
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** Mês anterior ao de hoje, 'AAAA-MM' (dia de Brasília). */
export function prevMonth(now = new Date()): string {
  const [y, m] = toISO(now).split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
/** O fechamento aparece na primeira semana do mês (dias 1 a 7). */
export const showMonthClose = (now = new Date()) => Number(toISO(now).slice(8)) <= 7;
/** Base = último ponto antes do mês (sem ele, o primeiro dentro do mês); fim = último ponto do mês. Menos de dois pontos: null. */
export function monthClose(history: HistoryPoint[], month: string): MonthClose | null {
  const pts = history.filter(p => Number.isFinite(p.total) && Number.isFinite(p.invested)).sort((a, b) => a.day.localeCompare(b.day));
  const inMonth = pts.filter(p => p.day.slice(0, 7) === month), end = inMonth[inMonth.length - 1];
  const base = [...pts].reverse().find(p => p.day.slice(0, 7) < month) ?? inMonth[0];
  if (!end || !base || end === base) return null;
  const [y, m] = month.split('-').map(Number), aportes = end.invested - base.invested, gain = end.total - base.total - aportes, den = base.total + aportes / 2;
  return { month, label: `${MONTHS[m - 1]} de ${y}`, aportes, gain, gainPct: den > 0 ? (gain / den) * 100 : null };
}
