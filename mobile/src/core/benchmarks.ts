import { CDIDailyRate } from './cdi';
import { HistoryPoint } from './history';
import { parseISO } from './dates';
/**
 * Poupança (regra oficial): Selic meta > 8,5% a.a. -> 0,5% a.m. + TR; senão 70% da Selic (mensalizada) + TR.
 * TR em % a.m.; sem TR disponível usamos TR = 0 (aproximação, avisada na tela).
 */
export function poupancaMonthlyPct(selicAnnualPct: number, trMonthlyPct = 0): number {
  const base = selicAnnualPct > 8.5 ? 0.5 : (Math.pow(1 + (0.7 * selicAnnualPct) / 100, 1 / 12) - 1) * 100;
  return ((1 + base / 100) * (1 + trMonthlyPct / 100) - 1) * 100;
}
const DAY = 86_400_000;
export interface BenchPoint { day: string; carteira: number; cdi: number; poupanca: number | null }
/**
 * Rentabilidade acumulada desde o primeiro ponto do período, em %.
 * Carteira: variação do índice total/investido (neutraliza aportes). CDI: produto das taxas diárias do BCB.
 * Poupança: taxa mensal convertida em diária corrida.
 */
export function benchmarkSeries(points: HistoryPoint[], rates: CDIDailyRate[], selicAnnualPct: number | null, trMonthlyPct = 0): BenchPoint[] {
  const pts = points.filter(p => p.invested > 0 && p.total > 0);
  if (!pts.length) return [];
  const t0 = parseISO(pts[0].day)!.getTime(), idx0 = pts[0].total / pts[0].invested;
  const pDaily = selicAnnualPct == null ? null : Math.pow(1 + poupancaMonthlyPct(selicAnnualPct, trMonthlyPct) / 100, 1 / 30) - 1;
  const sorted = [...rates].sort((a, b) => a.date.getTime() - b.date.getTime());
  return pts.map(p => {
    const t = parseISO(p.day)!.getTime();
    let f = 1; for (const r of sorted) if (r.date.getTime() >= t0 && r.date.getTime() < t) f *= 1 + r.percent / 100;
    const days = Math.round((t - t0) / DAY);
    return { day: p.day, carteira: ((p.total / p.invested) / idx0 - 1) * 100, cdi: (f - 1) * 100, poupanca: pDaily == null ? null : (Math.pow(1 + pDaily, days) - 1) * 100 };
  });
}
