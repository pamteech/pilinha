import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { PriceAlert, QuoteLite, Snapshot, UsdAlert, cryptoBRL, defaultUsdAlert, evaluateAlerts, safeNewsLink, usdDropDue, usdNotification, usdQuote, watchAlerts, itemDayPct, stockQuote } from '../core';
import * as S from './storage';
import { fetchUsdNews } from './news';
export const ALERT_TASK = 'pilinha-alertas';
const native = Platform.OS === 'ios' || Platform.OS === 'android';
if (native) {
  try { Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) }); } catch {}
  // Tocar no aviso do dólar abre a notícia (só https). Vale para o app aberto, em segundo plano e fechado (última resposta).
  const opened = new Set<string>();
  const open = (r: Notifications.NotificationResponse | null | undefined) => {
    const id = r?.notification?.request?.identifier, url = safeNewsLink(r?.notification?.request?.content?.data?.url);
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
  ({ ...Object.fromEntries((s.watch ?? []).map(w => [w.ticker, { price: w.price, dayPct: w.dayPct }])), ...Object.fromEntries(s.items.filter(i => i.unitPrice != null).map(i => [i.name.toUpperCase(), { price: i.unitPrice ?? null, dayPct: itemDayPct(i) }])) });
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
 * Dólar fechou em queda: um aviso por sessão (depois das 17h, dias úteis) com a manchete do motivo e o link.
 * Marca a sessão como avisada antes de buscar a notícia (duas checagens juntas não avisam duas vezes). Sem notícia, avisa mesmo assim.
 */
export async function checkUsdDrop(q: { bid: number | null | undefined; changePct: number | null | undefined } | null | undefined, settings?: S.Settings, now = new Date()): Promise<boolean> {
  if (!q || q.bid == null) return false;
  const cfg = usdAlertOf(settings ?? (await S.loadSettings()));
  const day = usdDropDue(q, cfg, (await S.loadUsdFired()).day, now); if (!day) return false;
  await S.saveUsdFired(day);
  const news = await fetchUsdNews('down', now).catch(() => null);
  const n = usdNotification(q, news);
  if (native) { try { await Notifications.scheduleNotificationAsync({ content: { title: n.title, body: n.body, data: { url: n.url } }, trigger: null }); } catch {} }
  return true;
}
/** Em segundo plano o iOS decide quando rodar (no mínimo a cada ~15 min, sem garantia). */
async function backgroundCheck() {
  const p = await S.loadPortfolio(), st = await S.loadSettings();
  if (usdAlertOf(st).enabled) { try { const fx = await usdQuote(); await checkUsdDrop({ bid: fx.bid, changePct: fx.changePct }, st); } catch {} }
  const alerts = [...(await S.loadAlerts()), ...watchAlerts(p.watchlist)].filter(a => a.enabled); if (!alerts.length) return;
  const token = await S.loadToken(), q: Record<string, QuoteLite> = {};
  const tickers = [...new Set(alerts.map(a => a.ticker.toUpperCase()))];
  const btc = p.crypto.filter(c => tickers.includes(c.symbol.toUpperCase()));
  await Promise.allSettled(tickers.filter(t => !btc.some(c => c.symbol.toUpperCase() === t)).map(async t => { const x = await stockQuote(t, token); q[t] = { price: x.price, dayPct: x.changePct }; }));
  if (btc.length) { try { const px = await cryptoBRL(btc.map(c => c.coinId)); for (const c of btc) { const v = px[c.coinId]; if (v) q[c.symbol.toUpperCase()] = { price: v.price, dayPct: v.change24h }; } } catch {} }
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
