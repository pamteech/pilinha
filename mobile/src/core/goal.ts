/** Meta do cofrinho: progresso de 0 a 100 e quanto falta (null sem meta). */
export function goalProgress(total: number, target: number | null | undefined) {
  if (!target || !(target > 0) || !Number.isFinite(total)) return null;
  const pct = Math.max(0, Math.min(100, (total / target) * 100));
  return { pct, remaining: Math.max(0, target - total), done: total >= target };
}

/** Taxa mensal equivalente a uma taxa anual em % (juros compostos). */
export const monthlyRate = (annualPct: number) => Math.pow(1 + annualPct / 100, 1 / 12) - 1;
const MAX_MONTHS = 1200;
/**
 * Simulador de metas: meses até a meta aportando `monthly` por mês, com o patrimônio atual rendendo `annualPct` ao ano.
 * 0 se já chegou; null se nunca chega (sem aporte e sem saldo) ou se passaria de 100 anos.
 */
export function monthsToGoal(current: number, target: number, monthly: number, annualPct: number): number | null {
  if (!(target > 0) || ![current, monthly, annualPct].every(Number.isFinite)) return null;
  if (current >= target) return 0;
  const i = monthlyRate(annualPct), a = Math.max(0, monthly), p = Math.max(0, current);
  let n: number;
  if (i <= 0) { if (a <= 0) return null; n = (target - p) / a; }
  else if (a <= 0) { if (p <= 0) return null; n = Math.log(target / p) / Math.log(1 + i); }
  else n = Math.log((target * i + a) / (p * i + a)) / Math.log(1 + i);
  const m = Math.ceil(n - 1e-9);
  return Number.isFinite(m) && m <= MAX_MONTHS ? Math.max(0, m) : null;
}
/** Aporte mensal para chegar à meta em `months` meses (0 se já chegou; null com prazo inválido). */
export function monthlyForGoal(current: number, target: number, months: number, annualPct: number): number | null {
  if (!(target > 0) || !(months > 0) || ![current, annualPct].every(Number.isFinite)) return null;
  if (current >= target) return 0;
  const i = monthlyRate(annualPct), p = Math.max(0, current), g = Math.pow(1 + i, months);
  const a = i <= 0 ? (target - p) / months : ((target - p * g) * i) / (g - 1);
  return Math.max(0, a);
}
/** Renda passiva mensal (bruta) que um valor gera a uma taxa anual: a "renda projetada" da landing. */
export const passiveIncome = (amount: number, annualPct: number) => Math.max(0, amount) * monthlyRate(annualPct);
/** "8 meses", "1 ano", "2 anos e 3 meses". */
export function formatMonths(m: number): string {
  const y = Math.floor(m / 12), r = m % 12;
  const ys = y ? `${y} ano${y > 1 ? 's' : ''}` : '', ms = r ? `${r} ${r > 1 ? 'meses' : 'mês'}` : '';
  return ys && ms ? `${ys} e ${ms}` : ys || ms || 'agora';
}
