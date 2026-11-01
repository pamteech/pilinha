/** Favoritos: ações que ela pretende comprar, com o preço desejado e (opcional) quanto quer investir. */
export interface WatchItem { ticker: string; targetPrice: number; amount?: number }
export interface WatchRow { ticker: string; targetPrice: number; amount: number | null; price: number | null; dayPct: number | null; distancePct: number | null; reached: boolean; shares: number | null }
/** distancePct > 0 = quanto ainda precisa cair até o alvo. reached = cotação <= alvo. */
export function watchRow(w: WatchItem, q?: { price: number | null; dayPct: number | null }): WatchRow {
  const price = q?.price ?? null;
  const distancePct = price != null && w.targetPrice > 0 ? (price / w.targetPrice - 1) * 100 : null;
  const ref = price != null ? Math.min(price, w.targetPrice) : w.targetPrice;
  return { ticker: w.ticker.toUpperCase(), targetPrice: w.targetPrice, amount: w.amount ?? null, price, dayPct: q?.dayPct ?? null, distancePct,
    reached: price != null && price <= w.targetPrice, shares: w.amount && ref > 0 ? Math.floor(w.amount / ref) : null };
}
export const validWatch = (w: any): w is WatchItem => typeof w?.ticker === 'string' && typeof w.targetPrice === 'number' && isFinite(w.targetPrice) && w.targetPrice > 0 && (w.amount == null || (typeof w.amount === 'number' && isFinite(w.amount) && w.amount >= 0));
