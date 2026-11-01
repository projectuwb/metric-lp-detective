export type Amounts = [string, string];
export interface BinChange { bin: string; logIndex: string; sharesBefore: string; sharesAfter: string; totalBefore: string; totalAfter: string; before: Amounts; after: Amounts }
export interface ReplayEvent {
  index: number; type: 'deposit' | 'withdrawal' | 'swap' | 'rounding'; block: string;
  transactionHash: string; logIndex: string; before: Amounts; after: Amounts; delta: Amounts;
  bins: BinChange[]; reference: null | { kind: 'EXECUTION'; referenceX64: string; bidX64: string; askX64: string };
  execution: null | { stockBase: string; stableBase: string };
}
export interface PositionSummary { id: string; provider: string; salt: string; firstBlock: string; lastBlock: string; firstTransactionHash?: string; lastTransactionHash?: string; status: 'reconciled' | 'indexed-only'; adds?: number; removals?: number; episodes?: number; liquidityState?: 'CLOSED_IN_CHECKED_WINDOW' | 'SHARES_REMAIN_IN_CHECKED_WINDOW' }
export interface ChartPoint { index: number; block: string; balances: Amounts }
export interface FundingPoint { index: number; block: string; tokens: Amounts; transactionHash: string; logIndex: string }
export interface Milestone { index: number; block: string; kind: 'INITIAL_DEPOSIT' | 'ADD' | 'PARTIAL_WITHDRAWAL' | 'FULL_CLOSE' | 'REENTRY' }
export interface BlockMark { block: string; blockHash: string; timestamp: string; referenceX64: string; kind: 'BLOCK_END' }
export interface ReplayMeta {
  milestones: Milestone[];
  label: string; closed: boolean; initialFunding: Amounts; funding: FundingPoint[]; marks: BlockMark[];
  id: string; eventCount: number; pageSize: number; from: string; through: string; final: Amounts;
  positionsCount: number; chart: ChartPoint[]; referencePoints: { index: number; referenceX64: string }[];
  performance: { finalValue: string; cashflowPnl: string; holdingPnl: string | null; vsHolding: string | null; unit: string };
  endpointReference: { block: string; referenceX64: string }; executionQuotes: number; oracleStatus: 'PARTIAL';
  sourceHashes: Record<string, string>;
}
