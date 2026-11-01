import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeEventTopics, type Hex } from 'viem';
import { historyInputs } from '../scripts/reconstruct-history';
import { POOL } from '../lib/chain/poolConfig';
import { sourceAbi } from '../lib/chain/decode';
import { liquidityPage, liquidityPositions, liquidityTopics, providerFilter } from '../lib/chain/discovery';
import { advanceDiscovery, checkedDiscoveryIndex, type DiscoveryIndex } from '../lib/chain/discoveryIndex';
import { RpcFailure, type Rpc, type RawLog } from '../lib/chain/rpc';
import { discoveryResult, type DiscoveryCoverage } from '../lib/domain/discovery';
import { replayEligibility } from '../lib/analysis/eligibility';
import { holdingExplanation } from '../lib/domain/holding';
import { checkedState, reserveRun } from '../lib/analysis/remote';
vi.mock('server-only', () => ({}));
import { POST } from '../app/api/positions/route';
import { GET as analysisInfo } from '../app/api/analysis/route';
import { getDiscoveryCoverage, getPositions, getRegistry } from '../lib/server/replay';

const h = historyInputs(), pilot = '0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba';
const coverage: DiscoveryCoverage = { chainId: 56, pool: h.logs[0].address, from: h.acquisition.from, through: h.acquisition.to, headHash: h.acquisition.endHash, sourceHash: 'fixture', accountingVersion: 'fixture', replayThrough: h.acquisition.to, refreshState: 'OWNER_REFRESH_REQUIRED', observedFinalizedHead: null, recentHeadLag: null };
describe('real source-specific direct-provider discovery', () => {
  it('matches verified ABI topic1/provider, topic2/uint80 salt and real indexed receipt logs', async () => {
    for (const eventName of ['LiquidityAdded', 'LiquidityRemoved'] as const) {
      const deployedEvent = h.abi.find((a: any) => a.type === 'event' && a.name === eventName) as any;
      expect(deployedEvent.inputs.filter((i: any) => i.indexed).map((i: any) => [i.name, i.type])).toEqual([['provider', 'address'], ['salt', 'uint80']]);
      const topic = encodeEventTopics({ abi: sourceAbi, eventName, args: { provider: pilot } });
      expect(providerFilter(pilot)).toEqual([liquidityTopics, topic[1]]);
    }
    const from = 129628000n, to = from + 999n;
    const expected = h.logs.filter(l => BigInt(l.blockNumber) >= from && BigInt(l.blockNumber) <= to && liquidityTopics.includes(l.topics[0] as Hex) && l.topics[1] === providerFilter(pilot)[1]);
    expect(expected).toHaveLength(2);
    const calls: unknown[][] = [];
    expect(await liquidityPage(async (method, args) => { expect(method).toBe('eth_getLogs'); calls.push(args); return expected; }, from, to, pilot)).toEqual(expected);
    expect(calls[0][0]).toMatchObject({ address: POOL, fromBlock: '0x7b9f760', toBlock: '0x7b9fb47', topics: providerFilter(pilot) });
    const receipt = JSON.parse(readFileSync('fixtures/positions/145ef95b632fc382/receipts/' + expected[0].transactionHash + '.json', 'utf8'));
    expect(receipt.logs.some((l: RawLog) => l.address.toLowerCase() === coverage.pool.toLowerCase() && l.logIndex === expected[0].logIndex && l.data === expected[0].data && JSON.stringify(l.topics) === JSON.stringify(expected[0].topics))).toBe(true);
  });
  it('keeps 236 salts separate, deduplicates events, distinguishes adds, removals and full closes', () => {
    const all = liquidityPositions(h.logs), duplicate = liquidityPositions([...h.logs, ...h.logs.filter(l => liquidityTopics.includes(l.topics[0] as Hex)).slice(0, 5)]);
    expect(all).toHaveLength(236); expect(duplicate).toEqual(all);
    const salts = all.filter(p => p.provider === '0x3eb210eaa4026f62d027fafaba1fa5592febb06a');
    expect(salts.length).toBeGreaterThan(1); expect(new Set(salts.map(p => p.id)).size).toBe(salts.length);
    const fourth = all.find(p => p.provider === pilot && p.salt === '880320313732695054146242')!;
    expect(fourth).toMatchObject({ adds: 2, removals: 1, episodes: 1, liquidityState: 'CLOSED_IN_CHECKED_WINDOW', firstBlock: '129628417', lastBlock: '129629243', status: 'indexed-only' });
    // Published fourth replay is evidence-derived, not an application allowlist.
    expect(getPositions().find(p => p.id === fourth.id)?.status).toBe('reconciled');
    expect(getRegistry().some(p => p.id === fourth.id)).toBe(true);
  });
  it('re-entry under the same salt is one position with a second episode (synthetic ordering vector)', () => {
    const provider = '0xa19899f6b8416d8266f0d4f14688c8c6eeaec818';
    const own = h.logs.filter(l => liquidityTopics.includes(l.topics[0] as Hex) && l.topics[1] === providerFilter(provider)[1] && BigInt(l.topics[2]) === 671085802901633847509096n);
    const add = own.find(l => l.topics[0] === liquidityTopics[0])!, last = own.at(-1)!;
    const secondAdd = { ...add, blockNumber: '0x' + (BigInt(last.blockNumber) + 1n).toString(16), transactionHash: '0x' + 'ab'.repeat(32) };
    expect(liquidityPositions([...own, secondAdd])).toEqual([expect.objectContaining({ provider, episodes: 2, adds: 2, removals: 1, liquidityState: 'SHARES_REMAIN_IN_CHECKED_WINDOW' })]);
  });
  it('rejects wrong provider/signature, over-wide pages, removed logs and provider truncation', async () => {
    const log = h.logs.find(l => liquidityTopics.includes(l.topics[0] as Hex))!;
    await expect(liquidityPage(async () => [log], BigInt(log.blockNumber), BigInt(log.blockNumber), pilot)).rejects.toThrow('outside');
    const swap = h.logs.find(l => !liquidityTopics.includes(l.topics[0] as Hex))!;
    await expect(liquidityPage(async () => [swap], BigInt(swap.blockNumber), BigInt(swap.blockNumber))).rejects.toThrow('outside');
    await expect(liquidityPage(async () => [], 0n, 1000n)).rejects.toThrow('1000');
    await expect(liquidityPage(async () => [{ ...log, removed: true }], BigInt(log.blockNumber), BigInt(log.blockNumber))).rejects.toThrow();
    await expect(liquidityPage(async () => Array(1000).fill(log), BigInt(log.blockNumber), BigInt(log.blockNumber))).rejects.toThrow('truncation');
  });
  it('never answers lifetime no-LP, even for an empty wallet; outside-window queries fail explicitly', async () => {
    const empty = discoveryResult([], coverage);
    expect(empty).toMatchObject({ status: 'NONE_FOUND_IN_CHECKED_WINDOW', managedStatus: 'UNSUPPORTED_MANAGED_POSITION_OWNERSHIP_UNKNOWN', coverage: { recentHeadLag: null } });
    const result = await POST(new Request('http://local/api/positions', { method: 'POST', body: JSON.stringify({ wallet: pilot, fromBlock: coverage.from, throughBlock: String(BigInt(coverage.through) + 1n) }) }));
    expect(result.status).toBe(409);
    expect(await result.json()).toMatchObject({ status: 'NOT_CHECKED_YET', positions: [], coverage: { headHash: coverage.headHash } });
    expect(discoveryResult([], coverage, { from: '0', through: '1' }).status).toBe('NOT_CHECKED_YET');
    const bad = await POST(new Request('http://local/api/positions', { method: 'POST', body: JSON.stringify({ wallet: pilot, fromBlock: '12', throughBlock: '1' }) }));
    expect(bad.status).toBe(400);
  });
  it('does not confuse published replay, indexed activity, and owner preflight eligibility', async () => {
    expect(getDiscoveryCoverage()).toMatchObject({ from: coverage.from, through: coverage.through, sourceHash: expect.any(String), accountingVersion: expect.any(String), refreshState: 'OWNER_REFRESH_REQUIRED' });
    const indexed = getPositions().find(p => p.status === 'indexed-only')!;
    const result = await analysisInfo(new Request('http://local/api/analysis?positionId=' + indexed.id));
    expect(await result.json()).toMatchObject({ queueAvailable: false, eligibility: 'OWNER_PREFLIGHT_REQUIRED', job: null });
    const ready = getRegistry().find(p => p.id.startsWith(pilot))!;
    expect(await (await analysisInfo(new Request('http://local/api/analysis?positionId=' + ready.id))).json()).toMatchObject({ eligibility: 'VERIFIED_REPLAY', job: null });
    const unknown = '0x000000000000000000000000000000000000dead:0';
    expect(await (await analysisInfo(new Request('http://local/api/analysis?positionId=' + unknown))).json()).toMatchObject({ eligibility: 'NO_INDEXED_POSITION', job: null });
  });
  it.each([0, 1, 9, 100, 101, 10000])('count preflight gives an honest bounded route for %i swaps', swaps => {
    const plan = replayEligibility({ swaps, checkpoints: 7, traces: swaps, fundingTransactions: 3 }, true);
    expect(plan.mode).toBe(swaps <= 9 ? 'OWNER_PILOT' : 'STAGED_OWNER_REVIEW');
    expect(plan.reason).toContain(swaps <= 9 ? 'independent checkpoint' : 'not permanently unsupported');
  });
  it('explains the actual deficient holding token without assuming a sale when stock would need buying', () => {
    const flow = (tokens: [string, string], index = 0) => ({ tokens, index, block: String(index + 1), transactionHash: 'fixture', logIndex: '0' });
    expect(holdingExplanation([flow(['10', '0']), flow(['0', '-1'], 1)])).toContain('stock sale; not calculated');
    expect(holdingExplanation([flow(['0', '10']), flow(['-1', '0'], 1)])).toContain('stock purchase; not calculated');
  });
});

