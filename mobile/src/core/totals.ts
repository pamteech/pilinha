import { HIDDEN_MONEY } from './assetCard';
import { LineItem, Snapshot, total } from './engine';
import { brl, oneLineMoney, pct, signedBrl } from './format';
import { itemDayPct } from './insights';

/** Posição em dólar: não entra em "Meus investimentos", mas continua no total geral, na distribuição e no plano. */
export const isUsdItem = (i: Pick<LineItem, 'category'>) => i.category === 'dolar';
export const investmentsOf = (items: LineItem[]) => items.filter(i => !isUsdItem(i));
export const usdItemOf = (items: LineItem[]) => items.find(i => isUsdItem(i) && i.current > 0) ?? null;

export const investmentsTotal = (s: Pick<Snapshot, 'items'>) => investmentsOf(s.items).reduce((a, i) => a + i.current, 0);
export const investmentsNet = (s: Pick<Snapshot, 'items'>) => investmentsOf(s.items).reduce((a, i) => a + (i.net ?? i.current), 0);
export const investmentsInvested = (s: Pick<Snapshot, 'items'>) => investmentsOf(s.items).reduce((a, i) => a + (i.invested ?? i.current), 0);
export const investmentsGain = (s: Pick<Snapshot, 'items'>) => {
  const it = investmentsOf(s.items);
  return it.some(i => i.invested != null) ? investmentsTotal(s) - investmentsInvested(s) : null;
};
export const investmentsDayChange = (s: Pick<Snapshot, 'items'>) => investmentsOf(s.items).reduce((a, i) => a + (i.dayChange ?? 0), 0);
export function investmentsDayPct(s: Pick<Snapshot, 'items'>): number | null {
  const it = investmentsOf(s.items);
  const ch = it.map(i => i.dayChange).filter((x): x is number => x != null);
  if (!ch.length) return null;
  const d = ch.reduce((a, b) => a + b, 0), prev = it.reduce((a, i) => a + i.current, 0) - d;
  return prev > 0 ? (d / prev) * 100 : null;
}

export const HIDDEN_USD = 'US$ ••••';

/** US$ no mesmo formato brasileiro do R$ (1.500,00). */
export const usd = (v: number) => 'US$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const money = (v: number, hidden: boolean) => oneLineMoney(hidden ? HIDDEN_MONEY : brl(v));
const toneOf = (v: number | null | undefined): 'up' | 'down' | 'neutral' => (v == null ? 'neutral' : v >= 0 ? 'up' : 'down');

/** Variação do dólar no cartão: fechamento das 17h (Brasília) quando já existe; senão a do momento. */
export function usdCardChangePct(livePct: number | null | undefined, close?: { changePct: number } | null): number | null {
  if (close != null && Number.isFinite(close.changePct)) return close.changePct;
  return livePct ?? null;
}

export interface InvestmentsCardView {
  title: string;
  total: string;
  net: string | null;
  dayPct: string | null;
  dayChange: string | null;
  gain: string | null;
  tone: 'up' | 'down' | 'neutral';
  show: boolean;
}
export interface UsdCardView {
  title: string;
  usd: string;
  brl: string;
  dayPct: string | null;
  tone: 'up' | 'down' | 'neutral';
  show: boolean;
}
export interface SplitTotalsView {
  investments: InvestmentsCardView;
  usd: UsdCardView | null;
  /** Linha discreta só quando os dois cartões aparecem. */
  combined: { label: string; value: string } | null;
}

export function splitTotals(s: Pick<Snapshot, 'items' | 'usdChangePct' | 'usdBRL'>, hidden: boolean, close?: { changePct: number } | null): SplitTotalsView {
  const invItems = investmentsOf(s.items);
  const dayPct = investmentsDayPct(s);
  const gain = investmentsGain(s);
  const net = investmentsNet(s), tot = investmentsTotal(s);
  const u = usdItemOf(s.items);
  const amount = u == null ? null : (u.quantity != null && u.quantity > 0 ? u.quantity : (s.usdBRL && s.usdBRL > 0 ? u.current / s.usdBRL : null));
  const usdCard: UsdCardView | null = u && amount != null && amount > 0 ? (() => {
    const live = itemDayPct(u) ?? s.usdChangePct ?? null;
    const ch = usdCardChangePct(live, close);
    return {
      title: 'Em dólar',
      usd: oneLineMoney(hidden ? HIDDEN_USD : usd(amount)),
      brl: money(u.current, hidden),
      dayPct: ch == null ? null : pct(ch),
      tone: toneOf(ch),
      show: true,
    };
  })() : null;
  const investments: InvestmentsCardView = {
    title: 'Meus investimentos',
    total: money(tot, hidden),
    net: invItems.some(i => i.net != null) && Math.abs(net - tot) >= 0.005 ? `Líquido se resgatar hoje: ${money(net, hidden)}` : null,
    dayPct: dayPct == null ? null : pct(dayPct),
    dayChange: dayPct == null || hidden ? null : signedBrl(investmentsDayChange(s)),
    gain: gain == null ? null : (hidden ? null : oneLineMoney(`${gain >= 0 ? '+' : '−'}${brl(Math.abs(gain))}`)),
    tone: toneOf(dayPct ?? gain),
    show: invItems.length > 0,
  };
  const combined = investments.show && usdCard
    ? { label: 'Total com dólar', value: money(total({ items: s.items } as Snapshot), hidden) }
    : null;
  return { investments, usd: usdCard, combined };
}
