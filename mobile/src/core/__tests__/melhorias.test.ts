import { parseTreasuryCSV, markToMarket, treasuryTitle, watchRow, watchAlerts, evaluateAlerts, triggered, PriceAlert, staleInfo, itemGain, parsePortfolio, mergePortfolio, receivedTotal, snapshot, FixedIncomeAsset } from '..';
const csv = `Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha
Tesouro IPCA+;15/08/2032;29/10/2026;7,84;7,96;3090,37;3069,51;3069,51
Tesouro IPCA+;15/08/2032;30/10/2026;7,89;8,01;3083,90;3062,48;3062,48
Tesouro IPCA+;15/08/2035;30/10/2026;7,5;7,6;2000,00;1990,00;1990,00
Tesouro Selic;01/03/2029;30/10/2026;0,06;0,07;20185,67;20170,66;20170,66`;
const ipca: FixedIncomeAsset = { name: 'Tesouro IPCA+ 2032', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7.89, maturity: '2032-08-15', deposits: [{ date: '2026-10-30', amount: 1000 }] };
describe('Tesouro a mercado', () => {
  test('casa título e vencimento', () => {
    expect(treasuryTitle(ipca)).toEqual({ title: 'Tesouro IPCA+', maturity: '2032-08-15' });
    expect(treasuryTitle({ ...ipca, kind: 'cdb' })).toBeNull(); expect(treasuryTitle({ ...ipca, maturity: undefined })).toBeNull();
    const rows = parseTreasuryCSV(csv, [treasuryTitle(ipca)!]);
    expect(rows).toHaveLength(2); expect(rows[1].puSell).toBeCloseTo(3062.48);
  });
  test('quantidade pelo PU de compra do dia do aporte, valor pelo PU de venda mais recente', () => {
    const rows = parseTreasuryCSV(csv, [treasuryTitle(ipca)!]);
    const m = markToMarket(ipca, rows)!;
    expect(m.quantity).toBeCloseTo(1000 / 3083.9, 6); expect(m.value).toBeCloseTo(1000 / 3083.9 * 3062.48, 4); expect(m.day).toBe('2026-10-30'); expect(m.sellRate).toBe(8.01);
    // aporte num sábado usa o último dia útil antes
    expect(markToMarket({ ...ipca, deposits: [{ date: '2026-10-31', amount: 1000 }] }, rows)!.quantity).toBeCloseTo(1000 / 3083.9, 6);
    expect(markToMarket(ipca, [])).toBeNull();
  });
  test('snapshot: falha silenciosa sem CSV e marketValue com CSV', async () => {
    const f = async (u: string) => (u.includes('bcdata') ? [] : {});
    const p = { fixedIncome: [ipca], stocks: [], crypto: [] };
    const a = await snapshot(p, { fetcher: f, now: new Date('2026-11-01T12:00:00Z') });
    expect(a.items[0].marketValue).toBeUndefined();
    const b = await snapshot(p, { fetcher: f, now: new Date('2026-11-01T12:00:00Z'), treasury: parseTreasuryCSV(csv, [treasuryTitle(ipca)!]) });
    expect(b.items[0].marketValue).toBeCloseTo(1000 / 3083.9 * 3062.48, 4);
  });
});
describe('Favoritos', () => {
  test('distância do alvo e cotas', () => {
    const r = watchRow({ ticker: 'taee11', targetPrice: 30, amount: 500 }, { price: 33, dayPct: 1 });
    expect(r.ticker).toBe('TAEE11'); expect(r.distancePct).toBeCloseTo(10); expect(r.reached).toBe(false); expect(r.shares).toBe(16);
    expect(watchRow({ ticker: 'X', targetPrice: 30 }, { price: 29, dayPct: 0 }).reached).toBe(true);
    expect(watchRow({ ticker: 'X', targetPrice: 30 }).price).toBeNull();
  });
  test('alerta quando chega no preço, uma vez por dia', () => {
    const al = watchAlerts([{ ticker: 'taee11', targetPrice: 30 }]);
    const r = evaluateAlerts(al, { TAEE11: { price: 29.5, dayPct: -1 } }, {}, new Date('2026-11-03T14:00:00Z'));
    expect(r.toFire).toHaveLength(1); expect(r.toFire[0].title).toContain('chegou no seu preço');
    expect(evaluateAlerts(al, { TAEE11: { price: 29.5, dayPct: -1 } }, r.fired, new Date('2026-11-03T18:00:00Z')).toFire).toHaveLength(0);
  });
  test('JSON: retrocompatível, descarta favorito inválido, merge sem duplicar', () => {
    expect(parsePortfolio('{"fixedIncome":[],"stocks":[],"crypto":[]}').watchlist).toBeUndefined();
    const p = parsePortfolio('{"fixedIncome":[],"stocks":[],"crypto":[],"watchlist":[{"ticker":"taee11","targetPrice":30},{"ticker":"X","targetPrice":-1}]}');
    expect(p.watchlist).toEqual([{ ticker: 'TAEE11', targetPrice: 30 }]);
    const m = mergePortfolio({ ...p, watchlist: [{ ticker: 'BBSE3', targetPrice: 40 }, { ticker: 'TAEE11', targetPrice: 31 }] }, p);
    expect(m.watchlist).toEqual([{ ticker: 'BBSE3', targetPrice: 40 }, { ticker: 'TAEE11', targetPrice: 30 }]);
  });
});
describe('Outros', () => {
  test('alerta de alta no dia', () => {
    const a: PriceAlert = { id: 'r', ticker: 'BBAS3', kind: 'risePct', value: 3, enabled: true };
    expect(triggered(a, { price: 1, dayPct: 3.1 })).toBe(true); expect(triggered(a, { price: 1, dayPct: -5 })).toBe(false);
  });
  test('resultado em R$', () => { expect(itemGain({ current: 150, invested: 100 })).toBe(50); expect(itemGain({ current: 150, invested: null })).toBeNull(); });
  test('dados atrasados', () => { expect(staleInfo([]).stale).toBe(false); const s = staleInfo(['X: HTTP 429']); expect(s.stale).toBe(true); expect(s.title).toBe('Dados atrasados'); expect(s.detail).toContain('429'); });
  test('total recebido', () => { expect(receivedTotal([{ ticker: 'A', date: '2026-01-01', amount: 1.5 }, { ticker: 'B', date: '2026-02-01', amount: 2 }])).toEqual({ total: 3.5, count: 2 }); expect(receivedTotal(undefined).count).toBe(0); });
});

