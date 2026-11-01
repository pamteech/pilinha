import { FixedIncomeAsset, isTaxExempt, rateModelOf } from './types';
import { parseISO, daysBetween } from './dates';
import { breakdown } from './tax';
export interface CDIDailyRate { date: Date; percent: number }

export function grossValue(principal: number, start: Date, cdiPercent: number, rates: CDIDailyRate[], until: Date = new Date()): number {
  let f = 1; const pct = cdiPercent / 100;
  for (const r of rates) if (r.date >= start && r.date < until) f *= 1 + (r.percent / 100) * pct;
  return principal * f;
}
/** IPCA mensal (BCB SGS 433). month = dia 1 do mês de referência. */
export interface IPCAMonthlyRate { month: Date; percent: number }
/** Π(1 + IPCA_m × fração do mês dentro de [start, until)), pró-rata simples em dias corridos; só meses já divulgados. */
export function inflationFactor(start: Date, until: Date, ipca: IPCAMonthlyRate[]): number {
  let f = 1;
  for (const m of ipca) {
    const next = new Date(m.month); next.setMonth(next.getMonth() + 1);
    const a = Math.max(start.getTime(), m.month.getTime()), b = Math.min(until.getTime(), next.getTime());
    if (b <= a) continue;
    f *= 1 + (m.percent / 100) * Math.min(1, (b - a) / (next.getTime() - m.month.getTime()));
  }
  return f;
}
/** IPCA+ na curva: aplicado × inflação × (1 + taxa)^(dias úteis/252). Sem marcação a mercado. */
export const ipcaGross = (principal: number, start: Date, realRate: number, ipca: IPCAMonthlyRate[], businessDays: number, until: Date) =>
  principal * inflationFactor(start, until, ipca) * Math.pow(1 + realRate / 100, businessDays / 252);
/** Prefixado na curva: aplicado × (1 + taxa)^(dias úteis/252). */
export const prefixedGross = (principal: number, rate: number, businessDays: number) => principal * Math.pow(1 + rate / 100, businessDays / 252);
function depositGross(a: FixedIncomeAsset, principal: number, start: Date, rates: CDIDailyRate[], ipca: IPCAMonthlyRate[], until: Date) {
  const m = rateModelOf(a);
  if (m === 'cdi') return grossValue(principal, start, a.cdiPercent, rates, until);
  const du = rates.filter(r => r.date >= start && r.date < until).length;
  if (m === 'prefixado') return prefixedGross(principal, a.fixedRate!, du);
  return ipcaGross(principal, start, a.realRate ?? 0, ipca, du, until);
}
export function value(a: FixedIncomeAsset, rates: CDIDailyRate[], until: Date = new Date(), ipca: IPCAMonthlyRate[] = []) {
  let invested = 0, gross = 0;
  for (const d of a.deposits) { const dt = parseISO(d.date); if (!dt) continue; invested += d.amount; gross += depositGross(a, d.amount, dt, rates, ipca, until); }
  return { invested, gross };
}
export function netValue(a: FixedIncomeAsset, rates: CDIDailyRate[], until: Date = new Date(), ipca: IPCAMonthlyRate[] = []): number {
  return a.deposits.reduce((acc, d) => {
    const dt = parseISO(d.date); if (!dt) return acc;
    const g = depositGross(a, d.amount, dt, rates, ipca, until);
    return acc + breakdown(d.amount, g, daysBetween(dt, until), isTaxExempt(a)).net;
  }, 0);
}
export const annualized = (daily: number) => (Math.pow(1 + daily / 100, 252) - 1) * 100;
