import { FixedIncomeAsset, isTaxExempt } from './types';
import { parseISO, daysBetween } from './dates';
import { breakdown } from './tax';
export interface CDIDailyRate { date: Date; percent: number }

export function grossValue(principal: number, start: Date, cdiPercent: number, rates: CDIDailyRate[], until: Date = new Date()): number {
  let f = 1; const pct = cdiPercent / 100;
  for (const r of rates) if (r.date >= start && r.date < until) f *= 1 + (r.percent / 100) * pct;
  return principal * f;
}
export function value(a: FixedIncomeAsset, rates: CDIDailyRate[], until: Date = new Date()) {
  let invested = 0, gross = 0;
  for (const d of a.deposits) { const dt = parseISO(d.date); if (!dt) continue; invested += d.amount; gross += grossValue(d.amount, dt, a.cdiPercent, rates, until); }
  return { invested, gross };
}
export function netValue(a: FixedIncomeAsset, rates: CDIDailyRate[], until: Date = new Date()): number {
  return a.deposits.reduce((acc, d) => {
    const dt = parseISO(d.date); if (!dt) return acc;
    const g = grossValue(d.amount, dt, a.cdiPercent, rates, until);
    return acc + breakdown(d.amount, g, daysBetween(dt, until), isTaxExempt(a)).net;
  }, 0);
}
export const annualized = (daily: number) => (Math.pow(1 + daily / 100, 252) - 1) * 100;
