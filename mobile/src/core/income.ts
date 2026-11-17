import { LineItem } from './engine';
/**
 * Renda passiva: quanto as ações e FIIs que estão na carteira hoje pagaram nos últimos 12 meses e quanto isso rende ao ano.
 * É estimativa olhando para trás (proventos de 12 meses ÷ valor de hoje), não promessa do que vem pela frente.
 */
export interface IncomeRow {
  ticker: string; received12m: number; current: number;
  /** proventos de 12 meses ÷ valor de hoje (null sem valor) */ dyPct: number | null;
  /** proventos de 12 meses ÷ o que foi pago (null sem preço médio) */ yocPct: number | null;
}
export interface IncomeSummary { /** média por mês dos últimos 12 meses */ monthly: number; annual: number; /** annual ÷ valor de hoje das ações e FIIs */ yieldPct: number | null; rows: IncomeRow[] }
const pos = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
/** `byTicker`: recebido por ticker nos últimos 12 meses (o `byTicker` de `dividendsByMonth`). Ticker fora da carteira é ignorado. */
export function incomeSummary(items: LineItem[], byTicker: { ticker: string; total: number }[]): IncomeSummary {
  const got = new Map<string, number>();
  for (const b of byTicker) { const t = b.ticker.toUpperCase(); got.set(t, (got.get(t) ?? 0) + pos(b.total)); }
  const rows = items.filter(i => i.category === 'acao' || i.category === 'fii').map(i => {
    const ticker = i.name.toUpperCase(), received12m = got.get(ticker) ?? 0, current = pos(i.current);
    return { ticker, received12m, current, dyPct: ratio(received12m, current), yocPct: ratio(received12m, pos(i.invested)) };
  }).sort((a, b) => b.received12m - a.received12m);
  const annual = rows.reduce((a, r) => a + r.received12m, 0);
  return { monthly: annual / 12, annual, yieldPct: ratio(annual, rows.reduce((a, r) => a + r.current, 0)), rows };
}
