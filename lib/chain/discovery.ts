// Owner-side indexing only. Topic layout is derived from the verified source ABI.
import { encodeEventTopics, isAddress, type Hex } from 'viem';
import { sourceAbi, decodeSourceLog } from './decode';
import { POOL } from './poolConfig';
import { checkedLogs, type RawLog, type Rpc } from './rpc';
import type { PositionSummary } from '../domain/web';

export const liquidityTopics = (['LiquidityAdded', 'LiquidityRemoved'] as const).map(eventName => encodeEventTopics({ abi: sourceAbi, eventName })[0]!);
export function providerFilter(provider?: string) {
  if (provider && !isAddress(provider, { strict: false })) throw new Error('Invalid provider');
  return provider ? [liquidityTopics, '0x' + provider.slice(2).toLowerCase().padStart(64, '0')] : [liquidityTopics];
}
export function liquidityPositions(logs: RawLog[], verified = new Set<string>()): PositionSummary[] {
  const positions = new Map<string, PositionSummary>();
  const shares = new Map<string, Map<string, bigint>>(), seen = new Map<string, string>();
  const ordered = [...logs].sort((a, b) => { for (const f of ['blockNumber', 'transactionIndex', 'logIndex'] as const) { const d = BigInt(a[f]) - BigInt(b[f]); if (d) return d < 0n ? -1 : 1; } return 0; });
  for (const log of ordered) {
    if (!liquidityTopics.includes(log.topics[0] as Hex)) continue;
    const unique = `${log.transactionHash.toLowerCase()}:${BigInt(log.logIndex)}`, encoded = JSON.stringify(log);
    if (seen.has(unique)) { if (seen.get(unique) !== encoded) throw new Error('Conflicting liquidity duplicate'); continue; }
    seen.set(unique, encoded);
    const event = decodeSourceLog({ address: log.address, topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex });
    if (event.eventName !== 'LiquidityAdded' && event.eventName !== 'LiquidityRemoved') throw new Error('Wrong liquidity event');
    const { provider: address, salt, binIdxs, shares: changes } = event.args;
    const provider = address.toLowerCase(), id = provider + ':' + salt, block = BigInt(log.blockNumber).toString();
    const before = positions.get(id), bins = shares.get(id) ?? new Map<string, bigint>();
    const wasClosed = before?.liquidityState === 'CLOSED_IN_CHECKED_WINDOW';
    for (const [i, bin] of binIdxs.entries()) {
      const amount = (bins.get(String(bin)) ?? 0n) + changes[i] * (event.eventName === 'LiquidityAdded' ? 1n : -1n);
      if (amount < 0n) throw new Error('Liquidity coverage starts after funding or contains invalid removal');
      bins.set(String(bin), amount);
    }
    shares.set(id, bins);
    positions.set(id, { id, provider, salt: String(salt), firstBlock: before?.firstBlock ?? block, lastBlock: block,
      status: verified.has(id) ? 'reconciled' : 'indexed-only',
      adds: (before?.adds ?? 0) + Number(event.eventName === 'LiquidityAdded'), removals: (before?.removals ?? 0) + Number(event.eventName === 'LiquidityRemoved'),
      episodes: (before?.episodes ?? 0) + Number(event.eventName === 'LiquidityAdded' && changes.some(n => n > 0n) && (!before || wasClosed)),
      liquidityState: [...bins.values()].some(n => n > 0n) ? 'SHARES_REMAIN_IN_CHECKED_WINDOW' : 'CLOSED_IN_CHECKED_WINDOW',
    });
  }
  return [...positions.values()];
}

// Inclusive, non-overlapping 1000-block pages; caller supplies a quota-counting RPC.
// No retry on 429 or other failures. A failure must never advance the caller's cursor.
export async function liquidityPage(rpc: Rpc, from: bigint, to: bigint, provider?: string) {
  if (from < 0n || to < from || to - from >= 1000n) throw new Error('Discovery page must contain 1..1000 blocks');
  const logs = checkedLogs(await rpc('eth_getLogs', [{ address: POOL, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16), topics: providerFilter(provider) }]), from, to);
  if (logs.length >= 1000) throw new Error('Possible provider result truncation; coverage incomplete');
  for (const log of logs) {
    if (!liquidityTopics.includes(log.topics[0] as Hex) || provider && log.topics[1]?.toLowerCase() !== providerFilter(provider)[1]) throw new Error('Provider returned logs outside the verified topic filter');
    decodeSourceLog({ address: log.address, topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex });
  }
  return logs;
}
