import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { keccak256, toBytes } from 'viem';
import { sourceAbi } from './decode';
import type { UsagePolicy } from '../analysis/usageBudget';
export interface RangeProfile { schema: 1; provider: 'solidrpc'; account: string; maxBlocks: number; sourceHash: string; abiHash: string; observedAt: string; reportHash: string }
export const discoveryAbiHash = () => keccak256(toBytes(JSON.stringify(sourceAbi)));
export function checkedRangeProfile(p: RangeProfile, sourceHash: string) {
  if (!p || p.schema !== 1 || p.provider !== 'solidrpc' || !/^[a-zA-Z0-9_-]{1,80}$/.test(p.account) || !Number.isSafeInteger(p.maxBlocks) || p.maxBlocks < 1000 || p.maxBlocks > 30000 || p.sourceHash !== sourceHash || p.abiHash !== discoveryAbiHash() || !Number.isFinite(Date.parse(p.observedAt)) || !/^[a-f0-9]{64}$/.test(p.reportHash)) throw new Error('Missing or incompatible measured RPC range provenance');
  return p;
}
export function measuredRangeProfile(policy: UsagePolicy, sourceHash: string): RangeProfile | undefined {
  if (policy.provider !== 'solidrpc' || policy.account !== 'owner-existing-bnb' || policy.endpointEnv !== 'BNB_RPC_URL' || policy.mode !== 'FREE') return undefined;
  return publishedRangeProfile(sourceHash);
}
export function publishedRangeProfile(sourceHash: string): RangeProfile {
  const file = new URL('../../fixtures/rpc/solidrpc-free-probe.json', import.meta.url);
  const raw = readFileSync(file), report = JSON.parse(raw.toString());
  const ranges = report.results.filter((r: any) => r.method === 'eth_getLogs' && r.status === 'PASS' && r.result?.matchesPinnedIndexExactly && r.result.blocks);
  const maxBlocks = Math.max(1000, ...ranges.map((r: any) => Number(r.result.blocks)));
  if (report.attempts > report.approvedAttempts || report.review?.sourceHash !== sourceHash || !report.observations.some((o: any) => o.quotaWindow === 'day' && o.quotaLimit === 10000)) throw new Error('Range probe does not establish this account/source capability');
  return checkedRangeProfile({ schema: 1, provider: 'solidrpc', account: 'owner-existing-bnb', maxBlocks, sourceHash, abiHash: discoveryAbiHash(), observedAt: report.observedAt, reportHash: createHash('sha256').update(raw).digest('hex') }, sourceHash);
}
export function comparableExecutionQuotes(quotes: ReturnType<typeof import('../metric/oracleTrace').executionQuotes>) {
  return quotes.map(q => ({ path: q.path, poolInput: q.poolInput, poolOutput: q.poolOutput, providerInput: q.providerCall.input, providerOutput: q.providerCall.output, bidX64: String(q.bidX64), askX64: String(q.askX64), referenceX64: String(q.referenceX64), amount0: String(q.amount0), amount1: String(q.amount1) }));
}
