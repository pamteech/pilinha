import { Portfolio, FixedIncomeKind } from './types';
import { parseISO } from './dates';
import { validWatch } from './watchlist';
// Mesmo formato do ~/.notchinvest/portfolio.json do app do Mac (campos extras são preservados).
const kinds: FixedIncomeKind[] = ['caixinha', 'cdb', 'tesouro', 'lci', 'lca'];
const isNum = (x: unknown): x is number => typeof x === 'number' && isFinite(x);
export function parsePortfolio(text: string): Portfolio {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error('O arquivo não é um JSON válido.'); }
  if (!j || typeof j !== 'object') throw new Error('Arquivo sem carteira.');
  const fixedIncome = (j.fixedIncome ?? []).map((a: any, i: number) => {
    if (typeof a?.name !== 'string' || !kinds.includes(a.kind) || !isNum(a.cdiPercent) || (a.indexer === 'ipca' ? a.cdiPercent < 0 || (a.realRate != null && !isNum(a.realRate)) : a.cdiPercent <= 0) || !Array.isArray(a.deposits)) throw new Error(`Renda fixa nº ${i + 1} inválida.`);
    for (const d of a.deposits) if (!parseISO(String(d?.date)) || !isNum(d?.amount) || d.amount <= 0) throw new Error(`Aporte inválido em "${a.name}".`);
    // Campos novos do Tesouro nunca impedem a carteira de abrir: tipo desconhecido é ignorado
    // (o título segue como % do CDI, como sempre foi) e prefixado sem taxa válida vira Selic/CDI.
    if (a.treasuryType != null && !['selic', 'prefixado', 'ipca'].includes(a.treasuryType)) { const { treasuryType: _t, ...r } = a; a = r; }
    if (a.fixedRate != null && (!isNum(a.fixedRate) || a.fixedRate < 0 || a.fixedRate > 50)) { const { fixedRate: _f, ...r } = a; a = r; }
    return a;
  });
  // Ticker em maiúsculas, quantidade > 0 e sem repetidos (o repetido somava duas vezes e quebrava a lista).
  const seen = new Map<string, any>();
  for (const s of j.stocks ?? []) {
    if (typeof s?.ticker !== 'string' || !isNum(s.quantity) || s.quantity <= 0) throw new Error(`Ação inválida${typeof s?.ticker === 'string' ? ` (${s.ticker})` : ''}.`);
    if (s.averagePrice != null && (!isNum(s.averagePrice) || s.averagePrice < 0)) throw new Error(`Preço médio inválido em ${s.ticker}.`);
    const t = s.ticker.trim().toUpperCase(), prev = seen.get(t);
    if (prev) {
      const q = prev.quantity + s.quantity;
      const avg = prev.averagePrice != null && s.averagePrice != null ? (prev.averagePrice * prev.quantity + s.averagePrice * s.quantity) / q : prev.averagePrice ?? s.averagePrice;
      seen.set(t, { ...prev, quantity: q, averagePrice: avg });
    } else seen.set(t, { ...s, ticker: t });
  }
  const stocks = [...seen.values()];
  const crypto = (j.crypto ?? []).map((c: any) => { if (typeof c?.coinId !== 'string' || typeof c?.symbol !== 'string' || !isNum(c.quantity) || c.quantity <= 0) throw new Error('Cripto inválida.'); return c; });
  const manualDividends = (j.manualDividends ?? []).map((m: any) => { if (typeof m?.ticker !== 'string' || !parseISO(String(m.date)) || !isNum(m.amount)) throw new Error('Provento inválido.'); return { ...m, ticker: m.ticker.trim().toUpperCase() }; });
  let usd = j.usd ?? null;
  if (usd != null) {
    if (!isNum(usd.amount) || usd.amount < 0 || (usd.averageRateBRL != null && (!isNum(usd.averageRateBRL) || usd.averageRateBRL <= 0))) throw new Error('Dólar inválido.');
    usd = { amount: usd.amount, ...(usd.averageRateBRL != null ? { averageRateBRL: usd.averageRateBRL } : {}) };
  }
  // Favoritos: itens inválidos são descartados (nunca impedem a carteira de abrir).
  const wl = Array.isArray(j.watchlist) ? j.watchlist.filter(validWatch).map((w: any) => ({ ...w, ticker: w.ticker.trim().toUpperCase() })) : undefined;
  const { watchlist: _w, ...rest } = j;
  return { ...rest, fixedIncome, stocks, crypto, manualDividends, ...(usd ? { usd } : {}), ...(wl && wl.length ? { watchlist: wl } : {}) };
}
/**
 * Junta a carteira do Mac na do iPhone sem duplicar: o Mac manda nos itens que tem
 * (mesmo ticker, mesma cripto, mesma renda fixa pelo nome); o que só existe no iPhone fica.
 * Proventos iguais (ticker+data+valor) não repetem.
 */
