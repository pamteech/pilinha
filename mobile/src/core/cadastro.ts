import { FixedIncomeAsset, FixedIncomeKind, Portfolio, TreasuryType, rateModelOf, treasuryTypeOf } from './types';
import { parseISO, toISO } from './dates';
import { isPositive, normTicker, parseNumberBR, validPastDate, validTicker } from './numbers';
import { brl } from './format';
/**
 * Cadastro em 3 passos (tipo → poucos campos → conferir). Só lógica pura aqui, para testar sem tela.
 * Nada aqui apaga item que não foi pedido: incluir soma (aporte / quantidade) e editar troca só o item editado.
 */
export type AssetType = 'renda' | 'tesouro' | 'acao' | 'fii' | 'bitcoin' | 'dolar' | 'lcilca' | 'provento';
export const ASSET_TYPES: { type: AssetType; title: string; hint: string; icon: string }[] = [
  { type: 'renda', title: 'Caixinha ou CDB', hint: 'Rende % do CDI', icon: 'wallet-outline' },
  { type: 'tesouro', title: 'Tesouro Direto', hint: 'Selic, Prefixado, IPCA+', icon: 'bank-outline' },
  { type: 'acao', title: 'Ações', hint: 'Ex.: PETR4, ITUB4', icon: 'trending-up' },
  { type: 'fii', title: 'Fundos imobiliários', hint: 'Ex.: MXRF11', icon: 'home-city-outline' },
  { type: 'bitcoin', title: 'Bitcoin', hint: 'Cotação automática', icon: 'bitcoin' },
  { type: 'dolar', title: 'Dólar', hint: 'Quantos US$ você tem', icon: 'currency-usd' },
  { type: 'lcilca', title: 'LCI ou LCA', hint: 'Isenta de IR', icon: 'shield-check-outline' },
  { type: 'provento', title: 'Provento recebido', hint: 'Dividendo que caiu', icon: 'gift-outline' },
];
export const CDI_SHORTCUTS = [100, 105, 110];

/** Tudo texto, como na tela. `kind` refina renda (caixinha/cdb) e lcilca (lci/lca). */
export interface Draft {
  type: AssetType; name: string; kind?: FixedIncomeKind; amount: string; date: string; cdi: string;
  treasury: TreasuryType; title?: string; maturity: string; rate: string;
  ticker: string; quantity: string; avg: string;
  /** Edição: chave do item original (nome da renda fixa, ticker, coinId, 'usd', índice do provento). */
  editKey?: string;
}
export const emptyDraft = (type: AssetType, today = toISO(new Date())): Draft => ({
  type, name: '', kind: type === 'renda' ? 'caixinha' : type === 'lcilca' ? 'lci' : type === 'tesouro' ? 'tesouro' : undefined,
  amount: '', date: today, cdi: '100', treasury: 'ipca', maturity: '', rate: '', ticker: '', quantity: '', avg: '',
});
const fmt = (n: number | null | undefined, d = 2) => (n == null ? '' : n.toFixed(d).replace(/\.?0+$/, '').replace('.', ','));
const isFixedType = (t: AssetType) => t === 'renda' || t === 'tesouro' || t === 'lcilca';

