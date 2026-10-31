export type Amounts = [string, string];
export interface BinChange { bin: string; logIndex: string; sharesBefore: string; sharesAfter: string; totalBefore: string; totalAfter: string; before: Amounts; after: Amounts }
export interface ReplayEvent {
  index: number; type: 'deposit' | 'withdrawal' | 'swap' | 'rounding'; block: string;
  transactionHash: string; logIndex: string; before: Amounts; after: Amounts; delta: Amounts;
  bins: BinChange[]; reference: null | { kind: 'EXECUTION'; referenceX64: string; bidX64: string; askX64: string };
  execution: null | { stockBase: string; stableBase: string };
}
export interface PositionSummary { id: string; provider: string; salt: string; firstBlock: string; lastBlock: string; status: 'reconciled' | 'indexed-only' }
export interface ChartPoint { index: number; block: string; balances: Amounts }
export interface ReplayMeta {
  id: string; eventCount: number; pageSize: number; from: string; through: string; final: Amounts;
  positionsCount: number; chart: ChartPoint[]; referencePoints: { index: number; referenceX64: string }[];
  performance: { finalValue: string; cashflowPnl: string; holdingPnl: string; vsHolding: string; unit: string };
  endpointReference: { block: string; referenceX64: string }; executionQuotes: number; oracleStatus: 'PARTIAL';
  sourceHashes: Record<string, string>;
}
