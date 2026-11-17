import { LineItem, incomeSummary } from '..';
// Renda passiva: proventos de 12 meses ÷ valor de hoje (e ÷ o que foi pago). Dados fictícios.
const item = (name: string, category: string, current: number, invested: number | null = null): LineItem => ({ name, category, invested, current, dayChange: null, net: null });
const ITEMS = [item('VALE3', 'acao', 5000), item('MXRF11', 'fii', 5000, 4000), item('PETR4', 'acao', 10000, 8000), item('CDB Banco', 'cdb', 20000, 18000), item('BTC', 'cripto', 3000, 1000)];
const BY = [{ ticker: 'MXRF11', total: 600 }, { ticker: 'PETR4', total: 1200 }];
test('renda por mês, por ano e rendimento da carteira de ações e FIIs', () => {
  const s = incomeSummary(ITEMS, BY);
  expect(s.annual).toBe(1800); expect(s.monthly).toBe(150);
  expect(s.yieldPct!).toBeCloseTo(9); // 1800 ÷ (5000 + 5000 + 10000): renda fixa e cripto ficam de fora
});
test('uma linha por ação/FII, de quem mais pagou para quem menos; sem provento aparece com 0', () => {
  const [a, b, c, ...rest] = incomeSummary(ITEMS, BY).rows;
  expect(rest).toEqual([]); expect([a.ticker, b.ticker, c.ticker]).toEqual(['PETR4', 'MXRF11', 'VALE3']);
  expect(a.received12m).toBe(1200); expect(a.current).toBe(10000); expect(a.dyPct!).toBeCloseTo(12); expect(a.yocPct!).toBeCloseTo(15);
  expect(b.received12m).toBe(600); expect(b.dyPct!).toBeCloseTo(12); expect(b.yocPct!).toBeCloseTo(15);
  expect(c).toEqual({ ticker: 'VALE3', received12m: 0, current: 5000, dyPct: 0, yocPct: null }); // sem preço médio não há "sobre o que pagou"
});
test('divisões protegidas: valor zero, preço médio zero e números inválidos viram null, nunca NaN', () => {
  const s = incomeSummary([item('PETR4', 'acao', 0, 0), item('MXRF11', 'fii', NaN, Infinity)], [{ ticker: 'PETR4', total: 100 }, { ticker: 'MXRF11', total: NaN }]);
  expect(s.annual).toBe(100); expect(s.yieldPct).toBeNull();
  expect(s.rows).toEqual([{ ticker: 'PETR4', received12m: 100, current: 0, dyPct: null, yocPct: null }, { ticker: 'MXRF11', received12m: 0, current: 0, dyPct: null, yocPct: null }]);
  expect(incomeSummary([], [])).toEqual({ monthly: 0, annual: 0, yieldPct: null, rows: [] });
  expect(incomeSummary([item('CDB Banco', 'cdb', 20000, 18000)], [{ ticker: 'CDB Banco', total: 50 }])).toEqual({ monthly: 0, annual: 0, yieldPct: null, rows: [] });
});
test('ticker sem diferenciar maiúsculas; provento de ativo que saiu da carteira é ignorado', () => {
  const s = incomeSummary([item('petr4', 'acao', 10000, 8000)], [{ ticker: 'PETR4', total: 700 }, { ticker: 'Petr4', total: 500 }, { ticker: 'ITUB4', total: 900 }]);
  expect(s.annual).toBe(1200); expect(s.monthly).toBe(100); expect(s.rows.map(r => r.ticker)).toEqual(['PETR4']);
});
test('não altera as entradas', () => {
  const items = ITEMS.map(i => ({ ...i })), by = [...BY].reverse().map(b => ({ ...b })), before = JSON.stringify([items, by]);
  incomeSummary(items, by);
  expect(JSON.stringify([items, by])).toBe(before);
});
