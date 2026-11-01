import {
  Portfolio, applyDraft, draftFor, emptyDraft, existingNotice, latestTreasuryOffers, markToMarket, mergeHits, parsePortfolio, parseYahooSearch,
  preview, rateModelOf, removeItem, serializePortfolio, treasuryTitle, treasuryTypeOf, validateDraft, value, localSearch, snapshot, offerName,
} from '..';
// Carteira de exemplo (valores fictícios).
const base = (): Portfolio => ({
  owner: 'exemplo', tradingview: { symbols: { X: 'Y' } },
  fixedIncome: [
    { name: 'Caixinha Viagem', kind: 'caixinha', cdiPercent: 100, deposits: [{ date: '2026-01-05', amount: 1000 }] },
    { name: 'Tesouro Selic 2029', kind: 'tesouro', cdiPercent: 100, maturity: '2029-03-01', deposits: [{ date: '2026-02-02', amount: 500 }] },
    { name: 'Tesouro IPCA+ 2035', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7.5, maturity: '2035-05-15', deposits: [{ date: '2026-03-02', amount: 200 }, { date: '2026-04-01', amount: 100 }] },
  ],
  stocks: [{ ticker: 'PETR4', quantity: 100, averagePrice: 30 }, { ticker: 'MXRF11', quantity: 10 }],
  crypto: [{ coinId: 'bitcoin', symbol: 'BTC', quantity: 0.01, averagePriceBRL: 300000 }],
  manualDividends: [{ ticker: 'MXRF11', date: '2026-05-10', amount: 1 }], usd: { amount: 100, averageRateBRL: 5 },
  watchlist: [{ ticker: 'TAEE11', targetPrice: 30 }],
});
const NOW = new Date('2026-11-01T15:00:00Z');
const d = (over: Partial<ReturnType<typeof emptyDraft>> & { type: any }) => ({ ...emptyDraft(over.type, '2026-10-15'), ...over });

describe('migração / compatibilidade', () => {
  test('Selic antigo (CDI 100%) é reconhecido como Selic sem reescrever nada', () => {
    const p = base(); const before = JSON.stringify(p);
    expect(treasuryTypeOf(p.fixedIncome[1])).toBe('selic');
    expect(treasuryTypeOf(p.fixedIncome[2])).toBe('ipca');
    expect(treasuryTypeOf(p.fixedIncome[0])).toBeNull();
    expect(rateModelOf(p.fixedIncome[1])).toBe('cdi');
    expect(treasuryTitle(p.fixedIncome[1])?.title).toBe('Tesouro Selic');
    expect(JSON.stringify(parsePortfolio(serializePortfolio(p)))).toBe(before);
  });
  test('campos novos desconhecidos/ruins nunca impedem a carteira de abrir', () => {
    const j = JSON.parse(serializePortfolio(base()));
    j.fixedIncome[1].treasuryType = 'futuro'; j.fixedIncome[0].fixedRate = 'x'; j.campoDoMac = 1;
    const p = parsePortfolio(JSON.stringify(j));
    expect(p.fixedIncome).toHaveLength(3); expect(p.fixedIncome[1].treasuryType).toBeUndefined(); expect(p.fixedIncome[0].fixedRate).toBeUndefined();
    expect((p as any).campoDoMac).toBe(1);
  });
  test('Prefixado gravado continua legível por quem só entende CDI (indexer ausente, cdiPercent 100)', () => {
    const r = applyDraft(base(), d({ type: 'tesouro', treasury: 'prefixado', rate: '13,2', maturity: '2031-01-01', amount: '1000', date: '2026-10-15' }));
    const a = r.portfolio.fixedIncome.at(-1)!;
    expect(a).toMatchObject({ name: 'Tesouro Prefixado 2031', kind: 'tesouro', cdiPercent: 100, treasuryType: 'prefixado', fixedRate: 13.2 });
    expect(a.indexer).toBeUndefined();
    expect(parsePortfolio(serializePortfolio(r.portfolio)).fixedIncome.at(-1)).toEqual(a);
  });
});

