import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { HistoryPoint, Portfolio, Snapshot, emptyPortfolio, record, snapshot, total, totalInvested, totalNet } from '../core';
import * as S from './storage';
import { syncExtensions } from './widget';
interface Ctx { portfolio: Portfolio; snap: Snapshot | null; history: HistoryPoint[]; loading: boolean; hasToken: boolean; hidden: boolean;
  setHidden: (b: boolean) => void; refresh: () => Promise<void>; update: (p: Portfolio) => Promise<void>; setToken: (t: string) => Promise<void> }
const C = createContext<Ctx>(null as any);
export const usePilinha = () => useContext(C);
export function PilinhaProvider({ children }: { children: React.ReactNode }) {
  const [portfolio, setP] = useState<Portfolio>(emptyPortfolio());
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [history, setH] = useState<HistoryPoint[]>([]);
  const [loading, setL] = useState(true); const [hasToken, setHT] = useState(false); const [hidden, setHiddenState] = useState(false);
  const hRef = useRef(false);
  const setHidden = (b: boolean) => { hRef.current = b; setHiddenState(b); S.saveHidden(b); if (snapRef.current) syncExtensions(snapRef.current, b); };
  const snapRef = useRef<Snapshot | null>(null);
  const pRef = useRef(portfolio); pRef.current = portfolio;
  const run = useCallback(async (p: Portfolio) => {
    setL(true);
    try {
      const token = await S.loadToken(); setHT(!!token);
      const s = await snapshot(p, { brapiToken: token }); setSnap(s); snapRef.current = s; syncExtensions(s, hRef.current);
      const h = record(await S.loadHistory(), total(s), totalInvested(s), totalNet(s)); setH(h); await S.saveHistory(h);
    } finally { setL(false); }
  }, []);
  useEffect(() => { (async () => { const h = await S.loadHidden(); hRef.current = h; setHiddenState(h); const p = await S.loadPortfolio(); setP(p); await run(p); })(); }, [run]);
  useEffect(() => { const t = setInterval(() => run(pRef.current), 5 * 60_000); return () => clearInterval(t); }, [run]);
  const update = async (p: Portfolio) => { setP(p); await S.savePortfolio(p); await run(p); };
  const setToken = async (t: string) => { await S.saveToken(t.trim()); await run(pRef.current); };
  return <C.Provider value={{ portfolio, snap, history, loading, hasToken, hidden, setHidden, refresh: () => run(pRef.current), update, setToken }}>{children}</C.Provider>;
}
