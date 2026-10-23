import { ManualDividend, StockPosition } from './types';
import { parseISO } from './dates';
export interface CashDividend { ticker: string; paymentDate: Date; ratePerShare: number; label: string }
export function parseBrapiDividends(json: any): CashDividend[] {
  const out: CashDividend[] = [];
  for (const r of json?.results ?? []) for (const c of r?.dividendsData?.cashDividends ?? []) {
    const d = typeof c.paymentDate === 'string' ? parseISO(c.paymentDate.slice(0, 10)) : null;
    if (!d || typeof c.rate !== 'number') continue;
    out.push({ ticker: String(r.symbol).toUpperCase(), paymentDate: d, ratePerShare: c.rate, label: c.label ?? '' });
  }
  return out;
}
export interface DividendSummary { last12m: number; byTicker: Record<string, number>; source: Record<string, 'brapi' | 'manual'> }
/** Últimos 12 meses; estimativa com a quantidade atual. Manual vence a brapi. */
export function summary(stocks: StockPosition[], brapi: CashDividend[], manual: ManualDividend[], now: Date = new Date()): DividendSummary {
  const start = new Date(now.getTime() - 365 * 86_400_000);
  const s: DividendSummary = { last12m: 0, byTicker: {}, source: {} };
  const mt = new Set(manual.map(m => m.ticker.toUpperCase()));
  for (const m of manual) {
    const d = parseISO(m.date); if (!d || d < start || d > now) continue;
    const t = m.ticker.toUpperCase(); s.byTicker[t] = (s.byTicker[t] ?? 0) + m.amount; s.source[t] = 'manual';
  }
  for (const st of stocks) {
    const t = st.ticker.toUpperCase(); if (mt.has(t)) continue;
    const v = brapi.filter(c => c.ticker === t && c.paymentDate >= start && c.paymentDate <= now).reduce((a, c) => a + c.ratePerShare * st.quantity, 0);
    if (v > 0) { s.byTicker[t] = (s.byTicker[t] ?? 0) + v; s.source[t] = 'brapi'; }
  }
  s.last12m = Object.values(s.byTicker).reduce((a, b) => a + b, 0);
  return s;
}
