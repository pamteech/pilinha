import { inflationFactor, ipcaGross, value, netValue, parsePortfolio, snapshot, ipcaURL } from '..';
// IPCA+ com dados falsos.
const d = (s: string) => new Date(s + 'T00:00:00-03:00');
test('pró-rata e curva', () => {
  const ipca = [{ month: d('2026-01-01'), percent: 0.31 }, { month: d('2026-02-01'), percent: 0.5 }];
  expect(inflationFactor(d('2026-01-02'), d('2026-03-10'), ipca)).toBeCloseTo((1 + 0.0031 * 30 / 31) * 1.005, 9);
  expect(ipcaGross(1000, d('2026-01-01'), 6, [{ month: d('2026-01-01'), percent: 1 }], 252, d('2026-02-01'))).toBeCloseTo(1010 * 1.06, 6);
});
test('value usa dias úteis da série CDI e IR', () => {
  const a = { name: 'X', kind: 'tesouro' as const, cdiPercent: 0, indexer: 'ipca' as const, realRate: 10, deposits: [{ date: '2026-01-05', amount: 100 }] };
  const rates = [5, 6, 7, 8, 9].map(n => ({ date: d(`2026-01-0${n}`), percent: 0.05 }));
  const v = value(a, rates, d('2026-01-10'), []);
  expect(v.gross).toBeCloseTo(100 * Math.pow(1.1, 5 / 252), 9);
  expect(netValue(a, rates, d('2026-01-10'), [])).toBeLessThan(v.gross);
});
test('JSON antigo e IPCA+ com cdiPercent 0', () => {
  const p = parsePortfolio(JSON.stringify({ fixedIncome: [{ name: 'T', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7, maturity: '2030-08-15', deposits: [{ date: '2026-01-05', amount: 100 }] }], stocks: [], crypto: [] }));
  expect(p.fixedIncome[0].indexer).toBe('ipca');
  expect(() => parsePortfolio(JSON.stringify({ fixedIncome: [{ name: 'C', kind: 'cdb', cdiPercent: 0, deposits: [{ date: '2026-01-05', amount: 100 }] }] }))).toThrow();
});
test('snapshot busca IPCA', async () => {
  const urls: string[] = [];
  const f = async (u: string) => { urls.push(u); if (u.includes('sgs.433')) return [{ data: '01/01/2026', valor: '0.5' }]; if (u.includes('sgs.12')) return [{ data: '05/01/2026', valor: '0.05' }]; return {}; };
  const s = await snapshot({ fixedIncome: [{ name: 'T', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7, deposits: [{ date: '2026-01-05', amount: 100 }] }], stocks: [], crypto: [] }, { now: d('2026-01-20'), fetcher: f as any });
  expect(urls.some(u => u.includes('sgs.433'))).toBe(true);
  expect(ipcaURL(d('2026-01-05'), d('2026-01-20'))).toContain('dataInicial=01/01/2026');
  expect(s.items[0].current).toBeGreaterThan(100);
});
