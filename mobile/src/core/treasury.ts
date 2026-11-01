import { FixedIncomeAsset, indexerOf } from './types';
import { parseBR, toISO } from './dates';
/**
 * Marcação a mercado do Tesouro Direto pelo CSV oficial do Tesouro Transparente
 * (PrecoTaxaTesouroDireto.csv, sai todo dia útil). Só sai do aparelho o pedido do arquivo público.
 * Quantidade estimada = aplicado / PU de compra na data do aporte (ou no último dia útil antes dela);
 * valor de venda hoje = quantidade × PU de venda (resgate) mais recente.
 */
export const TESOURO_CSV_URL = 'https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/PrecoTaxaTesouroDireto.csv';
export interface TreasuryRow { title: string; maturity: string; day: string; buyRate: number | null; sellRate: number | null; puBuy: number | null; puSell: number | null }
/** Título do CSV para um ativo da carteira (só Tesouro com vencimento). */
export function treasuryTitle(a: FixedIncomeAsset): { title: string; maturity: string } | null {
  if (a.kind !== 'tesouro' || !a.maturity) return null;
  const n = a.name.toLowerCase();
  const juros = n.includes('juros') || n.includes('semestra');
  const title = indexerOf(a) === 'ipca' ? (n.includes('renda') ? 'Tesouro Renda+ Aposentadoria Extra' : n.includes('educa') ? 'Tesouro Educa+' : juros ? 'Tesouro IPCA+ com Juros Semestrais' : 'Tesouro IPCA+') : 'Tesouro Selic';
  return { title, maturity: a.maturity.slice(0, 10) };
}
const num = (s: string | undefined) => { if (!s) return null; const v = parseFloat(s.trim().replace(/\./g, '').replace(',', '.')); return isFinite(v) && v > 0 ? v : null; };
export const titleKey = (title: string, maturity: string) => `${title.trim().toLowerCase()}|${maturity}`;
/** Lê o CSV (;) guardando só os títulos pedidos e datas a partir de `since` (AAAA-MM-DD). */
export function parseTreasuryCSV(text: string, wanted: { title: string; maturity: string }[], since = '0000-00-00'): TreasuryRow[] {
  const want = new Set(wanted.map(w => titleKey(w.title, w.maturity)));
  const out: TreasuryRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    const c = line.split(';'); if (c.length < 7) continue;
    const mat = parseBR(c[1]?.trim()), day = parseBR(c[2]?.trim()); if (!mat || !day) continue;
    const m = toISO(mat), d = toISO(day);
    if (!want.has(titleKey(c[0], m)) || d < since) continue;
    out.push({ title: c[0].trim(), maturity: m, day: d, buyRate: num(c[3]), sellRate: num(c[4]), puBuy: num(c[5]), puSell: num(c[6]) });
  }
  return out.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
export interface MarketValue { value: number; day: string; sellRate: number | null; quantity: number }
/** Valor de venda hoje. null se faltar dado (o app segue mostrando só a curva). */
export function markToMarket(a: FixedIncomeAsset, rows: TreasuryRow[]): MarketValue | null {
  const t = treasuryTitle(a); if (!t) return null;
  const k = titleKey(t.title, t.maturity), rs = rows.filter(r => titleKey(r.title, r.maturity) === k);
  const last = [...rs].reverse().find(r => r.puSell != null); if (!last || !a.deposits.length) return null;
  let q = 0;
  for (const d of a.deposits) {
    const ref = [...rs].reverse().find(r => r.day <= d.date && r.puBuy != null) ?? rs.find(r => r.puBuy != null);
    if (!ref) return null; q += d.amount / ref.puBuy!;
  }
  return { value: q * last.puSell!, day: last.day, sellRate: last.sellRate, quantity: q };
}
