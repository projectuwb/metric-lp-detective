// Server/owner process only; deliberately separate from the pinned accounting index.
import { createHash } from 'node:crypto';
import { liquidityPage, liquidityTopics } from './discovery';
import { checkedLogs, RpcFailure, type RawLog, type Rpc } from './rpc';
import type { DiscoveryCoverage } from '../domain/discovery';
import { keccak256, type Hex } from 'viem';
import { POOL, RUNTIME_CODE_HASH } from './poolConfig';
import { checkedRangeProfile, type RangeProfile } from './rpcCapabilities';
export interface DiscoveryPage { from: string; through: string; previousHash: string; headHash: string; logs: RawLog[]; sha256: string; rangeProfileHash?: string }
export interface DiscoveryIndex {
  schema: 1; base: Pick<DiscoveryCoverage, 'chainId' | 'pool' | 'from' | 'through' | 'headHash' | 'sourceHash' | 'accountingVersion'>;
  pages: DiscoveryPage[]; observedFinalizedHead: DiscoveryCoverage['observedFinalizedHead']; rangeProfile?: RangeProfile;
}
export const pageHash = (p: Omit<DiscoveryPage, 'sha256'>) => createHash('sha256').update(JSON.stringify(p)).digest('hex');
const digest = (p: DiscoveryPage) => pageHash({ from: p.from, through: p.through, previousHash: p.previousHash, headHash: p.headHash, logs: p.logs, ...(p.rangeProfileHash ? { rangeProfileHash: p.rangeProfileHash } : {}) });
const blockHash = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-f]{64}$/i.test(s);
export function checkedDiscoveryIndex(value: DiscoveryIndex, base: DiscoveryIndex['base']) {
  if (!value || value.schema !== 1 || JSON.stringify(value.base) !== JSON.stringify(base) || !Array.isArray(value.pages) || value.pages.length > 20000) throw new Error('Discovery index source/version changed or checkpoint invalid');
  let next = BigInt(base.through) + 1n, previousHash = base.headHash;
  const maxBlocks = value.rangeProfile ? checkedRangeProfile(value.rangeProfile, base.sourceHash).maxBlocks : 1000;
  for (const p of value.pages) {
    if (!/^\d+$/.test(p.from) || !/^\d+$/.test(p.through) || BigInt(p.from) !== next || BigInt(p.through) < next || BigInt(p.through) - next >= BigInt(maxBlocks) || BigInt(p.through) - next >= 1000n && p.rangeProfileHash !== value.rangeProfile?.reportHash || p.rangeProfileHash && p.rangeProfileHash !== value.rangeProfile?.reportHash || p.previousHash !== previousHash || !blockHash(p.headHash) || digest(p) !== p.sha256) throw new Error('Discovery index gap, hash mismatch or invalid window');
    const logs = checkedLogs(p.logs, next, BigInt(p.through));
    if (logs.length >= 1000 || logs.some(l => !liquidityTopics.includes(l.topics[0] as `0x${string}`))) throw new Error('Invalid discovery event page');
    next = BigInt(p.through) + 1n; previousHash = p.headHash;
  }
  const head = value.observedFinalizedHead;
  if (head && (!/^\d+$/.test(head.block) || !blockHash(head.hash) || !Number.isFinite(Date.parse(head.observedAt)) || BigInt(head.block) < next - 1n)) throw new Error('Invalid finalised head observation');
  return value;
}
export class IndexBudget extends Error {}
export async function advanceDiscovery(index: DiscoveryIndex, rpc: Rpc, budget: number, persist: (index: DiscoveryIndex) => void, options: { now?: () => Date; pace?: () => Promise<void>; rangeProfile?: RangeProfile } = {}) {
  checkedDiscoveryIndex(index, index.base);
  if (!Number.isSafeInteger(budget) || budget < 5 || budget > 100) throw new Error('Explicit index budget must be 5..100 attempts');
  if (options.rangeProfile) {
    checkedRangeProfile(options.rangeProfile, index.base.sourceHash);
    if (index.rangeProfile && JSON.stringify(index.rangeProfile) !== JSON.stringify(options.rangeProfile)) throw new Error('Measured range provenance changed; explicit index migration required');
    index.rangeProfile = options.rangeProfile;
  }
  const pageSize = BigInt(index.rangeProfile?.maxBlocks ?? 1000);
  let requests = 0;
  const now = options.now ?? (() => new Date()), day = now().toISOString().slice(0, 10);
  const call: Rpc = async (method, params) => {
    if (requests >= budget || now().toISOString().slice(0, 10) !== day) throw new IndexBudget('Index request budget/day ended; coverage checkpoint retained');
    requests++;
    await (options.pace?.() ?? new Promise(resolve => setTimeout(resolve, 1000)));
    return rpc(method, params);
  };
  const header = async (block: string) => {
    const h = await call('eth_getBlockByNumber', [block === 'finalized' ? block : '0x' + BigInt(block).toString(16), false]) as { number?: string; hash?: string } | null;
    if (!h || !blockHash(h.hash) || typeof h.number !== 'string' || !/^0x[0-9a-f]+$/i.test(h.number) || block !== 'finalized' && BigInt(h.number) !== BigInt(block)) throw new Error('Missing or inconsistent canonical header; discovery not advanced');
    return { block: BigInt(h.number).toString(), hash: h.hash };
  };
  try {
    if (await call('eth_chainId', []) !== '0x38') throw new Error('Wrong discovery chain');
    if ((await header(index.base.through)).hash !== index.base.headHash) throw new Error('Pinned deployment-to-head source reorg; rebuild requires owner review');
    const last = index.pages.at(-1);
    if (last && (await header(last.through)).hash !== last.headHash) throw new Error('Discovery checkpoint reorg; no stale-page reuse');
    const final = await header('finalized');
    if (BigInt(final.block) < BigInt(last?.through ?? index.base.through)) throw new Error('Finalised head precedes checked coverage');
    if (keccak256(await call('eth_getCode', [POOL, '0x' + BigInt(final.block).toString(16)]) as Hex) !== RUNTIME_CODE_HASH) throw new Error('Discovery pool runtime differs from verified source');
    index.observedFinalizedHead = { ...final, observedAt: now().toISOString() }; persist(index);
    let cursor = BigInt(last?.through ?? index.base.through) + 1n, previousHash = last?.headHash ?? index.base.headHash;
    while (cursor <= BigInt(final.block)) {
      const end = cursor + pageSize - 1n < BigInt(final.block) ? cursor + pageSize - 1n : BigInt(final.block);
      // A page is committed only after every event block and its final boundary
      // are canonical. Budget exhaustion discards that page, keeping the old cursor.
      const before = await header(String(end));
      const logs = await liquidityPage(call, cursor, end, undefined, Number(pageSize));
      const hashes = new Map<string, string>();
      for (const log of logs) {
        const block = BigInt(log.blockNumber).toString(), previous = hashes.get(block);
        if (previous && previous !== log.blockHash) throw new Error('Discovery log reorg');
        hashes.set(block, log.blockHash);
      }
      for (const [block, hash] of hashes) if ((await header(block)).hash !== hash) throw new Error('Discovery log is not canonical');
      const after = await header(String(end));
      if (before.hash !== after.hash || end === BigInt(final.block) && after.hash !== final.hash) throw new Error('Discovery page boundary reorg');
      const p = { from: String(cursor), through: String(end), previousHash, headHash: after.hash, logs, ...(index.rangeProfile ? { rangeProfileHash: index.rangeProfile.reportHash } : {}) };
      index.pages.push({ ...p, sha256: pageHash(p) }); persist(index);
      cursor = end + 1n; previousHash = after.hash;
      if (budget - requests < 3 && cursor <= BigInt(final.block)) throw new IndexBudget('Not enough budget to verify the next page');
    }
    return { requests, state: 'CAUGHT_UP_TO_OBSERVED_FINALISED_HEAD' as const };
  } catch (e) {
    if (e instanceof IndexBudget) return { requests, state: 'BUDGET_PAUSED' as const };
    // Redacted transport diagnostics only; no retry, including 429.
    if (e instanceof RpcFailure) throw new Error(`Discovery stopped after ${requests} attempts: ${e.message}`);
    throw e;
  }
}
