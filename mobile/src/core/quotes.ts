import { CDIDailyRate } from './cdi';
import { parseBR, toBR } from './dates';
import { CashDividend, parseBrapiDividends } from './dividends';
// Só códigos públicos (tickers, ids de moeda, datas) saem do aparelho; nada da carteira.
export type Fetcher = (url: string, headers?: Record<string, string>) => Promise<any>;
export const defaultFetcher: Fetcher = async (url, headers = {}) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: ctl.signal });
    const txt = await r.text();
    try { return JSON.parse(txt); } catch { throw new Error(`resposta inválida (HTTP ${r.status})`); }
  } finally { clearTimeout(t); }
};
const clean = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const bcbURL = (start: Date, end: Date) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados?formato=json&dataInicial=${toBR(start)}&dataFinal=${toBR(end)}`;
export function parseBCB(json: any): CDIDailyRate[] {
  if (!Array.isArray(json)) throw new Error('CDI: resposta inválida do BCB');
  return json.flatMap((r: any) => { const d = parseBR(r.data), v = parseFloat(r.valor); return d && !isNaN(v) ? [{ date: d, percent: v }] : []; });
}
export const cdiRates = async (start: Date, end: Date, f: Fetcher = defaultFetcher) => parseBCB(await f(bcbURL(start, end)));

export interface Quote { price: number; changePct: number | null; dividends: CashDividend[]; source: 'brapi' | 'yahoo' }

export const brapiURL = (t: string, dividends = false) => `https://brapi.dev/api/quote/${clean(t)}${dividends ? '?dividends=true' : ''}`;
export function parseBrapi(json: any, ticker: string, withDiv: boolean) {
  if (json?.error) throw new Error(`${ticker}: ${json.message ?? 'erro brapi'} (cadastre o token da brapi)`);
  const q = json?.results?.[0];
  if (typeof q?.regularMarketPrice !== 'number') throw new Error(`${ticker}: brapi sem preço`);
  return { price: q.regularMarketPrice as number, changePct: (q.regularMarketChangePercent ?? null) as number | null, dividends: withDiv ? parseBrapiDividends(json) : [] };
}

// UA curto: o Yahoo devolve 429 para alguns UAs completos de navegador.
export const BROWSER_UA = 'Mozilla/5.0';
export const yahooURL = (t: string, host = 'query1') => `https://${host}.finance.yahoo.com/v8/finance/chart/${clean(t)}.SA?range=1d&interval=1d`;
export function parseYahoo(json: any, ticker: string): { price: number; changePct: number | null } {
  const c = json?.chart;
  if (!c) throw new Error(`${ticker}: resposta inválida do Yahoo`);
  if (c.error) throw new Error(`${ticker}: ${c.error.description ?? c.error.code ?? 'erro Yahoo'}`);
  const m = c.result?.[0]?.meta;
  if (typeof m?.regularMarketPrice !== 'number') throw new Error(`${ticker}: Yahoo sem preço`);
  const prev = m.chartPreviousClose ?? m.previousClose;
  return { price: m.regularMarketPrice, changePct: prev > 0 ? (m.regularMarketPrice / prev - 1) * 100 : null };
}

/** query1 e, se der erro (ex. HTTP 429), query2. */
export async function yahooQuote(ticker: string, f: Fetcher = defaultFetcher) {
  try { return parseYahoo(await f(yahooURL(ticker), { 'User-Agent': BROWSER_UA }), ticker); }
  catch { return parseYahoo(await f(yahooURL(ticker, 'query2'), { 'User-Agent': BROWSER_UA }), ticker); }
}

/** Com token: brapi (com proventos), caindo no Yahoo. Sem token: Yahoo direto. */
export async function stockQuote(ticker: string, token: string | null | undefined, f: Fetcher = defaultFetcher): Promise<Quote> {
  let brapiErr: unknown;
  if (token) {
    try { return { ...parseBrapi(await f(brapiURL(ticker, true), { Authorization: `Bearer ${token}` }), ticker, true), source: 'brapi' }; }
    catch (e) { brapiErr = e; }
  }
  try { return { ...(await yahooQuote(ticker, f)), dividends: [], source: 'yahoo' }; }
  catch (e) {
    const msg = (x: unknown) => (x instanceof Error ? x.message : String(x));
    if (brapiErr) throw new Error(`${ticker}: sem cotação (brapi: ${msg(brapiErr)}; Yahoo: ${msg(e)})`);
    throw new Error(`${ticker}: sem cotação no Yahoo Finance (${msg(e)}). Confira o código ou cadastre o token da brapi.`);
  }
}

export const geckoURL = (ids: string[]) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(i => i.toLowerCase().replace(/[^a-z0-9-]/g, '')).join(',')}&vs_currencies=brl&include_24hr_change=true`;
export async function cryptoBRL(ids: string[], f: Fetcher = defaultFetcher) {
  const j = await f(geckoURL(ids)); const out: Record<string, { price: number; change24h: number | null }> = {};
  for (const [k, v] of Object.entries<any>(j ?? {})) if (typeof v?.brl === 'number') out[k] = { price: v.brl, change24h: v.brl_24h_change ?? null };
  return out;
}

/** Selic meta (% a.a.), série 432 do BCB: último valor. */
export const selicURL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json';
export async function selicAnnual(f: Fetcher = defaultFetcher): Promise<number> {
  const j = await f(selicURL); const v = parseFloat(j?.[0]?.valor);
  if (!isFinite(v)) throw new Error('Selic indisponível'); return v;
}
/** TR mensal (% a.m.), série 226 do BCB: último valor (null se indisponível). */
export const trURL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.226/dados/ultimos/1?formato=json';
export async function trMonthly(f: Fetcher = defaultFetcher): Promise<number | null> {
  try { const j = await f(trURL); const v = parseFloat(j?.[0]?.valor); return isFinite(v) ? v : null; } catch { return null; }
}