describe('incremental discovery checkpoint / quota / reorg safety (synthetic transport vectors)', () => {
  const base = { chainId: 56 as const, pool: coverage.pool, from: '0', through: '100', headHash: '0x' + '11'.repeat(32), sourceHash: 'source', accountingVersion: 'accounting' };
  const fresh = (): DiscoveryIndex => ({ schema: 1, base, pages: [], observedFinalizedHead: null });
  const hash = (block: bigint) => '0x' + block.toString(16).padStart(64, '0');
  const transport = (calls: { method: string; params: unknown[] }[]): Rpc => async (method, params) => {
    calls.push({ method, params });
    if (method === 'eth_chainId') return '0x38';
    if (method === 'eth_getLogs') return [];
    if (method === 'eth_getCode') return JSON.parse(readFileSync('fixtures/raw/code-and-identity.json', 'utf8')).runtimeCode;
    const n = params[0] === 'finalized' ? 2205n : BigInt(params[0] as string);
    return { number: '0x' + n.toString(16), hash: n === 100n ? base.headHash : hash(n) };
  };
  const options = { now: () => new Date('2026-11-01T12:00:00Z'), pace: async () => {} };
  it('pages inclusive ranges, saves durable complete windows, resumes without rescanning or changing accounting source', async () => {
    const index = fresh(), calls: { method: string; params: unknown[] }[] = [], saved: DiscoveryIndex[] = [];
    const first = await advanceDiscovery(index, transport(calls), 10, s => saved.push(structuredClone(s)), options);
    expect(first).toEqual({ requests: 10, state: 'BUDGET_PAUSED' });
    expect(index.pages.map(p => [p.from, p.through])).toEqual([['101', '1100'], ['1101', '2100']]);
    const restored = JSON.parse(JSON.stringify(saved.at(-1))) as DiscoveryIndex;
    const next = await advanceDiscovery(restored, transport(calls), 8, () => {}, options);
    expect(next).toEqual({ requests: 8, state: 'CAUGHT_UP_TO_OBSERVED_FINALISED_HEAD' });
    expect(restored.pages.at(-1)?.through).toBe('2205'); expect(restored.base).toEqual(base);
    expect(calls.filter(c => c.method === 'eth_getLogs').map(c => c.params[0])).toEqual([
      expect.objectContaining({ fromBlock: '0x65', toBlock: '0x44c' }), expect.objectContaining({ fromBlock: '0x44d', toBlock: '0x834' }), expect.objectContaining({ fromBlock: '0x835', toBlock: '0x89d' }),
    ]);
    expect(checkedDiscoveryIndex(restored, base)).toEqual(restored);
  });
  it('budget exhaustion cannot claim an incomplete page or no-LP coverage', async () => {
    const index = fresh();
    expect(await advanceDiscovery(index, transport([]), 5, () => {}, options)).toEqual({ requests: 5, state: 'BUDGET_PAUSED' });
    expect(index.pages).toEqual([]);
    expect(index.observedFinalizedHead?.block).toBe('2205');
  });
  it('checks real event-block hashes before publishing a page (saved log, synthetic headers)', async () => {
    const log = h.logs.find(l => l.topics[0] === liquidityTopics[0] && l.topics[1] === providerFilter(pilot)[1])!;
    const n = BigInt(log.blockNumber), eventBase = { ...base, through: String(n - 1n) };
    const make = (): DiscoveryIndex => ({ schema: 1, base: eventBase, pages: [], observedFinalizedHead: null });
    let bad = false, eventHeaders = 0;
    const rpc: Rpc = async (method, params) => {
      if (method === 'eth_chainId') return '0x38';
      if (method === 'eth_getCode') return JSON.parse(readFileSync('fixtures/raw/code-and-identity.json', 'utf8')).runtimeCode;
      if (method === 'eth_getLogs') return [log];
      if (params[0] === 'finalized') return { number: log.blockNumber, hash: log.blockHash };
      const b = BigInt(params[0] as string);
      return { number: params[0], hash: b === n - 1n ? base.headHash : bad && ++eventHeaders === 2 ? hash(999n) : log.blockHash };
    };
    const index = make();
    expect(await advanceDiscovery(index, rpc, 8, () => {}, options)).toEqual({ requests: 8, state: 'CAUGHT_UP_TO_OBSERVED_FINALISED_HEAD' });
    expect(index.pages[0].logs).toEqual([log]);
    bad = true; eventHeaders = 0;
    const refused = make();
    await expect(advanceDiscovery(refused, rpc, 8, () => {}, options)).rejects.toThrow('not canonical');
    expect(refused.pages).toEqual([]);
  });
  it('stops at the first 429, rejects pin/source/corruption changes and never advances on reorg', async () => {
    const index = fresh(); let sent = 0;
    await expect(advanceDiscovery(index, async () => { sent++; throw new RpcFailure('rate', 429); }, 10, () => {}, options)).rejects.toThrow('429');
    expect(sent).toBe(1); expect(index.pages).toEqual([]);
    await expect(advanceDiscovery(fresh(), async (m, p) => m === 'eth_chainId' ? '0x38' : { number: p[0], hash: hash(999n) }, 10, () => {}, options)).rejects.toThrow('source reorg');
    await advanceDiscovery(index, transport([]), 7, () => {}, options);
    const corrupted = structuredClone(index); corrupted.pages[0].through = '1099';
    expect(() => checkedDiscoveryIndex(corrupted, base)).toThrow('hash');
    expect(() => checkedDiscoveryIndex(index, { ...base, accountingVersion: 'new' })).toThrow('version');
    let boundary = 0;
    const stable = transport([]);
    await expect(advanceDiscovery(fresh(), async (m, p) => { const response = await stable(m, p); if (m === 'eth_getBlockByNumber' && p[0] === '0x44c' && ++boundary === 2) return { number: p[0], hash: hash(999n) }; return response; }, 10, () => {}, options)).rejects.toThrow('boundary reorg');
  });
  it('index and analysis share the durable provider daily reservation; no second allowance', async () => {
    const state = reserveRun({ schema: 1, reservations: [], discovery: fresh() }, '1', 'a'.repeat(64), options.now());
    expect(checkedState(state).discovery).toEqual(fresh());
    expect(() => reserveRun(state, '2', 'b'.repeat(64), options.now())).toThrow('Daily RPC allowance');
  });
});
