export type FixedIncomeKind = 'caixinha' | 'cdb' | 'tesouro' | 'lci' | 'lca';
export const kindLabel: Record<FixedIncomeKind, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA' };
export interface Deposit { date: string; amount: number }
/** Indexador: ausente = 'cdi' (JSON antigo). IPCA+ usa realRate (% a.a.) na curva da taxa contratada. */
export type FixedIncomeIndexer = 'cdi' | 'ipca';
/**
 * Tesouro Direto: tipo do título (opcional; JSON antigo não tem).
 * Compatível com o Mac antigo: Selic e Prefixado continuam com indexer ausente (= CDI) e cdiPercent 100,
 * então um Mac sem suporte lê como 100% do CDI em vez de quebrar. O Prefixado usa fixedRate (% a.a.).
 */
export type TreasuryType = 'selic' | 'prefixado' | 'ipca';
export interface FixedIncomeAsset { name: string; kind: FixedIncomeKind; cdiPercent: number; deposits: Deposit[]; taxExempt?: boolean; indexer?: FixedIncomeIndexer; realRate?: number; maturity?: string; treasuryType?: TreasuryType; fixedRate?: number }
/** Modelo de cálculo: IPCA+ (indexer), Prefixado (treasuryType + fixedRate) ou % do CDI (padrão, inclui Selic). */
export type RateModel = 'cdi' | 'ipca' | 'prefixado';
export const rateModelOf = (a: FixedIncomeAsset): RateModel =>
  a.indexer === 'ipca' ? 'ipca' : a.treasuryType === 'prefixado' && typeof a.fixedRate === 'number' && isFinite(a.fixedRate) ? 'prefixado' : 'cdi';
/** Tipo do Tesouro, inferido para dados antigos: IPCA+ pelo indexador; o resto (cadastrado como 100% do CDI) é Selic. */
export const treasuryTypeOf = (a: FixedIncomeAsset): TreasuryType | null =>
  a.kind !== 'tesouro' ? null : a.indexer === 'ipca' ? 'ipca' : rateModelOf(a) === 'prefixado' ? 'prefixado' : 'selic';
export const indexerOf = (a: FixedIncomeAsset): FixedIncomeIndexer => (a.indexer === 'ipca' ? 'ipca' : 'cdi');
export interface StockPosition { ticker: string; quantity: number; averagePrice?: number }
export interface CryptoPosition { coinId: string; symbol: string; quantity: number; averagePriceBRL?: number }
export interface ManualDividend { ticker: string; date: string; amount: number }
export interface Portfolio {
  owner?: string; fixedIncome: FixedIncomeAsset[]; stocks: StockPosition[]; crypto: CryptoPosition[];
  manualDividends?: ManualDividend[]; tradingview?: unknown;
  /** Dólares guardados (opcional; carteiras antigas não têm). */
  usd?: USDPosition | null;
  /** Favoritos que ela quer comprar (opcional; carteiras antigas não têm). */
  watchlist?: import('./watchlist').WatchItem[];
}
export interface USDPosition { amount: number; averageRateBRL?: number | null }
export const emptyPortfolio = (): Portfolio => ({ fixedIncome: [], stocks: [], crypto: [], manualDividends: [] });
export const isTaxExempt = (a: FixedIncomeAsset) => a.taxExempt ?? (a.kind === 'lci' || a.kind === 'lca');
