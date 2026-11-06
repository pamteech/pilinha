import { NewsItem, UsdDirection, parseRSS, pickUsdNews, usdNewsURL } from '../core';
// Manchete do dólar (Google Notícias, busca fixa). Cache de 20 min: o refresh de 5 min não repete a consulta.
const TTL = 20 * 60_000;
let cache: { at: number; items: NewsItem[] } | null = null;
export async function fetchUsdNews(dir: UsdDirection, now = new Date()): Promise<NewsItem | null> {
  if (!cache || now.getTime() - cache.at > TTL) {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(usdNewsURL(), { headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: ctl.signal });
      if (!r.ok) return null;
      cache = { at: now.getTime(), items: parseRSS(await r.text()) };
    } catch { return null; } finally { clearTimeout(tm); }
  }
  return pickUsdNews(cache.items, dir, now);
}
export const resetNewsCache = () => { cache = null; };
