import { Portfolio } from './types';
import { parseISO } from './dates';
import { annualized, netValue, value } from './cdi';
import { cdiRates, cryptoBRL, defaultFetcher, Fetcher, stockQuote, usdQuote, USDQuote } from './quotes';
import { CashDividend, DividendSummary, summary } from './dividends';

export interface LineItem { name: string; category: string; invested: number | null; current: number; dayChange: number | null; net: number | null; unitPrice?: number | null; avgPrice?: number | null; quantity?: number | null }
export interface Snapshot { items: LineItem[]; cdiAnnual: number | null; updatedAt: Date; errors: string[]; dividends: DividendSummary; cash?: CashDividend[]; usdBRL?: number | null; usdChangePct?: number | null }
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

export async function snapshot(p: Portfolio, opts: { brapiToken?: string | null; now?: Date; fetcher?: Fetcher } = {}): Promise<Snapshot> {
  const now = opts.now ?? new Date(), f = opts.fetcher ?? defaultFetcher;
  const items: LineItem[] = [], errors: string[] = []; let cdiAnnual: number | null = null;
  const dates = p.fixedIncome.flatMap(a => a.deposits).map(d => parseISO(d.date)).filter((d): d is Date => !!d);
  if (dates.length) {
    try {
      // Aporte com data futura não pode virar início da consulta (o BCB recusa e some toda a renda fixa).
      const rates = await cdiRates(new Date(Math.min(now.getTime(), ...dates.map(d => d.getTime()))), now, f);
      const last = rates[rates.length - 1];
      cdiAnnual = last ? annualized(last.percent) : null;
      for (const a of p.fixedIncome) {
        const v = value(a, rates, now), lastPct = ((last?.percent ?? 0) / 100) * (a.cdiPercent / 100);
        items.push({ name: a.name, category: a.kind, invested: v.invested, current: v.gross, dayChange: v.gross - v.gross / (1 + lastPct), net: netValue(a, rates, now) });
      }
    } catch (e) { errors.push(`CDI: ${msg(e)}`); }
  }
  let cash: CashDividend[] = [];
  const qs = await Promise.allSettled(p.stocks.map(s => stockQuote(s.ticker, opts.brapiToken, f)));
  p.stocks.forEach((s, i) => {
    const r = qs[i];
    if (r.status === 'rejected') { errors.push(msg(r.reason)); return; }
    const q = r.value, v = q.price * s.quantity; cash = cash.concat(q.dividends);
    items.push({ name: s.ticker.toUpperCase(), category: s.ticker.endsWith('11') ? 'fii' : 'acao', invested: s.averagePrice != null ? s.averagePrice * s.quantity : null, current: v, dayChange: chg(v, q.changePct), net: null, unitPrice: q.price, avgPrice: s.averagePrice ?? null });
  });
  if (p.crypto.length) {
    try {
      const px = await cryptoBRL(p.crypto.map(c => c.coinId), f);
      for (const c of p.crypto) {
        const q = px[c.coinId]; if (!q) { errors.push(`${c.symbol}: sem preço`); continue; }
        const v = q.price * c.quantity;
        items.push({ name: c.symbol, category: 'cripto', invested: c.averagePriceBRL != null ? c.averagePriceBRL * c.quantity : null, current: v, dayChange: chg(v, q.change24h), net: null, unitPrice: q.price, avgPrice: c.averagePriceBRL ?? null });
      }
    } catch (e) { errors.push(`cripto: ${msg(e)}`); }
  }
  let fx: USDQuote | null = null;
  try { fx = await usdQuote(f, now); } catch (e) { if (p.usd) errors.push(msg(e)); }
  if (p.usd && p.usd.amount > 0 && fx) items.push(usdItem(p.usd, fx));
  return { items, cdiAnnual, updatedAt: now, errors, dividends: summary(p.stocks, cash, p.manualDividends ?? [], now), cash, usdBRL: fx?.bid ?? null, usdChangePct: fx?.changePct ?? null };
}

export const USD_ITEM = 'Dólar';
export function usdItem(u: { amount: number; averageRateBRL?: number | null }, q: USDQuote): LineItem {
  const v = q.bid * u.amount;
  return { name: USD_ITEM, category: 'dolar', invested: u.averageRateBRL != null ? u.averageRateBRL * u.amount : null, current: v, dayChange: chg(v, q.changePct), net: null, unitPrice: q.bid, avgPrice: u.averageRateBRL ?? null, quantity: u.amount };
}
