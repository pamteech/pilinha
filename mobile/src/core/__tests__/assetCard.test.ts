import fs from 'fs';
import path from 'path';
import { LineItem, MARKET_KIND_ICON, MARKET_KIND_LABEL, assetCardView, assetTitle, formatQuantity, itemQuantity, marketKind, HIDDEN_MONEY, HIDDEN_QTY, snapshot, Fetcher } from '..';

const item = (name: string, extra: Partial<LineItem> = {}): LineItem => ({
  name, category: 'acao', invested: 1000, current: 1200, dayChange: 24, net: null, unitPrice: 12, avgPrice: 10, quantity: 100, ...extra,
});

describe('tipo → ícone e rótulo', () => {
  test('ação brasileira (ON, PN e fracionária)', () => {
    expect(marketKind('PETR4')).toBe('acao'); expect(marketKind('vale3')).toBe('acao'); expect(marketKind('PETR4F')).toBe('acao');
    expect(MARKET_KIND_LABEL.acao).toBe('Ação brasileira'); expect(MARKET_KIND_ICON.acao).toBe('trending-up');
    expect(assetTitle('PETR4')).toBe('PETR4 · Petrobras PN'); expect(assetTitle('VALE3')).toBe('VALE3 · Vale ON');
  });
  test('FII termina em 11, salvo ETF e unit', () => {
    expect(marketKind('MXRF11')).toBe('fii'); expect(marketKind('HGLG11')).toBe('fii'); expect(marketKind('ABCD11')).toBe('fii');
    expect(MARKET_KIND_LABEL.fii).toBe('Fundo imobiliário'); expect(MARKET_KIND_ICON.fii).toBe('home-city');
    expect(assetTitle('MXRF11')).toBe('MXRF11 · Maxi Renda FII');
  });
  test('ETF conhecido não vira FII', () => {
    expect(marketKind('BOVA11')).toBe('etf'); expect(marketKind('IVVB11')).toBe('etf'); expect(marketKind('HASH11')).toBe('etf');
    expect(MARKET_KIND_LABEL.etf).toBe('Fundo de índice (ETF)'); expect(MARKET_KIND_ICON.etf).toBe('chart-box');
    expect(assetTitle('IVVB11')).toBe('IVVB11 · S&P 500');
  });
  test('BDR pelos sufixos 32–35 e 39', () => {
    expect(marketKind('AAPL34')).toBe('bdr'); expect(marketKind('MSFT34')).toBe('bdr'); expect(marketKind('AMZO34')).toBe('bdr');
    expect(marketKind('BERK35')).toBe('bdr'); expect(marketKind('XXXX32')).toBe('bdr');
    expect(MARKET_KIND_LABEL.bdr).toBe('BDR'); expect(MARKET_KIND_ICON.bdr).toBe('earth');
    expect(assetTitle('AAPL34')).toBe('AAPL34');
  });
  test('unit (TAEE11, SANB11) é ação, não FII', () => {
    expect(marketKind('TAEE11')).toBe('acao'); expect(marketKind('SANB11')).toBe('acao');
    expect(assetTitle('TAEE11')).toBe('TAEE11 · Taesa Unit');
  });
});