/** Abre um item da carteira para editar (mesma tela do cadastro). */
export function draftFor(p: Portfolio, ref: { category: string; name: string }): Draft | null {
  const c = ref.category;
  if (['caixinha', 'cdb', 'tesouro', 'lci', 'lca'].includes(c)) {
    const a = p.fixedIncome.find(x => x.name === ref.name); if (!a) return null;
    const type: AssetType = a.kind === 'tesouro' ? 'tesouro' : a.kind === 'lci' || a.kind === 'lca' ? 'lcilca' : 'renda';
    const tt = treasuryTypeOf(a) ?? 'selic', rm = rateModelOf(a);
    const first = [...a.deposits].sort((x, y) => (x.date < y.date ? -1 : 1))[0];
    return { ...emptyDraft(type), editKey: a.name, name: a.name, kind: a.kind, cdi: fmt(a.cdiPercent), treasury: tt, maturity: a.maturity?.slice(0, 10) ?? '',
      rate: rm === 'ipca' ? fmt(a.realRate) : rm === 'prefixado' ? fmt(a.fixedRate) : '',
      amount: fmt(a.deposits.reduce((s, d) => s + d.amount, 0)), date: first?.date ?? toISO(new Date()) };
  }
  if (c === 'acao' || c === 'fii') {
    const s = p.stocks.find(x => x.ticker.toUpperCase() === ref.name.toUpperCase()); if (!s) return null;
    return { ...emptyDraft(c), editKey: s.ticker, ticker: s.ticker, quantity: fmt(s.quantity, 8), avg: fmt(s.averagePrice) };
  }
  if (c === 'cripto') {
    const k = p.crypto.find(x => x.symbol.toUpperCase() === ref.name.toUpperCase() || x.coinId === ref.name); if (!k) return null;
    return { ...emptyDraft('bitcoin'), editKey: k.coinId, quantity: fmt(k.quantity, 8), avg: fmt(k.averagePriceBRL) };
  }
  if (c === 'dolar' && p.usd) return { ...emptyDraft('dolar'), editKey: 'usd', quantity: fmt(p.usd.amount), avg: fmt(p.usd.averageRateBRL ?? null, 4) };
  return null;
}

/** Na edição de renda fixa com vários aportes, valor/data não são reescritos (só taxa, nome, vencimento). */
export const multiDeposit = (p: Portfolio, d: Draft) => !!d.editKey && isFixedType(d.type) && (p.fixedIncome.find(a => a.name === d.editKey)?.deposits.length ?? 0) > 1;

export function fixedName(d: Draft): string {
  if (d.name.trim()) return d.name.trim();
  if (d.type === 'tesouro') return d.title?.trim() || (d.treasury === 'selic' ? 'Tesouro Selic' : d.treasury === 'prefixado' ? 'Tesouro Prefixado' : 'Tesouro IPCA+') + (d.maturity ? ` ${d.maturity.slice(0, 4)}` : '');
  if (d.type === 'lcilca') return d.kind === 'lca' ? 'LCA' : 'LCI';
  return d.kind === 'cdb' ? 'CDB' : 'Caixinha';
}

/** Problemas em português (vazio = pode seguir). */
export function validateDraft(d: Draft, p: Portfolio, now = new Date()): string[] {
  const e: string[] = [], n = parseNumberBR;
  const editMulti = multiDeposit(p, d);
  if (d.type === 'acao' || d.type === 'fii') {
    if (!validTicker(d.ticker)) e.push('Escolha a ação pelo nome ou digite o código (ex. PETR4).');
    if (!isPositive(n(d.quantity))) e.push('Quantas você tem? (ex. 100)');
    if (d.avg.trim() && !isPositive(n(d.avg))) e.push('Preço médio inválido (ex. 32,10).');
    return e;
  }
  if (d.type === 'bitcoin' || d.type === 'dolar') {
    if (!isPositive(n(d.quantity))) e.push(d.type === 'bitcoin' ? 'Quanto de bitcoin você tem? (ex. 0,0015)' : 'Quantos dólares você tem? (ex. 1500)');
    if (d.avg.trim() && !isPositive(n(d.avg))) e.push('Valor médio inválido.');
    return e;
  }
  if (d.type === 'provento') {
    if (!validTicker(d.ticker)) e.push('De qual ação ou FII? (ex. MXRF11)');
    if (!isPositive(n(d.amount))) e.push('Quanto caiu na conta?');
    if (!validPastDate(d.date, now)) e.push('A data não pode ser no futuro.');
    return e;
  }
  if (!editMulti) {
    if (!isPositive(n(d.amount))) e.push('Quanto você investiu? (ex. 1.000,00)');
    if (!validPastDate(d.date, now)) e.push('Quando? A data não pode ser no futuro.');
  }
  if (d.type === 'tesouro' && d.treasury !== 'selic') {
    const r = n(d.rate);
    if (!Number.isFinite(r) || r < 0 || r > (d.treasury === 'ipca' ? 30 : 50)) e.push(d.treasury === 'ipca' ? 'Taxa do IPCA+ inválida (ex. 7,5).' : 'Taxa prefixada inválida (ex. 13,2).');
  } else {
    const c = n(d.cdi);
    if (!isPositive(c) || c > 300) e.push('% do CDI inválido (ex. 100).');
  }
  if (d.maturity && !parseISO(d.maturity)) e.push('Vencimento inválido.');
  return e;
}

