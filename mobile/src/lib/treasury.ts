import AsyncStorage from '@react-native-async-storage/async-storage';
import { Portfolio, TESOURO_CSV_URL, TreasuryRow, parseTreasuryCSV, toISO, treasuryTitle } from '../core';
// O CSV oficial tem ~15 MB: baixa no máximo 1 vez a cada 12 h e guarda só as linhas dos títulos da carteira.
const K = 'pilinha.treasury.v1';
interface Cache { at: number; keys: string; rows: TreasuryRow[] }
export async function treasuryRows(p: Portfolio): Promise<TreasuryRow[] | null> {
  const wanted = p.fixedIncome.map(treasuryTitle).filter((x): x is { title: string; maturity: string } => !!x);
  if (!wanted.length) return null;
  const keys = wanted.map(w => `${w.title}|${w.maturity}`).sort().join(',');
  let cache: Cache | null = null;
  try { cache = JSON.parse((await AsyncStorage.getItem(K)) ?? 'null'); } catch {}
  if (cache && cache.keys === keys && Date.now() - cache.at < 12 * 3600_000) return cache.rows;
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
    const txt = await fetch(TESOURO_CSV_URL, { signal: ctl.signal }).then(r => r.text()).finally(() => clearTimeout(t));
    const since = p.fixedIncome.flatMap(a => a.deposits.map(d => d.date)).sort()[0] ?? toISO(new Date());
    const from = toISO(new Date(new Date(since).getTime() - 15 * 86_400_000));
    const rows = parseTreasuryCSV(txt, wanted, from);
    if (rows.length) { await AsyncStorage.setItem(K, JSON.stringify({ at: Date.now(), keys, rows })); return rows; }
  } catch {}
  return cache?.rows ?? null; // falha silenciosa: segue só com a curva
}
