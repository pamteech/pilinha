import { HistoryPoint } from './history';
import { toISO } from './dates';
import { compactBRL } from './plan';
/**
 * Sequência de aportes e marcos: meses seguidos aportando (pelo histórico, um ponto por dia em que o app abriu) e marcos de patrimônio,
 * de fração da meta e de sequência. Cada marco comemora uma vez só: os ids já vistos ficam nos ajustes (milestonesSeen).
 */
export type MilestoneKind = 'total' | 'goal' | 'streak';
export interface Milestone { /** estável: fica guardado nos ajustes */ id: string; kind: MilestoneKind; /** R$ (total), % da meta (goal) ou meses seguidos (streak) */ value: number }
const list = (kind: MilestoneKind, values: number[]): Milestone[] => values.map(value => ({ id: `${kind}-${value}`, kind, value }));
/** Em ordem crescente dentro de cada tipo. */
export const MILESTONES: Milestone[] = [...list('total', [1e3, 5e3, 1e4, 25e3, 5e4, 1e5, 25e4, 5e5, 1e6]), ...list('goal', [25, 50, 75, 100]), ...list('streak', [3, 6, 12, 24])];
/**
 * Meses seguidos com aporte, terminando no mês atual (dia de Brasília). Mês com aporte: o aplicado no último ponto do mês passa, por mais de
 * um centavo, o do último ponto antes do mês (no primeiro mês do histórico a base é o primeiro ponto dele). Mês sem ponto ou com resgate não conta.
 * O mês atual ainda sem aporte não quebra a sequência: vale a que terminou no mês passado.
 */
export function aporteStreak(history: HistoryPoint[], now = new Date()): number {
  const pts = history.filter(p => Number.isFinite(p.invested)).sort((a, b) => a.day.localeCompare(b.day));
  const aportou = (month: string) => {
    const inMonth = pts.filter(p => p.day.slice(0, 7) === month), last = inMonth[inMonth.length - 1];
    const base = [...pts].reverse().find(p => p.day.slice(0, 7) < month) ?? inMonth[0];
    return !!last && last.invested - base.invested > 0.01;
  };
  const [y, m] = toISO(now).split('-').map(Number), month = (back: number) => new Date(Date.UTC(y, m - 1 - back, 1)).toISOString().slice(0, 7);
  const from = aportou(month(0)) ? 0 : 1; let n = 0;
  while (aportou(month(from + n))) n++; // para sozinho: antes do primeiro ponto nenhum mês tem aporte
  return n;
}
/** Quanto de patrimônio o marco pede, em R$ (null: marco de sequência, ou de meta sem meta definida). */
const targetOf = (m: Milestone, goal: number | null | undefined) => (m.kind === 'total' ? m.value : m.kind === 'goal' && goal != null && goal > 0 ? (goal * m.value) / 100 : null);
/** Ids dos marcos alcançados agora (os de meta, só com meta definida). No limite exato já vale. */
export function reachedMilestones({ total, goal, streak }: { total: number; goal: number | null | undefined; streak: number }): string[] {
  return MILESTONES.filter(m => { const t = targetOf(m, goal); return m.kind === 'streak' ? streak >= m.value : t != null && total >= t; }).map(m => m.id);
}
/** Alcançados que ainda não foram comemorados. `seen` null = primeira vez depois da atualização: nenhum é novo, para não despejar todos de uma vez em quem já usava o app. */
export const newMilestones = (reached: string[], seen: string[] | null | undefined): string[] => (seen ? reached.filter(id => !seen.includes(id)) : []);
/**
 * Meta criada, alterada ou removida: os marcos de meta passam a ser exatamente os já alcançados com a meta nova, sem comemorar (ela não acabou
 * de conquistar nada), e as frações de uma meta maior voltam a valer. `seen` null continua null: quem semeia a primeira vez é o Início.
 */
export const reseedGoalMilestones = (seen: string[] | null | undefined, total: number, goal: number | null | undefined): string[] | null =>
  seen ? [...seen.filter(id => !id.startsWith('goal-')), ...reachedMilestones({ total, goal, streak: 0 }).filter(id => id.startsWith('goal-'))] : null;
/** Aporte só dá para inferir do histórico com custo conhecido em todos os ativos: sem preço médio o "aplicado" do ativo é o valor de mercado, e alta de preço viraria aporte. */
export const aportesKnown = (items: { invested: number | null }[]) => items.every(i => i.invested != null);
/** De uma lista de ids, o maior marco de cada tipo (patrimônio, meta, sequência). */
export const topMilestones = (ids: string[]): string[] => (['total', 'goal', 'streak'] as const).flatMap(k => MILESTONES.filter(m => m.kind === k && ids.includes(m.id)).slice(-1)).map(m => m.id);
/** "3 meses seguidos aportando"; sem sequência, o convite para começar. */
export const streakLabel = (n: number) => (n > 1 ? `${n} meses seguidos aportando` : n === 1 ? '1 mês aportando' : 'Aporte este mês para começar uma sequência');
/** Nome do marco. Com valores escondidos o de patrimônio sai sem o valor, que revelaria o tamanho da carteira. Id desconhecido: ''. */
export function milestoneLabel(id: string, hidden: boolean): string {
  const m = MILESTONES.find(x => x.id === id); if (!m) return '';
  if (m.kind === 'streak') return streakLabel(m.value);
  if (m.kind === 'goal') return m.value === 100 ? 'Meta alcançada' : m.value === 50 ? 'Metade da meta' : `${m.value}% da meta`;
  return hidden ? 'Novo marco de patrimônio' : m.value >= 1e6 ? 'Primeiro R$ 1 milhão' : `Primeiros ${compactBRL(m.value)}`;
}
/**
 * Próximo marco de patrimônio ou de meta (o que pede menos patrimônio) e quanto do caminho já foi, de 0 a 100. Null quando não sobra nenhum.
 * Com valores escondidos, só os de meta: o caminho até um valor em R$ revelaria o tamanho da carteira.
 */
export function nextMilestone({ total, goal, hidden = false }: { total: number; goal: number | null | undefined; hidden?: boolean }): { id: string; kind: MilestoneKind; pct: number } | null {
  if (!Number.isFinite(total)) return null;
  const next = MILESTONES.flatMap(m => { const t = targetOf(m, goal); return t != null && t > total && !(hidden && m.kind === 'total') ? [{ id: m.id, kind: m.kind, t }] : []; }).sort((a, b) => a.t - b.t)[0];
  return next ? { id: next.id, kind: next.kind, pct: Math.max(0, (total / next.t) * 100) } : null;
}
