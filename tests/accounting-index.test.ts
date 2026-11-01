import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { encodeAbiParameters, decodeFunctionResult, type Hex } from 'viem';
import { historyInputs } from '../scripts/reconstruct-history';
import { advanceAccounting, accountingStateCall, reconcileAccounting, checkedAccountingIndex, verifyAccountingIndex, type AccountingIndex } from '../lib/chain/accountingIndex';
import { RpcFailure, type Rpc } from '../lib/chain/rpc';
const h = historyInputs(), batchAbi = h.abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
const zero = ('0x' + '0'.repeat(64)) as Hex;
const raw = encodeAbiParameters([{ type: 'bytes32[]' }], [Array(200).fill(zero)]);
const blockHash = (n: bigint) => '0x' + n.toString(16).padStart(64, '0');
const fresh = (): AccountingIndex => ({ schema: 1, base: { chainId: 56, pool: h.logs[0].address, from: '0', through: '100', headHash: blockHash(100n), sourceHash: 'synthetic-transport-vector', accountingVersion: 'test-only' }, pages: [], observedFinalizedHead: null });
const options = { now: () => new Date('2026-11-02T01:00:00Z'), pace: async () => {} };
function transport(calls: string[], logs: (params: any) => unknown = () => []): Rpc {
  return async (m, p) => {
    calls.push(m);
    if (m === 'eth_chainId') return '0x38';
    if (m === 'eth_getCode') return JSON.parse(readFileSync('fixtures/raw/code-and-identity.json', 'utf8')).runtimeCode;
    if (m === 'eth_call') return raw;
    if (m === 'eth_getLogs') { expect(p[0]).not.toHaveProperty('topics'); return logs(p[0]); }
    const n = p[0] === 'finalized' ? 3100n : BigInt(p[0] as string);
    return { number: '0x' + n.toString(16), hash: blockHash(n) };
  };
}
describe('full accounting extension, synthetic paging vectors (no chain coverage claims)', () => {
  it('checkpoints inclusive full-event ranges only after independent 100-bin reconciliation, then resumes', async () => {
    const i = fresh(), calls: string[] = [], snapshots: AccountingIndex[] = [];
    expect(await advanceAccounting(i, [], h.abi, transport(calls), 12, '2100', s => snapshots.push(structuredClone(s)), options)).toEqual({ requests: 12, state: 'RECONCILED_TO_EXPLICIT_TARGET' });
    expect(i.pages.map(p => [p.from, p.through])).toEqual([['101', '1100'], ['1101', '2100']]);
    expect(i.pages.every(p => p.state.raw === raw)).toBe(true);
    const restored = snapshots.at(-1)!;
    expect(await advanceAccounting(restored, [], h.abi, transport([]), 9, '3100', () => {}, options)).toEqual({ requests: 9, state: 'RECONCILED_TO_EXPLICIT_TARGET' });
    expect(verifyAccountingIndex(restored, restored.base, [], h.abi).verification?.status).toBe('POOL_LEDGER_RECONCILED_POSITION_PROOFS_REQUIRED');
    const damaged = structuredClone(restored); damaged.pages[1].through = '2099';
    expect(() => checkedAccountingIndex(damaged, damaged.base)).toThrow('hash');
  });
  it('discards an unfinished page on budget/day rollover and never claims its coverage', async () => {
    const i = fresh();
    expect(await advanceAccounting(i, [], h.abi, transport([]), 10, '2100', () => {}, options)).toEqual({ requests: 10, state: 'BUDGET_PAUSED' });
    expect(i.pages.map(p => p.through)).toEqual(['1100']);
    let n = 0; const j = fresh();
    expect(await advanceAccounting(j, [], h.abi, transport([]), 20, '1100', () => {}, { ...options, now: () => new Date(++n < 5 ? '2026-11-02T23:59:59Z' : '2026-11-03T00:00:00Z') })).toMatchObject({ state: 'BUDGET_PAUSED' });
    expect(j.pages).toEqual([]);
  });
  it('shrinks dense/range-limited full-event pages and counts every failed attempt', async () => {
    const i = fresh(), calls: string[] = [];
    const rpc = transport(calls, p => { if (BigInt(p.toBlock) - BigInt(p.fromBlock) >= 500n) throw new RpcFailure('range'); return []; });
    expect(await advanceAccounting(i, [], h.abi, rpc, 20, '1100', () => {}, options)).toEqual({ requests: 14, state: 'RECONCILED_TO_EXPLICIT_TARGET' });
    expect(i.pages.map(p => [p.from, p.through])).toEqual([['101', '600'], ['601', '1100']]);
    expect(calls.filter(m => m === 'eth_getLogs')).toHaveLength(3);
  });
  it.each(['rate', 'quota', 'temporary'] as const)('stops immediately on %s with no retry or cursor advance', async kind => {
    const i = fresh(), calls: string[] = [];
    await expect(advanceAccounting(i, [], h.abi, transport(calls, () => { throw new RpcFailure(kind); }), 20, '1100', () => {}, options)).rejects.toThrow(kind);
    expect(calls.filter(m => m === 'eth_getLogs')).toHaveLength(1); expect(i.pages).toEqual([]);
  });
  it('rejects a changed canonical boundary or independent reserve/share mismatch', async () => {
    const i = fresh(), rpc = transport([]); let reads = 0;
    await expect(advanceAccounting(i, [], h.abi, async (m, p) => {
      const r = await rpc(m, p);
      if (m === 'eth_getBlockByNumber' && p[0] === '0x44c' && ++reads === 2) return { number: p[0], hash: blockHash(99n) }; return r;
    }, 20, '1100', () => {}, options)).rejects.toThrow('boundary reorg');
    expect(i.pages).toEqual([]);
    const bad = encodeAbiParameters([{ type: 'bytes32[]' }], [['0x' + '0'.repeat(63) + '1', ...Array(199).fill(zero)]]);
    expect(() => reconcileAccounting([], h.abi, { call: accountingStateCall(h.abi), raw: bad })).toThrow('mismatch');
  });
  it('reconciles the actual saved full ledger against independent stored words, with zero tolerance', () => {
    const evidence = JSON.parse(readFileSync('fixtures/history/historical-state.json', 'utf8')).states.find((s: any) => s.block === h.acquisition.to);
    const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: evidence.raw }) as readonly Hex[];
    const state = { call: accountingStateCall(h.abi), raw: encodeAbiParameters([{ type: 'bytes32[]' }], [words.filter((_, i) => i % 3 !== 2)]) };
    expect(reconcileAccounting(h.logs, h.abi, state)).toMatchObject({ bins: 100, positions: 236, tolerance: '0 base units' });
    expect(() => reconcileAccounting(h.logs, h.abi, { ...state, call: { ...state.call, data: '0x' } })).toThrow('query');
  }, 60000);
});
