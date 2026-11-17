import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { FixedIncomeAsset, MATURITY_PREFIX, maturityReminders } from '../core';
import { permissionGranted } from './alerts';
const native = Platform.OS === 'ios' || Platform.OS === 'android';
async function reschedule(enabled: boolean, fixedIncome: Pick<FixedIncomeAsset, 'name' | 'maturity'>[]) {
  if (!native) return;
  try {
    const mine = (await Notifications.getAllScheduledNotificationsAsync()).filter(n => n.identifier.startsWith(MATURITY_PREFIX));
    await Promise.all(mine.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!enabled || !(await permissionGranted())) return;
    for (const r of maturityReminders(fixedIncome))
      await Notifications.scheduleNotificationAsync({ identifier: r.id, content: { title: r.title, body: r.body }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.fireAt } });
  } catch {}
}
let queue: Promise<void> = Promise.resolve();
/**
 * Avisos de vencimento da renda fixa (7 dias antes e no dia, 9h), agendados no próprio iPhone: chegam com o app fechado. Sem valores no texto (tela bloqueada).
 * Reagendado ao abrir, quando a carteira muda e ao mudar o ajuste. Uma chamada por vez: ligar e desligar rápido não deixa aviso sobrando.
 */
export function scheduleMaturityReminders(enabled: boolean, fixedIncome: Pick<FixedIncomeAsset, 'name' | 'maturity'>[]): Promise<void> {
  return (queue = queue.then(() => reschedule(enabled, fixedIncome)));
}
