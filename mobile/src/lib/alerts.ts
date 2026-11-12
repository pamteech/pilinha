import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { BTC_TICKER, PriceAlert, QuoteLite, Snapshot, USD_REMINDER_PREFIX, USD_TICKER, UsdAlert, cryptoBRL, defaultUsdAlert, evaluateAlerts, missingAlertTickers, safeNewsLink, usdCloseDue, usdCloseSchedule, usdDirection, usdNotification, usdQuote, usdReminder, usdReminderTime, watchAlerts, itemDayPct, stockQuote } from '../core';
import * as S from './storage';
import { fetchUsdNews } from './news';
export const ALERT_TASK = 'pilinha-alertas';
const native = Platform.OS === 'ios' || Platform.OS === 'android';
if (native) {
  try { Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) }); } catch {}
  // Tocar no aviso do dólar abre a notícia (só https). Vale para o app aberto, em segundo plano e fechado (última resposta).
  const opened = new Set<string>();
  const open = (r: Notifications.NotificationResponse | null | undefined) => {
    const data = r?.notification?.request?.content?.data;
    const id = r?.notification?.request?.identifier, url = safeNewsLink(data?.url) ?? (data?.route === '/plano' ? 'pilinha://plano' : null);
    if (!url || !id || opened.has(id)) return; opened.add(id);
    Linking.openURL(url).catch(() => {});
  };
  try { Notifications.addNotificationResponseReceivedListener(open); Notifications.getLastNotificationResponseAsync().then(open).catch(() => {}); } catch {}
}
export async function requestPermission(): Promise<boolean> {
  if (!native) return false;
  try {
    const cur = await Notifications.getPermissionsAsync(); if (cur.granted) return true;
    return (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } })).granted;
  } catch { return false; }
}
export async function permissionGranted(): Promise<boolean> { if (!native) return false; try { return (await Notifications.getPermissionsAsync()).granted; } catch { return false; } }
export const quotesFromSnapshot = (s: Snapshot): Record<string, QuoteLite> =>
  ({ ...Object.fromEntries((s.watch ?? []).map(w => [w.ticker, { price: w.price, dayPct: w.dayPct }])), ...Object.fromEntries(s.items.filter(i => i.unitPrice != null).map(i => [i.name.toUpperCase(), { price: i.unitPrice ?? null, dayPct: itemDayPct(i) }])),
    ...(s.usdBRL != null ? { [USD_TICKER]: { price: s.usdBRL, dayPct: s.usdChangePct ?? null } } : {}) });
/** Cotação de cada alerta: o que já está no snapshot e, para o resto (ação fora da carteira, dólar, bitcoin), busca na hora. Falha de um não derruba os outros. */
export async function quotesForAlerts(alerts: PriceAlert[], snap: Snapshot | null, token: string | null | undefined): Promise<Record<string, QuoteLite>> {
  const q: Record<string, QuoteLite> = snap ? quotesFromSnapshot(snap) : {};
  await Promise.allSettled(missingAlertTickers(alerts, q).map(async t => {
    if (t === BTC_TICKER) { const v = (await cryptoBRL(['bitcoin'])).bitcoin; if (v) q[t] = { price: v.price, dayPct: v.change24h }; }
    else if (t === USD_TICKER) { const u = await usdQuote(); q[t] = { price: u.bid, dayPct: u.changePct }; }
    else { const x = await stockQuote(t, token); q[t] = { price: x.price, dayPct: x.changePct }; }
  }));
  return q;
}
/** Avalia os alertas, notifica os novos e grava o registro (um aviso por alerta por dia). */
export async function checkAndNotify(quotes: Record<string, QuoteLite>, alerts?: PriceAlert[]) {
  const list = [...(alerts ?? (await S.loadAlerts())), ...watchAlerts((await S.loadPortfolio()).watchlist)]; if (!list.some(a => a.enabled)) return 0;
  const r = evaluateAlerts(list, quotes, await S.loadFired());
  await S.saveFired(r.fired);
  if (native) for (const n of r.toFire) { try { await Notifications.scheduleNotificationAsync({ content: { title: n.title, body: n.body }, trigger: null }); } catch {} }
  return r.toFire.length;
}
export const usdAlertOf = (st: Pick<S.Settings, 'usdAlert'> | null | undefined): UsdAlert => ({ ...defaultUsdAlert(), ...(st?.usdAlert ?? {}) });
/**
 * Fechamento do dólar: um aviso por sessão (depois das 17h, dias úteis), alta ou queda, com a manchete do motivo e o link.
 * Marca a sessão como avisada antes de buscar a notícia (duas checagens juntas não avisam duas vezes). Sem notícia, avisa mesmo assim.
 * Se o lembrete genérico das 17h10 daquele dia já tocou (app fechado), não manda o completo de novo: o card do Início mostra o motivo.
 */
