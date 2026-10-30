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
export const ipcaURL = (start: Date, end: Date) =>
  `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=${toBR(new Date(start.getFullYear(), start.getMonth(), 1))}&dataFinal=${toBR(end)}`;
export function parseIPCA(json: any): { month: Date; percent: number }[] {
  if (!Array.isArray(json)) throw new Error('IPCA: resposta inválida do BCB');
  return json.flatMap((r: any) => { const d = parseBR(r.data), v = parseFloat(r.valor); return d && !isNaN(v) ? [{ month: d, percent: v }] : []; });
}
export const ipcaMonthly = async (start: Date, end: Date, f: Fetcher = defaultFetcher) => parseIPCA(await f(ipcaURL(start, end)));
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

/** Dólar: AwesomeAPI ao vivo; se falhar, PTAX de venda do BCB (últimos 10 dias). */
export const awesomeUSDURL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL';
const mdY = (d: Date) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d); const g = (t: string) => p.find(x => x.type === t)!.value; return `${g('month')}-${g('day')}-${g('year')}`; };
export const ptaxURL = (now: Date) => `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='${mdY(new Date(now.getTime() - 10 * 86400000))}'&@dataFinalCotacao='${mdY(now)}'&$format=json&$orderby=dataHoraCotacao%20desc&$top=1`;
export interface USDQuote { bid: number; changePct: number | null; source: string }
export function parseAwesomeUSD(j: any): USDQuote | null {
  const b = Number(j?.USDBRL?.bid); if (!(b > 0)) return null;
  const c = Number(j.USDBRL.pctChange); return { bid: b, changePct: Number.isFinite(c) ? c : null, source: 'AwesomeAPI' };
}
export function parsePTAX(j: any): USDQuote | null { const v = Number(j?.value?.[0]?.cotacaoVenda); return v > 0 ? { bid: v, changePct: null, source: 'PTAX/BCB' } : null; }
export async function usdQuote(f: Fetcher = defaultFetcher, now = new Date()): Promise<USDQuote> {
  try { const q = parseAwesomeUSD(await f(awesomeUSDURL)); if (q) return q; } catch {}
  const q = parsePTAX(await f(ptaxURL(now))); if (q) return q;
  throw new Error('dólar: sem cotação');
}
