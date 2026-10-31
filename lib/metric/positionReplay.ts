import { encodeEventTopics, type Abi } from 'viem';
import type { RawLog } from '../chain/rpc.js';
import { sourceAbi } from '../chain/decode.js';
import { replayPool, portfolio, type Transition } from './positionLedger.js';
import type { ReplayEvent, BinChange, Amounts } from '../domain/web.js';
import { positionIdentity } from '../domain/position.js';
export function positionReplay(logs: RawLog[], abi: Abi, id: string, quotes = new Map<string, any>()) {
  id = positionIdentity(id);
  const [owner, salt] = id.split(':');
  const replay = replayPool(logs, abi, { entitlementPositions: [id] });
  if (!replay.positions.has(id)) throw new Error('Position not found in indexed coverage');
  const topics = new Set((['LiquidityAdded', 'LiquidityRemoved'] as const).map(eventName => encodeEventTopics({ abi: sourceAbi, eventName })[0]));
  const own = new Set(logs.filter(l => topics.has(l.topics[0] as `0x${string}`) && l.topics[1]?.slice(-40).toLowerCase() === owner.slice(2) && BigInt(l.topics[2]) === BigInt(salt)).map(l => `${l.transactionHash}:${BigInt(l.logIndex)}`));
  const changes = (t: Transition): BinChange => ({ bin: String(t.bin), logIndex: String(t.logIndex), sharesBefore: String(t.before.shares[id] ?? 0n), sharesAfter: String(t.after.shares[id] ?? 0n), totalBefore: String(t.before.totalShares), totalAfter: String(t.after.totalShares), before: (t.before.entitlements[id] ?? [0n, 0n]).map(String) as Amounts, after: (t.after.entitlements[id] ?? [0n, 0n]).map(String) as Amounts });
  const entries: Omit<ReplayEvent, 'index' | 'before' | 'after'>[] = [];
  for (const swap of replay.swaps) {
    const legs = swap.legs.filter(l => (l.before.shares[id] ?? 0n) > 0n); if (!legs.length) continue;
    const delta = legs.reduce<[bigint, bigint]>((n, l) => [n[0] + l.positionDelta[id][0], n[1] + l.positionDelta[id][1]], [0n, 0n]);
    const quote = quotes.get(`${swap.transactionHash}:${swap.logIndex}`);
    entries.push({ type: 'swap', block: String(swap.block), transactionHash: swap.transactionHash, logIndex: String(swap.logIndex), delta: delta.map(String) as Amounts, bins: legs.map(changes), reference: quote ? { kind: 'EXECUTION', referenceX64: quote.referenceX64, bidX64: quote.bidX64, askX64: quote.askX64 } : null, execution: { stockBase: String(swap.nativeDeltas[0] < 0n ? -swap.nativeDeltas[0] : swap.nativeDeltas[0]), stableBase: String(swap.nativeDeltas[1] < 0n ? -swap.nativeDeltas[1] : swap.nativeDeltas[1]) } });
  }
  const groups = new Map<string, Transition[]>();
  for (const t of replay.transitions.filter(t => t.event !== 'BinSwapped')) {
    const k = `${t.transactionHash}:${t.logIndex}`;
    if (!own.has(k) && (t.positionDelta[id] ?? [0n, 0n]).every(n => n === 0n)) continue;
    const list = groups.get(k) ?? []; list.push(t); groups.set(k, list);
  }
  const funding: { block: string; transactionHash: string; logIndex: string; type: string; tokens: Amounts }[] = [];
  for (const [k, rows] of groups) {
    const first = rows[0], self = own.has(k);
    const delta = rows.reduce<[bigint, bigint]>((n, t) => [n[0] + (t.positionDelta[id]?.[0] ?? 0n), n[1] + (t.positionDelta[id]?.[1] ?? 0n)], [0n, 0n]);
    const type = self ? first.event === 'LiquidityAdded' ? 'deposit' : 'withdrawal' : 'rounding';
    entries.push({ type, block: String(first.block), transactionHash: first.transactionHash, logIndex: String(first.logIndex), delta: delta.map(String) as Amounts, bins: rows.map(changes), reference: null, execution: null });
    if (self) funding.push({ block: String(first.block), transactionHash: first.transactionHash, logIndex: String(first.logIndex), type, tokens: rows.reduce<[bigint, bigint]>((n, t) => [n[0] + t.poolDelta[0], n[1] + t.poolDelta[1]], [0n, 0n]).map(String) as Amounts });
  }
  entries.sort((a, b) => BigInt(a.block) === BigInt(b.block) ? Number(BigInt(a.logIndex) - BigInt(b.logIndex)) : BigInt(a.block) < BigInt(b.block) ? -1 : 1);
  funding.sort((a, b) => BigInt(a.block) === BigInt(b.block) ? Number(BigInt(a.logIndex) - BigInt(b.logIndex)) : BigInt(a.block) < BigInt(b.block) ? -1 : 1);
  let balance: [bigint, bigint] = [0n, 0n];
  const events = entries.map((e, index): ReplayEvent => { const before = balance.map(String) as Amounts; balance = [balance[0] + BigInt(e.delta[0]), balance[1] + BigInt(e.delta[1])]; if (balance.some(n => n < 0n)) throw new Error('Negative position inventory'); return { ...e, index, before, after: balance.map(String) as Amounts }; });
  const final = portfolio(replay.bins, id);
  if (String(final) !== String(balance)) throw new Error('Event bridge does not reconcile');
  return { events, funding, final, replay };
}