describe('ficha do cartão e mascaramento', () => {
  test('linhas rotuladas, valor em destaque e variação do dia na cotação', () => {
    const v = assetCardView(item('PETR4'), false);
    expect(v.title).toBe('PETR4 · Petrobras PN'); expect(v.subtitle).toBe('Ação brasileira'); expect(v.icon).toBe('trending-up');
    expect(v.total).toBe('R$ 1.200,00');
    expect(v.rows.map(r => r.label)).toEqual(['Quantidade', 'Preço médio', 'Cotação atual', 'Valorização']);
    expect(v.rows[0].value).toBe('100');
    expect(v.rows[1].value).toBe('R$ 10,00');
    expect(v.rows[2]).toMatchObject({ value: 'R$ 12,00', hint: '+2,04%', tone: 'up' });
    expect(v.rows[3]).toMatchObject({ value: '+R$ 200,00', hint: '+20,00%', tone: 'up', arrow: 'up' });
  });
  test('olho esconde total, quantidade, PM e valor da valorização; cotação e % do dia ficam', () => {
    const v = assetCardView(item('FAKE4', { category: 'acao' }), true);
    expect(v.total).toBe(HIDDEN_MONEY);
    expect(v.rows[0].value).toBe(HIDDEN_QTY);
    expect(v.rows[1].value).toBe(HIDDEN_MONEY);
    expect(v.rows[2]).toMatchObject({ value: 'R$ 12,00', hint: '+2,04%' });
    expect(v.rows[3]).toMatchObject({ value: HIDDEN_MONEY, hint: '+20,00%', tone: 'up', arrow: 'up' });
    expect(JSON.stringify(v)).not.toMatch(/1\.200,00|R\$ 10,00|\+R\$ 200/);
    expect(JSON.stringify(v)).not.toMatch(/100(?!\.)/);
  });
  test('queda: seta e cor vermelha; sem dados vira traço', () => {
    const down = assetCardView(item('FAKE4', { invested: 1000, current: 800, dayChange: -40, unitPrice: 8, avgPrice: 10, quantity: 100 }), false);
    expect(down.rows[2]).toMatchObject({ hint: '-4,76%', tone: 'down' });
    expect(down.rows[3]).toMatchObject({ value: '−R$ 200,00', hint: '-20,00%', tone: 'down', arrow: 'down' });
    const empty = assetCardView({ name: 'FAKE4', category: 'acao', invested: null, current: 10, dayChange: null, net: null }, false);
    expect(empty.rows.map(r => r.value)).toEqual(['—', '—', '—', '—']);
    expect(empty.rows[3].arrow).toBeUndefined();
  });
  test('quantidade cai da cotação se o item ainda não trouxer o campo', () => {
    expect(itemQuantity({ current: 1200, unitPrice: 12 })).toBe(100);
    expect(itemQuantity({ current: 1200, unitPrice: 12, quantity: 80 })).toBe(80);
    expect(formatQuantity(1000)).toBe('1.000');
    expect(formatQuantity(0.0015)).toBe('0,0015');
  });
  test('FII, ETF e BDR entram com o subtítulo certo', () => {
    expect(assetCardView(item('MXRF11', { category: 'fii' }), false).subtitle).toBe('Fundo imobiliário');
    expect(assetCardView(item('IVVB11', { category: 'fii' }), false)).toMatchObject({ kind: 'etf', subtitle: 'Fundo de índice (ETF)', icon: 'chart-box' });
    expect(assetCardView(item('AAPL34'), false)).toMatchObject({ kind: 'bdr', subtitle: 'BDR', icon: 'earth', title: 'AAPL34' });
  });
});

describe('snapshot passa a quantidade e a tela usa os cartões', () => {
  test('ações e cripto no snapshot trazem quantity', async () => {
    const f: Fetcher = async u => {
      if (u.includes('yahoo')) return { chart: { result: [{ meta: { regularMarketPrice: 10, chartPreviousClose: 10 } }] } };
      return { bitcoin: { brl: 100, brl_24h_change: 0 } };
    };
    const s = await snapshot({ fixedIncome: [], stocks: [{ ticker: 'BBAS3', quantity: 3, averagePrice: 20 }], crypto: [{ coinId: 'bitcoin', symbol: 'BTC', quantity: 0.5 }] }, { fetcher: f });
    expect(s.items.find(i => i.name === 'BBAS3')).toMatchObject({ quantity: 3, unitPrice: 10, avgPrice: 20 });
    expect(s.items.find(i => i.name === 'BTC')).toMatchObject({ quantity: 0.5 });
  });
  test('aba Ações e FIIs usa AssetCard; renda fixa continua com AssetRow; sem comprar/vender', () => {
    const carteira = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/carteira.tsx'), 'utf8');
    const ui = fs.readFileSync(path.join(__dirname, '../../components/ui.tsx'), 'utf8');
    expect(ui).toMatch(/export function AssetCard/);
    expect(ui).toMatch(/assetCardView/);
    expect(ui).toMatch(/MaterialCommunityIcons/);
    expect(carteira).toMatch(/g\.key === 'acoes'/);
    expect(carteira).toMatch(/<AssetCard /);
    expect(carteira).toMatch(/<AssetRow /);
    expect(carteira + ui).not.toMatch(/Comprar|Vender|Saldo disponível/);
  });
  test('no cartão do ativo a % fica à esquerda do dinheiro, com seta na coluna da %', () => {
    const ui = fs.readFileSync(path.join(__dirname, '../../components/ui.tsx'), 'utf8');
    expect(ui).toMatch(/pct=\{r\.hint\} amount=\{r\.value\} tone=\{r\.tone\} arrow=\{r\.arrow\}/);
    expect(ui).toMatch(/width: COL\.arrow/);
    expect(ui).toMatch(/arrow === 'up' \? 'arrow-up' : 'arrow-down'/);
  });
});
