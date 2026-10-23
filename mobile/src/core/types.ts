export type FixedIncomeKind = 'caixinha' | 'cdb' | 'tesouro' | 'lci' | 'lca';
export const kindLabel: Record<FixedIncomeKind, string> = { caixinha: 'Caixinha', cdb: 'CDB', tesouro: 'Tesouro', lci: 'LCI', lca: 'LCA' };
export interface Deposit { date: string; amount: number }
export interface FixedIncomeAsset { name: string; kind: FixedIncomeKind; cdiPercent: number; deposits: Deposit[]; taxExempt?: boolean }
export interface StockPosition { ticker: string; quantity: number; averagePrice?: number }
export interface CryptoPosition { coinId: string; symbol: string; quantity: number; averagePriceBRL?: number }
export interface ManualDividend { ticker: string; date: string; amount: number }
export interface Portfolio {
  owner?: string; fixedIncome: FixedIncomeAsset[]; stocks: StockPosition[]; crypto: CryptoPosition[];
  manualDividends?: ManualDividend[]; tradingview?: unknown;
}
export const emptyPortfolio = (): Portfolio => ({ fixedIncome: [], stocks: [], crypto: [], manualDividends: [] });
export const isTaxExempt = (a: FixedIncomeAsset) => a.taxExempt ?? (a.kind === 'lci' || a.kind === 'lca');