export interface SaveResult { portfolio: Portfolio; merged: boolean; message?: string }
/** Aviso mostrado na conferência quando o item já existe (o que vai acontecer ao salvar). */
export function existingNotice(d: Draft, p: Portfolio, hidden = false): string | null {
  if (d.editKey) return null;
  if (isFixedType(d.type)) {
    const a = p.fixedIncome.find(x => x.name.trim().toLowerCase() === fixedName(d).toLowerCase());
    return a ? `Você já tem "${a.name}". Este valor entra como um novo aporte nele (os aportes anteriores continuam).` : null;
  }
  if (d.type === 'acao' || d.type === 'fii') {
    const t = normTicker(d.ticker), s = p.stocks.find(x => x.ticker.toUpperCase() === t); if (!s) return null;
    if (hidden) return `Você já tem ${t}. As quantidades somam e o preço médio vira a média ponderada pela quantidade (mostre os valores para ver a conta).`;
    const q = parseNumberBR(d.quantity), avg = d.avg.trim() ? parseNumberBR(d.avg) : null;
    const m = mergeStock(s, q, avg);
    return `Você já tem ${t}. As quantidades somam (${fmtQ(s.quantity)} + ${fmtQ(q)} = ${fmtQ(m.quantity)})` +
      (m.averagePrice != null && s.averagePrice != null && avg != null ? ` e o preço médio vira a média ponderada: (${fmtQ(s.quantity)} × ${brl(s.averagePrice)} + ${fmtQ(q)} × ${brl(avg)}) ÷ ${fmtQ(m.quantity)} = ${brl(m.averagePrice)}.` : s.averagePrice != null ? '; sem preço médio novo, o anterior é mantido.' : '.');
  }
  if (d.type === 'bitcoin' && p.crypto.some(c => c.coinId === 'bitcoin')) return 'Você já tem bitcoin. A quantidade soma com a que já está lá (preço médio ponderado, se informado).';
  if (d.type === 'dolar' && p.usd) return 'Você já tem dólar. A quantidade soma com a que já está lá (cotação média ponderada, se informada).';
  return null;
}
const fmtQ = (q: number) => q.toLocaleString('pt-BR', { maximumFractionDigits: 8 });
/** Soma quantidades; preço médio ponderado quando os dois lados têm preço, senão mantém o que existir. */
export function mergeStock<T extends { quantity: number; averagePrice?: number }>(s: T, q: number, avg: number | null): T & { averagePrice?: number } {
  const total = s.quantity + q;
  const pm = s.averagePrice != null && avg != null ? (s.averagePrice * s.quantity + avg * q) / total : s.averagePrice ?? avg ?? undefined;
  return { ...s, quantity: total, ...(pm != null ? { averagePrice: pm } : {}) };
}
const wavg = (q1: number, a1: number | null | undefined, q2: number, a2: number | null) => (a1 != null && a2 != null ? (a1 * q1 + a2 * q2) / (q1 + q2) : a1 ?? a2 ?? undefined);

