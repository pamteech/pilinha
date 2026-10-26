import { latestGate, parseNumberBR, validPastDate, validTicker, normTicker, parseISO, parsePortfolio, snapshot, Fetcher } from '..';
describe('Bugs corrigidos', () => {
  test('números digitados: ponto decimal não vira milhar', () => {
    expect(parseNumberBR('0.0015')).toBe(0.0015); expect(parseNumberBR('0,0015')).toBe(0.0015);
    expect(parseNumberBR('1.234,56')).toBe(1234.56); expect(parseNumberBR('1.500')).toBe(1500); expect(parseNumberBR('32.10')).toBe(32.1);
    expect(parseNumberBR('R$ 1.000.000')).toBe(1000000); expect(parseNumberBR('')).toBeNaN(); expect(parseNumberBR('abc')).toBeNaN(); expect(parseNumberBR('1,2,3')).toBeNaN();
  });
  test('datas inválidas e futuras', () => {
    expect(parseISO('2026-02-31')).toBeNull(); expect(parseISO('2024-02-29')).not.toBeNull();
    const now = new Date('2026-10-26T15:00:00Z');
    expect(validPastDate('2026-10-26', now)).toBe(true); expect(validPastDate('2026-10-27', now)).toBe(false); expect(validPastDate('26/10/2026', now)).toBe(false);
  });
  test('tickers', () => {
    expect(normTicker(' petr4.sa ')).toBe('PETR4'); expect(validTicker('mxrf11')).toBe(true); expect(validTicker('PETR4F')).toBe(true);
    expect(validTicker('1234')).toBe(false); expect(validTicker('PETR')).toBe(false);
  });
  test('import: normaliza, junta repetidos e recusa valores inválidos', () => {
    const p = parsePortfolio(JSON.stringify({ stocks: [{ ticker: 'petr4', quantity: 10, averagePrice: 30 }, { ticker: 'PETR4', quantity: 10, averagePrice: 40 }], manualDividends: [{ ticker: 'mxrf11', date: '2026-01-01', amount: 1 }], extra: 1 }));
    expect(p.stocks).toEqual([{ ticker: 'PETR4', quantity: 20, averagePrice: 35 }]); expect(p.manualDividends![0].ticker).toBe('MXRF11'); expect((p as any).extra).toBe(1);
    expect(() => parsePortfolio('{"stocks":[{"ticker":"X","quantity":-1}]}')).toThrow(/Ação inválida/);
    expect(() => parsePortfolio('{"fixedIncome":[{"name":"a","kind":"cdb","cdiPercent":100,"deposits":[{"date":"2026-02-31","amount":1}]}]}')).toThrow(/Aporte/);
    expect(() => parsePortfolio('não é json')).toThrow(/JSON/); expect(() => parsePortfolio('null')).toThrow();
  });
  test('aporte com data futura não derruba a renda fixa', async () => {
    const urls: string[] = [];
    const f: Fetcher = async u => { urls.push(u); return [{ data: '23/10/2026', valor: '0.05' }]; };
    const now = new Date('2026-10-26T15:00:00Z');
    const s = await snapshot({ fixedIncome: [{ name: 'CDB', kind: 'cdb', cdiPercent: 100, deposits: [{ date: '2026-12-01', amount: 100 }] }], stocks: [], crypto: [] }, { now, fetcher: f });
    expect(s.errors).toEqual([]); expect(urls[0]).toContain('dataInicial=26/10/2026');
  });
  test('sem internet: erros aparecem, sem NaN', async () => {
    const f: Fetcher = async () => { throw new Error('Network request failed'); };
    const s = await snapshot({ fixedIncome: [], stocks: [{ ticker: 'PETR4', quantity: 1 }], crypto: [{ coinId: 'bitcoin', symbol: 'BTC', quantity: 1 }] }, { fetcher: f });
    expect(s.items).toEqual([]); expect(s.errors.length).toBe(2);
  });
  test('refresh lento antigo não sobrescreve o novo', async () => {
    const g = latestGate(); let shown = '';
    const run = async (v: string, ms: number) => { const id = g.next(); await new Promise(r => setTimeout(r, ms)); if (g.isLatest(id)) shown = v; };
    await Promise.all([run('antigo', 30), run('novo', 5)]); expect(shown).toBe('novo');
  });
});