describe('Selic e Prefixado nos cálculos', () => {
  const rates = Array.from({ length: 252 }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 2) + i * 86_400_000), percent: 0.05 }));
  test('Prefixado rende pela taxa em dias úteis/252', () => {
    const a = { name: 'P', kind: 'tesouro' as const, cdiPercent: 100, treasuryType: 'prefixado' as const, fixedRate: 12, deposits: [{ date: '2026-01-01', amount: 1000 }] };
    const v = value(a, rates, new Date(Date.UTC(2027, 0, 1)));
    expect(v.gross).toBeCloseTo(1120, 1);
  });
  test('Selic rende como 100% do CDI', () => {
    const a = base().fixedIncome[1]; a.deposits = [{ date: '2026-01-01', amount: 1000 }]; a.treasuryType = 'selic';
    expect(value(a, rates, new Date(Date.UTC(2027, 0, 1))).gross).toBeCloseTo(1000 * Math.pow(1.0005, 252), 4);
  });
  test('título da planilha para Prefixado e marcação a mercado', () => {
    const a = { name: 'Tesouro Prefixado 2031', kind: 'tesouro' as const, cdiPercent: 100, treasuryType: 'prefixado' as const, fixedRate: 13, maturity: '2031-01-01', deposits: [{ date: '2026-10-01', amount: 1000 }] };
    expect(treasuryTitle(a)).toEqual({ title: 'Tesouro Prefixado', maturity: '2031-01-01' });
    const m = markToMarket(a, [{ title: 'Tesouro Prefixado', maturity: '2031-01-01', day: '2026-10-01', buyRate: 13, sellRate: 13.1, puBuy: 500, puSell: 499 },
      { title: 'Tesouro Prefixado', maturity: '2031-01-01', day: '2026-10-30', buyRate: 13, sellRate: 13.1, puBuy: 510, puSell: 505 }]);
    expect(m?.value).toBeCloseTo(1010, 6);
  });
  test('snapshot calcula Prefixado sem erro', async () => {
    const p: Portfolio = { fixedIncome: [{ name: 'P', kind: 'tesouro', cdiPercent: 100, treasuryType: 'prefixado', fixedRate: 12, deposits: [{ date: '2026-01-01', amount: 1000 }] }], stocks: [], crypto: [] };
    const f = async (u: string) => (u.includes('awesomeapi') ? { USDBRL: { bid: '5', pctChange: '0' } } : []);
    const s = await snapshot(p, { now: new Date(Date.UTC(2027, 0, 1)), fetcher: f as any, cdi: async () => rates });
    expect(s.items[0].current).toBeCloseTo(1120, 1);
    expect(s.items[0].dayChange!).toBeGreaterThan(0);
  });
});

describe('soma de aportes e preço médio', () => {
  test('renda fixa com o mesmo nome vira novo aporte, sem tocar no resto', () => {
    const p = base();
    const r = applyDraft(p, d({ type: 'renda', name: 'caixinha viagem', amount: '250,50', date: '2026-10-01' }));
    expect(r.merged).toBe(true);
    expect(r.portfolio.fixedIncome[0].deposits).toEqual([{ date: '2026-01-05', amount: 1000 }, { date: '2026-10-01', amount: 250.5 }]);
    expect(r.portfolio.fixedIncome.slice(1)).toEqual(p.fixedIncome.slice(1));
    expect(r.portfolio.stocks).toEqual(p.stocks); expect(r.portfolio.owner).toBe('exemplo'); expect(r.portfolio.tradingview).toEqual(p.tradingview);
    expect(existingNotice(d({ type: 'renda', name: 'Caixinha Viagem' }), p)).toMatch(/novo aporte/);
  });
  test('ação repetida soma quantidade com preço médio ponderado e explica a conta', () => {
    const p = base();
    const dr = d({ type: 'acao', ticker: 'PETR4', quantity: '50', avg: '36' });
    const r = applyDraft(p, dr);
    expect(r.merged).toBe(true);
    expect(r.portfolio.stocks[0]).toEqual({ ticker: 'PETR4', quantity: 150, averagePrice: 32 });
    const n = existingNotice(dr, p)!;
    expect(n).toMatch(/100 \+ 50 = 150/); expect(n).toMatch(/R\$ 32,00/);
    expect(existingNotice(dr, p, true)).not.toMatch(/\d{2}/);
  });
  test('sem preço médio novo mantém o anterior; sem preço antigo usa o novo', () => {
    expect(applyDraft(base(), d({ type: 'acao', ticker: 'PETR4', quantity: '10', avg: '' })).portfolio.stocks[0]).toEqual({ ticker: 'PETR4', quantity: 110, averagePrice: 30 });
    expect(applyDraft(base(), d({ type: 'fii', ticker: 'MXRF11', quantity: '10', avg: '10' })).portfolio.stocks[1]).toEqual({ ticker: 'MXRF11', quantity: 20, averagePrice: 10 });
  });
  test('bitcoin e dólar somam com média ponderada', () => {
    const r = applyDraft(base(), d({ type: 'bitcoin', quantity: '0,01', avg: '400000' })).portfolio;
    expect(r.crypto[0].quantity).toBeCloseTo(0.02); expect(r.crypto[0].averagePriceBRL).toBeCloseTo(350000);
    expect(applyDraft(base(), d({ type: 'dolar', quantity: '100', avg: '6' })).portfolio.usd).toEqual({ amount: 200, averageRateBRL: 5.5 });
  });
  test('novo provento entra na lista', () => {
    expect(applyDraft(base(), d({ type: 'provento', ticker: 'mxrf11', amount: '2,5', date: '2026-10-10' })).portfolio.manualDividends).toHaveLength(2);
  });
});

