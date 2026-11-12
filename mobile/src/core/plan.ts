import { HistoryPoint } from './history';
import { monthlyForGoal, monthlyRate, monthsToGoal } from './goal';
import { IPCA_ESTIMATE } from './cadastro';
import { toISO } from './dates';
/**
 * Plano de longo prazo: "quero R$ X aos Y anos, investindo Z por mês".
 * Toda a conta é em dinheiro de hoje (rendimento ACIMA da inflação): R$ 5 milhões daqui a 30 anos não compram o que compram hoje.
 * Na prática isso significa corrigir o aporte pela inflação uma vez por ano. O valor nominal aparece só como referência.
 * Os perfis são hipóteses de rendimento, não recomendação de investimento.
 */
export type PlanProfile = 'conservador' | 'moderado' | 'arrojado';
export const PLAN_PROFILES: { key: PlanProfile; label: string; real: number }[] = [
  { key: 'conservador', label: 'Conservador', real: 4 }, { key: 'moderado', label: 'Moderado', real: 6 }, { key: 'arrojado', label: 'Arrojado', real: 8 },
];
export const REMINDER_DAYS = [1, 5, 10, 15, 20, 25];
export interface Plan {
  /** idade informada e o mês em que foi informada (AAAA-MM): a idade anda com o tempo sem pedir data de nascimento */
  age: number; ageAsOf: string;
  /** idade em que quer chegar na meta (null = sem prazo, só acompanhar o aporte) */ targetAge: number | null;
  /** aporte mensal planejado, em dinheiro de hoje */ monthly: number;
  profile: PlanProfile;
  /** quando o plano começou e o patrimônio naquele dia (base do "em dia / atrasado") */ startDate: string; startAmount: number;
  /** dia do mês do lembrete de aporte (null = sem lembrete) */ reminderDay: number | null;
}
export const realRateOf = (p: PlanProfile | undefined) => PLAN_PROFILES.find(x => x.key === p)?.real ?? 6;
const ym = (d: Date) => toISO(d).slice(0, 7);
const monthIndex = (s: string) => { const [y, m] = s.split('-').map(Number); return y * 12 + (m - 1); };
export const monthsSince = (asOf: string, now = new Date()) => Math.max(0, monthIndex(ym(now)) - monthIndex(asOf.slice(0, 7)));
export const ageNow = (p: Pick<Plan, 'age' | 'ageAsOf'>, now = new Date()) => p.age + monthsSince(p.ageAsOf, now) / 12;
/** Meses de hoje até completar `age` anos (pode ser negativo se já passou). */
export const monthsToAge = (p: Pick<Plan, 'age' | 'ageAsOf'>, age: number, now = new Date()) => Math.round((age - p.age) * 12) - monthsSince(p.ageAsOf, now);
/** Idade (com uma casa) daqui a `months` meses. */
export const ageIn = (p: Pick<Plan, 'age' | 'ageAsOf'>, months: number, now = new Date()) => ageNow(p, now) + months / 12;
/** Valor nominal estimado daqui a `months` meses de algo que vale `v` hoje (IPCA estimado). */
export const nominal = (v: number, months: number, ipca = IPCA_ESTIMATE) => v * Math.pow(1 + ipca / 100, months / 12);

