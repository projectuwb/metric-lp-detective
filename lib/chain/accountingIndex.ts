// Owner-side, full-event ledger extension. This never registers an LP replay.
import { createHash } from 'node:crypto';
import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, keccak256, type Abi, type Hex } from 'viem';
import { checkedLogs, RpcFailure, type RawLog, type Rpc } from './rpc';
import { POOL, RUNTIME_CODE_HASH } from './poolConfig';
import { replayPool } from '../metric/positionLedger';
import type { DiscoveryIndex } from './discoveryIndex';

type Base = DiscoveryIndex['base'];
export interface AccountingPage {
  from: string; through: string; previousHash: string; headHash: string;
  logs: RawLog[]; state: { call: { to: string; data: Hex }; raw: Hex }; sha256: string;
}
export interface AccountingIndex {
  schema: 1; base: Base; pages: AccountingPage[];
  observedFinalizedHead: DiscoveryIndex['observedFinalizedHead'];
}
const hash = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-f]{64}$/i.test(s);
const digest = (p: Omit<AccountingPage, 'sha256'>) => createHash('sha256').update(JSON.stringify(p)).digest('hex');
export function checkedAccountingIndex(index: AccountingIndex, base: Base) {
  if (!index || index.schema !== 1 || JSON.stringify(index.base) !== JSON.stringify(base) || !Array.isArray(index.pages) || index.pages.length > 20000) throw new Error('Accounting source/version changed or invalid checkpoint');
  let next = BigInt(base.through) + 1n, previousHash = base.headHash;
  for (const { sha256, ...p } of index.pages) {
    if (!/^\d+$/.test(p.from) || !/^\d+$/.test(p.through) || BigInt(p.from) !== next || BigInt(p.through) < next || BigInt(p.through) - next >= 1000n || p.previousHash !== previousHash || !hash(p.headHash) || digest(p) !== sha256 || !p.state || p.state.call.to !== POOL || !/^0x[0-9a-f]*$/i.test(p.state.raw)) throw new Error('Accounting gap, hash mismatch or invalid page');
    if (checkedLogs(p.logs, next, BigInt(p.through)).length >= 1000) throw new Error('Accounting result cap; incomplete coverage');
    next = BigInt(p.through) + 1n; previousHash = p.headHash;
  }
  const head = index.observedFinalizedHead;
  if (head && (!/^\d+$/.test(head.block) || !hash(head.hash) || !Number.isFinite(Date.parse(head.observedAt)) || BigInt(head.block) < next - 1n)) throw new Error('Invalid accounting finality observation');
  return index;
}
export function accountingStateCall(abi: Abi) {
  const slots: Hex[] = [];
  for (let bin = -50n; bin < 50n; bin++) for (const slot of [4n, 5n]) slots.push(keccak256(encodeAbiParameters([{ type: 'int256' }, { type: 'uint256' }], [bin, slot])));
  return { to: POOL, data: encodeFunctionData({ abi, functionName: 'extsload', args: [slots] }) };
}
export function reconcileAccounting(logs: RawLog[], abi: Abi, state: AccountingPage['state']) {
  if (JSON.stringify(state.call) !== JSON.stringify(accountingStateCall(abi))) throw new Error('Wrong accounting storage query');
  const words = decodeFunctionResult({ abi, functionName: 'extsload', args: [[]], data: state.raw }) as readonly Hex[];
  if (words.length !== 200) throw new Error('Accounting state requires all 100 bins');
  const replay = replayPool(logs, abi, { entitlementPositions: [] });
  const mask = (1n << 104n) - 1n;
  for (let bin = -50n; bin < 50n; bin++) {
    const i = Number(bin + 50n) * 2, packed = BigInt(words[i]), total = BigInt(words[i + 1]), b = replay.bins.get(bin);
    const ownerShares = [...(b?.positions.values() ?? [])].reduce((n, v) => n + v, 0n);
    if ((b?.reserve0 ?? 0n) !== (packed & mask) || (b?.reserve1 ?? 0n) !== (packed >> 104n & mask) || (b?.totalShares ?? 0n) !== total || ownerShares !== total) throw new Error(`Independent accounting mismatch at bin ${bin}`);
  }
  return { bins: 100, positions: replay.positions.size, swaps: replay.swaps.length, tolerance: '0 base units', status: 'POOL_LEDGER_RECONCILED_POSITION_PROOFS_REQUIRED' as const };
}
export function verifyAccountingIndex(index: AccountingIndex, base: Base, baseline: RawLog[], abi: Abi) {
  checkedAccountingIndex(index, base);
  // Recheck each saved independent boundary, never trust a serialized PASS label.
  const logs = [...baseline]; let verification: ReturnType<typeof reconcileAccounting> | null = null;
  for (const page of index.pages) { logs.push(...page.logs); verification = reconcileAccounting(logs, abi, page.state); }
  return { logs, verification, through: index.pages.at(-1)?.through ?? base.through };
}
class BudgetEnded extends Error {}
export async function advanceAccounting(index: AccountingIndex, baseline: RawLog[], abi: Abi, rpc: Rpc, budget: number, targetThrough: string, persist: (index: AccountingIndex) => void, options: { now?: () => Date; pace?: () => Promise<void> } = {}) {
  const checked = verifyAccountingIndex(index, index.base, baseline, abi), start = BigInt(checked.through) + 1n;
  if (!/^\d+$/.test(targetThrough) || BigInt(targetThrough) < start || BigInt(targetThrough) - start >= 100000n || !Number.isSafeInteger(budget) || budget < 9 || budget > 100) throw new Error('Explicit accounting target <=100000 blocks and 9..100 attempts required');
  let requests = 0;
  const now = options.now ?? (() => new Date()), day = now().toISOString().slice(0, 10);
  const call: Rpc = async (m, p) => {
    if (requests >= budget || now().toISOString().slice(0, 10) !== day) throw new BudgetEnded();
    requests++; await (options.pace?.() ?? new Promise(resolve => setTimeout(resolve, 1000))); return rpc(m, p);
  };
  const header = async (block: string) => {
    const h = await call('eth_getBlockByNumber', [block === 'finalized' ? block : '0x' + BigInt(block).toString(16), false]) as { number?: string; hash?: string } | null;
    if (!h || !hash(h.hash) || !h.number || !/^0x[0-9a-f]+$/i.test(h.number) || block !== 'finalized' && BigInt(h.number) !== BigInt(block)) throw new Error('Invalid accounting canonical header');
    return { block: BigInt(h.number).toString(), hash: h.hash };
  };
  try {
    if (await call('eth_chainId', []) !== '0x38') throw new Error('Wrong accounting chain');
    if ((await header(index.base.through)).hash !== index.base.headHash) throw new Error('Accounting baseline reorg');
    const last = index.pages.at(-1);
    if (last && (await header(last.through)).hash !== last.headHash) throw new Error('Accounting checkpoint reorg');
    const final = await header('finalized');
    if (BigInt(targetThrough) > BigInt(final.block)) throw new Error('Accounting target exceeds finality');
    if (keccak256(await call('eth_getCode', [POOL, '0x' + BigInt(final.block).toString(16)]) as Hex) !== RUNTIME_CODE_HASH) throw new Error('Accounting runtime mismatch');
    index.observedFinalizedHead = { ...final, observedAt: now().toISOString() }; persist(index);
    const logs = checked.logs; let cursor = start, size = 1000n, previousHash = last?.headHash ?? index.base.headHash;
    while (cursor <= BigInt(targetThrough)) {
      const end = cursor + size - 1n < BigInt(targetThrough) ? cursor + size - 1n : BigInt(targetThrough);
      const before = await header(String(end)); let pageLogs: RawLog[];
      try {
        pageLogs = checkedLogs(await call('eth_getLogs', [{ address: POOL, fromBlock: '0x' + cursor.toString(16), toBlock: '0x' + end.toString(16) }]), cursor, end);
        if (pageLogs.length >= 1000) throw new RpcFailure('range');
      } catch (e) {
        if (!(e instanceof RpcFailure) || e.kind !== 'range') throw e;
        if (cursor === end) throw new Error('Single-block accounting result cap; cannot advance');
        size = (end - cursor + 1n) / 2n || 1n; continue;
      }
      const hashes = new Map<string, string>();
      for (const log of pageLogs) { const block = BigInt(log.blockNumber).toString(); if (hashes.has(block) && hashes.get(block) !== log.blockHash) throw new Error('Accounting log reorg'); hashes.set(block, log.blockHash); }
      for (const [block, blockHash] of hashes) if ((await header(block)).hash !== blockHash) throw new Error('Noncanonical accounting event');
      const stateCall = accountingStateCall(abi), raw = await call('eth_call', [stateCall, '0x' + end.toString(16)]) as Hex;
      const state = { call: stateCall, raw };
      reconcileAccounting([...logs, ...pageLogs], abi, state);
      const after = await header(String(end));
      if (before.hash !== after.hash || end === BigInt(final.block) && after.hash !== final.hash) throw new Error('Accounting boundary reorg');
      const page = { from: String(cursor), through: String(end), previousHash, headHash: after.hash, logs: pageLogs, state };
      index.pages.push({ ...page, sha256: digest(page) }); persist(index);
      logs.push(...pageLogs); cursor = end + 1n; previousHash = after.hash;
    }
    return { requests, state: 'RECONCILED_TO_EXPLICIT_TARGET' as const };
  } catch (e) { if (e instanceof BudgetEnded) return { requests, state: 'BUDGET_PAUSED' as const }; throw e; }
}