export function buildFixed(d: Draft, prev?: FixedIncomeAsset): FixedIncomeAsset {
  const n = parseNumberBR, name = fixedName(d);
  const kind: FixedIncomeKind = d.type === 'tesouro' ? 'tesouro' : d.kind ?? (d.type === 'lcilca' ? 'lci' : 'caixinha');
  const base: FixedIncomeAsset = { ...(prev ?? {}), name, kind, cdiPercent: 100, deposits: prev?.deposits ?? [] } as FixedIncomeAsset;
  delete base.indexer; delete base.realRate; delete base.treasuryType; delete base.fixedRate;
  if (d.type === 'tesouro') {
    base.treasuryType = d.treasury;
    if (d.treasury === 'ipca') { base.indexer = 'ipca'; base.realRate = n(d.rate); base.cdiPercent = 0; }
    else if (d.treasury === 'prefixado') base.fixedRate = n(d.rate); // cdiPercent 100: Mac antigo lê como CDI em vez de quebrar
    else base.cdiPercent = isPositive(n(d.cdi)) ? n(d.cdi) : 100; // Selic ≈ 100% do CDI (como já era cadastrado)
  } else base.cdiPercent = n(d.cdi);
  if (d.maturity) base.maturity = d.maturity; else delete base.maturity;
  if (kind === 'lci' || kind === 'lca') base.taxExempt = true;
  return base;
}

/** Aplica o rascunho na carteira. Edição troca só aquele item; inclusão soma no que já existe. */
export function applyDraft(p: Portfolio, d: Draft): SaveResult {
  const n = parseNumberBR;
  if (isFixedType(d.type)) {
    const list = [...p.fixedIncome];
    if (d.editKey) {
      const i = list.findIndex(a => a.name === d.editKey); const prev = list[i];
      const a = buildFixed(d, prev);
      if (!multiDeposit(p, d)) a.deposits = [{ date: d.date, amount: n(d.amount) }];
      if (i >= 0) list[i] = a; else list.push(a);
      return { portfolio: { ...p, fixedIncome: list }, merged: false };
    }
    const i = list.findIndex(a => a.name.trim().toLowerCase() === fixedName(d).toLowerCase());
    const dep = { date: d.date, amount: n(d.amount) };
    if (i >= 0) { list[i] = { ...list[i], deposits: [...list[i].deposits, dep] }; return { portfolio: { ...p, fixedIncome: list }, merged: true }; }
    const a = buildFixed(d); a.deposits = [dep]; list.push(a);
    return { portfolio: { ...p, fixedIncome: list }, merged: false };
  }
  if (d.type === 'acao' || d.type === 'fii') {
    const t = normTicker(d.ticker), q = n(d.quantity), avg = d.avg.trim() ? n(d.avg) : null;
    if (d.editKey) {
      const others = p.stocks.filter(s => s.ticker.toUpperCase() !== d.editKey!.toUpperCase());
      const prev = p.stocks.find(s => s.ticker.toUpperCase() === d.editKey!.toUpperCase());
      const { averagePrice: _a, ...rest } = prev ?? { ticker: t, quantity: q };
      const dup = others.find(s => s.ticker.toUpperCase() === t);
      const mine = { ...rest, ticker: t, quantity: q, ...(avg != null ? { averagePrice: avg } : {}) };
      return { portfolio: { ...p, stocks: dup ? others.map(s => (s === dup ? mergeStock(dup, q, avg) : s)) : [...others, mine] }, merged: !!dup };
    }
    const prev = p.stocks.find(s => s.ticker.toUpperCase() === t);
    if (prev) return { portfolio: { ...p, stocks: p.stocks.map(s => (s === prev ? mergeStock(prev, q, avg) : s)) }, merged: true };
    return { portfolio: { ...p, stocks: [...p.stocks, { ticker: t, quantity: q, ...(avg != null ? { averagePrice: avg } : {}) }] }, merged: false };
  }
  if (d.type === 'bitcoin') {
    const q = n(d.quantity), avg = d.avg.trim() ? n(d.avg) : null, prev = p.crypto.find(c => c.coinId === 'bitcoin');
    const others = p.crypto.filter(c => c.coinId !== 'bitcoin');
    if (prev && !d.editKey) {
      const pm = wavg(prev.quantity, prev.averagePriceBRL, q, avg);
      return { portfolio: { ...p, crypto: [...others, { ...prev, quantity: prev.quantity + q, ...(pm != null ? { averagePriceBRL: pm } : {}) }] }, merged: true };
    }
    const { averagePriceBRL: _a, ...rest } = prev ?? { coinId: 'bitcoin', symbol: 'BTC', quantity: q };
    return { portfolio: { ...p, crypto: [...others, { ...rest, coinId: 'bitcoin', symbol: 'BTC', quantity: q, ...(avg != null ? { averagePriceBRL: avg } : {}) }] }, merged: false };
  }
  if (d.type === 'dolar') {
    const q = n(d.quantity), avg = d.avg.trim() ? n(d.avg) : null, prev = p.usd;
    if (prev && !d.editKey) {
      const pm = wavg(prev.amount, prev.averageRateBRL, q, avg);
      return { portfolio: { ...p, usd: { amount: prev.amount + q, ...(pm != null ? { averageRateBRL: pm } : {}) } }, merged: true };
    }
    return { portfolio: { ...p, usd: { amount: q, ...(avg != null ? { averageRateBRL: avg } : {}) } }, merged: false };
  }
  // provento
  return { portfolio: { ...p, manualDividends: [...(p.manualDividends ?? []), { ticker: normTicker(d.ticker), date: d.date, amount: n(d.amount) }] }, merged: false };
}