export function mergePortfolio(phone: Portfolio, mac: Portfolio): Portfolio {
  const key = (s: string) => s.trim().toLowerCase();
  const byKey = <T,>(base: T[], incoming: T[], k: (x: T) => string) => {
    const inc = new Set(incoming.map(k));
    return [...base.filter(x => !inc.has(k(x))), ...incoming];
  };
  const dv = (d: { ticker: string; date: string; amount: number }) => `${d.ticker.toUpperCase()}|${d.date}|${Math.round(d.amount * 100)}`;
  const seen = new Set<string>(); const manualDividends = [...(phone.manualDividends ?? []), ...(mac.manualDividends ?? [])].filter(d => { const k = dv(d); if (seen.has(k)) return false; seen.add(k); return true; });
  return {
    ...phone, ...mac,
    fixedIncome: byKey(phone.fixedIncome, mac.fixedIncome, a => key(a.name)),
    stocks: byKey(phone.stocks, mac.stocks, s => key(s.ticker)),
    crypto: byKey(phone.crypto, mac.crypto, c => key(c.coinId)),
    manualDividends,
    ...(phone.watchlist || mac.watchlist ? { watchlist: byKey(phone.watchlist ?? [], mac.watchlist ?? [], w => key(w.ticker)) } : {}),
  };
}
/** JSON com chaves ordenadas: compara itens sem depender da ordem em que o Mac ou o iPhone gravaram. */
export const canon = (x: unknown): string | undefined =>
  JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o: any, k) => { o[k] = v[k]; return o; }, {}) : v));
/**
 * Sincronização contínua com o Mac (a cada abertura, 5 min, "Buscar agora"). Junta o que o Mac acabou de mandar (`mac`)
 * na carteira do iPhone (`phone`) sabendo o que o Mac tinha mandado da última vez (`base`). Por item (mesma chave do mergePortfolio):
 *  - o Mac mudou o item desde a última vez, ou ele é novo lá → vale o do Mac;
 *  - o Mac não mudou → vale o do iPhone: editado aqui (ex. VIVT3 de 5 para 10 cotas, US$ 1.500), igual ou removido aqui.
 * Antes o Mac vencia sempre, então o que era alterado no celular voltava ao valor antigo no próximo sync.
 * Sem `base` (primeira sincronização) é o mergePortfolio de sempre. Nunca apaga o que só existe no iPhone.
 */
export function mergeFromMac(phone: Portfolio, mac: Portfolio, base: Portfolio | null | undefined): Portfolio {
  if (!base) return mergePortfolio(phone, mac);
  const key = (s: string) => s.trim().toLowerCase();
  const list = <T,>(ph: T[], mc: T[], bs: T[], k: (x: T) => string): T[] => {
    const was = new Map(bs.map(x => [k(x), canon(x)]));
    const changed = mc.filter(x => was.get(k(x)) !== canon(x)); // novo no Mac ou mudado lá
    const ck = new Set(changed.map(k));
    return [...ph.filter(x => !ck.has(k(x))), ...changed];
  };
  const dv = (d: { ticker: string; date: string; amount: number }) => `${d.ticker.toUpperCase()}|${d.date}|${Math.round(d.amount * 100)}`;
  const dvSet = (xs: { ticker: string; date: string; amount: number }[] | undefined) => (xs ?? []).map(dv).sort().join('\n');
  let manualDividends = phone.manualDividends ?? [];
  if (dvSet(mac.manualDividends) !== dvSet(base.manualDividends)) {
    const seen = new Set<string>();
    manualDividends = [...manualDividends, ...(mac.manualDividends ?? [])].filter(d => { const k = dv(d); if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // Campos soltos (usd, owner, tradingview…): o do Mac só entra se mudou lá; se o Mac apagou, o do iPhone fica.
  const LISTS = new Set(['fixedIncome', 'stocks', 'crypto', 'manualDividends', 'watchlist']);
  const out: any = { ...phone };
  for (const k of Object.keys(mac)) if (!LISTS.has(k) && canon((mac as any)[k]) !== canon((base as any)[k])) out[k] = (mac as any)[k];
  out.fixedIncome = list(phone.fixedIncome, mac.fixedIncome, base.fixedIncome, a => key(a.name));
  out.stocks = list(phone.stocks, mac.stocks, base.stocks, s => key(s.ticker));
  out.crypto = list(phone.crypto, mac.crypto, base.crypto, c => key(c.coinId));
  out.manualDividends = manualDividends;
  const wl = list(phone.watchlist ?? [], mac.watchlist ?? [], base.watchlist ?? [], w => key(w.ticker));
  if (wl.length) out.watchlist = wl; else delete out.watchlist;
  return out as Portfolio;
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
