import * as fs from 'fs'; import * as path from 'path';
import { parsePortfolio, serializePortfolio, widgetSummary, isTradingHours, tradingViewSymbol, isTradingViewURL, parseISO } from '..';
test('importa o portfolio.example.json do Mac e volta igual', () => {
  const txt = fs.readFileSync(path.join(__dirname, '../../../../portfolio.example.json'), 'utf8');
  const p = parsePortfolio(txt); expect(p.fixedIncome.length).toBeGreaterThan(0);
  expect(JSON.parse(serializePortfolio(p))).toEqual({ ...JSON.parse(txt), manualDividends: JSON.parse(txt).manualDividends ?? [] });
});
test('rejeita arquivos ruins', () => {
  expect(() => parsePortfolio('nada')).toThrow(/JSON/);
  expect(() => parsePortfolio(JSON.stringify({ fixedIncome: [{ name: 'x', kind: 'poupanca', cdiPercent: 1, deposits: [] }] }))).toThrow();
  expect(() => parsePortfolio(JSON.stringify({ stocks: [{ ticker: 'PETR4' }] }))).toThrow();
});
test('widget no modo discreto não leva valores', () => {
  const w = widgetSummary(1000, 10, 1, 'feliz', true); expect(w.total).toBeNull(); expect(w.dayChange).toBeNull(); expect(w.dayChangePct).toBe(1);
  expect(widgetSummary(1000, 10, 1, 'feliz', false).total).toBe(1000);
});
test('pregão', () => {
  expect(isTradingHours(new Date('2026-10-23T14:00:00Z'))).toBe(true);   // sex 11h BRT
  expect(isTradingHours(new Date('2026-10-23T22:00:00Z'))).toBe(false);  // sex 19h
  expect(isTradingHours(new Date('2026-10-24T14:00:00Z'))).toBe(false);  // sáb
});
test('tradingview', () => {
  expect(tradingViewSymbol('petr4')).toBe('BMFBOVESPA:PETR4'); expect(tradingViewSymbol('BTC')).toBe('BINANCE:BTCBRL');
  expect(isTradingViewURL('https://br.tradingview.com/chart/')).toBe(true); expect(isTradingViewURL('https://evil.com/?tradingview.com')).toBe(false);
});
