import { decodeEventLog, type Abi, type Hex } from 'viem';
import { signedPair, unsignedPair } from '../chain/decode.js';
import { POOL } from '../chain/poolConfig.js';
import type { RawLog } from '../chain/rpc.js';

export interface Position { owner: string; salt: bigint }
export interface Bin { reserve0: bigint; reserve1: bigint; totalShares: bigint; positions: Map<string, bigint> }
export interface Snapshot { reserve0: bigint; reserve1: bigint; totalShares: bigint; shares: Record<string, bigint>; entitlements: Record<string, [bigint, bigint]> }
export interface Transition {
  block: bigint; transactionHash: string; transactionIndex: bigint; logIndex: bigint;
  event: string; bin: bigint; before: Snapshot; after: Snapshot;
  poolDelta: [bigint, bigint]; fee?: { lp: bigint; platform: bigint; inputToken: 0 | 1 };
  positionDelta: Record<string, [bigint, bigint]>;
}
export const positionId = (p: Position) => `${p.owner.toLowerCase()}:${p.salt}`;
export const floorMulDiv = (a: bigint, b: bigint, d: bigint) => {
  if (a < 0n || b < 0n || d <= 0n) throw new Error('Invalid unsigned floorMulDiv');
  return a * b / d;
};
const ceilMulDiv = (a: bigint, b: bigint, d: bigint) => (a * b + d - 1n) / d;
export function snapshot(bin: Bin, tracked?: ReadonlySet<string>): Snapshot {
  const entitlements: Snapshot['entitlements'] = {};
  const entries = [...bin.positions].filter(([key]) => !tracked || tracked.has(key));
  for (const [key, shares] of entries) entitlements[key] = bin.totalShares === 0n ? [0n, 0n] : [floorMulDiv(bin.reserve0, shares, bin.totalShares), floorMulDiv(bin.reserve1, shares, bin.totalShares)];
  return { reserve0: bin.reserve0, reserve1: bin.reserve1, totalShares: bin.totalShares, shares: Object.fromEntries(entries), entitlements };
}
export function portfolio(bins: Map<bigint, Bin>, key: string): [bigint, bigint] {
  let amount0 = 0n, amount1 = 0n;
  for (const bin of bins.values()) {
    if (bin.totalShares === 0n) continue;
    const shares = bin.positions.get(key) ?? 0n;
    amount0 += floorMulDiv(bin.reserve0, shares, bin.totalShares);
    amount1 += floorMulDiv(bin.reserve1, shares, bin.totalShares);
  }
  return [amount0, amount1]; // Scaled per-bin floors; native conversion is AFTER summing.
}
const nonInventoryEvents = new Set(['BidAskRefAsymmetryUpdated', 'PauseLevelUpdated', 'SpreadFeeUpdated', 'NotionalFeeUpdated', 'BinAdditionalFeesUpdated', 'PriceProviderUpdated', 'ProtocolFeesCollected', 'FeeTransferFailed']);

/** Full deployment-origin replay. Monetary arithmetic is bigint only. Callers must
 * establish complete ordered log coverage; unknown event semantics fail closed. */
