import { CDIDailyRate } from './cdi';
import { toISO } from './dates';
import { Snapshot } from './engine';
// Abertura rápida: último snapshot guardado e séries do BCB cacheadas por dia.
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const serializeSnapshot = (s: Snapshot) => JSON.stringify(s);
export function reviveSnapshot(txt: string | null): Snapshot | null {
  if (!txt) return null;
  try {
    const s = JSON.parse(txt, (_k, v) => (typeof v === 'string' && ISO_TS.test(v) ? new Date(v) : v));
    return s && Array.isArray(s.items) && s.updatedAt instanceof Date ? s : null;
  } catch { return null; }
}
export interface KV { get(k: string): Promise<string | null>; set(k: string, v: string): Promise<void> }
interface SeriesCache { start: string; day: string; rates: { date: string; percent: number }[] }
/** CDI com cache: no mesmo dia reaproveita; em outro dia baixa só o trecho novo; sem internet usa o antigo. */
export async function cachedCdiRates(start: Date, now: Date, kv: KV, fetchRange: (a: Date, b: Date) => Promise<CDIDailyRate[]>, key = 'pilinha.cdi.v1'): Promise<CDIDailyRate[]> {
  let c: SeriesCache | null = null;
  try { c = JSON.parse((await kv.get(key)) ?? 'null'); } catch {}
  const revive = (x: SeriesCache) => x.rates.map(r => ({ date: new Date(r.date), percent: r.percent })).filter(r => r.date >= start);
  const today = toISO(now), covers = !!c && c.start <= toISO(start);
  if (c && covers && c.day === today) return revive(c);
  try {
    let rates: CDIDailyRate[];
    if (c && covers && c.rates.length) {
      const last = new Date(c.rates[c.rates.length - 1].date);
      const extra = (await fetchRange(last, now)).filter(r => r.date > last);
      rates = [...c.rates.map(r => ({ date: new Date(r.date), percent: r.percent })), ...extra];
    } else rates = await fetchRange(start, now);
    const startISO = c && covers ? c.start : toISO(start);
    await kv.set(key, JSON.stringify({ start: startISO, day: today, rates: rates.map(r => ({ date: r.date.toISOString(), percent: r.percent })) })).catch(() => {});
    return rates.filter(r => r.date >= start);
  } catch (e) { if (c && covers) return revive(c); throw e; }
}
/** Promise com prazo: rejeita depois de ms. */
export const withTimeout = <T,>(p: Promise<T>, ms: number, what = 'tempo esgotado'): Promise<T> =>
  new Promise((ok, no) => { const t = setTimeout(() => no(new Error(what)), ms); p.then(v => { clearTimeout(t); ok(v); }, e => { clearTimeout(t); no(e); }); });
