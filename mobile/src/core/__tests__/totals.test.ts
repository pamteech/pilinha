import fs from 'fs';
import path from 'path';
import { LineItem, Snapshot, HIDDEN_MONEY, HIDDEN_USD, investmentsDayPct, investmentsTotal, splitTotals, total, usd, usdCardChangePct } from '..';

const it = (name: string, category: string, current: number, extra: Partial<LineItem> = {}): LineItem =>
  ({ name, category, invested: extra.invested === undefined ? current : extra.invested, current, dayChange: extra.dayChange ?? null, net: extra.net ?? null, ...extra });

const snap = (items: LineItem[], extra: Partial<Snapshot> = {}): Pick<Snapshot, 'items' | 'usdChangePct' | 'usdBRL'> =>
  ({ items, usdChangePct: extra.usdChangePct ?? null, usdBRL: extra.usdBRL ?? null });

describe('separação dos totais (investimentos × dólar)', () => {
  const acao = it('FAKE4', 'acao', 10_000, { invested: 8_000, dayChange: 100, unitPrice: 20, quantity: 500 });
  const renda = it('CDB Banco', 'cdb', 5_000, { invested: 4_800, dayChange: 2, net: 4_900 });
  const dolar = it('Dólar', 'dolar', 2_700, { invested: 2_500, dayChange: 20, quantity: 500, unitPrice: 5.4 });

  test('total geral continua somando o dólar; Meus investimentos exclui', () => {
    const s = snap([acao, renda, dolar]);
    expect(total({ items: s.items } as Snapshot)).toBe(17_700);
    expect(investmentsTotal(s)).toBe(15_000);
    expect(investmentsDayPct(s)).toBeCloseTo(102 / (15_000 - 102) * 100);
  });
  test('cartões: R$ nos investimentos, US$ em destaque no dólar, equivalente em R$ abaixo', () => {
    const v = splitTotals(snap([acao, renda, dolar], { usdBRL: 5.4, usdChangePct: 0.5 }), false);
    expect(v.investments.show).toBe(true);
    expect(v.investments.title).toBe('Meus investimentos');
    expect(v.investments.total).toBe('R$ 15.000,00');
    expect(v.investments.dayPct).toMatch(/^\+/);
    expect(v.investments.dayChange).toBe('R$ 102,00');
    expect(v.investments.net).toBe('Líquido se resgatar hoje: R$ 14.900,00');
    expect(v.usd?.show).toBe(true);
    expect(v.usd?.title).toBe('Em dólar');
    expect(v.usd?.usd).toBe('US$ 500,00');
    expect(v.usd?.brl).toBe('R$ 2.700,00');
    expect(v.usd?.dayPct).toBe('+0,75%'); // 20 / (2700-20)
    expect(v.combined).toEqual({ label: 'Total com dólar', value: 'R$ 17.700,00' });
  });
  test('olho mascara os dois cartões e a linha do total; porcentagens do dia ficam', () => {
    const v = splitTotals(snap([acao, dolar], { usdBRL: 5.4, usdChangePct: 0.5 }), true);
    expect(v.investments.total).toBe(HIDDEN_MONEY);
    expect(v.investments.dayChange).toBeNull();
    expect(v.investments.gain).toBeNull();
    expect(v.investments.dayPct).not.toBeNull();
    expect(v.usd?.usd).toBe(HIDDEN_USD);
    expect(v.usd?.brl).toBe(HIDDEN_MONEY);
    expect(v.usd?.dayPct).not.toBeNull();
    expect(v.combined?.value).toBe(HIDDEN_MONEY);
    expect(JSON.stringify(v)).not.toMatch(/10\.000|2\.700|500,00/);
  });
  test('sem posição em dólar (ou zerada) o cartão some e não há total combinado', () => {
    expect(splitTotals(snap([acao]), false).usd).toBeNull();
    expect(splitTotals(snap([acao]), false).combined).toBeNull();
    expect(splitTotals(snap([acao, it('Dólar', 'dolar', 0, { quantity: 0 })]), false).usd).toBeNull();
  });
  test('só dólar: some Meus investimentos e não inventa total combinado', () => {
    const v = splitTotals(snap([dolar], { usdBRL: 5.4 }), false);
    expect(v.investments.show).toBe(false);
    expect(v.usd?.usd).toBe('US$ 500,00');
    expect(v.combined).toBeNull();
  });
  test('variação do dólar usa o fechamento das 17h quando existe; senão a do momento', () => {
    expect(usdCardChangePct(1.2, { changePct: -0.4 })).toBeCloseTo(-0.4);
    expect(usdCardChangePct(1.2, null)).toBeCloseTo(1.2);
    expect(usdCardChangePct(null, null)).toBeNull();
    const live = snap([dolar], { usdChangePct: 1.2 });
    expect(splitTotals(live, false).usd?.dayPct).toBe('+0,75%'); // item day pct tem prioridade sobre o live do snap
    expect(splitTotals(live, false, { changePct: -0.4 }).usd?.dayPct).toBe('-0,40%');
    expect(splitTotals(live, false, { changePct: -0.4 }).usd?.tone).toBe('down');
  });
  test('usd formata como o R$', () => {
    expect(usd(1500)).toBe('US$ 1.500,00'); expect(usd(0.5)).toBe('US$ 0,50');
  });
  test('Início e Carteira usam os dois cartões; total() e a distribuição não foram reescritos', () => {
    const home = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/index.tsx'), 'utf8');
    const carteira = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/carteira.tsx'), 'utf8');
    const engine = fs.readFileSync(path.join(__dirname, '../engine.ts'), 'utf8');
    expect(home).toMatch(/TotalsSplit/);
    expect(carteira).toMatch(/TotalsSplit/);
    expect(engine).toMatch(/export const total = \(s: Snapshot\) => s\.items\.reduce/);
    expect(home + carteira).not.toMatch(/Comprar|Vender|Saldo disponível/);
  });
});
