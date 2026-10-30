export type FixedIncomeKind = 'caixinha' | 'cdb' | 'tesouro' | 'lci' | 'lca';
export const kindLabel: Record<FixedIncomeKind, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA' };
export interface Deposit { date: string; amount: number }
/** Indexador: ausente = 'cdi' (JSON antigo). IPCA+ usa realRate (% a.a.) na curva da taxa contratada. */
export type FixedIncomeIndexer = 'cdi' | 'ipca';
export interface FixedIncomeAsset { name: string; kind: FixedIncomeKind; cdiPercent: number; deposits: Deposit[]; taxExempt?: boolean; indexer?: FixedIncomeIndexer; realRate?: number; maturity?: string }
export const indexerOf = (a: FixedIncomeAsset): FixedIncomeIndexer => (a.indexer === 'ipca' ? 'ipca' : 'cdi');
export interface StockPosition { ticker: string; quantity: number; averagePrice?: number }
export interface CryptoPosition { coinId: string; symbol: string; quantity: number; averagePriceBRL?: number }
export interface ManualDividend { ticker: string; date: string; amount: number }
export interface Portfolio {
  owner?: string; fixedIncome: FixedIncomeAsset[]; stocks: StockPosition[]; crypto: CryptoPosition[];
  manualDividends?: ManualDividend[]; tradingview?: unknown;
  /** Dólares guardados (opcional; carteiras antigas não têm). */
  usd?: USDPosition | null;
}
export interface USDPosition { amount: number; averageRateBRL?: number | null }
export const emptyPortfolio = (): Portfolio => ({ fixedIncome: [], stocks: [], crypto: [], manualDividends: [] });
export const isTaxExempt = (a: FixedIncomeAsset) => a.taxExempt ?? (a.kind === 'lci' || a.kind === 'lca');
