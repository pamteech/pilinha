import { parseAwesomeUSD, parsePTAX, usdQuote, usdItem, snapshot, total, parsePortfolio, mergePortfolio, emptyPortfolio, ptaxURL } from '..';
// Dólar com dados falsos.
const awesome = { USDBRL: { bid: '5.5000', pctChange: '0.5' } };
test('parsers', () => {
  expect(parseAwesomeUSD(awesome)).toEqual({ bid: 5.5, changePct: 0.5, source: 'AwesomeAPI' });
  expect(parsePTAX({ value: [{ cotacaoVenda: 5.2 }] })?.bid).toBe(5.2);
  expect(parseAwesomeUSD({})).toBeNull();
  expect(ptaxURL(new Date('2026-10-30T12:00:00-03:00'))).toContain("@dataFinalCotacao='10-30-2026'");
});
test('fallback para PTAX', async () => {
  const f = async (u: string) => { if (u.includes('awesomeapi')) throw new Error('fora'); return { value: [{ cotacaoVenda: 5.3 }] }; };
  expect((await usdQuote(f)).source).toBe('PTAX/BCB');
});
test('item e total', async () => {
  const i = usdItem({ amount: 100, averageRateBRL: 5 }, { bid: 5.5, changePct: null, source: 'x' });
  expect(i.current).toBeCloseTo(550); expect(i.invested).toBe(500);
  const f = async (u: string) => { if (u.includes('awesomeapi')) return awesome; throw new Error('x'); };
  const s = await snapshot({ ...emptyPortfolio(), usd: { amount: 10 } }, { fetcher: f } as any);
  expect(s.usdBRL).toBe(5.5);
});
test('carteira antiga, import e merge', () => {
  expect(parsePortfolio('{"fixedIncome":[],"stocks":[],"crypto":[]}').usd).toBeUndefined();
  const mac = parsePortfolio('{"fixedIncome":[],"stocks":[],"crypto":[],"usd":{"amount":200,"averageRateBRL":5.1}}');
  expect(mac.usd).toEqual({ amount: 200, averageRateBRL: 5.1 });
  expect(mergePortfolio({ ...emptyPortfolio(), usd: { amount: 1 } }, mac).usd?.amount).toBe(200);
  expect(mergePortfolio({ ...emptyPortfolio(), usd: { amount: 1 } }, parsePortfolio('{"fixedIncome":[],"stocks":[],"crypto":[]}')).usd?.amount).toBe(1);
  expect(() => parsePortfolio('{"fixedIncome":[],"stocks":[],"crypto":[],"usd":{"amount":"x"}}')).toThrow();
});
test('dólar em grupo próprio, separado das ações', () => {
  const { groupItems } = require('..');
  const d = usdItem({ amount: 10 }, { bid: 5, changePct: 1, source: 'x' });
  const g = groupItems([{ name: 'FAKE3', category: 'acao', invested: null, current: 10, dayChange: null, net: null }, d]);
  expect(g.map((x: any) => x.key)).toEqual(['acoes', 'dolar']);
  expect(g[1].items[0].quantity).toBe(10);
});
