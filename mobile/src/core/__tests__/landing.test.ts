import { allocation, sharePct, dividendsByMonth, monthsToGoal, monthlyForGoal, passiveIncome, formatMonths, monthlyRate, inRange, HISTORY_RANGES, ALLOC_COLORS, LineItem } from '..';
// Gráficos e simulador prometidos na landing (site/index.html). Dados fictícios.
const li = (name: string, category: string, current: number): LineItem => ({ name, category, current, invested: null, dayChange: null, net: null });
describe('Distribuição por tipo', () => {
  test('ordem e cor fixas por tipo, % fecha em 100, vazios somem', () => {
    const a = allocation([li('MXRF11', 'fii', 120), li('Caixinha', 'caixinha', 450), li('Tesouro IPCA+', 'tesouro', 200), li('PETR4', 'acao', 150), li('BTC', 'cripto', 80)]);
    expect(a.map(x => x.key)).toEqual(['renda', 'tesouro', 'acoes', 'fiis', 'bitcoin']);
    expect(a.map(x => Math.round(x.pct))).toEqual([45, 20, 15, 12, 8]);
    expect(a.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100);
    expect(a[0].color).toBe(ALLOC_COLORS.renda); expect(a.find(x => x.key === 'fiis')!.color).toBe(ALLOC_COLORS.fiis);
    // sem renda fixa, a cor das ações continua a mesma (cor segue o tipo, não a posição)
    expect(allocation([li('PETR4', 'acao', 1)])[0].color).toBe(ALLOC_COLORS.acoes);
    expect(allocation([])).toEqual([]); expect(allocation([li('x', 'acao', 0)])).toEqual([]);
  });
  test('LCI/LCA/CDB entram em renda fixa; dólar à parte; outra cripto vira "Cripto"', () => {
    const a = allocation([li('LCI', 'lci', 1), li('CDB', 'cdb', 1), li('Dólar', 'dolar', 2), li('ETH', 'cripto', 1), li('BTC', 'cripto', 1)]);
    expect(a.map(x => [x.key, x.title, x.total])).toEqual([['renda', 'Renda fixa', 2], ['bitcoin', 'Cripto', 2], ['dolar', 'Dólar', 2]]);
    expect(sharePct(45)).toBe('45%'); expect(sharePct(7.46)).toBe('7,5%'); expect(sharePct(0)).toBe('0%');
  });
});
describe('Dividendos por mês', () => {
  const now = new Date('2026-11-05T15:00:00Z');
  const cash = [
    { ticker: 'MXRF11', paymentDate: new Date('2026-11-14T03:00:00Z'), ratePerShare: 0.1, label: 'rendimento' }, // futuro: não entra
    { ticker: 'MXRF11', paymentDate: new Date('2026-10-15T03:00:00Z'), ratePerShare: 0.1, label: 'rendimento' },
    { ticker: 'MXRF11', paymentDate: new Date('2026-09-15T03:00:00Z'), ratePerShare: 0.1, label: 'rendimento' },
    { ticker: 'PETR4', paymentDate: new Date('2026-10-20T03:00:00Z'), ratePerShare: 1.5, label: 'dividendo' },
    { ticker: 'PETR4', paymentDate: new Date('2025-10-20T03:00:00Z'), ratePerShare: 9, label: 'fora da janela' },
    { ticker: 'VALE3', paymentDate: new Date('2026-10-20T03:00:00Z'), ratePerShare: 1, label: 'não tenho' },
  ];
  const stocks = [{ ticker: 'MXRF11', quantity: 100 }, { ticker: 'PETR4', quantity: 10 }];
  test('12 meses com o atual, taxa × quantidade, só pagamentos passados', () => {
    const r = dividendsByMonth(stocks, cash, [], now);
    expect(r.months).toHaveLength(12); expect(r.months[0].month).toBe('2025-12'); expect(r.months[11]).toMatchObject({ month: '2026-11', label: 'nov', total: 0 });
    const by = Object.fromEntries(r.months.map(m => [m.month, m.total]));
    expect(by['2026-10']).toBeCloseTo(10 + 15); expect(by['2026-09']).toBeCloseTo(10); expect(by['2025-12']).toBe(0);
    expect(r.total).toBeCloseTo(35); expect(r.average).toBeCloseTo(35 / 12); expect(r.best?.month).toBe('2026-10');
  });
  test('lançamento manual vence a brapi no mesmo ticker e cai no mês certo', () => {
    const r = dividendsByMonth(stocks, cash, [{ ticker: 'mxrf11', date: '2026-10-16', amount: 9.8 }, { ticker: 'MXRF11', date: '2026-12-01', amount: 99 }], now);
    const by = Object.fromEntries(r.months.map(m => [m.month, m.total]));
    expect(by['2026-10']).toBeCloseTo(9.8 + 15); expect(by['2026-09']).toBe(0); expect(r.total).toBeCloseTo(24.8);
    expect(dividendsByMonth([], [], [], now).best).toBeNull();
  });
});
describe('Simulador de metas', () => {
  test('taxa mensal e renda passiva', () => {
    expect(monthlyRate(12.68)).toBeCloseTo(0.01, 4); expect(passiveIncome(100000, 12.68)).toBeCloseTo(1000, 0); expect(passiveIncome(-5, 10)).toBe(0);
  });
  test('meses até a meta: fórmula, já chegou, nunca chega', () => {
    expect(monthsToGoal(0, 12000, 1000, 0)).toBe(12);
    expect(monthsToGoal(0, 10000, 500, 12.68)).toBe(19); // 500 × 19 meses a 1% a.m. ≈ 10.400
    expect(monthsToGoal(5000, 10000, 0, 12.68)).toBe(70); // só rendendo: 1,01^70 ≈ 2,007
    expect(monthsToGoal(12000, 10000, 100, 10)).toBe(0);
    expect(monthsToGoal(0, 10000, 0, 10)).toBeNull(); expect(monthsToGoal(0, 10000, 0, 0)).toBeNull(); expect(monthsToGoal(1, 1e12, 1, 1)).toBeNull();
    expect(monthsToGoal(0, 0, 100, 10)).toBeNull();
  });
  test('aporte para chegar no prazo', () => {
    expect(monthlyForGoal(0, 12000, 12, 0)).toBeCloseTo(1000);
    const a = monthlyForGoal(0, 10000, 19, 12.68)!; expect(a).toBeGreaterThan(470); expect(a).toBeLessThan(500);
    expect(monthlyForGoal(5000, 10000, 70, 12.68)!).toBeCloseTo(0, 0);
    expect(monthlyForGoal(12000, 10000, 12, 10)).toBe(0); expect(monthlyForGoal(0, 10000, 0, 10)).toBeNull();
  });
  test('texto do prazo', () => {
    expect(formatMonths(8)).toBe('8 meses'); expect(formatMonths(1)).toBe('1 mês'); expect(formatMonths(12)).toBe('1 ano'); expect(formatMonths(27)).toBe('2 anos e 3 meses'); expect(formatMonths(0)).toBe('agora');
  });
});
test('Evolução: períodos de 6 meses e 1 ano', () => {
  const now = new Date('2026-11-05T15:00:00Z');
  const h = [{ day: '2025-10-01', total: 1, invested: 1 }, { day: '2026-03-01', total: 1, invested: 1 }, { day: '2026-09-01', total: 1, invested: 1 }, { day: '2026-11-05', total: 1, invested: 1 }];
  expect(inRange(h, '6 meses', now).map(p => p.day)).toEqual(['2026-09-01', '2026-11-05']);
  expect(inRange(h, '1 ano', now).map(p => p.day)).toEqual(['2026-03-01', '2026-09-01', '2026-11-05']);
  expect(HISTORY_RANGES).toEqual(['Semana', 'Mês', '6 meses', '1 ano', 'Tudo']);
});
