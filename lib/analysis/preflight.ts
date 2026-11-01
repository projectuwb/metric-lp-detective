// Offline source-index evidence only: neither balances nor prices are verified here.
import { decodeEventLog, type Abi, type Hex } from 'viem';
import type { RawLog } from '../chain/rpc';
import { POOL } from '../chain/poolConfig';
import { positionPlan } from './collect';
import { reconstructionCalls } from './rpcEstimate';
import { positionIdentity } from '../domain/position';
export function indexedSwapActivity(logs: RawLog[], abi: Abi) {
  const bins = new Map<string, Map<string, bigint>>(), counts = new Map<string, { swaps: number; transactions: Set<string> }>();
  let touched = new Set<string>(), pendingTx = '';
  for (const log of [...logs].sort((a, b) => { for (const f of ['blockNumber', 'transactionIndex', 'logIndex'] as const) { const d = BigInt(a[f]) - BigInt(b[f]); if (d) return d < 0n ? -1 : 1; } return 0; })) {
    if (log.address.toLowerCase() !== POOL.toLowerCase() || log.removed) throw new Error('Invalid activity source');
    const event = decodeEventLog({ abi, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: true }), args = event.args as any;
    if (event.eventName === 'LiquidityAdded' || event.eventName === 'LiquidityRemoved') {
      if (pendingTx) throw new Error('Liquidity inside incomplete swap');
      const id = args.provider.toLowerCase() + ':' + args.salt;
      for (const [i, bin] of (args.binIdxs as bigint[]).entries()) {
        const owners = bins.get(String(bin)) ?? new Map<string, bigint>(), held = (owners.get(id) ?? 0n) + args.shares[i] * (event.eventName === 'LiquidityAdded' ? 1n : -1n);
        if (held < 0n) throw new Error('Activity source begins after funding or is incomplete');
        owners.set(id, held); bins.set(String(bin), owners);
      }
    } else if (event.eventName === 'BinSwapped') {
      if (pendingTx && pendingTx !== log.transactionHash) throw new Error('Incomplete swap activity boundary');
      pendingTx = log.transactionHash;
      for (const [id, shares] of bins.get(String(args.binIdx)) ?? []) if (shares > 0n) touched.add(id);
    } else if (event.eventName === 'Swap') {
      if (pendingTx !== log.transactionHash) throw new Error('Swap has no indexed bin legs');
      for (const id of touched) { const p = counts.get(id) ?? { swaps: 0, transactions: new Set<string>() }; p.swaps++; p.transactions.add(log.transactionHash); counts.set(id, p); }
      touched = new Set(); pendingTx = '';
    }
  }
  if (pendingTx) throw new Error('Incomplete swap activity source');
  return counts;
}
export function offlinePreflight(id: string) {
  id = positionIdentity(id);
  const p = positionPlan(id);
  const shares = new Map<string, bigint>(); let withdrawals = 0, cursor = 0;
  for (const block of p.blocks) {
    while (cursor < p.r.replay.transitions.length && p.r.replay.transitions[cursor].block <= BigInt(block)) {
      const t = p.r.replay.transitions[cursor++]; shares.set(String(t.bin), t.after.shares[id] ?? 0n);
    }
    if ([...shares.values()].some(n => n > 0n)) withdrawals++;
  }
  const marks = p.blocks.filter(b => b === p.h.acquisition.to || p.r.events.some(e => e.block === b)).length;
  return { id, confidence: 'INDEX_PREFLIGHT_NOT_INDEPENDENTLY_VERIFIED', from: p.h.acquisition.from, through: p.h.acquisition.to,
    swaps: p.r.events.filter(e => e.type === 'swap').length, checkpoints: p.blocks.length, traces: p.swapTransactions.length,
    expected: reconstructionCalls(p.blocks.length, withdrawals, marks, p.fundingTransactions.length, p.swapTransactions.length), hardLimit: p.upperBound,
    events: p.r.events.map(e => ({ type: e.type, block: e.block, transactionHash: e.transactionHash })),
    closedInIndex: [...shares.values()].every(n => n === 0n), moneyAuthorised: false, liveRequestsIssued: 0 };
}
