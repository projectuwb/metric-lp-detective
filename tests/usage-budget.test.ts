import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { usagePolicy, checkedPolicy, allocateUsage, usageMeter, checkpointUsage, checkedUsage, usageSummary, formatNanoUsd, policyHash, type UsagePolicy } from '../lib/analysis/usageBudget';
import { reserveRun, reserveBudgetedRun, checkedState } from '../lib/analysis/remote';
import { configuredRpc, getPoolLogs } from '../lib/chain/rpc';
const day = new Date('2026-11-02T00:00:00Z'), key = 'a'.repeat(64);
const temporary: string[] = [];
const file = () => { const root = mkdtempSync(path.join(os.tmpdir(), 'rpc-cost-unit-')); temporary.push(root); return path.join(root, 'attempts.json'); };
const paid = (): UsagePolicy => ({ ...usagePolicy(), id: 'prepaid-TEST-ONLY', mode: 'PREPAID', account: 'synthetic-prepaid', endpointEnv: 'LP_RPC_URL', unitPriceNanoUsd: '4000', usageCapNanoUsd: '1000000000', paymentTotalNanoUsd: '1000000000', creditNanoUsd: '1000000000', approval: { by: 'projectuwb', at: day.toISOString(), reference: 'synthetic unit vector - not owner approval', terms: 'test terms only', settledCreditVerified: true } });
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('durable combined RPC request and charge reservations', () => {
  it('keeps default Free/$0/100-per-day while permitting index + small replay in one day', () => {
    const p = usagePolicy(); expect(p).toMatchObject({ mode: 'FREE', dailyRequests: 100, usageCapNanoUsd: '0', approval: null });
    const first = reserveBudgetedRun({ schema: 1, reservations: [] }, '1', key, p, 20, 0, 'discovery', day);
    const both = reserveBudgetedRun(JSON.parse(JSON.stringify(first)), '2', 'b'.repeat(64), p, 43, 1, 'analysis', day);
    expect(both.reservations.map(r => r.requests)).toEqual([20, 43]);
    expect(usageSummary(both.usage!, p)).toMatchObject({ reservedNanoUsd: '0', remainingNanoUsd: '0', attemptsRecorded: 0 });
    expect(() => reserveBudgetedRun(both, '3', key, p, 38, 0, 'analysis', day)).toThrow('Combined daily');
    expect(checkedState(both)).toEqual(both);
    const stripped = { ...both, usage: undefined }; expect(() => checkedState(stripped)).toThrow('cost-aware');
  });
  it('never refunds old full-day reservations or permits a mixed-revision race to overspend', () => {
    const p = usagePolicy(), old = reserveRun({ schema: 1, reservations: [] }, '1', key, day);
    expect(() => reserveBudgetedRun(old, '2', key, p, 5, 0, 'discovery', day)).toThrow('daily');
    const first = reserveBudgetedRun({ schema: 1, reservations: [] }, '1', key, p, 20, 0, 'discovery', day);
    expect(() => reserveRun(first, '2', key, day)).toThrow('Daily RPC');
    expect(() => checkedState({ schema: 1, reservations: [{ ...old.reservations[0], requests: 20 }] })).toThrow('ledger invalid');
    const largerFree = { ...p, dailyRequests: 1000, approval: paid().approval };
    expect(() => reserveBudgetedRun(old, '2', key, largerFree, 5, 1, 'analysis', day)).toThrow('Legacy combined');
  });
  it('enforces global trace and two-analysis-per-day bounds, independently of request headroom', () => {
    const p = usagePolicy(), initial = { schema: 1 as const, reservations: [] };
    const first = reserveBudgetedRun(initial, '1', key, p, 10, 6, 'analysis', day);
    expect(() => reserveBudgetedRun(first, '2', key, p, 10, 5, 'analysis', day)).toThrow('trace');
    const second = reserveBudgetedRun(first, '2', key, p, 10, 4, 'analysis', day);
    expect(() => reserveBudgetedRun(second, '3', key, p, 1, 0, 'analysis', day)).toThrow('analysis-job');
  });
  it('uses exact per-call nanodollars and refuses a cap before the transport can spend it', () => {
    const p = { ...paid(), usageCapNanoUsd: '8000' };
    const ledger = allocateUsage(undefined, p, { runId: '1', day: '2026-11-02', kind: 'analysis', requests: 2, traces: 1 }, 0);
    expect(ledger.reservedNanoUsd).toBe('8000'); expect(formatNanoUsd('8000')).toBe('$0.000008000');
    expect(() => allocateUsage(ledger, p, { runId: '2', day: '2026-11-03', kind: 'discovery', requests: 1, traces: 0 }, 0)).toThrow('spending ceiling');
    expect(() => allocateUsage(ledger, { ...p, unitPriceNanoUsd: '4001' }, { runId: '2', day: '2026-11-03', kind: 'discovery', requests: 1, traces: 0 }, 0)).toThrow('changed');
  });
  it('requires explicit policy-transition approval and preserves free history without resetting paid counters', () => {
    const free = usagePolicy(), old = allocateUsage(undefined, free, { runId: '1', day: '2026-11-02', kind: 'discovery', requests: 20, traces: 0 }, 0);
    const approved = { ...paid(), previousPolicyHash: policyHash(free) };
    const migrated = allocateUsage(old, approved, { runId: '2', day: '2026-11-03', kind: 'analysis', requests: 40, traces: 1 }, 0);
    expect(migrated.allocations).toHaveLength(2); expect(migrated.allocations[0].unitPriceNanoUsd).toBe('0');
    expect(migrated.allocations[1].unitPriceNanoUsd).toBe('4000'); expect(migrated.reservedNanoUsd).toBe('160000');
    expect(() => allocateUsage(migrated, { ...approved, id: 'another-account-budget', previousPolicyHash: policyHash(approved) }, { runId: '3', day: '2026-11-04', kind: 'discovery', requests: 1, traces: 0 }, 0)).toThrow('changed');
    expect(() => allocateUsage(old, paid(), { runId: '2', day: '2026-11-03', kind: 'analysis', requests: 1, traces: 0 }, 0)).toThrow('changed');
  });
  it('refuses payment caps >=$10 including external fees, unknown rates, auto topups, overage and missing approval', () => {
    for (const change of [{ paymentTotalNanoUsd: '9990000000', externalFeesNanoUsd: '10000000' }, { automaticTopups: true }, { recurringCharges: true }, { hardStopNoOverage: false }, { approval: null }, { unitPriceNanoUsd: '0' }, { mode: 'PAYG' }, { usageCapNanoUsd: '1000000001' }]) expect(() => checkedPolicy({ ...paid(), ...change } as UsagePolicy)).toThrow();
    expect(() => checkedPolicy({ ...usagePolicy(), dailyRequests: 10000 })).toThrow('approval');
    expect(() => checkedPolicy({ ...usagePolicy(), unitPriceNanoUsd: '4000' })).toThrow('Free policy');
  });
  it('persists before send, counts failures, restores counters, and cannot reuse exhausted or rollover budgets', async () => {
    const p = paid(), allocation = allocateUsage(undefined, p, { runId: '1', day: '2026-11-02', kind: 'analysis', requests: 2, traces: 1 }, 0).allocations[0], stateFile = file();
    const meter = usageMeter(allocation, p, stateFile, () => day);
    const transport = vi.fn(async () => { expect(JSON.parse(readFileSync(stateFile, 'utf8')).attempts).toBe(1); throw new Error('Synthetic timeout after reservation'); });
    await expect(meter.wrap(transport)('eth_chainId', [])).rejects.toThrow('timeout');
    const restored = usageMeter(allocation, p, stateFile, () => day);
    restored.beforeAttempt('debug_traceTransaction'); expect(restored.current()).toMatchObject({ attempts: 2, traceAttempts: 1, attemptedNanoUsd: '8000' });
    expect(() => restored.beforeAttempt('eth_chainId')).toThrow('allocation exhausted');
    expect(() => usageMeter(allocation, p, stateFile, () => new Date('2026-11-03')).beforeAttempt('eth_chainId')).toThrow('UTC-day');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('checkpoints actual counters without refunding reserved costs or allowing corruption/reset', () => {
    const p = paid(), ledger = allocateUsage(undefined, p, { runId: '1', day: '2026-11-02', kind: 'discovery', requests: 20, traces: 0 }, 0);
    const meter = usageMeter(ledger.allocations[0], p, file(), () => day); meter.beforeAttempt('eth_getLogs');
    const saved = checkpointUsage(ledger, p, meter.current());
    expect(saved.allocations[0]).toMatchObject({ attempts: 1, attemptedNanoUsd: '4000', reservedNanoUsd: '80000', checkpointed: true });
    expect(saved.reservedNanoUsd).toBe('80000');
    expect(() => checkpointUsage(saved, p, { ...meter.current(), attempts: 0 })).toThrow('reset');
    expect(() => checkedUsage({ ...saved, reservedNanoUsd: '0' }, p)).toThrow('mismatch');
  });
  it('serialises duplicate meter instances and fails closed on a stale crash lock', () => {
    const p = paid(), allocation = allocateUsage(undefined, p, { runId: '1', day: '2026-11-02', kind: 'discovery', requests: 2, traces: 0 }, 0).allocations[0], counter = file();
    const first = usageMeter(allocation, p, counter, () => day), second = usageMeter(allocation, p, counter, () => day);
    first.beforeAttempt('eth_getLogs'); second.beforeAttempt('eth_getLogs');
    expect(first.current().attempts).toBe(2); expect(() => first.beforeAttempt('eth_getLogs')).toThrow('exhausted');
    writeFileSync(counter + '.lock', 'synthetic crashed writer');
    expect(() => second.beforeAttempt('eth_getLogs')).toThrow('crashed writer');
    expect(JSON.parse(readFileSync(counter, 'utf8')).attempts).toBe(2);
  });
});

describe('server-only provider selection and fail-closed transport', () => {
  it('never permits prepaid use through the legacy unmetered transport', () => {
    vi.stubEnv('LP_RPC_URL', 'https://synthetic.invalid/credential-not-to-log');
    expect(() => configuredRpc({ policy: paid() })).toThrow('configuration');
    expect(() => configuredRpc({ policy: paid(), beforeAttempt: () => {} })).toThrow('configuration');
  });
  it('selects an explicitly approved server endpoint, counts a 402 once, and exposes safe quota headers only', async () => {
    const p = paid(), allocation = allocateUsage(undefined, p, { runId: '1', day: '2026-11-02', kind: 'discovery', requests: 2, traces: 0 }, 0).allocations[0];
    const meter = usageMeter(allocation, p, file(), () => day), seen: any[] = [];
    vi.stubEnv('LP_RPC_URL', 'https://synthetic.invalid/private-endpoint');
    const transport = vi.fn().mockResolvedValue(new Response('provider body must not be printed', { status: 402, headers: { 'X-Quota-Limit': '10000', 'X-Quota-Remaining': '0', 'X-Quota-Window': 'day', 'X-Other-Private-Header': 'do-not-copy' } })); vi.stubGlobal('fetch', transport);
    const rpc = configuredRpc({ policy: p, beforeAttempt: meter.beforeAttempt, observe: o => seen.push(o) });
    await expect(getPoolLogs(rpc, 1n, 1n)).rejects.toThrow('quota');
    expect(transport).toHaveBeenCalledTimes(1); expect(transport.mock.calls[0][0]).toBe('https://synthetic.invalid/private-endpoint');
    expect(meter.current()).toMatchObject({ attempts: 1, attemptedNanoUsd: '4000' });
    expect(seen).toEqual([{ method: 'eth_getLogs', httpStatus: 402, quotaLimit: 10000, quotaRemaining: 0, quotaWindow: 'day' }]);
    expect(JSON.stringify(seen)).not.toContain('private');
  });
});
