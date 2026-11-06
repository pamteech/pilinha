import { toISO } from './dates';
import { brl, pct } from './format';
import { normTicker, validTicker } from './numbers';
/** Alertas valem para qualquer ação/FII da B3 (mesmo fora da carteira), para o dólar (USD) e o bitcoin (BTC). */
export const USD_TICKER = 'USD', BTC_TICKER = 'BTC';
export const alertAssetName = (t: string) => { const u = t.toUpperCase(); return u === USD_TICKER ? 'Dólar' : u === BTC_TICKER ? 'Bitcoin' : u; };
export const validAlertTicker = (t: string) => { const u = normTicker(t); return u === USD_TICKER || u === BTC_TICKER || validTicker(u); };
export type AlertKind = 'above' | 'below' | 'dropPct' | 'risePct';
export interface PriceAlert { id: string; ticker: string; kind: AlertKind; value: number; enabled: boolean }
export interface QuoteLite { price: number | null; dayPct: number | null }
/** id do alerta -> dia (AAAA-MM-DD, Brasília) em que já disparou. Um aviso por alerta por dia. */
export type FiredLog = Record<string, string>;
export const alertLabel = (a: PriceAlert) => {
  const n = alertAssetName(a.ticker);
  return a.kind === 'above' ? `${n} acima de ${brl(a.value)}` : a.kind === 'below' ? `${n} abaixo de ${brl(a.value)}` : a.kind === 'risePct' ? `${n} subindo ${String(a.value).replace('.', ',')}% no dia` : `${n} caindo ${String(a.value).replace('.', ',')}% no dia`;
};
/** Tickers de alertas ligados que ainda não têm cotação (ativos fora da carteira: buscar à parte). */
export const missingAlertTickers = (alerts: PriceAlert[], quotes: Record<string, QuoteLite>) => [...new Set(alerts.filter(a => a.enabled).map(a => a.ticker.toUpperCase()))].filter(t => !quotes[t]);
export function triggered(a: PriceAlert, q: QuoteLite | undefined): boolean {
  if (!a.enabled || !q || !(a.value > 0)) return false;
  if (a.kind === 'above') return q.price != null && q.price >= a.value;
  if (a.kind === 'below') return q.price != null && q.price <= a.value;
  if (a.kind === 'risePct') return q.dayPct != null && q.dayPct >= a.value;
  return q.dayPct != null && q.dayPct <= -a.value;
}
export function evaluateAlerts(alerts: PriceAlert[], quotes: Record<string, QuoteLite>, fired: FiredLog, now: Date = new Date()) {
  const day = toISO(now), next: FiredLog = {}, toFire: { alert: PriceAlert; title: string; body: string }[] = [];
  for (const a of alerts) {
    if (fired[a.id]) next[a.id] = fired[a.id];
    const q = quotes[a.ticker.toUpperCase()];
    if (fired[a.id] === day || !triggered(a, q)) continue;
    next[a.id] = day;
    const body = a.kind === 'dropPct' || a.kind === 'risePct' ? `Hoje ${pct(q!.dayPct)} · cotação ${q!.price != null ? brl(q!.price) : '—'}` : `Cotação agora: ${brl(q!.price!)}`;
    toFire.push({ alert: a, title: a.id.startsWith('w:') ? `${alertAssetName(a.ticker)} chegou no seu preço` : alertLabel(a), body: a.id.startsWith('w:') ? `Favorito: alvo ${brl(a.value)} · ${body}` : body });
  }
  return { toFire, fired: next };
}
export const newAlertId = (now = Date.now()) => `a${now.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
/** Favoritos viram alertas 'abaixo de' automáticos (id estável por ticker+alvo, um aviso por dia). */
export const watchAlerts = (wl: { ticker: string; targetPrice: number }[] | undefined): PriceAlert[] =>
  (wl ?? []).map(w => ({ id: `w:${w.ticker.toUpperCase()}:${w.targetPrice}`, ticker: w.ticker.toUpperCase(), kind: 'below' as const, value: w.targetPrice, enabled: true }));