/** Remove só o item pedido. */
export function removeItem(p: Portfolio, ref: { category: string; name: string }): Portfolio {
  const c = ref.category;
  if (['caixinha', 'cdb', 'tesouro', 'lci', 'lca'].includes(c)) return { ...p, fixedIncome: p.fixedIncome.filter(a => a.name !== ref.name) };
  if (c === 'acao' || c === 'fii') return { ...p, stocks: p.stocks.filter(s => s.ticker.toUpperCase() !== ref.name.toUpperCase()) };
  if (c === 'cripto') return { ...p, crypto: p.crypto.filter(k => k.symbol.toUpperCase() !== ref.name.toUpperCase() && k.coinId !== ref.name) };
  if (c === 'dolar') { const { usd: _u, ...rest } = p; return rest as Portfolio; }
  return p;
}

export interface Preview { invested: number | null; date: string | null; today: number | null; yearGain: number | null; label: string; sub: string }
/** IPCA usado só na estimativa de 1 ano do IPCA+ (aviso "estimado" na tela). */
export const IPCA_ESTIMATE = 4.5;
/**
 * Prévia da conferência. Renda fixa: valor de hoje pela taxa anual do CDI (ou a taxa do título)
 * em dias úteis aproximados (corridos × 252/365); 1 ano = aplicado × taxa anual. Ações/BTC/US$: quantidade × cotação.
 */
export function preview(d: Draft, ctx: { cdiAnnual: number | null; price?: number | null; now?: Date }): Preview {
  const n = parseNumberBR, now = ctx.now ?? new Date();
  if (isFixedType(d.type)) {
    const amt = n(d.amount); const start = parseISO(d.date);
    const annual = d.type === 'tesouro' && d.treasury === 'prefixado' ? n(d.rate)
      : d.type === 'tesouro' && d.treasury === 'ipca' ? ((1 + n(d.rate) / 100) * (1 + IPCA_ESTIMATE / 100) - 1) * 100
      : ctx.cdiAnnual != null ? ctx.cdiAnnual * n(d.cdi) / 100 : null;
    const ok = isPositive(amt) && annual != null && Number.isFinite(annual);
    const days = start ? Math.max(0, (now.getTime() - start.getTime()) / 86_400_000) * 252 / 365 : 0;
    const sub = d.type === 'tesouro' ? (d.treasury === 'selic' ? 'Selic' : d.treasury === 'prefixado' ? `Prefixado ${d.rate}% ao ano` : `IPCA + ${d.rate}% ao ano`) : `${d.cdi}% do CDI`;
    return { label: fixedName(d), sub, invested: isPositive(amt) ? amt : null, date: d.date || null,
      today: ok ? amt * Math.pow(1 + annual! / 100, days / 252) : null, yearGain: ok ? amt * annual! / 100 : null };
  }
  if (d.type === 'provento') return { label: normTicker(d.ticker), sub: 'Provento recebido', invested: null, date: d.date, today: isPositive(n(d.amount)) ? n(d.amount) : null, yearGain: null };
  const q = n(d.quantity), avg = d.avg.trim() ? n(d.avg) : null;
  const label = d.type === 'bitcoin' ? 'Bitcoin' : d.type === 'dolar' ? 'Dólar' : normTicker(d.ticker);
  return { label, sub: d.type === 'fii' ? 'Fundo imobiliário' : d.type === 'acao' ? 'Ação' : d.type === 'dolar' ? 'US$' : 'BTC',
    invested: avg != null && isPositive(q) ? avg * q : null, date: null, today: ctx.price != null && isPositive(q) ? ctx.price * q : null, yearGain: null };
}