describe('editar e remover', () => {
  test('editar troca só o item editado e preserva os aportes quando há vários', () => {
    const p = base();
    const dr = draftFor(p, { category: 'tesouro', name: 'Tesouro IPCA+ 2035' })!;
    expect(dr).toMatchObject({ type: 'tesouro', treasury: 'ipca', rate: '7,5', maturity: '2035-05-15', editKey: 'Tesouro IPCA+ 2035' });
    const r = applyDraft(p, { ...dr, rate: '7,89' }).portfolio;
    expect(r.fixedIncome[2]).toMatchObject({ realRate: 7.89, indexer: 'ipca', deposits: p.fixedIncome[2].deposits });
    expect(r.fixedIncome.slice(0, 2)).toEqual(p.fixedIncome.slice(0, 2));
  });
  test('editar ação substitui quantidade e preço (não soma)', () => {
    const p = base(); const dr = draftFor(p, { category: 'acao', name: 'PETR4' })!;
    expect(dr).toMatchObject({ ticker: 'PETR4', quantity: '100', avg: '30' });
    expect(applyDraft(p, { ...dr, quantity: '120', avg: '' }).portfolio.stocks).toEqual([{ ticker: 'MXRF11', quantity: 10 }, { ticker: 'PETR4', quantity: 120 }]);
  });
  test('editar Selic antigo mantém o % do CDI e passa a marcar o tipo', () => {
    const p = base(); const dr = draftFor(p, { category: 'tesouro', name: 'Tesouro Selic 2029' })!;
    expect(dr.treasury).toBe('selic');
    const a = applyDraft(p, dr).portfolio.fixedIncome[1];
    expect(a).toMatchObject({ cdiPercent: 100, treasuryType: 'selic', maturity: '2029-03-01', deposits: [{ date: '2026-02-02', amount: 500 }] });
  });
  test('cripto e dólar abrem para editar; remover tira só o item', () => {
    const p = base();
    expect(draftFor(p, { category: 'cripto', name: 'BTC' })).toMatchObject({ type: 'bitcoin', quantity: '0,01' });
    expect(draftFor(p, { category: 'dolar', name: 'Dólar' })).toMatchObject({ type: 'dolar', quantity: '100' });
    const r = removeItem(p, { category: 'acao', name: 'PETR4' });
    expect(r.stocks).toEqual([{ ticker: 'MXRF11', quantity: 10 }]); expect(r.fixedIncome).toEqual(p.fixedIncome);
    expect(removeItem(p, { category: 'dolar', name: 'Dólar' }).usd).toBeUndefined();
  });
});

