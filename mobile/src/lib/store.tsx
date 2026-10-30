import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Linking from 'expo-linking';
import { normalizeCode } from '../core';
import { codeFromURL, pullFromMac } from './sync';
import { latestGate, HistoryPoint, Portfolio, Snapshot, emptyPortfolio, record, snapshot, total, totalInvested, totalNet } from '../core';
import * as S from './storage';
import { syncExtensions } from './widget';
import { PriceAlert } from '../core';
import { checkAndNotify, quotesFromSnapshot, syncBackgroundTask } from './alerts';
import { authenticate } from './auth';
interface Ctx { portfolio: Portfolio; snap: Snapshot | null; history: HistoryPoint[]; loading: boolean; hasToken: boolean; hidden: boolean;
  setHidden: (b: boolean) => void; refresh: () => Promise<void>; update: (p: Portfolio) => Promise<void>; setToken: (t: string) => Promise<void>;
  settings: S.Settings; setSettings: (s: S.Settings) => Promise<void>; alerts: PriceAlert[]; setAlerts: (a: PriceAlert[]) => Promise<void>; toggleHidden: () => Promise<void>; ready: boolean;
  sync: SyncState; connectMac: (code: string) => Promise<SyncState>; disconnectMac: () => Promise<void>; syncNow: () => Promise<SyncState> }
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
  const [alerts, setAlertsState] = useState<PriceAlert[]>([]); const [ready, setReady] = useState(false); const [loaded, setLoaded] = useState(false);
  const setHidden = (b: boolean) => { hRef.current = b; setHiddenState(b); S.saveHidden(b); if (snapRef.current) syncExtensions(snapRef.current, b); };
  const snapRef = useRef<Snapshot | null>(null);
  const pRef = useRef(portfolio); pRef.current = portfolio;
  // Só o refresh mais recente vale: um mais lento (ex. do timer) não sobrescreve a carteira recém-editada.
  const gate = useRef(latestGate()).current;
  const run = useCallback(async (p: Portfolio) => {
    const my = gate.next();
    setL(true);
    try {
      const token = await S.loadToken(); setHT(!!token);
      const s = await snapshot(p, { brapiToken: token });
      if (!gate.isLatest(my)) return;
      setSnap(s); checkAndNotify(quotesFromSnapshot(s)).catch(() => {}); snapRef.current = s; syncExtensions(s, hRef.current);
      // Com cotação falhando o total sai menor: não grava esse ponto para não estragar o histórico.
      const old = await S.loadHistory();
      if (s.errors.length) setH(old); else { const h = record(old, total(s), totalInvested(s), totalNet(s)); setH(h); await S.saveHistory(h); }
    } catch { /* sem internet etc.: mantém o último snapshot */ } finally { if (gate.isLatest(my)) setL(false); }
  }, []);
  useEffect(() => { (async () => { setSettingsState(await S.loadSettings()); setReady(true); const al = await S.loadAlerts(); setAlertsState(al); syncBackgroundTask(al.some(a => a.enabled)); const h = await S.loadHidden(); hRef.current = h; setHiddenState(h); const p = await S.loadPortfolio(); setP(p); pRef.current = p; setLoaded(true); await run(p); })(); }, [run]);
  useEffect(() => { const t = setInterval(() => run(pRef.current), 5 * 60_000); return () => clearInterval(t); }, [run]);
  // Sincronização com o Mac: ao abrir, ao voltar para o app, a cada 5 min e pelo link do QR.
  const [sync, setSync] = useState<SyncState>({ connected: false, status: 'off' });
  const codeRef = useRef<string | null>(null); const syncing = useRef(false);
  const doSync = useCallback(async (): Promise<SyncState> => {
    const code = codeRef.current; if (!code) { const st: SyncState = { connected: false, status: 'off' }; setSync(st); return st; }
    if (syncing.current) return { connected: true, status: 'syncing' };
    syncing.current = true; setSync(s => ({ ...s, connected: true, status: 'syncing' }));
    try {
      const r = await pullFromMac(code, pRef.current);
      let st: SyncState;
      if (r.kind === 'ok') {
        if (JSON.stringify(r.portfolio) !== JSON.stringify(pRef.current)) { setP(r.portfolio); pRef.current = r.portfolio; await S.savePortfolio(r.portfolio); run(r.portfolio); }
        st = { connected: true, status: 'ok', lastSync: Date.now(), macUpdatedAt: r.updatedAt, message: `${r.items} item(ns) do Mac` };
      } else if (r.kind === 'waiting') st = { connected: true, status: 'waiting', message: 'Ainda nada do Mac. Abra o Pilinha no Mac com a internet ligada.' };
      else st = { connected: true, status: 'error', message: r.message };
      setSync(st); return st;
    } finally { syncing.current = false; }
  }, [run]);
  const connectMac = async (raw: string): Promise<SyncState> => {
    const c = normalizeCode(raw); if (!c) { const st: SyncState = { connected: !!codeRef.current, status: 'error', message: 'Código inválido: são 16 letras e números (ex. ABCD-EFGH-2345-6789).' }; setSync(st); return st; }
    codeRef.current = c; await S.saveSyncCode(c); return doSync();
  };
  const disconnectMac = async () => { codeRef.current = null; await S.saveSyncCode(null); setSync({ connected: false, status: 'off' }); };
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
  const update = async (p: Portfolio) => { setP(p); await S.savePortfolio(p); await run(p); };
  const setToken = async (t: string) => { await S.saveToken(t.trim()); await run(pRef.current); };
  const setSettings = async (x: S.Settings) => { setSettingsState(x); await S.saveSettings(x); };
  const setAlerts = async (a: PriceAlert[]) => { setAlertsState(a); await S.saveAlerts(a); await syncBackgroundTask(a.some(x => x.enabled)); if (snapRef.current) await checkAndNotify(quotesFromSnapshot(snapRef.current), a); };
  // Revelar valores pode exigir Face ID (com senha do aparelho como alternativa).
  const toggleHidden = async () => {
    if (hRef.current && setRef.current.faceOnReveal && !(await authenticate('Mostrar os valores do Pilinha'))) return;
    setHidden(!hRef.current);
  };
  return <C.Provider value={{ settings, setSettings, alerts, setAlerts, toggleHidden, ready,  portfolio, snap, history, loading, hasToken, hidden, setHidden, refresh: () => run(pRef.current), update, setToken, sync, connectMac, disconnectMac, syncNow: doSync }}>{children}</C.Provider>;
}
