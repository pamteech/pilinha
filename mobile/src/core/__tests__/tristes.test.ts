import {
  Portfolio, applyDraft, emptyDraft, validateDraft, parsePortfolio, serializePortfolio, parseTreasuryCSV, latestTreasuryOffers,
  markToMarket, sanitizeOffers, offerRateText, weekSummary,
} from '..';
import { parseNumberBR, validPastDate, validTicker } from '../numbers';
import { parseBCB, parseIPCA, cdiRates, stockQuote, cryptoBRL, selicAnnual, trMonthly, parseBrapi, parseYahoo } from '../quotes';
import { cachedCdiRates, reviveSnapshot, withTimeout, KV } from '../cache';
// Só dados de exemplo (fictícios).
const base = (): Portfolio => ({
  owner: 'exemplo', fixedIncome: [{ name: 'Caixinha Teste', kind: 'caixinha', cdiPercent: 100, deposits: [{ date: '2026-01-05', amount: 1000 }] }],
  stocks: [{ ticker: 'PETR4', quantity: 10, averagePrice: 30 }], crypto: [], manualDividends: [],
} as any);
const NOW = new Date('2026-11-01T15:00:00Z');
const d = (over: any) => ({ ...emptyDraft(over.type, '2026-10-15'), ...over });
const v = (over: any) => validateDraft(d(over), base(), NOW);

describe('cadastro: caminho triste', () => {
  test.each(['', '0', '-100', 'abc', '1,2,3', '  '])('valor inválido "%s" bloqueia', amount => {
    expect(v({ type: 'renda', amount }).length).toBeGreaterThan(0);
  });
  test('data futura bloqueia', () => expect(v({ type: 'renda', amount: '100', date: '2027-01-01' })).toContain('Quando? A data não pode ser no futuro.'));
  test.each(['2026-02-31', '15/10/2026', 'ontem', ''])('data inválida "%s" bloqueia', date => expect(v({ type: 'renda', amount: '100', date }).length).toBeGreaterThan(0));
  test('prefixado sem taxa bloqueia', () => expect(v({ type: 'tesouro', treasury: 'prefixado', rate: '', amount: '100' })).toContain('Taxa prefixada inválida (ex. 13,2).'));
  test.each(['51', '-1', 'treze', '999'])('prefixado com taxa absurda "%s" bloqueia', rate => expect(v({ type: 'tesouro', treasury: 'prefixado', rate, amount: '100' }).length).toBeGreaterThan(0));
  test('IPCA+ acima de 30% bloqueia', () => expect(v({ type: 'tesouro', treasury: 'ipca', rate: '31', amount: '100' })).toContain('Taxa do IPCA+ inválida (ex. 7,5).'));
  test.each(['0', '-5', '301', 'cem'])('% do CDI inválido "%s"', cdi => expect(v({ type: 'renda', amount: '100', cdi })).toContain('% do CDI inválido (ex. 100).'));
  test('vencimento inválido bloqueia', () => expect(v({ type: 'tesouro', treasury: 'selic', amount: '100', maturity: '2030-13-40' })).toContain('Vencimento inválido.'));
  test.each(['', 'PETR', 'XPTO', '1234', 'PETROBRAS'])('ticker inválido "%s" bloqueia', ticker => expect(v({ type: 'acao', ticker, quantity: '10' }).length).toBeGreaterThan(0));
  test.each(['0', '-3', 'dez', ''])('quantidade inválida "%s" em ação', quantity => expect(v({ type: 'acao', ticker: 'PETR4', quantity }).length).toBeGreaterThan(0));
  test('ação com quantidade fracionária bloqueia (ações são inteiras)', () => expect(v({ type: 'acao', ticker: 'PETR4', quantity: '1,5' }).length).toBeGreaterThan(0));
  test('FII com quantidade fracionária bloqueia', () => expect(v({ type: 'fii', ticker: 'MXRF11', quantity: '0,5' }).length).toBeGreaterThan(0));
  test('preço médio negativo bloqueia', () => expect(v({ type: 'acao', ticker: 'PETR4', quantity: '10', avg: '-1' })).toContain('Preço médio inválido (ex. 32,10).'));
  test('bitcoin zero bloqueia', () => expect(v({ type: 'bitcoin', quantity: '0' }).length).toBe(1));
  test('dólar com texto bloqueia', () => expect(v({ type: 'dolar', quantity: 'mil' }).length).toBe(1));
  test('provento futuro e sem valor', () => { const e = v({ type: 'provento', ticker: 'MXRF11', amount: '', date: '2030-01-01' }); expect(e.length).toBe(2); });
  test('parseNumberBR rejeita lixo', () => { for (const s of ['abc', '1,2,3', '--1', '1e5', 'R$']) expect(parseNumberBR(s)).toBeNaN(); });
  test('validPastDate e validTicker rejeitam entradas ruins', () => {
    expect(validPastDate('2026-11-02', NOW)).toBe(false); expect(validPastDate('xx', NOW)).toBe(false); expect(validTicker('ab')).toBe(false);
  });
});
describe('cadastro: caminho feliz', () => {
  test('bitcoin fracionário é aceito', () => expect(v({ type: 'bitcoin', quantity: '0,0015' })).toEqual([]));
  test('ação inteira com .SA é aceita', () => expect(v({ type: 'acao', ticker: 'itub4.sa', quantity: '100' })).toEqual([]));
  test('prefixado válido salva com fixedRate e não apaga outros itens', () => {
    const r = applyDraft(base(), d({ type: 'tesouro', treasury: 'prefixado', rate: '12,5', maturity: '2031-01-01', amount: '100' }));
    expect(r.portfolio.fixedIncome).toHaveLength(2); expect(r.portfolio.fixedIncome[1].fixedRate).toBe(12.5); expect(r.portfolio.stocks).toHaveLength(1);
  });
});