export function replayPool(input: RawLog[], abi: Abi, options: { entitlementPositions?: readonly string[] } = {}) {
  const tracked = options.entitlementPositions ? new Set(options.entitlementPositions) : undefined;
  const bins = new Map<bigint, Bin>();
  const transitions: Transition[] = [];
  const swaps: { block: bigint; transactionHash: string; logIndex: bigint; legs: Transition[]; nativeDeltas: [bigint, bigint] }[] = [];
  const positions = new Map<string, Position>();
  const ignored: { event: string; block: bigint; logIndex: bigint }[] = [];
  let pending: Transition[] = [];
  const logs = [...input].sort((a, b) => {
    for (const field of ['blockNumber', 'transactionIndex', 'logIndex'] as const) {
      if (BigInt(a[field]) !== BigInt(b[field])) return BigInt(a[field]) < BigInt(b[field]) ? -1 : 1;
    }
    return 0;
  });
  const seen = new Set<string>();
  const hashes = new Map<bigint, string>();
  for (const log of logs) {
    if (log.address.toLowerCase() !== POOL.toLowerCase() || log.removed) throw new Error('Invalid pool log');
    const unique = `${log.transactionHash}:${BigInt(log.logIndex)}`;
    if (seen.has(unique)) throw new Error('Duplicate log; normalize acquisition first');
    seen.add(unique);
    const block = BigInt(log.blockNumber);
    if (hashes.has(block) && hashes.get(block) !== log.blockHash) throw new Error('Conflicting block hashes');
    hashes.set(block, log.blockHash);
    const event = decodeEventLog({ abi, topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex, strict: true });
    const name = event.eventName;
    const args = event.args as unknown as Record<string, unknown>;
    if (!name) throw new Error('Unnamed event');
    if (nonInventoryEvents.has(name)) { ignored.push({ event: name, block, logIndex: BigInt(log.logIndex) }); continue; }
    if (name === 'Swap') {
      if (!pending.length || pending.some(t => t.transactionHash !== log.transactionHash)) throw new Error('Swap/step boundary mismatch');
      const native = signedPair(args.amountDeltas as bigint);
      const inputToken = native.high > 0n ? 0 : 1;
      if (pending.some(l => l.fee!.inputToken !== inputToken)) throw new Error('Bin fee leg disagrees with swap input token');
      // This one pool has immutable scale multipliers 1/1. No later fee addition.
      const sum: [bigint, bigint] = [0n, 0n];
      for (const leg of pending) {
        sum[0] += leg.poolDelta[0]; sum[1] += leg.poolDelta[1];
        sum[leg.fee!.inputToken] += leg.fee!.platform;
      }
      const platform = unsignedPair(args.platformFees as bigint);
      if (sum[0] !== native.high || sum[1] !== native.low || pending.reduce((n, l) => n + l.fee!.platform, 0n) !== platform.high + platform.low) throw new Error('Swap native/bin/platform fee mismatch');
      swaps.push({ block, transactionHash: log.transactionHash, logIndex: BigInt(log.logIndex), legs: pending, nativeDeltas: [native.high, native.low] });
      pending = []; continue;
    }
    if (!['LiquidityAdded', 'LiquidityRemoved', 'BinSwapped'].includes(name)) throw new Error(`Unreviewed event ${name}`);
    if (name !== 'BinSwapped' && pending.length) throw new Error('Liquidity inside incomplete swap');
    const indices = name === 'BinSwapped' ? [args.binIdx as bigint] : args.binIdxs as bigint[];
    if (name !== 'BinSwapped' && (indices.length !== (args.shares as bigint[]).length || indices.length !== (args.binBalanceDeltas as unknown[]).length)) throw new Error('Parallel arrays differ');
    for (const [i, index] of indices.entries()) {
      if (index < -50n || index > 49n) throw new Error('Bin outside verified grid');
      let bin = bins.get(index);
      if (!bin) { bin = { reserve0: 0n, reserve1: 0n, totalShares: 0n, positions: new Map() }; bins.set(index, bin); }
      const before = snapshot(bin, tracked);
      let delta: [bigint, bigint];
      let fee: Transition['fee'];
      if (name === 'BinSwapped') {
        if (bin.totalShares === 0n) throw new Error('Swap without liquidity');
        const packed = signedPair(args.binDeltas as bigint), fees = unsignedPair(args.fees as bigint);
        delta = [packed.high, packed.low];
        if (!(packed.high >= 0n && packed.low <= 0n || packed.high <= 0n && packed.low >= 0n)) throw new Error('Unexpected swap signs');
        fee = { lp: fees.high, platform: fees.low, inputToken: packed.high > 0n || packed.low < 0n ? 0 : 1 };
      } else {
        const p = { owner: args.provider as string, salt: args.salt as bigint }, key = positionId(p);
        positions.set(key, p);
        const count = (args.shares as bigint[])[i];
        const d = (args.binBalanceDeltas as { delta0Scaled: bigint; delta1Scaled: bigint }[])[i];
        delta = [d.delta0Scaled, d.delta1Scaled];
        const held = bin.positions.get(key) ?? 0n;
        if (count === 0n) {
          if (delta[0] !== 0n || delta[1] !== 0n) throw new Error('Nonzero delta for zero-share row');
        } else if (name === 'LiquidityAdded') {
          if (delta.some(d => d < 0n)) throw new Error('Negative add');
          if (bin.totalShares > 0n && (delta[0] !== ceilMulDiv(bin.reserve0, count, bin.totalShares) || delta[1] !== ceilMulDiv(bin.reserve1, count, bin.totalShares))) throw new Error('Add rounding differs from source');
          bin.totalShares += count; bin.positions.set(key, held + count);
        } else {
          if (held < count || bin.totalShares === 0n || delta[0] !== -floorMulDiv(bin.reserve0, count, bin.totalShares) || delta[1] !== -floorMulDiv(bin.reserve1, count, bin.totalShares)) throw new Error('Removal math differs from source');
          bin.totalShares -= count; bin.positions.set(key, held - count);
        }
      }
      bin.reserve0 += delta[0]; bin.reserve1 += delta[1];
      if (bin.reserve0 < 0n || bin.reserve1 < 0n || bin.reserve0 >= 1n << 104n || bin.reserve1 >= 1n << 104n) throw new Error('Invalid uint104 reserve');
      if ([...bin.positions.values()].reduce((n, s) => n + s, 0n) !== bin.totalShares) throw new Error('Position shares do not sum to total');
      const after = snapshot(bin, tracked);
      const keys = new Set([...Object.keys(before.entitlements), ...Object.keys(after.entitlements)]);
      const positionDelta: Transition['positionDelta'] = {};
      for (const key of keys) {
        const a = after.entitlements[key] ?? [0n, 0n], b = before.entitlements[key] ?? [0n, 0n];
        positionDelta[key] = [a[0] - b[0], a[1] - b[1]];
      }
      const transition: Transition = { block, transactionHash: log.transactionHash, transactionIndex: BigInt(log.transactionIndex), logIndex: BigInt(log.logIndex), event: name, bin: index, before, after, poolDelta: delta, fee, positionDelta };
      transitions.push(transition);
      if (name === 'BinSwapped') pending.push(transition);
    }
  }
  if (pending.length) throw new Error('Incomplete swap coverage');
  return { bins, positions, transitions, swaps, ignored };
}
