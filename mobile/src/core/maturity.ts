import { FixedIncomeAsset } from './types';
import { daysBetween, parseISO, toISO } from './dates';
/**
 * Vencimento da renda fixa: o que vence daqui para frente e os avisos locais (7 dias antes e no dia, às 9h de Brasília).
 * No texto do aviso entra só o nome do título, nunca valores (tela bloqueada).
 */
type Asset = Pick<FixedIncomeAsset, 'name' | 'maturity'>;
export interface Maturity { name: string; /** AAAA-MM-DD */ date: string; daysLeft: number }
export interface MaturityReminder { id: string; name: string; fireAt: Date; title: string; body: string }
export const MATURITY_PREFIX = 'pilinha-venc-';
const HOUR = 9, DAYS_BEFORE = 7, MAX_REMINDERS = 20, DAY_MS = 86_400_000;
/** Títulos que vencem hoje ou depois, do mais próximo para o mais distante. Sem data, com data inválida ou já vencido: fora. */
export function upcomingMaturities(fixedIncome: Asset[], now = new Date()): Maturity[] {
  return fixedIncome.flatMap(a => {
    const d = typeof a.maturity === 'string' ? parseISO(a.maturity) : null; if (!d) return [];
    const daysLeft = daysBetween(now, d);
    return daysLeft >= 0 ? [{ name: a.name, date: toISO(d), daysLeft }] : [];
  }).sort((a, b) => a.daysLeft - b.daysLeft);
}
export const maturityLabel = (daysLeft: number) => (daysLeft === 0 ? 'vence hoje' : daysLeft === 1 ? 'vence amanhã' : `vence em ${daysLeft} dias`);
/** Avisos que ainda estão no futuro, só os 20 mais próximos (o iPhone guarda poucos avisos agendados; os outros entram quando reagendar). */
export function maturityReminders(fixedIncome: Asset[], now = new Date()): MaturityReminder[] {
  const body = 'Veja se vai resgatar ou reinvestir.';
  return upcomingMaturities(fixedIncome, now).flatMap(m => {
    const at = (daysBefore: number) => new Date(parseISO(m.date)!.getTime() + HOUR * 3600_000 - daysBefore * DAY_MS);
    return [
      { id: `${MATURITY_PREFIX}${m.date}-${DAYS_BEFORE}-${m.name}`, name: m.name, fireAt: at(DAYS_BEFORE), title: `${m.name} vence em ${DAYS_BEFORE} dias`, body },
      { id: `${MATURITY_PREFIX}${m.date}-0-${m.name}`, name: m.name, fireAt: at(0), title: `Vence hoje: ${m.name}`, body }];
  }).filter(r => r.fireAt.getTime() > now.getTime()).sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_REMINDERS);
}