const HEAD = 'Tipo Titulo;Data Vencimento;Data Base;Taxa Compra Manha;Taxa Venda Manha;PU Compra Manha;PU Venda Manha;PU Base Manha';
const IPCA = { title: 'Tesouro IPCA+', maturity: '2035-05-15' };
const row = (day: string, pu = '3000,00') => `Tesouro IPCA+;15/05/2035;${day};7,50;7,60;${pu};${pu};${pu}`;
describe('Tesouro / IPCA+: caminho triste', () => {
  test('planilha vazia', () => { expect(parseTreasuryCSV('', [IPCA])).toEqual([]); expect(latestTreasuryOffers('')).toEqual([]); });
  test('só cabeçalho', () => expect(parseTreasuryCSV(HEAD, [IPCA])).toEqual([]));
  test('CSV corrompido (binário/HTML) não quebra', () => {
    const junk = '<html><body>erro 502</body></html>\n\u0000\u0001;;;\n' + 'x'.repeat(1000);
    expect(parseTreasuryCSV(junk, [IPCA])).toEqual([]); expect(latestTreasuryOffers(junk)).toEqual([]);
  });
  test('linha faltando colunas é ignorada', () => {
    const t = [HEAD, 'Tesouro IPCA+;15/05/2035;01/10/2026;7,5', row('02/10/2026')].join('\r\n');
    expect(parseTreasuryCSV(t, [IPCA])).toHaveLength(1);
  });
  test('datas inválidas são ignoradas', () => expect(parseTreasuryCSV([HEAD, row('32/13/2026')].join('\n'), [IPCA])).toEqual([]));
  test('PU com texto vira null e markToMarket devolve null', () => {
    const rows = parseTreasuryCSV([HEAD, row('02/10/2026', 'abc')].join('\n'), [IPCA]);
    expect(rows[0].puSell).toBeNull();
    expect(markToMarket({ name: 'Tesouro IPCA+ 2035', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7.5, maturity: '2035-05-15', deposits: [{ date: '2026-10-02', amount: 100 }] } as any, rows)).toBeNull();
  });
  test('título não encontrado', () => {
    const rows = parseTreasuryCSV([HEAD, row('02/10/2026')].join('\n'), [{ title: 'Tesouro Educa+', maturity: '2040-01-15' }]);
    expect(rows).toEqual([]);
  });
  test('markToMarket sem planilha ou sem vencimento', () => {
    const a: any = { name: 'Tesouro IPCA+ 2035', kind: 'tesouro', cdiPercent: 0, indexer: 'ipca', realRate: 7.5, maturity: '2035-05-15', deposits: [{ date: '2026-10-02', amount: 100 }] };
    expect(markToMarket(a, [])).toBeNull(); expect(markToMarket({ ...a, maturity: undefined }, [])).toBeNull();
  });
  test('ofertas do cache malformadas são descartadas', () => {
    expect(sanitizeOffers(null)).toEqual([]); expect(sanitizeOffers('x')).toEqual([]);
    expect(sanitizeOffers([{ title: 1 }, { title: 'T', maturity: 'x', type: 'ipca' }, { title: 'T', maturity: '2035-05-15', type: 'outro' }, { title: 'T', maturity: '2035-05-15', type: 'ipca', buyRate: NaN }])).toEqual([]);
  });
  test('taxa ausente mostra "sem taxa hoje"', () => { expect(offerRateText({ type: 'ipca', buyRate: null })).toBe('sem taxa hoje'); expect(offerRateText({ type: 'prefixado', buyRate: NaN })).toBe('sem taxa hoje'); });
  test('timeout rejeita', async () => { await expect(withTimeout(new Promise(() => {}), 10, 'planilha demorou')).rejects.toThrow('planilha demorou'); });
  test('falha de rede propaga pelo withTimeout', async () => { await expect(withTimeout(Promise.reject(new Error('rede')), 1000)).rejects.toThrow('rede'); });
  test('feliz: título vencido não aparece nas ofertas', () => {
    const t = [HEAD, row('02/10/2026'), 'Tesouro Prefixado;01/01/2025;02/10/2026;10,00;10,10;900,00;900,00;900,00'].join('\n');
    const o = latestTreasuryOffers(t, '2026-11-01'); expect(o).toHaveLength(1); expect(o[0].type).toBe('ipca');
  });
});