export interface PlanSummary {
  realRate: number; monthsLeft: number | null;
  /** aporte por mês (em dinheiro de hoje) para chegar na idade-alvo; null sem idade-alvo ou se ela já passou */ required: number | null;
  /** com o aporte planejado: em quantos meses e com que idade chega (null se não chega em 100 anos) */ reachMonths: number | null; reachAge: number | null;
  /** meta em reais do ano em que chega (só referência) */ nominalTarget: number | null; nominalYear: number | null;
  /** renda mensal acima da inflação que a meta gera no perfil escolhido */ passive: number;
  byProfile: { key: PlanProfile; label: string; real: number; required: number | null; reachAge: number | null }[];
}
export function planSummary(p: Plan, target: number, current: number, now = new Date()): PlanSummary {
  const realRate = realRateOf(p.profile);
  const monthsLeft = p.targetAge != null ? monthsToAge(p, p.targetAge, now) : null;
  const req = (r: number) => (monthsLeft != null && monthsLeft > 0 ? monthlyForGoal(current, target, monthsLeft, r) : null);
  const reach = (r: number) => monthsToGoal(current, target, p.monthly, r);
  const reachMonths = reach(realRate);
  const horizon = monthsLeft != null && monthsLeft > 0 ? monthsLeft : reachMonths;
  const year = horizon != null ? Number(toISO(now).slice(0, 4)) + Math.round(horizon / 12) : null;
  return {
    realRate, monthsLeft, required: req(realRate), reachMonths, reachAge: reachMonths != null ? ageIn(p, reachMonths, now) : null,
    nominalTarget: horizon != null ? nominal(target, horizon) : null, nominalYear: year,
    passive: target * monthlyRate(realRate),
    byProfile: PLAN_PROFILES.map(x => { const m = reach(x.real); return { ...x, required: req(x.real), reachAge: m != null ? ageIn(p, m, now) : null }; }),
  };
}
/** Caminho do patrimônio (em dinheiro de hoje) ano a ano com o aporte planejado, até a idade-alvo ou até chegar (no máx. 100 anos). */
export function planPath(p: Plan, target: number, current: number, now = new Date()): { age: number; value: number }[] {
  const i = monthlyRate(realRateOf(p.profile)), a = Math.max(0, p.monthly), start = ageNow(p, now);
  const reach = monthsToGoal(current, target, a, realRateOf(p.profile));
  const tgt = p.targetAge != null ? monthsToAge(p, p.targetAge, now) : 0;
  const months = Math.min(Math.round((100 - start) * 12), Math.max(tgt, reach ?? 0, 12) + 24);
  const out: { age: number; value: number }[] = []; let v = Math.max(0, current);
  for (let m = 0; m <= months; m++) {
    if (m % 12 === 0 || m === months) out.push({ age: start + m / 12, value: v });
    v = v * (1 + i) + a;
  }
  return out;
}
export interface PlanTracking {
  monthsElapsed: number;
  /** quanto deveria ter hoje (em reais de hoje, com inflação estimada) se tivesse seguido o plano desde o início */ expected: number;
  diff: number;
  /** aportes do mês atual pelo histórico (variação do valor investido) e quanto o plano pede este mês */ monthAporte: number | null; monthPlanned: number;
}
/** Acompanhamento: o patrimônio de hoje contra o caminho do plano, e o aporte do mês contra o planejado. */
export function planTracking(p: Plan, current: number, history: HistoryPoint[], now = new Date()): PlanTracking {
  const start = new Date(p.startDate + 'T12:00:00Z');
  const days = Math.max(0, (now.getTime() - start.getTime()) / 86_400_000), monthsElapsed = Math.floor(days / 30.44);
  const i = monthlyRate(realRateOf(p.profile)); let v = Math.max(0, p.startAmount);
  for (let m = 0; m < monthsElapsed; m++) v = v * (1 + i) + p.monthly;
  const expected = nominal(v, monthsElapsed);
  const month = ym(now), pts = [...history].sort((a, b) => a.day.localeCompare(b.day));
  const before = [...pts].reverse().find(x => x.day.slice(0, 7) < month), inMonth = pts.filter(x => x.day.slice(0, 7) === month);
  const last = inMonth[inMonth.length - 1], base = before ?? inMonth[0];
  const monthAporte = last && base && last !== base ? Math.max(0, last.invested - base.invested) : last ? 0 : null;
  return { monthsElapsed, expected, diff: current - expected, monthAporte, monthPlanned: nominal(p.monthly, monthsElapsed) };
}
/** "R$ 5 mi", "R$ 4,98 mi", "R$ 19 mi", "R$ 480 mil", "R$ 950" — para números grandes de plano. */
export function compactBRL(v: number): string {
  const a = Math.abs(v), sig = v < 0 ? '−' : '';
  const n = (x: number, d: number) => x.toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '').replace('.', ',');
  if (a >= 1e6) return `${sig}R$ ${n(a / 1e6, a >= 1e7 ? 0 : 2)} mi`;
  if (a >= 1e3) return `${sig}R$ ${n(a / 1e3, 0)} mil`;
  return `${sig}R$ ${Math.round(a)}`;
}
/** Validação do formulário (vazio = ok). */
export function validatePlan(x: { target: number; age: number; targetAge: number | null; monthly: number }): string[] {
  const e: string[] = [];
  if (!(x.target > 0)) e.push('Quanto quer ter? (ex. 5.000.000)');
  if (!(x.age >= 10 && x.age <= 100)) e.push('Sua idade (entre 10 e 100).');
  if (x.targetAge != null && !(x.targetAge > x.age && x.targetAge <= 100)) e.push('A idade da meta tem que ser maior que a sua e até 100.');
  if (!(x.monthly >= 0) || !Number.isFinite(x.monthly)) e.push('Aporte por mês inválido (ex. 1.500,00).');
  return e;
}
/** Idade com meses: "55 anos", "55 anos e 7 meses", "56 anos" (11,96 vira 12). */
export function ageLabel(a: number): string {
  let y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); if (m === 12) { y += 1; m = 0; }
  return m ? `${y} anos e ${m} ${m > 1 ? 'meses' : 'mês'}` : `${y} anos`;
}
