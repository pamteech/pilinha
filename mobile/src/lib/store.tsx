import { treasuryRows } from './treasury';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { normalizeCode, cachedCdiRates, cdiRates, mergeFromMac, withTimeout, NewsItem, UsdDirection } from '../core';
import { codeFromURL, pullFromMac } from './sync';
import { latestGate, HistoryPoint, Portfolio, Snapshot, emptyPortfolio, record, snapshot, total, totalInvested, totalNet } from '../core';
import * as S from './storage';
import { syncExtensions } from './widget';
import { PriceAlert, hiddenOnOpen, shouldRehide, watchAlerts } from '../core';
import { checkAndNotify, checkUsdClose, quotesForAlerts, scheduleAporteReminder, scheduleMonthCloseReminder, scheduleUsdCloseReminders, syncBackgroundTask, usdAlertOf, usdCloseNow } from './alerts';
import { fetchUsdNews } from './news';
import { authenticate } from './auth';
import { scheduleMaturityReminders } from './maturity';
interface Ctx { portfolio: Portfolio; snap: Snapshot | null; history: HistoryPoint[]; loading: boolean; hasToken: boolean; hidden: boolean;
  setHidden: (b: boolean) => void; refresh: () => Promise<void>; update: (p: Portfolio) => Promise<void>; setToken: (t: string) => Promise<void>;
  settings: S.Settings; setSettings: (s: S.Settings) => Promise<void>; alerts: PriceAlert[]; setAlerts: (a: PriceAlert[]) => Promise<void>; toggleHidden: () => Promise<void>; ready: boolean;
  sync: SyncState; connectMac: (code: string) => Promise<SyncState>; disconnectMac: () => Promise<void>; syncNow: () => Promise<SyncState>;
  /** Última carteira recebida do Mac (para saber se um item também existe lá). */ macBase: Portfolio | null;
  /** Manchete que explica a variação do dólar hoje (card do Início). */ usdNews: UsdNewsState | null;
  /** Fechamento das 17h (Brasília), quando já existe; o cartão Em dólar usa essa variação. */ usdClose: UsdClose | null }