describe('validações', () => {
  const p = base();
  test('campos obrigatórios e datas', () => {
    expect(validateDraft(d({ type: 'renda', amount: '', date: '2026-10-01' }), p, NOW)).toHaveLength(1);
    expect(validateDraft(d({ type: 'renda', amount: '100', date: '2026-12-01' }), p, NOW)[0]).toMatch(/futuro/);
    expect(validateDraft(d({ type: 'renda', amount: '100', cdi: '0' }), p, NOW)[0]).toMatch(/CDI/);
    expect(validateDraft(d({ type: 'renda', amount: '100', date: '2026-10-01' }), p, NOW)).toEqual([]);
  });
  test('Tesouro: taxa só para Prefixado/IPCA+', () => {
    expect(validateDraft(d({ type: 'tesouro', treasury: 'ipca', rate: '', amount: '100' }), p, NOW)[0]).toMatch(/IPCA/);
    expect(validateDraft(d({ type: 'tesouro', treasury: 'prefixado', rate: '80', amount: '100' }), p, NOW)[0]).toMatch(/prefixada/);
    expect(validateDraft(d({ type: 'tesouro', treasury: 'selic', amount: '100' }), p, NOW)).toEqual([]);
  });
  test('ações, bitcoin e provento', () => {
    expect(validateDraft(d({ type: 'acao', ticker: 'PETRO', quantity: '1' }), p, NOW)[0]).toMatch(/código/);
    expect(validateDraft(d({ type: 'acao', ticker: 'PETR4', quantity: '0' }), p, NOW)).toHaveLength(1);
    expect(validateDraft(d({ type: 'bitcoin', quantity: '0,001', avg: 'abc' }), p, NOW)).toHaveLength(1);
    expect(validateDraft(d({ type: 'provento', ticker: 'MXRF11', amount: '1', date: '2026-10-01' }), p, NOW)).toEqual([]);
  });
});

describe('prévia, planilha e busca', () => {
  test('prévia da renda fixa: valor de hoje e 1 ano', () => {
    const pv = preview(d({ type: 'renda', amount: '1000', date: '2026-11-01', cdi: '110' }), { cdiAnnual: 10, now: new Date('2026-11-01T12:00:00Z') });
    expect(pv.invested).toBe(1000); expect(pv.yearGain).toBeCloseTo(110); expect(pv.today).toBeCloseTo(1000, 0);
    expect(preview(d({ type: 'acao', ticker: 'PETR4', quantity: '10', avg: '30' }), { cdiAnnual: null, price: 40 })).toMatchObject({ invested: 300, today: 400 });
  });
  test('ofertas do dia mais recente, sem vencidos', () => {
    const csv = ['Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha',
      'Tesouro IPCA+;15/05/2035;29/10/2026;7,80;7,92;2000,00;1990,00;1990,00',
      'Tesouro IPCA+;15/05/2035;30/10/2026;7,89;8,01;2001,00;1991,00;1991,00',
      'Tesouro Selic;01/03/2029;30/10/2026;0,0500;0,0600;17000,00;16990,00;16990,00',
      'Tesouro Prefixado;01/01/2020;30/10/2026;10,00;10,10;900,00;899,00;899,00',
      'Tesouro Prefixado;01/01/2031;30/10/2026;13,20;13,32;600,00;598,00;598,00'].join('\n');
    const o = latestTreasuryOffers(csv, '2026-11-01');
    expect(o.map(offerName)).toEqual(['Tesouro IPCA+ 2035', 'Tesouro Prefixado 2031', 'Tesouro Selic 2029']);
    expect(o[0]).toMatchObject({ type: 'ipca', buyRate: 7.89, day: '2026-10-30' });
  });
  test('busca por nome ou código', () => {
    expect(localSearch('petro').map(h => h.ticker)).toEqual(expect.arrayContaining(['PETR4', 'PETR3', 'PRIO3']));
    expect(localSearch('maxi', true).map(h => h.ticker)).toEqual(['MXRF11']);
    expect(localSearch('mxrf', false)).toEqual([]);
    const y = parseYahooSearch({ quotes: [{ symbol: 'PETR4.SA', shortname: 'PETROBRAS PN' }, { symbol: 'PBR', shortname: 'x' }, { symbol: 'PETR4.SA' }] });
    expect(y).toEqual([{ ticker: 'PETR4', name: 'PETROBRAS PN' }]);
    expect(mergeHits(localSearch('petr4'), y)).toHaveLength(1);
  });
});
