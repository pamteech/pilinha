import { CashDividend } from './dividends';
import { parseISO } from './dates';
/** Proventos do Yahoo (chart events=div): só histórico, por ação, com data ex aproximada. */
export const yahooDivURL = (t: string) => `https://query1.finance.yahoo.com/v8/finance/chart/${t.toUpperCase().replace(/[^A-Z0-9]/g, '')}.SA?range=1y&interval=1mo&events=div`;
export function parseYahooDividends(json: any, ticker: string): CashDividend[] {
  const ev = json?.chart?.result?.[0]?.events?.dividends;
  if (!ev || typeof ev !== 'object') return [];
  return Object.values<any>(ev).flatMap(d => (typeof d?.amount === 'number' && typeof d?.date === 'number')
    ? [{ ticker: ticker.toUpperCase(), paymentDate: new Date(d.date * 1000), ratePerShare: d.amount, label: 'data ex' }] : []);
}
export interface CalendarEntry { ticker: string; date: Date; perShare: number; total: number; label: string }
/** Separa próximos anunciados (data >= hoje) de últimos pagos. Nunca inventa datas: só o que a fonte trouxe. */
export function dividendCalendar(cash: CashDividend[], qty: Record<string, number>, now: Date = new Date(), recentN = 8) {
  const today = parseISO(now.toISOString().slice(0, 10))!.getTime() - 86_400_000;
  const seen = new Set<string>(), list: CalendarEntry[] = [];
  for (const c of cash) {
    const k = `${c.ticker}|${c.paymentDate.toISOString().slice(0, 10)}|${c.ratePerShare.toFixed(6)}`;
    if (seen.has(k)) continue; seen.add(k);
    const q = qty[c.ticker] ?? 0;
    list.push({ ticker: c.ticker, date: c.paymentDate, perShare: c.ratePerShare, total: c.ratePerShare * q, label: c.label });
  }
  const upcoming = list.filter(e => e.date.getTime() > today).sort((a, b) => a.date.getTime() - b.date.getTime());
  const recent = list.filter(e => e.date.getTime() <= today).sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, recentN);
  return { upcoming, recent };
}
