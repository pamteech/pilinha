import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { emptyPortfolio, HistoryPoint, Portfolio } from '../core';
// Tudo fica só no aparelho: carteira e histórico no AsyncStorage, token da brapi no Keychain.
const K = { portfolio: 'pilinha.portfolio.v1', history: 'pilinha.history.v1', token: 'pilinha.brapiToken', hidden: 'pilinha.hidden' };
export async function loadPortfolio(): Promise<Portfolio> {
  try { const s = await AsyncStorage.getItem(K.portfolio); return s ? { ...emptyPortfolio(), ...JSON.parse(s) } : emptyPortfolio(); } catch { return emptyPortfolio(); }
}
export const savePortfolio = (p: Portfolio) => AsyncStorage.setItem(K.portfolio, JSON.stringify(p));
export async function loadHistory(): Promise<HistoryPoint[]> { try { return JSON.parse((await AsyncStorage.getItem(K.history)) ?? '[]'); } catch { return []; } }
export const saveHistory = (h: HistoryPoint[]) => AsyncStorage.setItem(K.history, JSON.stringify(h));
export const loadToken = () => SecureStore.getItemAsync(K.token);
export const saveToken = (t: string) => (t ? SecureStore.setItemAsync(K.token, t) : SecureStore.deleteItemAsync(K.token));
export const loadHidden = async () => (await AsyncStorage.getItem(K.hidden)) === '1';
export const saveHidden = (b: boolean) => AsyncStorage.setItem(K.hidden, b ? '1' : '0');
