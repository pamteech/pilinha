import { Portfolio, canon, emptyPortfolio, mergeFromMac, mergePortfolio, parsePortfolio } from '..';
// Bug: o que era alterado no celular (US$, quantidade da VIVT3) voltava ao valor antigo no próximo sync com o Mac.
// Dados FALSOS. `base` = o que o Mac mandou da última vez; `mac` = o que mandou agora; `phone` = carteira do iPhone.
const macJSON = (over: any = {}) => parsePortfolio(JSON.stringify({
  owner: 'Fulana', fixedIncome: [{ name: 'Caixinha Teste', kind: 'caixinha', cdiPercent: 100, deposits: [{ date: '2026-01-02', amount: 50 }] }],
  stocks: [{ ticker: 'VIVT3', quantity: 5, averagePrice: 40 }, { ticker: 'TEST3', quantity: 3, averagePrice: 10 }],
  crypto: [{ coinId: 'bitcoin', symbol: 'BTC', quantity: 0.001, averagePriceBRL: 100000 }],
  manualDividends: [{ ticker: 'AAAA11', date: '2026-02-10', amount: 1.5 }], usd: { amount: 100, averageRateBRL: 5 }, ...over,
}));
const q = (p: Portfolio, t: string) => p.stocks.find(s => s.ticker === t)?.quantity;