export async function checkUsdClose(q: { bid: number | null | undefined; changePct: number | null | undefined } | null | undefined, settings?: S.Settings, now = new Date()): Promise<boolean> {
  if (!q || q.bid == null) return false;
  const cfg = usdAlertOf(settings ?? (await S.loadSettings()));
  const fired = await S.loadUsdFired();
  const day = usdCloseDue(q, cfg, fired.day, now); if (!day) return false;
  await S.saveUsdFired(day);
  const reminderDone = (fired.scheduled ?? []).includes(day) && now.getTime() >= usdReminderTime(day).getTime();
  if (native) { try { await Notifications.cancelScheduledNotificationAsync(usdReminder(day).id); } catch {} }
  if (reminderDone) return false;
  const dir = usdDirection(q.changePct!);
  const news = dir === 'flat' ? null : await fetchUsdNews(dir, now).catch(() => null);
  const n = usdNotification(q, news);
  if (native) { try { await Notifications.scheduleNotificationAsync({ content: { title: n.title, body: n.body, data: { url: n.url } }, trigger: null }); } catch {} }
  return true;
}
/** @deprecated nome antigo */
export const checkUsdDrop = checkUsdClose;
/**
 * Lembretes locais das 17h10 dos próximos dias úteis: o iOS entrega mesmo com o app fechado, sem servidor.
 * Reagendado a cada abertura e ao mudar o ajuste; o dia que já teve o aviso completo não entra.
 */
export async function scheduleUsdCloseReminders(enabled: boolean, now = new Date()) {
  if (!native) return;
  try {
    const mine = (await Notifications.getAllScheduledNotificationsAsync()).filter(n => n.identifier.startsWith(USD_REMINDER_PREFIX));
    await Promise.all(mine.map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    if (!enabled || !(await permissionGranted())) { await S.saveUsdScheduled([]); return; }
    const fired = await S.loadUsdFired();
    const days = usdCloseSchedule(now).filter(d => d.day !== fired.day);
    for (const d of days) {
      const r = usdReminder(d.day);
      await Notifications.scheduleNotificationAsync({ identifier: r.id, content: { title: r.title, body: r.body, data: { kind: 'usd-close' } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: d.date } });
    }
    await S.saveUsdScheduled(days.map(d => d.day));
  } catch {}
}
/** Em segundo plano o iOS decide quando rodar (no mínimo a cada ~15 min, sem garantia). */
async function backgroundCheck() {
  const p = await S.loadPortfolio(), st = await S.loadSettings();
  if (usdAlertOf(st).enabled) { try { const fx = await usdQuote(); await checkUsdClose({ bid: fx.bid, changePct: fx.changePct }, st); } catch {} await scheduleUsdCloseReminders(true); }
  const alerts = [...(await S.loadAlerts()), ...watchAlerts(p.watchlist)].filter(a => a.enabled); if (!alerts.length) return;
  const q = await quotesForAlerts(alerts, null, await S.loadToken());
  await checkAndNotify(q, alerts.filter(a => !a.id.startsWith('w:')));
}
if (native) {
  try {
    TaskManager.defineTask(ALERT_TASK, async () => {
      try { await backgroundCheck(); return BackgroundTask.BackgroundTaskResult.Success; } catch { return BackgroundTask.BackgroundTaskResult.Failed; }
    });
  } catch {}
}
export async function syncBackgroundTask(enabled: boolean) {
  if (!native) return;
  try {
    const on = await TaskManager.isTaskRegisteredAsync(ALERT_TASK);
    if (enabled && !on) await BackgroundTask.registerTaskAsync(ALERT_TASK, { minimumInterval: 15 });
    if (!enabled && on) await BackgroundTask.unregisterTaskAsync(ALERT_TASK);
  } catch {}
}
/** Lembrete mensal de aporte (dia escolhido no plano, 9h), agendado no próprio iPhone: chega com o app fechado. Sem valores no texto (tela bloqueada). */
const APORTE_ID = 'aporte-mensal';
export async function scheduleAporteReminder(day: number | null | undefined) {
  if (!native) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(APORTE_ID).catch(() => {});
    if (!day || !(await permissionGranted())) return;
    await Notifications.scheduleNotificationAsync({ identifier: APORTE_ID, content: { title: 'Dia de aportar no seu plano', body: 'Toque para ver quanto falta neste mês.', data: { route: '/plano' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, day, hour: 9, minute: 0, repeats: true } });
  } catch {}
}
