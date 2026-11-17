import { ALLOC_ORDER, AllocKey, AllocSlice } from './insights';
/**
 * Distribuição ideal por tipo e "onde aportar este mês": sugestão só com compras, nunca vender.
 * ideal do tipo = % ideal × (carteira + aporte); falta = o que está abaixo do ideal; o aporte é dividido na proporção das faltas.
 * Quem já está acima do ideal recebe zero. Não é recomendação de investimento: a distribuição é a que a pessoa escolheu.
 */
export type AllocTargets = Partial<Record<AllocKey, number>>;
export interface AporteRow { key: AllocKey; currentPct: number; targetPct: number; /** quanto colocar neste tipo, em R$ */ suggest: number; /** % do tipo depois do aporte */ afterPct: number }
const TARGET_TOLERANCE = 0.5;
const num = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
/** Validação da distribuição ideal (vazio = ok). */
export function validateTargets(t: AllocTargets): string[] {
  const v = ALLOC_ORDER.map(k => t[k] ?? 0);
  if (v.some(x => !Number.isFinite(x) || x < 0 || x > 100)) return ['Cada tipo tem que ficar entre 0 e 100%.'];
  return Math.abs(v.reduce((a, x) => a + x, 0) - 100) > TARGET_TOLERANCE ? ['A soma tem que dar 100%.'] : [];
}
/** Uma linha por tipo que tem ideal ou valor hoje. Aporte, valores ou distribuição inválidos: toda sugestão é zero. */
export function aporteSuggestion(current: Pick<AllocSlice, 'key' | 'total'>[], targets: AllocTargets, amount: number): AporteRow[] {
  const ok = Number.isFinite(amount) && amount > 0 && current.every(c => Number.isFinite(c.total)) && validateTargets(targets).length === 0;
  const rows = ALLOC_ORDER.map(key => ({ key, cur: current.reduce((a, c) => a + (c.key === key ? Math.max(0, num(c.total)) : 0), 0), targetPct: Math.max(0, num(targets[key])) }))
    .filter(r => r.targetPct > 0 || r.cur > 0);
  const total = rows.reduce((a, r) => a + r.cur, 0), cents = ok ? Math.round(amount * 100) : 0;
  const gaps = rows.map(r => Math.max(0, (r.targetPct / 100) * (total + cents / 100) - r.cur));
  // sem falta nenhuma (ideais somando um pouco menos que 100 numa carteira já no ideal): divide pelos ideais
  const w = gaps.some(g => g > 0) ? gaps : rows.map(r => r.targetPct), W = w.reduce((a, x) => a + x, 0);
  // em centavos, arredondando para baixo: a sobra (nunca negativa) vai para a maior falta e a soma fecha no aporte
  const base = w.map(x => (W > 0 ? Math.floor((cents * x) / W + 1e-6) : 0));
  const top = w.indexOf(Math.max(...w)), rest = cents - base.reduce((a, x) => a + x, 0), after = total + cents / 100;
  return rows.map((r, i) => {
    const suggest = (base[i] + (i === top ? rest : 0)) / 100;
    return { key: r.key, currentPct: total > 0 ? (r.cur / total) * 100 : 0, targetPct: r.targetPct, suggest, afterPct: after > 0 ? ((r.cur + suggest) / after) * 100 : 0 };
  });
}