import { hiddenOnOpen, shouldRehide, hideOnOpenDefault, HIDE_AFTER_MS } from '..';
describe('Abrir com valores escondidos', () => {
  test('ligado por padrão e sempre começa oculto', () => {
    expect(hideOnOpenDefault).toBe(true);
    expect(hiddenOnOpen(undefined, false)).toBe(true); expect(hiddenOnOpen(true, false)).toBe(true);
    expect(hiddenOnOpen(false, false)).toBe(false); expect(hiddenOnOpen(false, true)).toBe(true);
  });
  test('esconde de novo só ao voltar do segundo plano', () => {
    expect(shouldRehide(true, 'background', 'active')).toBe(true);
    expect(shouldRehide(undefined, 'background', 'active')).toBe(true);
    expect(shouldRehide(true, 'inactive', 'active')).toBe(false);
    expect(shouldRehide(false, 'background', 'active')).toBe(false);
  });
  test('saída rápida do app mantém o último estado; só esconde depois de HIDE_AFTER_MS fora', () => {
    expect(HIDE_AFTER_MS).toBe(5 * 60_000);
    expect(shouldRehide(true, 'background', 'active', 60_000)).toBe(false);
    expect(shouldRehide(true, 'background', 'active', HIDE_AFTER_MS)).toBe(false);
    expect(shouldRehide(true, 'background', 'active', HIDE_AFTER_MS + 1)).toBe(true);
    expect(hiddenOnOpen(true, false, 60_000)).toBe(false); // estava visível: continua visível
    expect(hiddenOnOpen(true, true, 60_000)).toBe(true);
    expect(hiddenOnOpen(true, false, HIDE_AFTER_MS + 1)).toBe(true);
    expect(hiddenOnOpen(false, false, HIDE_AFTER_MS + 1)).toBe(false); // opção desligada: segue o estado salvo
  });
  test('sem registro de saída ou com relógio estranho, esconde por segurança', () => {
    expect(hiddenOnOpen(true, false, undefined)).toBe(true);
    expect(hiddenOnOpen(true, false, -5)).toBe(true);
    expect(hiddenOnOpen(true, false, NaN)).toBe(true);
    expect(shouldRehide(true, 'background', 'active', -5)).toBe(true);
    expect(shouldRehide(true, 'inactive', 'active', HIDE_AFTER_MS + 1)).toBe(false);
  });
});
