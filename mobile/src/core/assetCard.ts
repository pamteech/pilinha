import { POPULAR } from './cadastro';
import { LineItem, itemGain } from './engine';
import { brl, pct } from './format';
import { itemDayPct } from './insights';
import { logoUrl } from './logo';
import { normTicker } from './numbers';

/** Tipo de papel da B3 para ícone e rótulo na Carteira (não altera a categoria do item). */
export type MarketKind = 'acao' | 'fii' | 'etf' | 'bdr';

export const MARKET_KIND_LABEL: Record<MarketKind, string> = {
  acao: 'Ação brasileira',
  fii: 'Fundo imobiliário',
  etf: 'Fundo de índice (ETF)',
  bdr: 'BDR',
};

/** Ícones do MaterialCommunityIcons já usados no app (nada de marca de terceiros). */
export const MARKET_KIND_ICON: Record<MarketKind, string> = {
  acao: 'trending-up',
  fii: 'home-city',
  etf: 'chart-box',
  bdr: 'earth',
};

export const HIDDEN_MONEY = 'R$ ••••';
export const HIDDEN_QTY = '••••';

/** ETFs comuns da B3 (também terminam em 11, como FII e unit). */
const ETFS: Record<string, string> = {
  BOVA11: 'Ibovespa', BOVV11: 'Ibovespa', BOVB11: 'Ibovespa', BOVX11: 'Ibovespa', XBOV11: 'Ibovespa', BBOV11: 'Ibovespa',
  SMAL11: 'Small Caps', SMAC11: 'Small Caps',
  IVVB11: 'S&P 500', SPXI11: 'S&P 500', NASD11: 'Nasdaq 100', WRLD11: 'Mundo',
  GOLD11: 'Ouro', HASH11: 'Criptomoedas', QBTC11: 'Bitcoin', BITH11: 'Bitcoin', QETH11: 'Ethereum', ETHE11: 'Ethereum', WEB311: 'Web3',
  DIVO11: 'Dividendos', FIND11: 'Financeiro', GOVE11: 'Governança', ISUS11: 'Sustentabilidade', MATB11: 'Materiais', ECOO11: 'Carbono',
  BBSD11: 'Dividendos', BRAX11: 'IBrX-100', PIBB11: 'IBrX-50', XFIX11: 'IFIX',
  IMAB11: 'IMAB', IRFM11: 'IRF-M', NTNS11: 'NTN-B',
};

/** Units (ON+PN): ação brasileira, não FII. */
const UNITS = new Set(['TAEE11', 'SANB11', 'ALUP11', 'ENGI11', 'SAPR11', 'TIET11', 'CPLE11', 'KLBN11', 'BPAC11', 'IGTI11']);

const BDR_SUF = /^(?:32|33|34|35|39)$/;

/** Classifica o ticker para exibição: ação, FII, ETF ou BDR. */
export function marketKind(ticker: string): MarketKind {
  const t = normTicker(ticker);
  const m = t.match(/^([A-Z]{4})(\d{1,2})F?$/);
  const suf = m?.[2] ?? '';
  if (BDR_SUF.test(suf)) return 'bdr';
  if (ETFS[t]) return 'etf';
  if (UNITS.has(t)) return 'acao';
  if (suf === '11') return 'fii';
  return 'acao';
}

export function assetName(ticker: string): string | null {
  const t = normTicker(ticker);
  return ETFS[t] ?? POPULAR.find(h => h.ticker === t)?.name ?? null;
}

export function assetTitle(ticker: string): string {
  const t = normTicker(ticker) || ticker.trim().toUpperCase();
  const n = assetName(ticker);
  return n ? `${t} · ${n}` : t;
}

export function formatQuantity(q: number): string {
  if (!Number.isFinite(q)) return '—';
  if (Number.isInteger(q) || Math.abs(q - Math.round(q)) < 1e-8) return Math.round(q).toLocaleString('pt-BR');
  return q.toLocaleString('pt-BR', { maximumFractionDigits: 8 });
}

/** Quantidade informada ou, se faltar, current ÷ cotação. */
export function itemQuantity(item: Pick<LineItem, 'quantity' | 'current' | 'unitPrice'>): number | null {
  if (item.quantity != null && Number.isFinite(item.quantity)) return item.quantity;
  if (item.unitPrice != null && item.unitPrice > 0 && Number.isFinite(item.current)) return item.current / item.unitPrice;
  return null;
}

export interface AssetCardRow {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down' | 'neutral';
  arrow?: 'up' | 'down';
}

export interface AssetCardView {
  title: string;
  subtitle: string;
  icon: string;
  kind: MarketKind;
  logoUrl: string | null;
  total: string;
  rows: AssetCardRow[];
}

const toneOf = (v: number | null | undefined): 'up' | 'down' | 'neutral' => (v == null ? 'neutral' : v >= 0 ? 'up' : 'down');

/** Modelo da ficha de um ativo na aba Ações e FIIs (testável sem tela). */
export function assetCardView(item: LineItem, hidden: boolean): AssetCardView {
  const kind = marketKind(item.name);
  const gain = itemGain(item);
  const dp = itemDayPct(item);
  const qty = itemQuantity(item);
  const gainPct = item.invested && item.invested > 0 && gain != null ? (gain / item.invested) * 100 : null;
  const rows: AssetCardRow[] = [
    { label: 'Quantidade', value: qty == null ? '—' : hidden ? HIDDEN_QTY : formatQuantity(qty) },
    { label: 'Preço médio', value: item.avgPrice == null ? '—' : hidden ? HIDDEN_MONEY : brl(item.avgPrice) },
    { label: 'Cotação atual', value: item.unitPrice == null ? '—' : brl(item.unitPrice), hint: dp != null ? pct(dp) : undefined, tone: toneOf(dp) },
    {
      label: 'Valorização',
      value: gain == null ? '—' : hidden ? HIDDEN_MONEY : `${gain >= 0 ? '+' : '−'}${brl(Math.abs(gain))}`,
      hint: gain == null ? undefined : pct(gainPct),
      tone: toneOf(gain),
      arrow: gain == null ? undefined : gain >= 0 ? 'up' : 'down',
    },
  ];
  return { title: assetTitle(item.name), subtitle: MARKET_KIND_LABEL[kind], icon: MARKET_KIND_ICON[kind], kind, logoUrl: logoUrl(item.name), total: hidden ? HIDDEN_MONEY : brl(item.current), rows };
}
