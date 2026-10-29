import { parsePortfolio, mergePortfolio } from '..';
// Dados FALSOS: formato exato que o Mac grava em iCloud Drive/Pilinha/carteira.json (JSONEncoder, sortedKeys).
const macJSON = JSON.stringify({
  crypto: [{ averagePriceBRL: 100000, coinId: 'bitcoin', quantity: 0.001, symbol: 'BTC' }],
  fixedIncome: [{ cdiPercent: 100, deposits: [{ amount: 50, date: '2026-01-02' }], kind: 'caixinha', name: 'Caixinha Teste' }],
  manualDividends: [{ amount: 1.5, date: '2026-02-10', ticker: 'aaaa11' }],
  owner: 'Fulana', stocks: [{ averagePrice: 10, quantity: 3, ticker: 'test3' }],
  tradingview: { symbols: { TEST3: 'BMFBOVESPA:TEST3' } },
});
test('mapeia o JSON do Mac para o app', () => {
  const p = parsePortfolio(macJSON);
  expect(p.stocks).toEqual([{ averagePrice: 10, quantity: 3, ticker: 'TEST3' }]);
  expect(p.fixedIncome[0].kind).toBe('caixinha'); expect(p.crypto[0].coinId).toBe('bitcoin');
  expect(p.manualDividends?.[0].ticker).toBe('AAAA11'); expect(p.owner).toBe('Fulana');
});
test('merge sem duplicar: Mac manda no que tem, iPhone mantém o resto', () => {
  const phone = parsePortfolio(JSON.stringify({
    stocks: [{ ticker: 'TEST3', quantity: 1, averagePrice: 9 }, { ticker: 'ONLY4', quantity: 2 }],
    fixedIncome: [{ name: 'caixinha teste', kind: 'cdb', cdiPercent: 90, deposits: [{ date: '2026-01-01', amount: 10 }] }],
    crypto: [], manualDividends: [{ ticker: 'AAAA11', date: '2026-02-10', amount: 1.5 }],
  }));
  const mac = parsePortfolio(macJSON);
  const m = mergePortfolio(phone, mac);
  expect(m.stocks.map(s => s.ticker).sort()).toEqual(['ONLY4', 'TEST3']);
  expect(m.stocks.find(s => s.ticker === 'TEST3')).toEqual({ ticker: 'TEST3', quantity: 3, averagePrice: 10 });
  expect(m.fixedIncome).toHaveLength(1); expect(m.fixedIncome[0].cdiPercent).toBe(100);
  expect(m.crypto).toHaveLength(1); expect(m.manualDividends).toHaveLength(1);
  // importar duas vezes dá o mesmo resultado
  expect(mergePortfolio(m, mac)).toEqual(m);
});
