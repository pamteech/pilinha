import AsyncStorage from '@react-native-async-storage/async-storage';
import { Portfolio, TESOURO_CSV_URL, TreasuryRow, TreasuryOffer, latestTreasuryOffers, parseTreasuryCSV, toISO, treasuryTitle } from '../core';
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
  // Planilha velha: devolve o cache na hora e atualiza em segundo plano (vale no próximo refresh).
  const job = download(p, wanted, keys);
  if (cache && cache.keys === keys) { job.catch(() => {}); return cache.rows; }
  return (await job.catch(() => null)) ?? cache?.rows ?? null;
}
let inflight: Promise<TreasuryRow[] | null> | null = null;
function download(p: Portfolio, wanted: { title: string; maturity: string }[], keys: string): Promise<TreasuryRow[] | null> {
  return inflight ??= (async () => {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
    const txt = await fetch(TESOURO_CSV_URL, { signal: ctl.signal }).then(r => r.text()).finally(() => clearTimeout(t));
    const since = p.fixedIncome.flatMap(a => a.deposits.map(d => d.date)).sort()[0] ?? toISO(new Date());
    const from = toISO(new Date(new Date(since).getTime() - 15 * 86_400_000));
    const rows = parseTreasuryCSV(txt, wanted, from);
    if (rows.length) { await AsyncStorage.setItem(K, JSON.stringify({ at: Date.now(), keys, rows })); return rows; }
  } catch {}
  return null; // falha silenciosa: segue só com a curva
  })().finally(() => { inflight = null; });
}

// Ofertas do dia (para o cadastro preencher a taxa sozinho): mesma planilha, cache próprio de 12 h.
const KO = 'pilinha.treasury.offers.v1';
let offersInflight: Promise<TreasuryOffer[]> | null = null;
export async function treasuryOffers(): Promise<TreasuryOffer[]> {
  let c: { at: number; offers: TreasuryOffer[] } | null = null;
  try { c = JSON.parse((await AsyncStorage.getItem(KO)) ?? 'null'); } catch {}
  if (c && Date.now() - c.at < 12 * 3600_000 && c.offers.length) return c.offers;
  return offersInflight ??= (async () => {
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 30000);
      const txt = await fetch(TESOURO_CSV_URL, { signal: ctl.signal }).then(r => r.text()).finally(() => clearTimeout(t));
      const offers = latestTreasuryOffers(txt, toISO(new Date()));
      if (offers.length) await AsyncStorage.setItem(KO, JSON.stringify({ at: Date.now(), offers }));
      return offers.length ? offers : c?.offers ?? [];
    } catch { return c?.offers ?? []; }
  })().finally(() => { offersInflight = null; });
}
