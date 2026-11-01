import { Portfolio, indexerOf, rateModelOf } from './types';
import { parseISO } from './dates';
import { annualized, netValue, value, IPCAMonthlyRate, CDIDailyRate } from './cdi';
import { cdiRates, ipcaMonthly, cryptoBRL, defaultFetcher, Fetcher, stockQuote, usdQuote, USDQuote } from './quotes';
import { CashDividend, DividendSummary, summary } from './dividends';
import { TreasuryRow, markToMarket } from './treasury';
import { WatchRow, watchRow } from './watchlist';

export interface LineItem { name: string; category: string; invested: number | null; current: number; dayChange: number | null; net: number | null; unitPrice?: number | null; avgPrice?: number | null; quantity?: number | null; marketValue?: number | null; marketDay?: string | null; marketRate?: number | null }
export interface Snapshot { items: LineItem[]; cdiAnnual: number | null; updatedAt: Date; errors: string[]; dividends: DividendSummary; cash?: CashDividend[]; usdBRL?: number | null; usdChangePct?: number | null; watch?: WatchRow[] }
const chg = (v: number, pct: number | null) => (pct == null ? null : v - v / (1 + pct / 100));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const total = (s: Snapshot) => s.items.reduce((a, i) => a + i.current, 0);
export const totalNet = (s: Snapshot) => s.items.reduce((a, i) => a + (i.net ?? i.current), 0);
export const totalInvested = (s: Snapshot) => s.items.reduce((a, i) => a + (i.invested ?? i.current), 0);
export function dayChangePct(s: Snapshot): number | null {
  const ch = s.items.map(i => i.dayChange).filter((x): x is number => x != null);
  if (!ch.length) return null;
  const d = ch.reduce((a, b) => a + b, 0), prev = total(s) - d;
  return prev > 0 ? (d / prev) * 100 : null;
}
export const dayChange = (s: Snapshot) => s.items.reduce((a, i) => a + (i.dayChange ?? 0), 0);