export interface UsdNewsState { dir: UsdDirection; pct: number; item: NewsItem }
export interface SyncState { connected: boolean; status: 'off' | 'syncing' | 'ok' | 'waiting' | 'error'; message?: string; lastSync?: number; macUpdatedAt?: number | null }
const C = createContext<Ctx>(null as any);
export const usePilinha = () => useContext(C);
export function PilinhaProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setP] = useState<Portfolio>(emptyPortfolio());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [history, setH] = useState<HistoryPoint[]>([]);
  const [loading, setL] = useState(true); const [hasToken, setHT] = useState(false); const [hidden, setHiddenState] = useState(false);
  const hRef = useRef(false);
  const [settings, setSettingsState] = useState<S.Settings>(S.defaultSettings()); const setRef = useRef(settings); setRef.current = settings;
  const [alerts, setAlertsState] = useState<PriceAlert[]>([]); const alRef = useRef(alerts); alRef.current = alerts; const [ready, setReady] = useState(false); const [loaded, setLoaded] = useState(false);
  const setHidden = (b: boolean) => { hRef.current = b; setHiddenState(b); S.saveHidden(b); if (snapRef.current) syncExtensions(snapRef.current, b); };
  const snapRef = useRef<Snapshot | null>(null);
  const pRef = useRef(portfolio); pRef.current = portfolio;
  const [macBase, setMacBase] = useState<Portfolio | null>(null);
  const [usdNews, setUsdNews] = useState<UsdNewsState | null>(null);
  const [usdClose, setUsdClose] = useState<UsdClose | null>(null);
  const needsBackground = (p: Portfolio, al: PriceAlert[], st: S.Settings) => al.some(a => a.enabled) || !!p.watchlist?.length || usdAlertOf(st).enabled;
  // Só o refresh mais recente vale: um mais lento (ex. do timer) não sobrescreve a carteira recém-editada.
  const gate = useRef(latestGate()).current;
  const run = useCallback(async (p: Portfolio) => {
    const my = gate.next();
    setL(true);
    try {
      const [token, treasury] = await Promise.all([S.loadToken(), treasuryRows(p).catch(() => null)]); setHT(!!token);
      const s = await withTimeout(snapshot(p, { brapiToken: token, treasury, cdi: (a, b) => cachedCdiRates(a, b, S.kv, (x, y) => cdiRates(x, y)) }), 25000);
      if (!gate.isLatest(my)) return;
      setSnap(s); S.saveLastSnapshot(s); snapRef.current = s; syncExtensions(s, hRef.current);
      // Alertas: ativos fora da carteira (ação que ela ainda não tem, dólar, bitcoin) têm a cotação buscada à parte.
      quotesForAlerts([...alRef.current, ...watchAlerts(p.watchlist)], s, token).then(q => checkAndNotify(q)).catch(() => {});
      // Dólar: aviso do fechamento (alta ou queda) e, no Início, a manchete do motivo (só com o aviso ligado nos Alertas).
      // Depois das 17h (Brasília) o card usa a variação do fechamento, a mesma do aviso; antes, a do momento.
      const usdOn = usdAlertOf(setRef.current).enabled;
      const showUsdNews = (pc: number | null | undefined) => {
        if (usdOn && pc != null && Math.abs(pc) >= 0.01) {
          const dir: UsdDirection = pc < 0 ? 'down' : 'up';
          fetchUsdNews(dir).then(item => { if (gate.isLatest(my)) setUsdNews(item ? { dir, pct: pc, item } : null); }).catch(() => {});
        } else if (gate.isLatest(my)) setUsdNews(null);
      };
      // O cartão Em dólar precisa do fechamento mesmo com o aviso desligado.
      usdCloseNow().then(c => { if (gate.isLatest(my)) setUsdClose(c); }).catch(() => {});
      checkUsdClose(setRef.current).then(r => { if (gate.isLatest(my) && r.close) setUsdClose(r.close); scheduleUsdCloseReminders(usdAlertOf(setRef.current).enabled); showUsdNews(r.close?.changePct ?? s.usdChangePct); })
        .catch(() => showUsdNews(s.usdChangePct));
      // Com cotação falhando o total sai menor: não grava esse ponto para não estragar o histórico.
      const old = await S.loadHistory();
      if (s.errors.length) setH(old); else { const h = record(old, total(s), totalInvested(s), totalNet(s)); setH(h); await S.saveHistory(h); }
    } catch { /* sem internet etc.: mantém o último snapshot */ } finally { if (gate.isLatest(my)) setL(false); }
  }, []);
  useEffect(() => { (async () => { const st0 = await S.loadSettings(); setSettingsState(st0); setRef.current = st0; setReady(true); const al = await S.loadAlerts(); setAlertsState(al); const left = await S.loadLeftAt(); const h = hiddenOnOpen(st0.hideOnOpen, await S.loadHidden(), left == null ? undefined : Date.now() - left); hRef.current = h; setHiddenState(h); if (h) S.saveHidden(true); const [p, last, base] = await Promise.all([S.loadPortfolio(), S.loadLastSnapshot(), S.loadMacBase()]); setP(p); pRef.current = p; setMacBase(base); syncBackgroundTask(needsBackground(p, al, st0)); scheduleUsdCloseReminders(usdAlertOf(st0).enabled); scheduleAporteReminder(st0.plan?.reminderDay); if (last && !snapRef.current) { setSnap(last); snapRef.current = last; setH(await S.loadHistory()); } setLoaded(true); await run(p); })(); }, [run]);
  // Vencimento da renda fixa: reagenda os avisos ao abrir, quando a carteira muda (edição ou sync do Mac) e ao ligar/desligar nos Alertas.
  useEffect(() => { if (loaded) scheduleMaturityReminders(settings.maturityAlert, portfolio.fixedIncome); }, [loaded, portfolio.fixedIncome, settings.maturityAlert]);
  // Fechamento do mês: agenda o aviso do dia 1º ao abrir e ao ligar/desligar nos Alertas.
  useEffect(() => { if (loaded) scheduleMonthCloseReminder(settings.monthCloseAlert); }, [loaded, settings.monthCloseAlert]);
  // Permissão de notificação dada no meio da sessão (no app ou nos Ajustes do iOS) não muda nada acima: ao voltar para o app, reagenda os dois avisos.
  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener('change', st => { if (st === 'active') { scheduleMaturityReminders(setRef.current.maturityAlert, pRef.current.fixedIncome); scheduleMonthCloseReminder(setRef.current.monthCloseAlert); } });
    return () => sub.remove();
  }, [loaded]);
  // Abrir com valores escondidos: ao voltar depois de um tempo fora esconde de novo. O estado escondido é salvo: se o app for encerrado e reaberto logo em seguida, continua escondido.
  useEffect(() => {
    let prev: string = AppState.currentState ?? 'active'; let leftAt: number | undefined;
    const sub = AppState.addEventListener('change', st => {
      if (st === 'background') { leftAt = Date.now(); S.saveLeftAt(leftAt); }
      if (shouldRehide(setRef.current.hideOnOpen, prev, st, leftAt == null ? undefined : Date.now() - leftAt)) { hRef.current = true; setHiddenState(true); S.saveHidden(true); }
      prev = st;
    });
    return () => sub.remove();
  }, []);
  useEffect(() => { const t = setInterval(() => run(pRef.current), 5 * 60_000); return () => clearInterval(t); }, [run]);
  // Sincronização com o Mac: ao abrir, ao voltar para o app, a cada 5 min e pelo link do QR.
  const [sync, setSync] = useState<SyncState>({ connected: false, status: 'off' });
  const codeRef = useRef<string | null>(null); const syncing = useRef(false);
  const doSync = useCallback(async (): Promise<SyncState> => {
    const code = codeRef.current; if (!code) { const st: SyncState = { connected: false, status: 'off' }; setSync(st); return st; }
    if (syncing.current) return { connected: true, status: 'syncing' };
    syncing.current = true; setSync(s => ({ ...s, connected: true, status: 'syncing' }));
    try {
      const r = await pullFromMac(code);
      let st: SyncState;
      if (r.kind === 'ok') {
        // Merge de três vias com a carteira do iPhone DE AGORA (não a de antes do download): o que foi editado aqui
        // enquanto baixava, ou desde o último sync, fica; o Mac só sobrescreve o item que mudou lá.
        const base = await S.loadMacBase();
        const merged = mergeFromMac(pRef.current, r.portfolio, base);
        await S.saveMacBase(r.portfolio); setMacBase(r.portfolio);
        if (JSON.stringify(merged) !== JSON.stringify(pRef.current)) { pRef.current = merged; setP(merged); await S.savePortfolio(merged); run(merged); }
        st = { connected: true, status: 'ok', lastSync: Date.now(), macUpdatedAt: r.updatedAt, message: `${r.items} item(ns) do Mac` };
      } else if (r.kind === 'waiting') st = { connected: true, status: 'waiting', message: 'Ainda nada do Mac. Abra o Pilinvest no Mac com a internet ligada.' };
      else st = { connected: true, status: 'error', message: r.message };
      setSync(st); return st;
    } finally { syncing.current = false; }
  }, [run]);
  const connectMac = async (raw: string): Promise<SyncState> => {
    const c = normalizeCode(raw); if (!c) { const st: SyncState = { connected: !!codeRef.current, status: 'error', message: 'Código inválido: são 16 letras e números (ex. ABCD-EFGH-2345-6789).' }; setSync(st); return st; }
    if (codeRef.current !== c) { await S.saveMacBase(null); setMacBase(null); } // outro Mac/código: a base antiga não vale
    codeRef.current = c; await S.saveSyncCode(c); return doSync();
  };
  const disconnectMac = async () => { codeRef.current = null; await S.saveSyncCode(null); await S.saveMacBase(null); setMacBase(null); setSync({ connected: false, status: 'off' }); };
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    (async () => {
      codeRef.current = await S.loadSyncCode();
      if (!alive) return;
      // Link do QR é tratado pela rota app/sync.tsx.
      if (!codeFromURL(await Linking.getInitialURL())) await doSync();
    })();
    const sub = AppState.addEventListener('change', st => { if (st === 'active') doSync(); });
    const t = setInterval(() => { if (AppState.currentState === 'active') doSync(); }, 5 * 60_000);
    return () => { alive = false; sub.remove(); clearInterval(t); };
  }, [loaded, doSync]);
  // pRef muda já (não só no próximo render): um sync que termine agora junta com a carteira recém-editada, não com a antiga.
  const update = async (p: Portfolio) => { pRef.current = p; setP(p); syncBackgroundTask(needsBackground(p, alerts, setRef.current)); await S.savePortfolio(p); await run(p); };
  const setToken = async (t: string) => { await S.saveToken(t.trim()); await run(pRef.current); };
  const setSettings = async (x: S.Settings) => {
    setSettingsState(x); setRef.current = x; await S.saveSettings(x);
    await syncBackgroundTask(needsBackground(pRef.current, alerts, x));
    if (!usdAlertOf(x).enabled) setUsdNews(null); else checkUsdClose(x).catch(() => {});
    await scheduleUsdCloseReminders(usdAlertOf(x).enabled);
    await scheduleAporteReminder(x.plan?.reminderDay);
  };
  const setAlerts = async (a: PriceAlert[]) => { setAlertsState(a); alRef.current = a; await S.saveAlerts(a); await syncBackgroundTask(needsBackground(pRef.current, a, setRef.current)); if (snapRef.current) { try { await checkAndNotify(await quotesForAlerts([...a, ...watchAlerts(pRef.current.watchlist)], snapRef.current, await S.loadToken()), a); } catch {} } };
  // Revelar valores pode exigir Face ID (com senha do aparelho como alternativa).
  const toggleHidden = async () => {
    if (hRef.current && setRef.current.faceOnReveal && !(await authenticate('Mostrar os valores do Pilinvest'))) return;
    setHidden(!hRef.current);
  };
  return <C.Provider value={{ settings, setSettings, alerts, setAlerts, toggleHidden, ready,  portfolio, snap, history, loading, hasToken, hidden, setHidden, refresh: () => run(pRef.current), update, setToken, sync, connectMac, disconnectMac, syncNow: doSync, macBase, usdNews, usdClose }}>{children}</C.Provider>;
}