const fail = (msg = 'HTTP 500') => async () => { throw new Error(msg); };
describe('CDI do BCB e cotações: caminho triste', () => {
  test('BCB vazio / erro / lixo', () => {
    expect(parseBCB([])).toEqual([]); expect(parseBCB({ erro: 'x' })).toEqual([]); expect(parseBCB(null)).toEqual([]);
    expect(parseBCB([{ data: 'x', valor: 'y' }, { data: '01/10/2026', valor: 'abc' }])).toEqual([]);
    expect(parseIPCA('lixo')).toEqual([]);
  });
  test('cdiRates propaga HTTP 500', async () => { await expect(cdiRates(new Date('2026-01-01'), new Date('2026-02-01'), fail())).rejects.toThrow('HTTP 500'); });
  test('cache: rede falha e usa o CDI antigo', async () => {
    const store = new Map<string, string>(); const kv: KV = { get: async k => store.get(k) ?? null, set: async (k, val) => { store.set(k, val); } };
    const start = new Date('2026-01-02T00:00:00Z');
    await cachedCdiRates(start, new Date('2026-01-10T12:00:00Z'), kv, async () => [{ date: new Date('2026-01-05T00:00:00Z'), percent: 0.05 }]);
    const r = await cachedCdiRates(start, new Date('2026-01-12T12:00:00Z'), kv, fail('sem internet'));
    expect(r).toHaveLength(1); expect(r[0].percent).toBe(0.05);
  });
  test('cache vazio e rede falha: propaga o erro', async () => {
    const kv: KV = { get: async () => null, set: async () => {} };
    await expect(cachedCdiRates(new Date('2026-01-02'), NOW, kv, fail('sem internet'))).rejects.toThrow('sem internet');
  });
  test('cache corrompido não quebra (baixa de novo)', async () => {
    const kv: KV = { get: async () => '{lixo', set: async () => {} };
    const r = await cachedCdiRates(new Date('2026-01-02'), NOW, kv, async () => [{ date: new Date('2026-01-05'), percent: 0.05 }]);
    expect(r).toHaveLength(1);
  });
  test('snapshot corrompido vira null', () => { expect(reviveSnapshot('{x')).toBeNull(); expect(reviveSnapshot('{"items":1}')).toBeNull(); expect(reviveSnapshot(null)).toBeNull(); });
  test('brapi/yahoo com resposta vazia ou erro', () => {
    expect(() => parseBrapi({}, 'PETR4', false)).toThrow(); expect(() => parseBrapi({ error: true }, 'PETR4', false)).toThrow();
    expect(() => parseYahoo({}, 'PETR4')).toThrow(); expect(() => parseYahoo({ chart: { error: { code: 'Not Found' } } }, 'XPTO3')).toThrow('Not Found');
  });
  test('ticker inexistente: erro claro', async () => {
    await expect(stockQuote('XPTO3', null, async () => ({ chart: { result: [] } }))).rejects.toThrow('sem cotação');
  });
  test('brapi falha e Yahoo responde (feliz)', async () => {
    const f = async (u: string) => (u.includes('brapi') ? { error: true } : { chart: { result: [{ meta: { regularMarketPrice: 10, chartPreviousClose: 8 } }] } });
    const q = await stockQuote('PETR4', 'tok-exemplo', f); expect(q.source).toBe('yahoo'); expect(q.changePct).toBeCloseTo(25);
  });
  test('bitcoin: resposta vazia/inválida não inventa preço', async () => {
    expect(await cryptoBRL(['bitcoin'], async () => null)).toEqual({}); expect(await cryptoBRL(['bitcoin'], async () => ({ bitcoin: { brl: 'x' } }))).toEqual({});
    await expect(cryptoBRL(['bitcoin'], fail())).rejects.toThrow();
  });
  test('Selic indisponível e TR nula', async () => {
    await expect(selicAnnual(async () => [])).rejects.toThrow('Selic indisponível');
    expect(await trMonthly(fail())).toBeNull(); expect(await trMonthly(async () => 'x')).toBeNull();
  });
});

