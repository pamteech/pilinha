import { parseISO, toISO } from './dates';
import { BROWSER_UA, Fetcher, defaultFetcher } from './quotes';
/**
 * Fechamento do dólar comercial (à vista, interbancário) no Brasil.
 * O mercado à vista negocia das 9h às 17h de Brasília; o "dólar fechou" das notícias (Reuters, InfoMoney, Valor) é o preço das 17h.
 * O dólar futuro da B3 vai até 18h e a AwesomeAPI segue cotando depois das 17h (mercado externo), com variação contra o último preço
 * dela na véspera (fim da noite), não contra o fechamento: por isso o aviso não usa a cotação "agora".
 * Tudo em horário de Brasília (UTC−3 fixo, sem horário de verão desde 2019), independente do fuso do aparelho.
 */
export const USD_CLOSE_HOUR = 17, USD_CLOSE_MINUTE = 0;
/** Lembrete local: 5 min depois do fechamento, quando a fonte já tem o preço das 17h. */
export const USD_REMINDER_HOUR = 17, USD_REMINDER_MINUTE = 5;
const DAY = 86_400_000, H = 3_600_000;

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), como AAAA-MM-DD. */
export function easterISO(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const shift = (iso: string, days: number) => toISO(new Date(parseISO(iso)!.getTime() + days * DAY));
const holidayCache = new Map<number, Set<string>>();
/**
 * Dias sem sessão de câmbio no ano: feriados nacionais (calendário ANBIMA, com a Consciência Negra desde 2024),
 * Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi e 31/12 (sem expediente bancário).
 */
export function fxHolidays(year: number): Set<string> {
  let s = holidayCache.get(year); if (s) return s;
  const fixed = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25', '12-31', ...(year >= 2024 ? ['11-20'] : [])];
  const e = easterISO(year);
  s = new Set([...fixed.map(md => `${year}-${md}`), shift(e, -48), shift(e, -47), shift(e, -2), shift(e, 60)]);
  holidayCache.set(year, s); return s;
}
/** Dia (AAAA-MM-DD) com sessão de câmbio: segunda a sexta, fora dos feriados. */
export function isFxBusinessDay(iso: string): boolean {
  const d = parseISO(iso); if (!d) return false;
  const w = new Date(d.getTime() - 3 * H).getUTCDay(); // meia-noite de Brasília → dia da semana de Brasília
  return w >= 1 && w <= 5 && !fxHolidays(+iso.slice(0, 4)).has(iso.slice(0, 10));
}
/** Dia útil de câmbio anterior a `iso`. */
export function prevFxBusinessDay(iso: string): string {
  let d = shift(iso, -1); for (let i = 0; i < 15 && !isFxBusinessDay(d); i++) d = shift(d, -1); return d;
}
/** Instante do fechamento (17h de Brasília) do dia. */
export const usdCloseTime = (day: string) => new Date(parseISO(day)!.getTime() + (USD_CLOSE_HOUR * 60 + USD_CLOSE_MINUTE) * 60_000);

/** Série intradiária do dólar (Yahoo Finance, BRL=X, barras de 5 min, 5 dias): dá o preço das 17h de hoje e da véspera. */
export const usdIntradayURL = (host = 'query1') => `https://${host}.finance.yahoo.com/v8/finance/chart/BRL=X?interval=5m&range=5d`;
export interface UsdClose { day: string; close: number; prevDay: string; prevClose: number; changePct: number; source: string }
type Pt = { t: number; v: number | null };
const pointsOf = (json: any): Pt[] => {
  const r = json?.chart?.result?.[0], ts = r?.timestamp, cl = r?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(cl)) return [];
  return ts.map((t: unknown, i: number) => ({ t: Number(t) * 1000, v: typeof cl[i] === 'number' && Number.isFinite(cl[i]) && cl[i] > 0 ? cl[i] : null }))
    .filter((p: Pt) => Number.isFinite(p.t)).sort((a: Pt, b: Pt) => a.t - b.t);
};
/**
 * Preço de fechamento do dia: o último preço da série antes das 17h (a barra que começa 16h55 fecha às 17h).
 * Só vale quando o dia é útil, há preço nos 30 min antes das 17h e a série já passou das 17h (senão a barra das 16h55 ainda pode mudar).
 */
export function closeAt(points: Pt[], day: string): number | null {
  if (!isFxBusinessDay(day)) return null;
  const end = usdCloseTime(day).getTime(), start = end - 8 * H;
  if (!points.some(p => p.t >= end)) return null; // a fonte ainda não chegou às 17h: espera
  let last: Pt | null = null;
  for (const p of points) if (p.t >= start && p.t < end && p.v != null) last = p;
  return last && last.t >= end - 30 * 60_000 ? last.v : null;
}
/** Fechamento do dia `day` e variação contra o fechamento do dia útil anterior; null se a fonte ainda não tem os dois. */
export function parseUsdClose(json: any, day: string): UsdClose | null {
  const pts = pointsOf(json); if (!pts.length) return null;
  const close = closeAt(pts, day); if (close == null) return null;
  const prevDay = prevFxBusinessDay(day), prevClose = closeAt(pts, prevDay); if (prevClose == null) return null;
  const changePct = (close / prevClose - 1) * 100;
  if (!Number.isFinite(changePct) || Math.abs(changePct) > 15) return null; // dado quebrado
  return { day, close, prevDay, prevClose, changePct: Math.round(changePct * 10000) / 10000, source: 'Yahoo BRL=X 17h' };
}
/** Busca o fechamento do dia (dois hosts do Yahoo). null = ainda não disponível ou fonte fora: o aviso tenta de novo depois. */
export async function usdCloseQuote(day: string, f: Fetcher = defaultFetcher): Promise<UsdClose | null> {
  for (const host of ['query1', 'query2']) {
    try { const c = parseUsdClose(await f(usdIntradayURL(host), { 'User-Agent': BROWSER_UA }), day); if (c) return c; } catch {}
  }
  return null;
}