describe('sync com o Mac guarda o que foi editado no iPhone', () => {
  test('VIVT3: comprei 10 no celular, Mac não mudou → fica 10', () => {
    const base = macJSON(), mac = macJSON();
    const phone: Portfolio = { ...base, stocks: base.stocks.map(s => (s.ticker === 'VIVT3' ? { ...s, quantity: 10 } : s)) };
    const m = mergeFromMac(phone, mac, base);
    expect(q(m, 'VIVT3')).toBe(10); expect(q(m, 'TEST3')).toBe(3);
    // o merge antigo (Mac vence) era o bug
    expect(q(mergePortfolio(phone, mac), 'VIVT3')).toBe(5);
  });
  test('dólar: mudei US$ no celular, Mac não mudou → fica o meu', () => {
    const base = macJSON(), mac = macJSON();
    const m = mergeFromMac({ ...base, usd: { amount: 1500, averageRateBRL: 5.1 } }, mac, base);
    expect(m.usd).toEqual({ amount: 1500, averageRateBRL: 5.1 });
    expect(mergePortfolio({ ...base, usd: { amount: 1500 } }, mac).usd?.amount).toBe(100); // o bug
  });
  test('Mac mudou o item → vale o do Mac (inclusive o dólar)', () => {
    const base = macJSON(), mac = macJSON({ stocks: [{ ticker: 'VIVT3', quantity: 7, averagePrice: 41 }, { ticker: 'TEST3', quantity: 3, averagePrice: 10 }], usd: { amount: 200 } });
    const phone: Portfolio = { ...base, stocks: base.stocks.map(s => (s.ticker === 'VIVT3' ? { ...s, quantity: 10 } : s)), usd: { amount: 1500 } };
    const m = mergeFromMac(phone, mac, base);
    expect(m.stocks.find(s => s.ticker === 'VIVT3')).toEqual({ ticker: 'VIVT3', quantity: 7, averagePrice: 41 });
    expect(m.usd).toEqual({ amount: 200 });
  });
  test('removi no celular e o Mac não mudou → continua removido; Mac mudou → volta', () => {
    const base = macJSON();
    const phone: Portfolio = { ...base, stocks: base.stocks.filter(s => s.ticker !== 'TEST3') };
    expect(mergeFromMac(phone, macJSON(), base).stocks.map(s => s.ticker)).toEqual(['VIVT3']);
    const mac2 = macJSON({ stocks: [{ ticker: 'VIVT3', quantity: 5, averagePrice: 40 }, { ticker: 'TEST3', quantity: 4, averagePrice: 10 }] });
    expect(q(mergeFromMac(phone, mac2, base), 'TEST3')).toBe(4);
  });
  test('novo no Mac entra; só no iPhone fica; Mac apagou → iPhone mantém', () => {
    const base = macJSON();
    const phone: Portfolio = { ...base, stocks: [...base.stocks, { ticker: 'ONLY4', quantity: 2 }] };
    const mac = macJSON({ stocks: [{ ticker: 'VIVT3', quantity: 5, averagePrice: 40 }, { ticker: 'NEW5', quantity: 1 }] });
    const m = mergeFromMac(phone, mac, base);
    expect(m.stocks.map(s => s.ticker).sort()).toEqual(['NEW5', 'ONLY4', 'TEST3', 'VIVT3']);
  });
  test('renda fixa, cripto, favoritos e campos soltos seguem a mesma regra', () => {
    const base = macJSON({ watchlist: [{ ticker: 'TAEE11', targetPrice: 30 }] });
    const phone: Portfolio = { ...base, fixedIncome: [{ ...base.fixedIncome[0], cdiPercent: 110 }], crypto: [{ ...base.crypto[0], quantity: 0.002 }], watchlist: [{ ticker: 'TAEE11', targetPrice: 28 }], owner: 'Eu' };
    const same = mergeFromMac(phone, macJSON({ watchlist: [{ ticker: 'TAEE11', targetPrice: 30 }] }), base);
    expect(same.fixedIncome[0].cdiPercent).toBe(110); expect(same.crypto[0].quantity).toBe(0.002); expect(same.watchlist).toEqual([{ ticker: 'TAEE11', targetPrice: 28 }]); expect(same.owner).toBe('Eu');
    const mac = macJSON({ fixedIncome: [{ ...base.fixedIncome[0], cdiPercent: 120 }], owner: 'Fulana S.', watchlist: [{ ticker: 'TAEE11', targetPrice: 31 }] });
    const ch = mergeFromMac(phone, mac, base);
    expect(ch.fixedIncome[0].cdiPercent).toBe(120); expect(ch.owner).toBe('Fulana S.'); expect(ch.watchlist).toEqual([{ ticker: 'TAEE11', targetPrice: 31 }]); expect(ch.crypto[0].quantity).toBe(0.002);
  });
  test('proventos: Mac igual → lista do iPhone (até sem o que apaguei); Mac mudou → junta sem repetir', () => {
    const base = macJSON();
    const phone: Portfolio = { ...base, manualDividends: [{ ticker: 'BBBB11', date: '2026-03-01', amount: 2 }] };
    expect(mergeFromMac(phone, macJSON(), base).manualDividends).toEqual([{ ticker: 'BBBB11', date: '2026-03-01', amount: 2 }]);
    const mac = macJSON({ manualDividends: [{ ticker: 'AAAA11', date: '2026-02-10', amount: 1.5 }, { ticker: 'BBBB11', date: '2026-03-01', amount: 2 }, { ticker: 'CCCC11', date: '2026-04-01', amount: 3 }] });
    expect(mergeFromMac(phone, mac, base).manualDividends!.map(d => d.ticker)).toEqual(['BBBB11', 'AAAA11', 'CCCC11']);
  });
  test('primeira sincronização (sem base) é o merge antigo; depois é idempotente', () => {
    const mac = macJSON(), phone = { ...emptyPortfolio(), stocks: [{ ticker: 'VIVT3', quantity: 10 }] };
    const first = mergeFromMac(phone, mac, null);
    expect(first).toEqual(mergePortfolio(phone, mac)); expect(q(first, 'VIVT3')).toBe(5);
    const edited = { ...first, usd: { amount: 1 } };
    const again = mergeFromMac(edited, mac, mac);
    expect(again).toEqual(edited); expect(mergeFromMac(again, mac, mac)).toEqual(again);
  });
  test('ordem das chaves e ticker em minúsculas não contam como mudança', () => {
    expect(canon({ b: 1, a: { d: 2, c: 3 } })).toBe(canon({ a: { c: 3, d: 2 }, b: 1 }));
    const base = macJSON(), mac = parsePortfolio(JSON.stringify({ ...JSON.parse(JSON.stringify(base)), stocks: [{ averagePrice: 10, quantity: 3, ticker: 'test3' }, { averagePrice: 40, quantity: 5, ticker: 'vivt3' }] }));
    const phone: Portfolio = { ...base, stocks: base.stocks.map(s => (s.ticker === 'VIVT3' ? { ...s, quantity: 10 } : s)) };
    expect(q(mergeFromMac(phone, mac, base), 'VIVT3')).toBe(10);
  });
});
