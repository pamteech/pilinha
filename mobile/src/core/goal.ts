/** Meta do cofrinho: progresso de 0 a 100 e quanto falta (null sem meta). */
export function goalProgress(total: number, target: number | null | undefined) {
  if (!target || !(target > 0) || !Number.isFinite(total)) return null;
  const pct = Math.max(0, Math.min(100, (total / target) * 100));
  return { pct, remaining: Math.max(0, target - total), done: total >= target };
}
