import { toISO } from './dates';
export interface HistoryPoint { day: string; total: number; invested: number; net?: number | null }
export type HistoryRange = 'Dia' | 'Semana' | 'Mês' | 'Tudo';
const rangeDays: Record<HistoryRange, number | null> = { Dia: 1, Semana: 7, 'Mês': 30, Tudo: null };
export function record(points: HistoryPoint[], total: number, invested: number, net: number | null, now: Date = new Date()): HistoryPoint[] {
  if (!(total > 0)) return points;
  const day = toISO(now), p = { day, total, invested, net };
  return [...points.filter(x => x.day !== day), p].sort((a, b) => a.day.localeCompare(b.day));
}
export function inRange(points: HistoryPoint[], r: HistoryRange, now: Date = new Date()) {
  const n = rangeDays[r]; if (n == null) return points;
  const cut = toISO(new Date(now.getTime() - n * 86_400_000));
  return points.filter(p => p.day >= cut);
}
export const gainPct = (p: HistoryPoint) => (p.invested > 0 ? (p.total / p.invested - 1) * 100 : 0);
