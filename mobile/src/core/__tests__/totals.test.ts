import fs from 'fs';
import path from 'path';
import { LineItem, Snapshot, HIDDEN_MONEY, HIDDEN_USD, investmentsDayPct, investmentsTotal, oneLineMoney, splitTotals, total, usd, usdCardChangePct } from '..';

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
    expect(v.investments.total).toBe(oneLineMoney('R$ 15.000,00'));
    expect(v.investments.dayPct).toMatch(/^\+/);
    expect(v.investments.dayChange).toBe(oneLineMoney('+R$ 102,00'));
    expect(v.investments.net).toBe(oneLineMoney('Líquido se resgatar hoje: R$ 14.900,00'));
    expect(v.usd?.show).toBe(true);
    expect(v.usd?.title).toBe('Em dólar');
    expect(v.usd?.usd).toBe(oneLineMoney('US$ 500,00'));
    expect(v.usd?.brl).toBe(oneLineMoney('R$ 2.700,00'));
    expect(v.usd?.dayPct).toBe('+0,75%'); // 20 / (2700-20)
    expect(v.combined).toEqual({ label: 'Total com dólar', value: oneLineMoney('R$ 17.700,00') });
  });
  test('olho mascara os dois cartões e a linha do total; porcentagens do dia ficam', () => {
    const v = splitTotals(snap([acao, dolar], { usdBRL: 5.4, usdChangePct: 0.5 }), true);
    expect(v.investments.total).toBe(oneLineMoney(HIDDEN_MONEY));
    expect(v.investments.dayChange).toBeNull();
    expect(v.investments.gain).toBeNull();
    expect(v.investments.dayPct).not.toBeNull();
    expect(v.usd?.usd).toBe(oneLineMoney(HIDDEN_USD));
    expect(v.usd?.brl).toBe(oneLineMoney(HIDDEN_MONEY));
    expect(v.usd?.dayPct).not.toBeNull();
    expect(v.combined?.value).toBe(oneLineMoney(HIDDEN_MONEY));
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
    expect(v.usd?.usd).toBe(oneLineMoney('US$ 500,00'));
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
  test('oneLineMoney impede a quebra entre R$/US$ e o número, inclusive em valor grande', () => {
    expect(oneLineMoney('R$ 1.234.567,89')).toBe('R$\u00A01.234.567,89');
    expect(oneLineMoney('US$ 12.345,67')).toBe('US$\u00A012.345,67');
    const v = splitTotals(snap([it('FAKE4', 'acao', 1_234_567.89), it('Dólar', 'dolar', 12_345.67, { quantity: 2000, unitPrice: 6.172835 })]), false);
    expect(v.investments.total).toBe(oneLineMoney('R$ 1.234.567,89'));
    expect(v.usd?.usd).toBe(oneLineMoney('US$ 2.000,00'));
    expect(v.investments.total).toContain('\u00A0');
    expect(v.investments.total).not.toMatch(/R\$ /);
  });
  test('os cartões forçam uma linha só e reduzem a fonte se precisar', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../components/TotalsSplit.tsx'), 'utf8');
    const ui = fs.readFileSync(path.join(__dirname, '../../components/ui.tsx'), 'utf8');
    expect(src).toMatch(/<Fit /);
    expect(ui).toMatch(/numberOfLines=\{1\}/);
    expect(ui).toMatch(/adjustsFontSizeToFit/);
    expect(ui).toMatch(/minimumFontScale/);
  });
  test('cartões empilhados no estilo limpo: linhas rotuladas, chevron, ícone de dólar, sem bloco roxo chapado e sem Nubank', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../components/TotalsSplit.tsx'), 'utf8');
    const ui = fs.readFileSync(path.join(__dirname, '../../components/ui.tsx'), 'utf8');
    const home = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/index.tsx'), 'utf8');
    const carteira = fs.readFileSync(path.join(__dirname, '../../app/(tabs)/carteira.tsx'), 'utf8');
    const theme = fs.readFileSync(path.join(__dirname, '../../lib/theme.ts'), 'utf8');
    expect(src).toMatch(/Rendimento do dia/);
    expect(src).toMatch(/CDI hoje/);
    expect(src).toMatch(/Em reais/);
    expect(src).toMatch(/Variação do dólar hoje/);
    expect(src).toMatch(/chevron-right/);
    expect(src).toMatch(/currency-usd/);
    expect(src).toMatch(/onOpenCarteira/);
    expect(src).toMatch(/cardSurface/);
    expect(src).not.toMatch(/T\.navy/);
    expect(home).toMatch(/EyeToggle/);
    expect(home).toMatch(/onOpenCarteira=\{\(\) => router\.navigate\('\/carteira'\)\}/);
    expect(carteira).toMatch(/cdiAnnual=\{snap\.cdiAnnual\}/);
    expect(ui).toMatch(/borderTopWidth: 1, borderTopColor: T\.line/);
    expect(theme).toMatch(/card: '#1F1F23'/);
    expect(theme).not.toMatch(/card: '#241A33'/);
    expect(src + ui + home + carteira).not.toMatch(/nubank|Nubank|820AD1/i);
    expect(src + home + carteira).not.toMatch(/Comprar|Vender|Saldo disponível/);
  });
});
