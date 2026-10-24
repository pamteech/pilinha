import { Portfolio, FixedIncomeKind } from './types';
import { parseISO } from './dates';
// Mesmo formato do ~/.notchinvest/portfolio.json do app do Mac (campos extras são preservados).
const kinds: FixedIncomeKind[] = ['caixinha', 'cdb', 'tesouro', 'lci', 'lca'];
const isNum = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
export function parsePortfolio(text: string): Portfolio {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  if (!j || typeof j !== 'object') throw new Error('Arquivo sem carteira.');
  const fixedIncome = (j.fixedIncome ?? []).map((a: any, i: number) => {
    if (typeof a?.name !== 'string' || !kinds.includes(a.kind) || !isNum(a.cdiPercent) || !Array.isArray(a.deposits)) throw new Error(`Renda fixa nº ${i + 1} inválida.`);
    for (const d of a.deposits) if (!parseISO(String(d?.date)) || !isNum(d?.amount)) throw new Error(`Aporte inválido em "${a.name}".`);
    return a;
  });
  const stocks = (j.stocks ?? []).map((s: any) => { if (typeof s?.ticker !== 'string' || !isNum(s.quantity)) throw new Error('Ação inválida.'); return s; });
  const crypto = (j.crypto ?? []).map((c: any) => { if (typeof c?.coinId !== 'string' || typeof c?.symbol !== 'string' || !isNum(c.quantity)) throw new Error('Cripto inválida.'); return c; });
  const manualDividends = (j.manualDividends ?? []).map((m: any) => { if (typeof m?.ticker !== 'string' || !parseISO(String(m.date)) || !isNum(m.amount)) throw new Error('Provento inválido.'); return m; });
  return { ...j, fixedIncome, stocks, crypto, manualDividends };
}
export const serializePortfolio = (p: Portfolio) => JSON.stringify(p, null, 2);

export const tradingViewSymbol = (ticker: string, tv?: any) =>
  tv?.symbols?.[ticker.toUpperCase()] ?? (ticker.toLowerCase() === 'bitcoin' || ticker.toUpperCase() === 'BTC' ? 'BINANCE:BTCBRL' : `BMFBOVESPA:${ticker.toUpperCase()}`);
export const tradingViewURL = (symbol: string) => `https://br.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
export function isTradingViewURL(u: string) {
  try { const x = new URL(u); return x.protocol === 'https:' && (x.hostname === 'tradingview.com' || x.hostname.endsWith('.tradingview.com')); } catch { return false; }
}

/** Resumo para widget e Live Activity. No modo discreto não vai nenhum valor em R$. */
export interface WidgetSummary { total: number | null; dayChange: number | null; dayChangePct: number | null; mood: string; hidden: boolean; updatedAt: number }
export const widgetSummary = (total: number, dayChange: number, dayChangePct: number | null, mood: string, hidden: boolean, now = new Date()): WidgetSummary =>
  ({ total: hidden ? null : total, dayChange: hidden ? null : dayChange, dayChangePct, mood, hidden, updatedAt: Math.floor(now.getTime() / 1000) });

/** Pregão da B3 (aprox.): seg–sex, 10h–18h de Brasília. */
export function isTradingHours(now = new Date()) {
  const b = new Date(now.getTime() - 3 * 3600_000); const d = b.getUTCDay(), h = b.getUTCHours();
  return d >= 1 && d <= 5 && h >= 10 && h < 18;
}
