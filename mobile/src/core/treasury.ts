import { FixedIncomeAsset, treasuryTypeOf, TreasuryType } from './types';
import { parseBR, parseISO, toISO } from './dates';
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
  const tt = treasuryTypeOf(a);
  const title = tt === 'prefixado' ? (juros ? 'Tesouro Prefixado com Juros Semestrais' : 'Tesouro Prefixado') : tt === 'ipca' ? (n.includes('renda') ? 'Tesouro Renda+ Aposentadoria Extra' : n.includes('educa') ? 'Tesouro Educa+' : juros ? 'Tesouro IPCA+ com Juros Semestrais' : 'Tesouro IPCA+') : 'Tesouro Selic';
  return { title, maturity: a.maturity.slice(0, 10) };
}
const num = (s: string | undefined) => { if (!s) return null; const v = parseFloat(s.trim().replace(/\./g, '').replace(',', '.')); return isFinite(v) && v > 0 ? v : null; };
export const titleKey = (title: string, maturity: string) => `${title.trim().toLowerCase()}|${maturity}`;
/** Percorre as linhas sem criar um array com todas (o CSV tem ~15 MB; o split dobrava a memória no iPhone). */
export function forEachLine(text: string, fn: (line: string) => void) {
  let i = 0; const n = text.length;
  while (i < n) { let j = text.indexOf('\n', i); if (j < 0) j = n; const e = j > i && text.charCodeAt(j - 1) === 13 ? j - 1 : j; fn(text.slice(i, e)); i = j + 1; }
}
/** Lê o CSV (;) guardando só os títulos pedidos e datas a partir de `since` (AAAA-MM-DD). */
export function parseTreasuryCSV(text: string, wanted: { title: string; maturity: string }[], since = '0000-00-00'): TreasuryRow[] {
  const want = new Set(wanted.map(w => titleKey(w.title, w.maturity)));
  const out: TreasuryRow[] = [];
  forEachLine(text, line => {
    const c = line.split(';'); if (c.length < 7) return;
    const mat = parseBR(c[1]?.trim()), day = parseBR(c[2]?.trim()); if (!mat || !day) return;
    const m = toISO(mat), d = toISO(day);
    if (!want.has(titleKey(c[0], m)) || d < since) return;
    out.push({ title: c[0].trim(), maturity: m, day: d, buyRate: num(c[3]), sellRate: num(c[4]), puBuy: num(c[5]), puSell: num(c[6]) });
  });
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

/** Título à venda hoje (último dia da planilha), para o cadastro preencher a taxa sozinho. */
export interface TreasuryOffer { title: string; maturity: string; type: TreasuryType; buyRate: number | null; day: string }
export const treasuryTypeOfTitle = (title: string): TreasuryType | null => {
  const t = title.toLowerCase();
  return t.includes('selic') ? 'selic' : t.includes('prefixado') ? 'prefixado' : t.includes('ipca') || t.includes('renda+') || t.includes('educa+') ? 'ipca' : null;
};
/** Ofertas do dia mais recente do CSV, sem títulos já vencidos, ordenadas por tipo e vencimento. */
export function latestTreasuryOffers(text: string, today = '0000-00-00'): TreasuryOffer[] {
  let last = ''; const byDay = new Map<string, TreasuryOffer[]>();
  forEachLine(text, line => {
    const c = line.split(';'); if (c.length < 7) return;
    const mat = parseBR(c[1]?.trim()), day = parseBR(c[2]?.trim()); if (!mat || !day) return;
    const type = treasuryTypeOfTitle(c[0]); if (!type) return;
    const d = toISO(day), m = toISO(mat); if (m < today) return;
    if (d < last) return;
    if (d > last) { last = d; byDay.clear(); }
    const list = byDay.get(d) ?? []; const t = c[0].trim();
    if (!list.some(o => o.title === t && o.maturity === m)) list.push({ title: t, maturity: m, type, buyRate: num(c[3]), day: d }); byDay.set(d, list);
  });
  return (byDay.get(last) ?? []).sort((a, b) => (a.type + a.maturity < b.type + b.maturity ? -1 : 1));
}
/** Nome curto: "Tesouro IPCA+ 2035". */
export const offerName = (o: { title: string; maturity: string }) => `${o.title} ${o.maturity.slice(0, 4)}`;

/** Texto da taxa do dia no cadastro; nunca quebra com taxa ausente/inválida. */
export function offerRateText(o: { type: TreasuryType; buyRate: number | null | undefined }): string {
  const r = o.buyRate; if (typeof r !== 'number' || !Number.isFinite(r)) return 'sem taxa hoje';
  return o.type === 'selic' ? `Hoje: Selic + ${r.toFixed(4).replace('.', ',')}%` : o.type === 'ipca' ? `Hoje: IPCA + ${r.toFixed(2).replace('.', ',')}% ao ano` : `Hoje: ${r.toFixed(2).replace('.', ',')}% ao ano`;
}
/** Ofertas vindas do cache/planilha: descarta qualquer item malformado (título, vencimento ou tipo). */
export const sanitizeOffers = (x: unknown): TreasuryOffer[] => (Array.isArray(x) ? x : []).filter((o: any) =>
  !!o && typeof o.title === 'string' && typeof o.maturity === 'string' && !!parseISO(o.maturity) && ['selic', 'prefixado', 'ipca'].includes(o.type) && (o.buyRate == null || (typeof o.buyRate === 'number' && Number.isFinite(o.buyRate))));
