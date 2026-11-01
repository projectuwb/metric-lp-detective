// Owner/server only. Monetary counters use integer nanodollars, never floats.
// This module cannot purchase credit, change a subscription or send a payment.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { AnalysisLimit, atomicJson } from './store';
import type { Rpc } from '../chain/rpc';

export interface UsagePolicy {
  schema: 1; id: string; account: string; provider: string; endpointEnv: 'BNB_RPC_URL' | 'LP_RPC_URL';
  mode: 'FREE' | 'PREPAID'; dailyRequests: number; jobRequests: number; traceRequests: number;
  unitPriceNanoUsd: string; usageCapNanoUsd: string; paymentTotalNanoUsd: string;
  externalFeesNanoUsd: string; creditNanoUsd: string;
  hardStopNoOverage: true; automaticTopups: false; recurringCharges: false;
  approval: null | { by: 'projectuwb'; at: string; reference: string; terms: string; settledCreditVerified: true };
  previousPolicyHash?: string;
}
const safeName = (s: unknown): s is string => typeof s === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(s);
const amount = (s: unknown): s is string => typeof s === 'string' && /^(0|[1-9]\d{0,15})$/.test(s);
const count = (n: unknown, max: number): n is number => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= max;
export function checkedPolicy(p: UsagePolicy): UsagePolicy {
  if (!p || p.schema !== 1 || ![p.id, p.account, p.provider].every(safeName) || !['BNB_RPC_URL', 'LP_RPC_URL'].includes(p.endpointEnv) || !['FREE', 'PREPAID'].includes(p.mode) ||
      !count(p.dailyRequests, 10000) || p.dailyRequests < 1 || !count(p.jobRequests, 100) || p.jobRequests < 1 || !count(p.traceRequests, 10) ||
      ![p.unitPriceNanoUsd, p.usageCapNanoUsd, p.paymentTotalNanoUsd, p.externalFeesNanoUsd, p.creditNanoUsd].every(amount) ||
      p.hardStopNoOverage !== true || p.automaticTopups !== false || p.recurringCharges !== false) throw new Error('Invalid or unsafe RPC usage policy');
  const approved = p.approval && p.approval.by === 'projectuwb' && Number.isFinite(Date.parse(p.approval.at)) && /^[a-zA-Z0-9_:#./ -]{1,200}$/.test(p.approval.reference) && typeof p.approval.terms === 'string' && p.approval.terms.length > 0 && p.approval.terms.length <= 200 && p.approval.settledCreditVerified === true;
  if ((p.mode === 'PREPAID' || p.dailyRequests > 100 || p.endpointEnv !== 'BNB_RPC_URL') && !approved) throw new Error('Explicit owner approval and verified account terms required; no RPC authorised');
  if (BigInt(p.paymentTotalNanoUsd) + BigInt(p.externalFeesNanoUsd) >= 10_000_000_000n || BigInt(p.creditNanoUsd) > BigInt(p.paymentTotalNanoUsd) || BigInt(p.usageCapNanoUsd) > BigInt(p.creditNanoUsd)) throw new Error('RPC pilot exceeds strict all-in sub-$10 or settled-credit ceiling');
  if (p.mode === 'FREE' && [p.unitPriceNanoUsd, p.usageCapNanoUsd, p.paymentTotalNanoUsd, p.externalFeesNanoUsd, p.creditNanoUsd].some(s => s !== '0')) throw new Error('Free policy cannot authorise any provider charge');
  if (p.mode === 'PREPAID' && (BigInt(p.unitPriceNanoUsd) === 0n || BigInt(p.usageCapNanoUsd) === 0n)) throw new Error('Prepaid price and usable credit must be confirmed');
  return p;
}
export function usagePolicy() { return checkedPolicy(JSON.parse(readFileSync(process.env.LP_RPC_POLICY_FILE ?? 'config/rpc-usage-policy.json', 'utf8'))); }
export const policyHash = (p: UsagePolicy) => createHash('sha256').update(JSON.stringify(checkedPolicy(p))).digest('hex');
export interface UsageAllocation {
  runId: string; day: string; kind: 'analysis' | 'discovery' | 'probe'; requests: number; traces: number;
  reservedNanoUsd: string; attempts: number; traceAttempts: number; attemptedNanoUsd: string;
  methods: Record<string, number>; checkpointed: boolean;
  unitPriceNanoUsd: string;
}
export interface UsageLedger { schema: 1; account: string; policyHash: string; reservedNanoUsd: string; allocations: UsageAllocation[] }
export function checkedUsage(ledger: UsageLedger, p?: UsagePolicy) {
  if (!ledger || ledger.schema !== 1 || !safeName(ledger.account) || !/^[a-f0-9]{64}$/.test(ledger.policyHash) || !amount(ledger.reservedNanoUsd) || !Array.isArray(ledger.allocations) || ledger.allocations.length > 10000) throw new Error('Invalid durable RPC usage ledger');
  let total = 0n; const runs = new Set<string>();
  for (const a of ledger.allocations) {
    if (!/^\d{1,20}$/.test(a.runId) || runs.has(a.runId) || !/^\d{4}-\d{2}-\d{2}$/.test(a.day) || !['analysis', 'discovery', 'probe'].includes(a.kind) || !count(a.requests, 100) || a.requests < 1 || !count(a.traces, 10) || a.traces > a.requests || !count(a.attempts, a.requests) || !count(a.traceAttempts, a.traces) || !amount(a.reservedNanoUsd) || !amount(a.attemptedNanoUsd) || !amount(a.unitPriceNanoUsd) || BigInt(a.reservedNanoUsd) !== BigInt(a.unitPriceNanoUsd) * BigInt(a.requests) || BigInt(a.attemptedNanoUsd) !== BigInt(a.unitPriceNanoUsd) * BigInt(a.attempts) || typeof a.checkpointed !== 'boolean' || !a.methods || Object.entries(a.methods).some(([k, v]) => !/^(eth_[A-Za-z0-9]+|debug_traceTransaction)$/.test(k) || !count(v, a.requests)) || Object.values(a.methods).reduce((n, v) => n + v, 0) !== a.attempts || (a.methods.debug_traceTransaction ?? 0) !== a.traceAttempts) throw new Error('Invalid RPC allocation/counters; refusing requests');
    total += BigInt(a.reservedNanoUsd); runs.add(a.runId);
  }
  if (total !== BigInt(ledger.reservedNanoUsd)) throw new Error('Cumulative RPC cost ledger mismatch');
  if (p && (ledger.account !== p.account || ledger.policyHash !== policyHash(p) || total > BigInt(p.usageCapNanoUsd))) throw new Error('RPC account, price, approval or cumulative cost changed; explicit migration required');
  return ledger;
}
export function allocateUsage(previous: UsageLedger | undefined, p: UsagePolicy, allocation: Pick<UsageAllocation, 'runId' | 'day' | 'kind' | 'requests' | 'traces'>, dailyAlreadyReserved: number) {
  checkedPolicy(p);
  const ledger: UsageLedger = structuredClone(previous ?? { schema: 1, account: p.account, policyHash: policyHash(p), reservedNanoUsd: '0', allocations: [] });
  checkedUsage(ledger);
  if (ledger.policyHash !== policyHash(p) && p.approval && p.previousPolicyHash === ledger.policyHash && ledger.reservedNanoUsd === '0') {
    // A future, explicitly approved Free -> prepaid transition preserves all
    // prior request allocations and prices. Paid counters cannot be reset or
    // moved to a fresh account by changing configuration.
    ledger.policyHash = policyHash(p); ledger.account = p.account;
  }
  checkedUsage(ledger, p);
  const sameDay = ledger.allocations.filter(a => a.day === allocation.day);
  if (sameDay.reduce((n, a) => n + a.traces, 0) + allocation.traces > p.traceRequests || allocation.kind === 'analysis' && sameDay.filter(a => a.kind === 'analysis').length >= 2) throw new AnalysisLimit('RATE_LIMITED', 'Combined daily trace or analysis-job allowance exhausted; no request sent');
  if (!count(dailyAlreadyReserved, 10000) || !count(allocation.requests, p.jobRequests) || allocation.requests < 1 || !count(allocation.traces, p.traceRequests) || allocation.traces > allocation.requests || dailyAlreadyReserved + allocation.requests > p.dailyRequests) throw new AnalysisLimit('RATE_LIMITED', 'Combined daily RPC reservation exhausted; no request sent');
  const cost = BigInt(allocation.requests) * BigInt(p.unitPriceNanoUsd);
  if (BigInt(ledger.reservedNanoUsd) + cost > BigInt(p.usageCapNanoUsd)) throw new AnalysisLimit('RATE_LIMITED', 'Prepaid RPC spending ceiling exhausted; no request sent');
  ledger.allocations.push({ ...allocation, unitPriceNanoUsd: p.unitPriceNanoUsd, reservedNanoUsd: String(cost), attempts: 0, traceAttempts: 0, attemptedNanoUsd: '0', methods: {}, checkpointed: false });
  ledger.reservedNanoUsd = String(BigInt(ledger.reservedNanoUsd) + cost);
  return checkedUsage(ledger, p);
}
export function usageMeter(allocation: UsageAllocation, p: UsagePolicy, file: string, now = () => new Date()) {
  checkedPolicy(p); let saved: UsageAllocation;
  const locked = <T>(work: () => T): T => {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); let fd: number;
    try { fd = openSync(file + '.lock', 'wx', 0o600); } catch { throw new AnalysisLimit('RATE_LIMITED', 'RPC counter lock is active or left by a crashed writer; no request sent. Reserved costs remain consumed.'); }
    try { return work(); } finally { closeSync(fd); unlinkSync(file + '.lock'); }
  };
  const load = () => {
    const current: UsageAllocation = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : structuredClone(allocation);
    if (['runId', 'day', 'kind', 'requests', 'traces', 'reservedNanoUsd', 'unitPriceNanoUsd'].some(k => current[k as keyof UsageAllocation] !== allocation[k as keyof UsageAllocation]) || current.attempts < allocation.attempts || saved && current.attempts < saved.attempts) throw new Error('Attempt record does not match this durable reservation or reset counters');
    checkedUsage({ schema: 1, account: p.account, policyHash: policyHash(p), reservedNanoUsd: current.reservedNanoUsd, allocations: [current] }, p);
    if (current.reservedNanoUsd !== String(BigInt(current.requests) * BigInt(p.unitPriceNanoUsd))) throw new Error('Allocation does not match locked provider price');
    return current;
  };
  locked(() => { saved = load(); atomicJson(file, saved); });
  const beforeAttempt = (method: string) => locked(() => {
    saved = load();
    if (!/^(eth_[A-Za-z0-9]+|debug_traceTransaction)$/.test(method)) throw new Error('Unknown read-only RPC method');
    if (now().toISOString().slice(0, 10) !== saved.day || saved.attempts >= saved.requests || method === 'debug_traceTransaction' && saved.traceAttempts >= saved.traces) throw new AnalysisLimit('RATE_LIMITED', 'RPC attempt, trace or UTC-day allocation exhausted; no further RPC sent');
    saved.attempts++; saved.traceAttempts += Number(method === 'debug_traceTransaction'); saved.methods[method] = (saved.methods[method] ?? 0) + 1;
    saved.attemptedNanoUsd = String(BigInt(saved.attempts) * BigInt(p.unitPriceNanoUsd));
    // Persist before transport, including timeouts/errors. Lost runner progress
    // still consumes the entire remote reservation, never an inferred refund.
    atomicJson(file, saved);
  });
  return { beforeAttempt, current: () => locked(() => { saved = load(); return structuredClone(saved); }), wrap: (rpc: Rpc): Rpc => async (method, params) => { beforeAttempt(method); return rpc(method, params); } };
}
export function usageSummary(ledger: UsageLedger, p: UsagePolicy) {
  checkedUsage(ledger, p);
  return { account: p.account, mode: p.mode, reservedNanoUsd: ledger.reservedNanoUsd, remainingNanoUsd: String(BigInt(p.usageCapNanoUsd) - BigInt(ledger.reservedNanoUsd)), attemptsRecorded: ledger.allocations.reduce((n, a) => n + a.attempts, 0), reservationsAreUpperBounds: true, automaticTopups: false };
}
export function checkpointUsage(ledger: UsageLedger, p: UsagePolicy, current: UsageAllocation) {
  checkedUsage(ledger, p);
  const index = ledger.allocations.findIndex(a => a.runId === current.runId), prior = ledger.allocations[index];
  if (!prior || ['day', 'kind', 'requests', 'traces', 'reservedNanoUsd', 'unitPriceNanoUsd'].some(k => prior[k as keyof UsageAllocation] !== current[k as keyof UsageAllocation]) || current.attempts < prior.attempts || current.traceAttempts < prior.traceAttempts) throw new Error('RPC attempt checkpoint changed its reservation or reset counters');
  ledger.allocations[index] = { ...current, checkpointed: true };
  return checkedUsage(ledger, p);
}
export function formatNanoUsd(value: string) { const n = BigInt(value); return '$' + n / 1_000_000_000n + '.' + String(n % 1_000_000_000n).padStart(9, '0'); }
