import type { PositionSummary } from './web';

export interface DiscoveryCoverage {
  chainId: 56; pool: string; from: string; through: string; headHash: string;
  sourceHash: string; accountingVersion: string; replayThrough: string; replayHeadHash?: string;
  refreshState: 'OWNER_REFRESH_REQUIRED';
  observedFinalizedHead: { block: string; hash: string; observedAt: string } | null;
  recentHeadLag: string | null;
}
export type DiscoveryStatus = 'FOUND' | 'NONE_FOUND_IN_CHECKED_WINDOW' | 'NOT_CHECKED_YET';
export interface DiscoveryResult {
  status: DiscoveryStatus; positions: PositionSummary[]; coverage: DiscoveryCoverage;
  ownership: 'DIRECT_PROVIDER_ONLY'; managedStatus: 'UNSUPPORTED_MANAGED_POSITION_OWNERSHIP_UNKNOWN';
  message: string; from: string; through: string;
}
export function discoveryResult(positions: PositionSummary[], coverage: DiscoveryCoverage, range?: { from: string; through: string }): DiscoveryResult {
  const outside = range && (BigInt(range.from) < BigInt(coverage.from) || BigInt(range.through) > BigInt(coverage.through));
  if (range && !outside && (range.from !== coverage.from || range.through !== coverage.through)) throw new Error('Only the complete published window is supported');
  const selected = outside ? [] : positions;
  const status: DiscoveryStatus = outside ? 'NOT_CHECKED_YET' : selected.length ? 'FOUND' : 'NONE_FOUND_IN_CHECKED_WINDOW';
  return { status, positions: selected, coverage, from: coverage.from, through: coverage.through,
    ownership: 'DIRECT_PROVIDER_ONLY', managedStatus: 'UNSUPPORTED_MANAGED_POSITION_OWNERSHIP_UNKNOWN',
    message: outside ? 'The requested window is not fully indexed. No complete lookup was performed.' : selected.length ? 'Direct-provider positions found in the checked window. Discovery alone does not verify balances or PnL.' : 'No direct-provider position found in the checked window. Later activity has not been checked.',
  };
}
