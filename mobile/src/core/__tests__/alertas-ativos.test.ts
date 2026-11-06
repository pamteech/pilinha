import { BTC_TICKER, USD_TICKER, alertAssetName, alertLabel, evaluateAlerts, missingAlertTickers, validAlertTicker, PriceAlert } from '..';
// Alertas para ação fora da carteira, dólar e bitcoin.
const A = (ticker: string, kind: PriceAlert['kind'], value: number, enabled = true): PriceAlert => ({ id: ticker + kind, ticker, kind, value, enabled });
test('dólar e bitcoin têm nome; ação mostra o código', () => {
  expect(alertAssetName('usd')).toBe('Dólar'); expect(alertAssetName(BTC_TICKER)).toBe('Bitcoin'); expect(alertAssetName('petr4')).toBe('PETR4');
  expect(alertLabel(A(USD_TICKER, 'below', 5.2))).toBe('Dólar abaixo de R$ 5,20');
  expect(alertLabel(A(BTC_TICKER, 'dropPct', 5))).toBe('Bitcoin caindo 5% no dia');
});
test('aceita qualquer código da B3 (mesmo fora da carteira), USD e BTC; recusa lixo', () => {
  for (const ok of ['PETR4', 'mxrf11', 'ITUB4.SA', 'usd', 'BTC', 'VIVT3']) expect(validAlertTicker(ok)).toBe(true);
  for (const bad of ['', 'PETR', 'EUR', 'DÓLAR', '1234', 'Petrobras']) expect(validAlertTicker(bad)).toBe(false);
});
test('tickers sem cotação são buscados à parte; alerta desligado não conta', () => {
  const q = { PETR4: { price: 30, dayPct: 0 } };
  expect(missingAlertTickers([A('PETR4', 'below', 1), A('VALE3', 'below', 1), A(USD_TICKER, 'below', 1), A('ITUB4', 'below', 1, false), A('vale3', 'above', 1)], q)).toEqual(['VALE3', 'USD']);
});
test('alerta do dólar e do bitcoin disparam como os de ação', () => {
  const r = evaluateAlerts([A(USD_TICKER, 'below', 5.3), A(BTC_TICKER, 'risePct', 2), A('VALE3', 'above', 70)], { USD: { price: 5.25, dayPct: -0.4 }, BTC: { price: 500000, dayPct: 2.5 }, VALE3: { price: 69, dayPct: 1 } }, {}, new Date('2026-11-05T20:00:00Z'));
  expect(r.toFire.map(f => f.title)).toEqual(['Dólar abaixo de R$ 5,30', 'Bitcoin subindo 2% no dia']);
});