describe('io / portfolio.json: caminho triste', () => {
  test('JSON corrompido', () => { expect(() => parsePortfolio('{')).toThrow('O arquivo não é um JSON válido.'); expect(() => parsePortfolio('')).toThrow(); });
  test('null / número', () => { expect(() => parsePortfolio('null')).toThrow('Arquivo sem carteira.'); expect(() => parsePortfolio('5')).toThrow(); });
  test('objeto vazio abre como carteira vazia', () => { const p = parsePortfolio('{}'); expect(p.fixedIncome).toEqual([]); expect(p.stocks).toEqual([]); });
  test('renda fixa sem nome / aporte negativo / ação sem quantidade', () => {
    expect(() => parsePortfolio(JSON.stringify({ fixedIncome: [{ kind: 'cdb', cdiPercent: 100, deposits: [] }] }))).toThrow('Renda fixa nº 1');
    expect(() => parsePortfolio(JSON.stringify({ fixedIncome: [{ name: 'X', kind: 'cdb', cdiPercent: 100, deposits: [{ date: '2026-01-01', amount: -1 }] }] }))).toThrow('Aporte inválido');
    expect(() => parsePortfolio(JSON.stringify({ stocks: [{ ticker: 'PETR4' }] }))).toThrow('Ação inválida');
  });
  test('arquivo antigo sem treasuryType/fixedRate carrega igual', () => {
    const old = { fixedIncome: [{ name: 'Tesouro Selic 2029', kind: 'tesouro', cdiPercent: 100, maturity: '2029-03-01', deposits: [{ date: '2026-02-02', amount: 50 }] }], stocks: [], crypto: [], manualDividends: [] };
    const p = parsePortfolio(JSON.stringify(old)); expect(p.fixedIncome[0].treasuryType).toBeUndefined();
    expect(JSON.parse(serializePortfolio(p))).toEqual(old);
  });
  test('fixedRate absurdo é descartado sem quebrar', () => {
    const p = parsePortfolio(JSON.stringify({ fixedIncome: [{ name: 'P', kind: 'tesouro', cdiPercent: 100, treasuryType: 'prefixado', fixedRate: 999, deposits: [] }] }));
    expect(p.fixedIncome[0].fixedRate).toBeUndefined();
  });
});

describe('weekSummary: caminho triste', () => {
  test('carteira vazia', () => expect(weekSummary([], false)).toEqual({ ys: [], pct: null, gain: null }));
  test('um ponto só', () => expect(weekSummary([{ total: 100, invested: 100 }], false).pct).toBeNull());
  test('valores zerados não geram NaN', () => {
    const r = weekSummary([{ total: 0, invested: 0 }, { total: 0, invested: 0 }], true);
    expect(r.pct).toBeNull(); expect(r.gain).toBe(0); expect(r.ys).toEqual([0, 0]);
  });
  test('só aportes (sem rendimento): 0% e ganho 0', () => {
    const r = weekSummary([{ total: 100, invested: 100 }, { total: 300, invested: 300 }], false);
    expect(r.pct).toBeCloseTo(0); expect(r.gain).toBeCloseTo(0);
  });
  test('NaN/Infinity são ignorados', () => {
    const r = weekSummary([{ total: NaN, invested: 1 }, { total: 100, invested: 100 }, { total: Infinity, invested: 1 }, { total: 110, invested: 100 }], false);
    expect(r.ys).toEqual([100, 110]); expect(r.pct).toBeCloseTo(10); expect(r.gain).toBeCloseTo(10);
  });
});
