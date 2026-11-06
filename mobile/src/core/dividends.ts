import { ManualDividend, StockPosition } from './types';
import { parseISO, toISO } from './dates';
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
/** Total já recebido (lançamentos manuais, todo o período). */
export const receivedTotal = (m: ManualDividend[] | undefined) => ({ total: (m ?? []).reduce((a, x) => a + x.amount, 0), count: (m ?? []).length });

export const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export interface MonthDividends { month: string; label: string; total: number }
export type DividendSource = 'brapi' | 'manual' | 'yahoo';
export interface MonthlyDividends { months: MonthDividends[]; total: number; average: number; best: MonthDividends | null; byTicker: { ticker: string; total: number; source: DividendSource }[]; usesYahoo: boolean }
/**
 * Proventos por mês de pagamento nos últimos `months` meses (o atual incluído), para o gráfico "Dividendos por mês".
 * brapi/Yahoo: taxa × quantidade atual, só pagamentos já ocorridos; lançamento manual vence a brapi no mesmo ticker.
 * `average` é a média sobre todos os meses da janela, meses sem provento contam como zero.
 */
export function dividendsByMonth(stocks: StockPosition[], cash: CashDividend[], manual: ManualDividend[], now: Date = new Date(), months = 12): MonthlyDividends {
  const [y0, m0] = toISO(now).split('-').map(Number);
  const keys: string[] = []; for (let k = months - 1; k >= 0; k--) { const d = new Date(Date.UTC(y0, m0 - 1 - k, 1)); keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`); }
  const sum: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  const by: Record<string, { total: number; source: DividendSource }> = {};
  const add = (month: string, ticker: string, v: number, source: DividendSource) => {
    if (!(month in sum) || !(v > 0)) return;
    sum[month] += v; const t = ticker.toUpperCase(); by[t] = { total: (by[t]?.total ?? 0) + v, source };
  };
  const mt = new Set(manual.map(m => m.ticker.toUpperCase()));
  for (const m of manual) { const d = parseISO(m.date); if (d && d <= now) add(m.date.slice(0, 7), m.ticker, m.amount, 'manual'); }
  const qty = new Map(stocks.map(s => [s.ticker.toUpperCase(), s.quantity]));
  // Por ticker: brapi (data de pagamento) vence o Yahoo (data ex, só referência); o Yahoo entra só onde não há brapi.
  const hasBrapi = new Set(cash.filter(c => c.label !== 'data ex').map(c => c.ticker.toUpperCase()));
  let usesYahoo = false;
  for (const c of cash) {
    const t = c.ticker.toUpperCase(), q = qty.get(t), yahoo = c.label === 'data ex';
    if (!q || mt.has(t) || c.paymentDate > now || (yahoo && hasBrapi.has(t))) continue;
    if (yahoo) usesYahoo = true;
    add(toISO(c.paymentDate).slice(0, 7), t, c.ratePerShare * q, yahoo ? 'yahoo' : 'brapi');
  }
  const list = keys.map(month => ({ month, label: MONTH_SHORT[Number(month.slice(5, 7)) - 1], total: sum[month] }));
  const total = list.reduce((a, m) => a + m.total, 0);
  const best = list.reduce<MonthDividends | null>((b, m) => (m.total > 0 && (!b || m.total > b.total) ? m : b), null);
  const byTicker = Object.entries(by).map(([ticker, x]) => ({ ticker, ...x })).sort((a, b) => b.total - a.total);
  return { months: list, total, average: months > 0 ? total / months : 0, best, byTicker, usesYahoo };
}
