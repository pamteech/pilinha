import { HistoryPoint } from './history';
import { LineItem } from './engine';
import { toISO } from './dates';
import { pct } from './format';
import { MonthClose, monthClose } from './monthClose';
/**
 * Retrospectiva do ano: como foi o ano, pelo histórico (um ponto por dia em que o app abriu). Mesmas contas do fechamento do mês:
 * o rendimento não conta aportes e a porcentagem é o ganho sobre o saldo de base + metade do aporte do ano.
 */
export interface YearReview { year: number; /** aplicado no ano; negativo = resgate */ aportes: number; /** rendimento em reais, sem contar aportes */ gain: number; gainPct: number | null; /** meses com fechamento em que o aplicado subiu */ monthsWithAporte: number; /** meses do ano com fechamento (monthClose) */ monthsTracked: number; /** mês de maior gainPct; label só com o nome ("março") */ bestMonth: { label: string; pct: number } | null; /** o ano ainda não acabou */ partial: boolean }
const yearMonth = (now: Date) => toISO(now).split('-').map(Number);
/** Ano da retrospectiva: em janeiro é o ano que acabou; no resto do ano, o atual (dia de Brasília). */
export function reviewYear(now = new Date()): number {
  const [y, m] = yearMonth(now);
  return m === 1 ? y - 1 : y;
}
/** O card da retrospectiva aparece de 1º de dezembro a 31 de janeiro. */
export const showYearReview = (now = new Date()) => [12, 1].includes(yearMonth(now)[1]);
/** Base = último ponto antes do ano (sem ele, o primeiro dentro do ano); fim = último ponto do ano. Menos de dois pontos: null. */
export function yearReview(history: HistoryPoint[], year: number, now = new Date()): YearReview | null {
  const pts = history.filter(p => Number.isFinite(p.total) && Number.isFinite(p.invested)).sort((a, b) => a.day.localeCompare(b.day));
  const inYear = pts.filter(p => p.day.startsWith(`${year}-`)), end = inYear[inYear.length - 1];
  const base = [...pts].reverse().find(p => p.day < `${year}-`) ?? inYear[0];
  if (!end || !base || end === base) return null;
  const aportes = end.invested - base.invested, gain = end.total - base.total - aportes, den = base.total + aportes / 2;
  const months = Array.from({ length: 12 }, (_, i) => monthClose(history, `${year}-${String(i + 1).padStart(2, '0')}`)).filter((c): c is MonthClose => !!c);
  const best = months.reduce<MonthClose | null>((b, c) => (c.gainPct != null && (b?.gainPct == null || c.gainPct > b.gainPct) ? c : b), null);
  return {
    year, aportes, gain, gainPct: den > 0 ? (gain / den) * 100 : null,
    monthsWithAporte: months.filter(c => c.aportes > 0.005).length, monthsTracked: months.length, // meio centavo de folga: ruído de arredondamento no aplicado não é aporte
    bestMonth: best?.gainPct != null ? { label: best.label.split(' ')[0], pct: best.gainPct } : null, partial: yearMonth(now)[0] <= year,
  };
}
/** Ativo em carteira com a maior porcentagem de ganho desde a compra (não é do ano). Só itens com aplicado positivo; sem nenhum: null. */
export function bestAsset(items: Pick<LineItem, 'name' | 'current' | 'invested'>[]): { name: string; pct: number } | null {
  return items.reduce<{ name: string; pct: number } | null>((b, i) => {
    const p = i.invested != null && i.invested > 0 ? (i.current / i.invested - 1) * 100 : NaN;
    return Number.isFinite(p) && (!b || p > b.pct) ? { name: i.name, pct: p } : b;
  }, null);
}
/** Texto para compartilhar: só porcentagens e contagens, nunca valor em reais. `aportes` false (algum ativo sem preço médio): a parte dos aportes sai, porque não é confiável. */
export function yearShareText(r: YearReview, aportes = true): string {
  const parts = [r.gainPct != null ? `rendeu ${pct(r.gainPct)}` : null, aportes ? `aportei em ${r.monthsWithAporte} de ${r.monthsTracked} ${r.monthsTracked === 1 ? 'mês' : 'meses'}` : null,
    r.bestMonth ? `melhor mês: ${r.bestMonth.label} (${pct(r.bestMonth.pct)})` : null].filter(Boolean);
  return `Meu ${r.year} no Pilinvest${r.partial ? ' até agora' : ''}: ${parts.join(', ')}.`;
}
