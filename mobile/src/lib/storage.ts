import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { AllocOrder, Plan, emptyPortfolio, HistoryPoint, Portfolio, UsdAlert, defaultUsdAlert } from '../core';
// Tudo fica só no aparelho: carteira e histórico no AsyncStorage, token da brapi no Keychain.
const K = { portfolio: 'pilinha.portfolio.v1', history: 'pilinha.history.v1', token: 'pilinha.brapiToken', hidden: 'pilinha.hidden' };
export async function loadPortfolio(): Promise<Portfolio> {
  try { const s = await AsyncStorage.getItem(K.portfolio); return s ? { ...emptyPortfolio(), ...JSON.parse(s) } : emptyPortfolio(); } catch { return emptyPortfolio(); }
}
export const savePortfolio = (p: Portfolio) => AsyncStorage.setItem(K.portfolio, JSON.stringify(p));
export async function loadHistory(): Promise<HistoryPoint[]> { try { return JSON.parse((await AsyncStorage.getItem(K.history)) ?? '[]'); } catch { return []; } }
export const saveHistory = (h: HistoryPoint[]) => AsyncStorage.setItem(K.history, JSON.stringify(h));
// Keychain pode falhar (aparelho bloqueado, web): sem token, segue pelo Yahoo em vez de travar o refresh.
export const loadToken = async () => { try { return await SecureStore.getItemAsync(K.token); } catch { return null; } };
export const saveToken = (t: string) => (t ? SecureStore.setItemAsync(K.token, t) : SecureStore.deleteItemAsync(K.token));
export const loadHidden = async () => (await AsyncStorage.getItem(K.hidden)) === '1';
export const saveHidden = (b: boolean) => AsyncStorage.setItem(K.hidden, b ? '1' : '0');

// Ajustes, alertas e registro de alertas disparados (também só no aparelho).
import type { Appearance } from './theme';
export interface Settings { goal: number | null; faceOnOpen: boolean; faceOnReveal: boolean; hideOnOpen: boolean; usdAlert: UsdAlert; /** Automático segue o iPhone */ appearance: Appearance; /** ordem da distribuição por tipo */ allocOrder: AllocOrder; /** gráfico da distribuição: pizza (rosca) ou barra */ allocChart: 'donut' | 'bar'; /** plano de longo prazo (meta por idade); a meta em R$ é `goal` */ plan: Plan | null }
export const defaultSettings = (): Settings => ({ goal: null, faceOnOpen: false, faceOnReveal: false, hideOnOpen: true, usdAlert: defaultUsdAlert(), appearance: 'auto', allocOrder: 'value', allocChart: 'donut', plan: null });
const K2 = { settings: 'pilinha.settings.v1', alerts: 'pilinha.alerts.v1', fired: 'pilinha.alertsFired.v1' };
const loadJSON = async <T,>(k: string, def: T): Promise<T> => { try { const s = await AsyncStorage.getItem(k); return s ? { ...(def as any), ...JSON.parse(s) } : def; } catch { return def; } };
const loadArr = async <T,>(k: string): Promise<T[]> => { try { const v = JSON.parse((await AsyncStorage.getItem(k)) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
export const loadSettings = () => loadJSON<Settings>(K2.settings, defaultSettings());
export const saveSettings = (s: Settings) => AsyncStorage.setItem(K2.settings, JSON.stringify(s));
export const loadAlerts = () => loadArr<import('../core').PriceAlert>(K2.alerts);
export const saveAlerts = (a: import('../core').PriceAlert[]) => AsyncStorage.setItem(K2.alerts, JSON.stringify(a));
export const loadFired = () => loadJSON<import('../core').FiredLog>(K2.fired, {});
export const saveFired = (f: import('../core').FiredLog) => AsyncStorage.setItem(K2.fired, JSON.stringify(f));
// Aviso do dólar: dia da sessão já avisada (um aviso por fechamento).
const KUSD = 'pilinha.usdFired.v1';
export interface UsdFired { day: string | null; /** dias com lembrete local agendado */ scheduled?: string[] }
export const loadUsdFired = () => loadJSON<UsdFired>(KUSD, { day: null, scheduled: [] });
export const saveUsdFired = async (day: string) => { const f = await loadUsdFired(); await AsyncStorage.setItem(KUSD, JSON.stringify({ ...f, day })); };
export const saveUsdScheduled = async (scheduled: string[]) => { const f = await loadUsdFired(); await AsyncStorage.setItem(KUSD, JSON.stringify({ ...f, scheduled })); };
// Última carteira que o Mac mandou (base do merge de três vias): sem ela o Mac venceria e desfaria o que foi editado aqui.
const KBASE = 'pilinha.macBase.v1';
export async function loadMacBase(): Promise<Portfolio | null> {
  try { const s = await AsyncStorage.getItem(KBASE); return s ? { ...emptyPortfolio(), ...JSON.parse(s) } : null; } catch { return null; }
}
export const saveMacBase = (p: Portfolio | null) => (p ? AsyncStorage.setItem(KBASE, JSON.stringify(p)) : AsyncStorage.removeItem(KBASE));
// Código de pareamento com o Mac (sincronização cifrada) fica no Keychain.
const KS = 'pilinha.syncCode';
export const loadSyncCode = async () => { try { return await SecureStore.getItemAsync(KS); } catch { return null; } };
export const saveSyncCode = (c: string | null) => (c ? SecureStore.setItemAsync(KS, c) : SecureStore.deleteItemAsync(KS));

// Último snapshot e cache de séries (abrir o app mostrando os últimos valores na hora).
import { reviveSnapshot, serializeSnapshot, KV, Snapshot } from '../core';
const KSNAP = 'pilinha.lastSnapshot.v1';
export const loadLastSnapshot = async (): Promise<Snapshot | null> => { try { return reviveSnapshot(await AsyncStorage.getItem(KSNAP)); } catch { return null; } };
export const saveLastSnapshot = (s: Snapshot) => AsyncStorage.setItem(KSNAP, serializeSnapshot(s)).catch(() => {});
export const kv: KV = { get: k => AsyncStorage.getItem(k), set: (k, v) => AsyncStorage.setItem(k, v) };
