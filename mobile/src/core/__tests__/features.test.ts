import { evaluateAlerts, triggered, alertLabel, PriceAlert, goalProgress, poupancaMonthlyPct, benchmarkSeries, dividendCalendar, parseYahooDividends, parseISO, CDIDailyRate } from '..';
const A = (kind: PriceAlert['kind'], value: number, extra: Partial<PriceAlert> = {}): PriceAlert => ({ id: kind + value, ticker: 'PETR4', kind, value, enabled: true, ...extra });
describe('Alertas', () => {
  test('acima/abaixo/queda', () => {
    expect(triggered(A('above', 40), { price: 40, dayPct: 0 })).toBe(true); expect(triggered(A('above', 40), { price: 39.99, dayPct: 0 })).toBe(false);
    expect(triggered(A('below', 30), { price: 29, dayPct: 0 })).toBe(true); expect(triggered(A('dropPct', 3), { price: 1, dayPct: -3.2 })).toBe(true);
    expect(triggered(A('dropPct', 3), { price: 1, dayPct: -2.9 })).toBe(false); expect(triggered(A('dropPct', 3), { price: 1, dayPct: null })).toBe(false);
    expect(triggered(A('below', 30, { enabled: false }), { price: 1, dayPct: 0 })).toBe(false); expect(triggered(A('below', 30), undefined)).toBe(false);
  });
  test('um aviso por alerta por dia', () => {
    const al = [A('below', 30)], q = { PETR4: { price: 29, dayPct: -1 } };
    const d1 = new Date('2026-10-26T13:00:00Z'), d1b = new Date('2026-10-26T20:00:00Z'), d2 = new Date('2026-10-27T13:00:00Z');
    const r1 = evaluateAlerts(al, q, {}, d1); expect(r1.toFire.length).toBe(1); expect(r1.toFire[0].body).toContain('29,00');
    expect(evaluateAlerts(al, q, r1.fired, d1b).toFire.length).toBe(0);
    expect(evaluateAlerts(al, q, r1.fired, d2).toFire.length).toBe(1);
    // alerta removido some do registro
    expect(evaluateAlerts([], q, r1.fired, d2).fired).toEqual({});
    // virada do dia em Brasília (02:30 UTC ainda é dia anterior)
    expect(evaluateAlerts(al, q, r1.fired, new Date('2026-10-27T02:30:00Z')).toFire.length).toBe(0);
  });
  test('rótulo', () => { expect(alertLabel(A('dropPct', 2.5))).toBe('PETR4 caindo 2,5% no dia'); expect(alertLabel(A('above', 40))).toBe('PETR4 acima de R$ 40,00'); });
});
describe('Meta', () => {
  test('progresso', () => {
    expect(goalProgress(500, 1000)).toEqual({ pct: 50, remaining: 500, done: false }); expect(goalProgress(1500, 1000)!.pct).toBe(100);
    expect(goalProgress(1500, 1000)!.done).toBe(true); expect(goalProgress(100, null)).toBeNull(); expect(goalProgress(100, 0)).toBeNull(); expect(goalProgress(-5, 100)!.pct).toBe(0);
  });
});
describe('Poupança e CDI', () => {
  test('regra oficial', () => {
    expect(poupancaMonthlyPct(15)).toBeCloseTo(0.5, 10); expect(poupancaMonthlyPct(8.5)).toBeCloseTo((Math.pow(1.0595, 1 / 12) - 1) * 100, 10);
    expect(poupancaMonthlyPct(15, 0.1)).toBeCloseTo((1.005 * 1.001 - 1) * 100, 10);
  });
  test('série acumulada neutraliza aportes', () => {
    const rates: CDIDailyRate[] = ['2026-10-01', '2026-10-02', '2026-10-05'].map(d => ({ date: parseISO(d)!, percent: 0.05 }));
    const h = [{ day: '2026-10-01', total: 1000, invested: 1000 }, { day: '2026-10-06', total: 2020, invested: 2000 }];
    const b = benchmarkSeries(h, rates, 15);
    expect(b[0]).toMatchObject({ carteira: 0, cdi: 0, poupanca: 0 }); expect(b[1].carteira).toBeCloseTo(1, 10);
    expect(b[1].cdi).toBeCloseTo((1.0005 ** 3 - 1) * 100, 10); expect(b[1].poupanca!).toBeCloseTo((Math.pow(1.005, 5 / 30) - 1) * 100, 10);
    expect(benchmarkSeries(h, rates, null)[1].poupanca).toBeNull(); expect(benchmarkSeries([], rates, 15)).toEqual([]);
  });
});
describe('Calendário de proventos', () => {
  test('separa próximos e últimos sem inventar e sem repetir', () => {
    const now = new Date('2026-10-26T15:00:00Z');
    const c = (t: string, d: string, r: number) => ({ ticker: t, paymentDate: parseISO(d)!, ratePerShare: r, label: 'Dividendo' });
    const cal = dividendCalendar([c('MXRF11', '2026-11-14', 0.1), c('MXRF11', '2026-11-14', 0.1), c('MXRF11', '2026-10-14', 0.09), c('PETR4', '2026-10-26', 1), c('PETR4', '2026-08-01', 0.5)], { MXRF11: 100, PETR4: 10 }, now);
    expect(cal.upcoming.map(e => e.ticker)).toEqual(['PETR4', 'MXRF11']); expect(cal.upcoming[1].total).toBeCloseTo(10);
    expect(cal.recent.map(e => e.date.toISOString().slice(0, 10))).toEqual(['2026-10-14', '2026-08-01']);
  });
  test('Yahoo events=div', () => {
    const j = { chart: { result: [{ events: { dividends: { a: { amount: 0.1, date: 1760400000 }, b: { amount: 'x', date: 1 } } } }] } };
    expect(parseYahooDividends(j, 'mxrf11')).toHaveLength(1); expect(parseYahooDividends({}, 'X')).toEqual([]);
  });
});
