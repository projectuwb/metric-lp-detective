import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { keccak256 } from 'viem';
import { historyInputs } from '../scripts/reconstruct-history';
import { measuredRangeProfile, publishedRangeProfile, checkedRangeProfile, comparableExecutionQuotes } from '../lib/chain/rpcCapabilities';
import { usagePolicy } from '../lib/analysis/usageBudget';
import { advanceDiscovery, checkedDiscoveryIndex, type DiscoveryIndex } from '../lib/chain/discoveryIndex';
import { liquidityTopics } from '../lib/chain/discovery';
import { executionQuotes } from '../lib/metric/oracleTrace';
import { reconstructionCalls, discoveryCalls } from '../lib/analysis/rpcEstimate';
const raw = readFileSync('fixtures/rpc/solidrpc-free-probe.json'), probe = JSON.parse(raw.toString());
const h = historyInputs(), sourceHash = keccak256(readFileSync('fixtures/history/pool-logs.json.gz'));

describe('actual owner-approved 12-call probe and source provenance', () => {
  it('retains actual quota observations, exact range counts and an honest failed trace comparison', () => {
    expect(probe.attempts).toBe(12); expect(probe.approvedAttempts).toBe(12); expect(probe.observations).toHaveLength(12);
    expect(probe.observations.map((o: any) => o.quotaUsed)).toEqual(Array.from({ length: 12 }, (_, i) => i + 39));
    expect(probe.observations.every((o: any) => o.quotaLimit === 10000 && o.quotaWindow === 'day' && o.rateLimit === 10)).toBe(true);
    expect(probe.observations.at(-1).quotaRemaining).toBe(9950);
    expect(probe.newPositionVerified).toBe(false); expect(probe.moneyAuthorised).toBe(false);
    for (const range of probe.results.filter((r: any) => r.result?.blocks)) {
      const expected = h.logs.filter(l => BigInt(l.blockNumber) >= BigInt(range.result.from) && BigInt(l.blockNumber) <= BigInt(range.result.through) && liquidityTopics.includes(l.topics[0] as `0x${string}`));
      expect(range.status).toBe('PASS'); expect(range.result.logCount).toBe(expected.length);
      expect(BigInt(range.result.through) - BigInt(range.result.from) + 1n).toBe(BigInt(range.result.blocks));
    }
    expect(probe.results.find((r: any) => r.name === 'historical callTracer compatibility').status).toBe('FAILED');
    expect(probe.review.traceResult).toContain('BigInt');
    expect(probe.review.sourceHash).toBe(sourceHash);
  });
  it('binds wider ranges to the measured account alias, ABI, source and retained report checksum', () => {
    const profile = measuredRangeProfile(usagePolicy(), sourceHash)!;
    expect(profile.maxBlocks).toBe(30000); expect(profile.reportHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(publishedRangeProfile(sourceHash)).toEqual(profile);
    expect(() => checkedRangeProfile({ ...profile, abiHash: 'changed' }, sourceHash)).toThrow('provenance');
    expect(() => measuredRangeProfile(usagePolicy(), 'changed')).toThrow('source');
    expect(measuredRangeProfile({ ...usagePolicy(), account: 'new-prepaid-account' }, sourceHash)).toBeUndefined();
    expect(measuredRangeProfile({ ...usagePolicy(), mode: 'PREPAID' }, sourceHash)).toBeUndefined();
  });
  it('fixes the BigInt harness offline using the actual saved trace; does not relabel the spent live probe', () => {
    const tx = '0xe7f667bc4e71febdb65fc026eb3b6f0ec6ddb95ddcd7b060b6ed2ba835265af0';
    const trace = JSON.parse(gunzipSync(readFileSync('fixtures/positions/145ef95b632fc382/traces/' + tx + '.json.gz')).toString());
    const quotes = executionQuotes(trace), values = comparableExecutionQuotes(quotes);
    expect(quotes).toHaveLength(1); expect(() => JSON.stringify(quotes)).toThrow('BigInt');
    expect(() => JSON.stringify(values)).not.toThrow();
    expect(values[0].referenceX64).toBe(String(quotes[0].referenceX64));
    const changed = comparableExecutionQuotes([{ ...quotes[0], referenceX64: quotes[0].referenceX64 + 1n }]);
    expect(JSON.stringify(changed)).not.toBe(JSON.stringify(values));
    expect(probe.status).toBe('STOPPED');
  });
});

describe('measured forward windows and reproducible resource estimates', () => {
  it('uses contiguous 30k pages only with measured provenance; legacy pages remain valid', async () => {
    const profile = publishedRangeProfile(sourceHash), headHash = '0x' + 'a'.repeat(64);
    const index: DiscoveryIndex = { schema: 1, base: { chainId: 56, pool: h.logs[0].address, from: '1', through: '100', headHash, sourceHash, accountingVersion: 'synthetic-transport-only' }, pages: [], observedFinalizedHead: null };
    const ranges: any[] = [], hash = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');
    const result = await advanceDiscovery(index, async (method, params) => {
      if (method === 'eth_chainId') return '0x38';
      if (method === 'eth_getCode') return JSON.parse(readFileSync('fixtures/raw/code-and-identity.json', 'utf8')).runtimeCode;
      if (method === 'eth_getLogs') { ranges.push(params[0]); return []; }
      const n = params[0] === 'finalized' ? 60101n : BigInt(params[0] as string);
      return { number: '0x' + n.toString(16), hash: n === 100n ? headHash : hash(n) };
    }, 20, () => {}, { rangeProfile: profile, pace: async () => {} });
    expect(result).toEqual({ requests: 13, state: 'CAUGHT_UP_TO_OBSERVED_FINALISED_HEAD' });
    expect(index.pages.map(p => [p.from, p.through])).toEqual([['101', '30100'], ['30101', '60100'], ['60101', '60101']]);
    expect(ranges).toHaveLength(3); expect(index.pages.every(p => p.rangeProfileHash === profile.reportHash)).toBe(true);
    expect(checkedDiscoveryIndex(index, index.base)).toEqual(index);
    expect(() => checkedDiscoveryIndex({ ...index, rangeProfile: undefined }, index.base)).toThrow('window');
    const bad = structuredClone(index); bad.pages[0].rangeProfileHash = 'f'.repeat(64);
    expect(() => checkedDiscoveryIndex(bad, index.base)).toThrow('hash');
  });
  it('reproduces the real 38/86-call receipts and explains why 100+ swaps exceed today’s limits', () => {
    expect(reconstructionCalls(7, 4, 5, 3, 1).total).toBe(38);
    expect(reconstructionCalls(15, 12, 13, 2, 10).total).toBe(86);
    expect(reconstructionCalls(105, 105, 105, 2, 100).total).toBe(631);
    expect(reconstructionCalls(1005, 1005, 1005, 2, 1000).total).toBe(6031);
    expect(discoveryCalls(278319n, 1000n)).toMatchObject({ windows: '279', total: '841' });
    expect(discoveryCalls(278319n, 30000n)).toMatchObject({ windows: '10', total: '34' });
    expect(discoveryCalls(278319n, 30000n, 80n)).toMatchObject({ total: '114' });
    expect(() => reconstructionCalls(1, 2, 1, 0, 0)).toThrow();
    expect(() => discoveryCalls(1n, 30001n)).toThrow();
  });
});