/** Busca por nome ou código: lista curta local (funciona sem internet) + Yahoo (só o texto digitado sai do aparelho). */
export interface TickerHit { ticker: string; name: string }
export const POPULAR: TickerHit[] = [
  ['PETR4', 'Petrobras PN'], ['PETR3', 'Petrobras ON'], ['VALE3', 'Vale ON'], ['ITUB4', 'Itaú Unibanco PN'], ['BBDC4', 'Bradesco PN'],
  ['BBAS3', 'Banco do Brasil ON'], ['ITSA4', 'Itaúsa PN'], ['B3SA3', 'B3 ON'], ['WEGE3', 'WEG ON'], ['ABEV3', 'Ambev ON'],
  ['BBSE3', 'BB Seguridade ON'], ['TAEE11', 'Taesa Unit'], ['EGIE3', 'Engie Brasil ON'], ['PRIO3', 'PetroRio ON'], ['SUZB3', 'Suzano ON'],
  ['MGLU3', 'Magazine Luiza ON'], ['RENT3', 'Localiza ON'], ['ELET3', 'Eletrobras ON'], ['CMIG4', 'Cemig PN'], ['SANB11', 'Santander Unit'],
  ['MXRF11', 'Maxi Renda FII'], ['HGLG11', 'CSHG Logística FII'], ['KNRI11', 'Kinea Renda Imobiliária FII'], ['XPML11', 'XP Malls FII'],
  ['VISC11', 'Vinci Shopping Centers FII'], ['KNCR11', 'Kinea Rendimentos FII'], ['BTLG11', 'BTG Logística FII'], ['HGRU11', 'CSHG Renda Urbana FII'],
  ['CPTS11', 'Capitânia Securities FII'], ['IRDM11', 'Iridium Recebíveis FII'],
].map(([ticker, name]) => ({ ticker, name }));
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function localSearch(q: string, onlyFii?: boolean): TickerHit[] {
  const k = fold(q.trim()); if (!k) return [];
  return POPULAR.filter(h => (onlyFii == null || onlyFii === h.ticker.endsWith('11')) && (fold(h.ticker).startsWith(k) || fold(h.name).includes(k))).slice(0, 6);
}
export const yahooSearchURL = (q: string) => `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q.trim())}&quotesCount=10&newsCount=0&lang=pt-BR&region=BR`;
export function parseYahooSearch(json: any): TickerHit[] {
  const out: TickerHit[] = [];
  for (const r of json?.quotes ?? []) {
    const s = String(r?.symbol ?? ''); if (!s.endsWith('.SA')) continue;
    const t = s.slice(0, -3).toUpperCase(); if (!validTicker(t)) continue;
    if (!out.some(o => o.ticker === t)) out.push({ ticker: t, name: String(r.shortname ?? r.longname ?? t) });
  }
  return out;
}
/** Junta local + remoto sem repetir, local primeiro. */
export const mergeHits = (a: TickerHit[], b: TickerHit[]) => { const seen = new Set<string>(); return [...a, ...b].filter(h => (seen.has(h.ticker) ? false : (seen.add(h.ticker), true))).slice(0, 8); };