export async function snapshot(p: Portfolio, opts: { brapiToken?: string | null; now?: Date; fetcher?: Fetcher; treasury?: TreasuryRow[] | null; cdi?: (start: Date, end: Date) => Promise<CDIDailyRate[]> } = {}): Promise<Snapshot> {
  const now = opts.now ?? new Date(), f = opts.fetcher ?? defaultFetcher;
  const items: LineItem[] = [], errors: string[] = []; let cdiAnnual: number | null = null;
  const dates = p.fixedIncome.flatMap(a => a.deposits).map(d => parseISO(d.date)).filter((d): d is Date => !!d);
  // Tudo da rede começa junto (antes era em fila: CDI, IPCA, ações, cripto, dólar).
  const start0 = dates.length ? new Date(Math.min(now.getTime(), ...dates.map(d => d.getTime()))) : now;
  const cdiP = dates.length ? (opts.cdi ? opts.cdi(start0, now) : cdiRates(start0, now, f)) : Promise.resolve([] as CDIDailyRate[]);
  const ipcaP = dates.length && p.fixedIncome.some(a => indexerOf(a) === 'ipca') ? ipcaMonthly(start0, now, f).catch(() => [] as IPCAMonthlyRate[]) : Promise.resolve([] as IPCAMonthlyRate[]);
  const stocksP = Promise.allSettled(p.stocks.map(s => stockQuote(s.ticker, opts.brapiToken, f)));
  const cryptoP = p.crypto.length ? cryptoBRL(p.crypto.map(c => c.coinId), f) : null; cryptoP?.catch(() => {});
  const usdP = usdQuote(f, now); usdP.catch(() => {}); cdiP.catch(() => {});
  if (dates.length) {
    try {
      // Aporte com data futura não pode virar início da consulta (o BCB recusa e some toda a renda fixa).
      let rates: CDIDailyRate[] = [];
      try { rates = await cdiP; } catch { errors.push('CDI indisponível agora; renda fixa mostrada pelo valor aplicado'); }
      const last = rates[rates.length - 1];
      cdiAnnual = last ? annualized(last.percent) : null;
      const ipca: IPCAMonthlyRate[] = await ipcaP;
      const mtm = (a: typeof p.fixedIncome[number]) => { const m = opts.treasury ? markToMarket(a, opts.treasury) : null; return m ? { marketValue: m.value, marketDay: m.day, marketRate: m.sellRate } : {}; };
      for (const a of p.fixedIncome) {
        const v = value(a, rates, now, ipca);
        const rm = rateModelOf(a);
        const lastPct = rm === 'ipca' ? Math.pow(1 + (a.realRate ?? 0) / 100, 1 / 252) - 1 : rm === 'prefixado' ? Math.pow(1 + a.fixedRate! / 100, 1 / 252) - 1 : ((last?.percent ?? 0) / 100) * (a.cdiPercent / 100);
        items.push({ name: a.name, category: a.kind, invested: v.invested, current: v.gross, dayChange: v.gross - v.gross / (1 + lastPct), net: netValue(a, rates, now, ipca), ...mtm(a) });
      }
    } catch (e) { errors.push(`CDI: ${msg(e)}`); }
  }
  let cash: CashDividend[] = [];
  const qs = await stocksP;
  p.stocks.forEach((s, i) => {
    const r = qs[i];
    if (r.status === 'rejected') { errors.push(msg(r.reason)); return; }
    const q = r.value, v = q.price * s.quantity; cash = cash.concat(q.dividends);
    items.push({ name: s.ticker.toUpperCase(), category: s.ticker.endsWith('11') ? 'fii' : 'acao', invested: s.averagePrice != null ? s.averagePrice * s.quantity : null, current: v, dayChange: chg(v, q.changePct), net: null, unitPrice: q.price, avgPrice: s.averagePrice ?? null });
  });
  if (p.crypto.length) {
    try {
      const px = await cryptoP!;
      for (const c of p.crypto) {
        const q = px[c.coinId]; if (!q) { errors.push(`${c.symbol}: sem preço`); continue; }
        const v = q.price * c.quantity;
        items.push({ name: c.symbol, category: 'cripto', invested: c.averagePriceBRL != null ? c.averagePriceBRL * c.quantity : null, current: v, dayChange: chg(v, q.change24h), net: null, unitPrice: q.price, avgPrice: c.averagePriceBRL ?? null });
      }
    } catch (e) { errors.push(`cripto: ${msg(e)}`); }
  }
  let fx: USDQuote | null = null;
  try { fx = await usdP; } catch (e) { if (p.usd) errors.push(msg(e)); }
  if (p.usd && p.usd.amount > 0 && fx) items.push(usdItem(p.usd, fx));
  // Favoritos: cotação sem entrar no total; falha de um favorito não vira erro da carteira.
  let watch: WatchRow[] | undefined;
  if (p.watchlist?.length) {
    const have: Record<string, { price: number; dayPct: number | null }> = {};
    for (const i of items) if (i.unitPrice != null) have[i.name.toUpperCase()] = { price: i.unitPrice, dayPct: i.dayChange != null && i.current - i.dayChange > 0 ? (i.dayChange / (i.current - i.dayChange)) * 100 : null };
    const wq = await Promise.allSettled(p.watchlist.map(w => have[w.ticker.toUpperCase()] ? Promise.resolve(have[w.ticker.toUpperCase()]) : stockQuote(w.ticker, opts.brapiToken, f).then(q => ({ price: q.price, dayPct: q.changePct }))));
    watch = p.watchlist.map((w, i) => { const r = wq[i]; return watchRow(w, r.status === 'fulfilled' ? r.value : undefined); });
  }
  return { watch, items, cdiAnnual, updatedAt: now, errors, dividends: summary(p.stocks, cash, p.manualDividends ?? [], now), cash, usdBRL: fx?.bid ?? null, usdChangePct: fx?.changePct ?? null };
}

export const USD_ITEM = 'Dólar';
export function usdItem(u: { amount: number; averageRateBRL?: number | null }, q: USDQuote): LineItem {
  const v = q.bid * u.amount;
  return { name: USD_ITEM, category: 'dolar', invested: u.averageRateBRL != null ? u.averageRateBRL * u.amount : null, current: v, dayChange: chg(v, q.changePct), net: null, unitPrice: q.bid, avgPrice: u.averageRateBRL ?? null, quantity: u.amount };
}

/** Resultado em R$ de um item (atual − investido); null sem preço médio. */
export const itemGain = (i: Pick<LineItem, 'current' | 'invested'>) => (i.invested != null ? i.current - i.invested : null);
