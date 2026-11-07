import * as fs from 'fs'; import * as path from 'path';
import { irRate, iofRate, breakdown, grossValue, netValue, annualized, parseISO, daysBetween, parseBCB, moodFrom, shouldCelebrate, frameCount, Mood,
  parseYahoo, parseBrapi, stockQuote, yahooURL, brapiURL, summary, parseBrapiDividends, record, inRange, snapshot, dayChangePct, FixedIncomeAsset, Fetcher, CDIDailyRate } from '..';
const d = (s: string) => parseISO(s)!;
const close = (a: number, b: number, e = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(e);

describe('IR/IOF', () => {
  test.each([[1, 0.225], [180, 0.225], [181, 0.2], [360, 0.2], [361, 0.175], [720, 0.175], [721, 0.15], [2000, 0.15]])('ir %i', (n, r) => expect(irRate(n)).toBe(r));
  test('iof', () => { expect(iofRate(1)).toBe(0.96); expect(iofRate(10)).toBe(0.66); expect(iofRate(29)).toBe(0.03); expect(iofRate(30)).toBe(0); expect(iofRate(400)).toBe(0); });
  test('breakdown', () => { const b = breakdown(1000, 1010, 10, false); close(b.iof, 6.6); close(b.ir, 0.765); close(b.net, 1002.635); });
  test('long/exempt/loss', () => { close(breakdown(1000, 1200, 800, false).net, 1170); expect(breakdown(1000, 1200, 5, true).net).toBe(1200); expect(breakdown(1000, 990, 5, false).net).toBe(990); });
  test('net per deposit + LCI', () => {
    const rates: CDIDailyRate[] = Array.from({ length: 400 }, (_, i) => ({ date: new Date(d('2025-09-01').getTime() + i * 86_400_000), percent: 0.05 }));
    const a: FixedIncomeAsset = { name: 'CDB', kind: 'cdb', cdiPercent: 100, deposits: [{ date: '2025-09-01', amount: 1000 }, { date: '2026-09-20', amount: 1000 }] };
    const end = d('2026-10-01');
    const g1 = grossValue(1000, d('2025-09-01'), 100, rates, end), g2 = grossValue(1000, d('2026-09-20'), 100, rates, end);
    close(netValue(a, rates, end), 1000 + (g1 - 1000) * 0.825 + 1000 + (g2 - 1000) * (1 - iofRate(11)) * 0.775, 1e-6);
    close(netValue({ ...a, kind: 'lci' }, rates, end), g1 + g2, 1e-6);
  });
  test('days', () => expect(daysBetween(d('2026-01-01'), d('2026-01-31'))).toBe(30));
});

describe('CDI', () => {
  test('compounding', () => {
    const rates = Array.from({ length: 10 }, (_, i) => ({ date: d(`2026-01-${String(i + 1).padStart(2, '0')}`), percent: 0.05 }));
    close(grossValue(1000, d('2026-01-01'), 100, rates, d('2026-02-01')), 1000 * 1.0005 ** 10);
    close(grossValue(1000, d('2026-01-06'), 110, rates, d('2026-02-01')), 1000 * (1 + 0.0005 * 1.1) ** 5);
  });
  test('annualized', () => close(annualized(0.050788), 13.65, 0.05));
  test('parse BCB', () => expect(parseBCB([{ data: '21/10/2026', valor: '0.050788' }])[0].percent).toBe(0.050788));
  test('example portfolio decodes', () => { const p = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../portfolio.example.json'), 'utf8')); expect(p.fixedIncome.length).toBeGreaterThan(0); });
});

describe('Humor', () => {
  test('mood', () => {
    expect(moodFrom(0.2, true, true)).toBe('pensando'); expect(moodFrom(0.2, false, true)).toBe('erro');
    expect(moodFrom(0.06, false, false)).toBe('feliz'); expect(moodFrom(0.05, false, false)).toBe('neutro');
    expect(moodFrom(-0.06, false, false)).toBe('triste'); expect(moodFrom(null, false, false)).toBe('neutro');
  });
  test('celebrate', () => { expect(shouldCelebrate(100, 101, 0.1)).toBe(true); expect(shouldCelebrate(null, 101, 0.1)).toBe(false); expect(shouldCelebrate(100, 101, -0.1)).toBe(false); });
  test('folhas em WebP: grade de 8 colunas, 384 px por quadro, linhas conforme os quadros', () => {
    for (const m of Object.keys(frameCount) as Mood[]) {
      const b = fs.readFileSync(path.join(__dirname, `../../../assets/pig/porco2d_${m}.webp`));
      expect(b.toString('ascii', 8, 16)).toBe('WEBPVP8X');
      const w = b.readUIntLE(24, 3) + 1, h = b.readUIntLE(27, 3) + 1;
      expect([m, w, h]).toEqual([m, 8 * 384, Math.ceil(frameCount[m] / 8) * 384]);
    }
  });
});

describe('Cotações', () => {
  const yahooOK = { chart: { result: [{ meta: { regularMarketPrice: 22, chartPreviousClose: 20 } }], error: null } };
  test('yahoo parse', () => { const q = parseYahoo(yahooOK, 'X'); expect(q.price).toBe(22); close(q.changePct!, 10); });
  test('yahoo errors', () => { expect(() => parseYahoo({ chart: { result: null, error: { code: 'Not Found', description: 'No data' } } }, 'ZZZZ3')).toThrow(/No data/); expect(() => parseYahoo({}, 'X')).toThrow(); });
  test('urls só com ticker', () => { expect(yahooURL('bbas3')).toBe('https://query1.finance.yahoo.com/v8/finance/chart/BBAS3.SA?range=1d&interval=1d'); expect(brapiURL('pe tr4;', true)).toBe('https://brapi.dev/api/quote/PETR4?dividends=true'); });
  test('brapi error', () => expect(() => parseBrapi({ error: true, message: 'token' }, 'X', false)).toThrow(/token/));
  test('sem token vai direto no Yahoo', async () => {
    const calls: string[] = []; const f: Fetcher = async u => { calls.push(u); return yahooOK; };
    const q = await stockQuote('BBAS3', null, f); expect(q.source).toBe('yahoo'); expect(calls.every(c => c.includes('yahoo'))).toBe(true);
  });
  test('brapi falha → Yahoo; token só no header', async () => {
    const seen: Record<string, string>[] = []; const f: Fetcher = async (u, h = {}) => { seen.push(h); if (u.includes('brapi')) return { error: true, message: 'x' }; return yahooOK; };
    const q = await stockQuote('BBAS3', 'tok', f); expect(q.source).toBe('yahoo'); expect(seen[0].Authorization).toBe('Bearer tok');
  });
  test('ambos falham → mensagem clara', async () => { await expect(stockQuote('X', null, async () => ({}))).rejects.toThrow(/Yahoo/); });
});

describe('Proventos e histórico', () => {
  const now = d('2026-10-20');
  test('summary manual vence brapi', () => {
    const cash = parseBrapiDividends({ results: [{ symbol: 'mxrf11', dividendsData: { cashDividends: [{ paymentDate: '2026-09-15T00:00:00.000Z', rate: 0.1, label: 'R' }, { paymentDate: '2024-01-01', rate: 9, label: 'old' }] } }, { symbol: 'PETR4', dividendsData: { cashDividends: [{ paymentDate: '2026-08-01', rate: 1 }] } }] });
    const s = summary([{ ticker: 'MXRF11', quantity: 100 }, { ticker: 'PETR4', quantity: 10 }], cash, [{ ticker: 'petr4', date: '2026-05-01', amount: 7 }], now);
    close(s.byTicker.MXRF11, 10); expect(s.byTicker.PETR4).toBe(7); expect(s.source.PETR4).toBe('manual'); close(s.last12m, 17);
  });
  test('history record/range', () => {
    let h = record([], 100, 90, null, d('2026-10-01')); h = record(h, 110, 90, null, d('2026-10-01')); h = record(h, 120, 90, null, d('2026-10-19')); h = record(h, 0, 0, null, now);
    expect(h.length).toBe(2); expect(h[0].total).toBe(110); expect(inRange(h, 'Semana', now).length).toBe(1); expect(inRange(h, 'Tudo', now).length).toBe(2);
  });
  test('snapshot com fetcher falso', async () => {
    const f: Fetcher = async u => {
      if (u.includes('bcb')) return [{ data: '01/10/2026', valor: '0.05' }];
      if (u.includes('yahoo')) return { chart: { result: [{ meta: { regularMarketPrice: 10, chartPreviousClose: 10 } }] } };
      return { bitcoin: { brl: 100, brl_24h_change: 0 } };
    };
    const s = await snapshot({ fixedIncome: [{ name: 'Caixinha', kind: 'caixinha', cdiPercent: 100, deposits: [{ date: '2026-09-30', amount: 100 }] }], stocks: [{ ticker: 'BBAS3', quantity: 1 }], crypto: [{ coinId: 'bitcoin', symbol: 'BTC', quantity: 1 }] }, { now, fetcher: f });
    expect(s.errors).toEqual([]); expect(s.items.length).toBe(3); expect(dayChangePct(s)).not.toBeNull();
  });
});
