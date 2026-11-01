import * as fs from 'fs'; import * as path from 'path';
import { cachedCdiRates, reviveSnapshot, serializeSnapshot, snapshot, emptyPortfolio, withTimeout, KV, parseISO } from '..';
// Abertura rápida com dados fictícios (nada da carteira real).
const mem = (): KV & { m: Record<string, string> } => { const m: Record<string, string> = {}; return { m, get: async k => m[k] ?? null, set: async (k, v) => { m[k] = v; } }; };
const r = (iso: string, p = 0.04) => ({ date: parseISO(iso)!, percent: p });
test('snapshot guardado volta com datas', () => {
  const s: any = { items: [{ name: 'XPTO3', category: 'acao', invested: 10, current: 12, dayChange: 1, net: null }], cdiAnnual: 10, updatedAt: new Date('2026-11-01T12:00:00Z'), errors: [], dividends: { last12m: 0 }, cash: [{ ticker: 'XPTO3', paymentDate: new Date('2026-12-01T03:00:00Z'), rate: 1 }] };
  const b = reviveSnapshot(serializeSnapshot(s))!;
  expect(b.updatedAt).toBeInstanceOf(Date); expect((b.cash![0] as any).paymentDate).toBeInstanceOf(Date); expect(b.items[0].current).toBe(12);
  expect(reviveSnapshot('lixo')).toBeNull(); expect(reviveSnapshot(null)).toBeNull();
});
test('CDI: mesmo dia não baixa de novo; outro dia baixa só o trecho novo; offline usa cache', async () => {
  const kv = mem(); const calls: string[] = [];
  const fetchR = async (a: Date, b: Date) => { calls.push(a.toISOString().slice(0, 10)); return [r('2026-10-01'), r('2026-10-02'), r('2026-10-30')].filter(x => x.date >= a && x.date <= b); };
  const start = parseISO('2026-10-01')!, d1 = new Date('2026-10-30T15:00:00Z'), d2 = new Date('2026-11-03T15:00:00Z');
  expect((await cachedCdiRates(start, d1, kv, fetchR)).length).toBe(3);
  expect((await cachedCdiRates(start, d1, kv, fetchR)).length).toBe(3); expect(calls.length).toBe(1);
  await cachedCdiRates(start, d2, kv, async (a, b) => { calls.push('inc'); expect(a.getTime()).toBe(parseISO('2026-10-30')!.getTime()); return [r('2026-10-30'), r('2026-11-03')]; });
  const all = await cachedCdiRates(start, d2, kv, fetchR); expect(all.length).toBe(4);
  const off = await cachedCdiRates(start, new Date('2026-11-05T15:00:00Z'), kv, async () => { throw new Error('sem internet'); });
  expect(off.length).toBe(4);
  // início anterior ao cache: baixa tudo
  await cachedCdiRates(parseISO('2026-09-01')!, d2, kv, async () => [r('2026-09-02')]); expect(JSON.parse(kv.m['pilinha.cdi.v1']).start).toBe('2026-09-01');
});
test('cotações saem em paralelo, não em fila', async () => {
  let open = 0, peak = 0;
  const f = async (u: string) => { open++; peak = Math.max(peak, open); await new Promise(z => setTimeout(z, 30)); open--;
    if (u.includes('coingecko')) return { bitcoin: { brl: 100, brl_24h_change: 1 } };
    if (u.includes('awesomeapi')) return { USDBRL: { bid: '5', pctChange: '0' } };
    if (u.includes('bcb')) return [{ data: '01/10/2026', valor: '0.04' }];
    return { chart: { result: [{ meta: { regularMarketPrice: 10, chartPreviousClose: 10 } }] } }; };
  const p = { ...emptyPortfolio(), stocks: [{ ticker: 'AAAA3', quantity: 1 }, { ticker: 'BBBB11', quantity: 1 }] as any, crypto: [{ symbol: 'BTC', coinId: 'bitcoin', quantity: 1 }] as any,
    fixedIncome: [{ name: 'CDB X', kind: 'cdb', cdiPercent: 100, deposits: [{ date: '2026-10-01', amount: 100 }] }] as any };
  const t0 = Date.now(); const s = await snapshot(p, { fetcher: f, now: new Date('2026-10-20T15:00:00Z') });
  expect(s.errors).toEqual([]); expect(peak).toBeGreaterThanOrEqual(4); expect(Date.now() - t0).toBeLessThan(150);
});
test('withTimeout', async () => {
  await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow(); expect(await withTimeout(Promise.resolve(1), 10)).toBe(1);
});
test('Carteira e Proventos têm o olho da máscara global', () => {
  const app = path.join(__dirname, '../../app/(tabs)');
  for (const f of ['carteira.tsx', 'proventos.tsx']) { const s = fs.readFileSync(path.join(app, f), 'utf8'); expect(s).toMatch(/<EyeToggle \/>/); expect(s).not.toMatch(/\bbrl\((?!w\.(targetPrice|price)\b)/); }
});
