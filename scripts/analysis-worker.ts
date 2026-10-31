import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { configuredRpc, RpcFailure, type Rpc } from '../lib/chain/rpc.js';
import { recoveryBudget } from '../lib/chain/recoveryBudget.js';
import { collectPosition } from '../lib/analysis/collect.js';
import { verifyPosition } from './verify-position.js';
import { promote } from '../lib/analysis/artifact.js';
import { AnalysisLimit, atomicJson, context, exclusive, expire, getJob, heartbeat, jobFolder, jobs, ownerLocal, readJson, reserveRequest, updateJob } from '../lib/analysis/store.js';
import { SERVICE_LIMITS, type AnalysisJob } from '../lib/analysis/types.js';
import { accountingVersion } from '../lib/analysis/version.js';
export async function processJob(job: AnalysisJob, suppliedRpc?: Rpc, wait?: (ms: number) => Promise<void>) {
  const current = context();
  if (JSON.stringify(current) !== JSON.stringify(job.context) || current.accountingVersion !== accountingVersion()) { updateJob(job.key, { status: 'UNSUPPORTED', phase: 'Index/accounting version changed; rebuild and request a current job' }); return; }
  if (job.attempts >= SERVICE_LIMITS.attempts) { updateJob(job.key, { status: 'FAILED', phase: 'Attempt limit reached' }); return; }
  updateJob(job.key, { status: 'RUNNING', attempts: job.attempts + 1, phase: 'Replaying the fixed pool index' });
  const rawRoot = path.join(jobFolder(job.key), 'capture'), rawUrl = pathToFileURL(rawRoot + '/');
  let method = 'offline replay'; const deadline = Date.now() + 15 * 60 * 1000;
  try {
    const rpc = suppliedRpc ?? configuredRpc(), budget = recoveryBudget(SERVICE_LIMITS.jobRequests, 1000, wait);
    const cachedRpc: Rpc = async (m, params) => {
      method = m; if (Date.now() > deadline) throw new AnalysisLimit('FAILED', 'Worker time budget reached; successful checkpoints are retained');
      if (getJob(job.key)?.cancelled) throw new AnalysisLimit('FAILED', 'Owner cancelled analysis');
      const cacheKey = createHash('sha256').update(JSON.stringify([m, params])).digest('hex'), file = path.join(jobFolder(job.key), 'cache', cacheKey + '.json');
      const reusable = !['eth_chainId', 'eth_getBlockByNumber'].includes(m);
      if (reusable && existsSync(file)) { const saved = readJson(file); if (saved.key !== cacheKey || saved.checksum !== createHash('sha256').update(JSON.stringify(saved.result)).digest('hex')) throw new Error('RPC cache integrity mismatch'); return saved.result; }
      const result = await budget.run(async () => { reserveRequest(job.key); return rpc(m, params); });
      if (reusable) atomicJson(file, { key: cacheKey, checksum: createHash('sha256').update(JSON.stringify(result)).digest('hex'), result });
      return result;
    };
    // A captured but not-yet-promoted job is reverified without reacquiring chain data.
    if (!existsSync(path.join(rawRoot, 'config.json'))) await collectPosition(job.id, job.slug, rawUrl, cachedRpc, () => getJob(job.key)!.requests, p => updateJob(job.key, p));
    method = 'independent reconciliation'; updateJob(job.key, { phase: 'Independently reconciling raw storage, withdrawals, receipts and traces' });
    const verified = verifyPosition(job.slug, rawUrl);
    if (getJob(job.key)?.cancelled) throw new AnalysisLimit('FAILED', 'Owner cancelled analysis');
    atomicJson(path.join(rawRoot, 'verification.json'), verified.verification);
    atomicJson(path.join(rawRoot, 'status.json'), { ...readJson<Record<string, unknown>>(path.join(rawRoot, 'status.json')), status: 'VERIFIED', phase: 'Independent reconciliation passed', requests: getJob(job.key)!.requests });
    promote(job.key, verified);
  } catch (e) {
    const state = e instanceof AnalysisLimit ? e.state : e instanceof RpcFailure && e.kind === 'rate' ? 'RATE_LIMITED' : e instanceof Error && /mark|reference/i.test(e.message) ? 'PARTIAL' : 'FAILED';
    const message = e instanceof RpcFailure || e instanceof AnalysisLimit ? e.message : state === 'PARTIAL' ? 'Required historical reference marks are incomplete. Captured token proof is retained; replay publication awaits the missing valuation inputs.' : 'Independent capture/verification failed; replay remains locked. Owner review is required.';
    updateJob(job.key, { status: state, phase: 'Stopped; replay remains locked', error: message, method: e instanceof RpcFailure ? e.method ?? method : method });
    console.error(JSON.stringify({ key: job.key, state, method: e instanceof RpcFailure ? e.method ?? method : method, error: message }));
  }
}
if (process.argv[1]?.endsWith('analysis-worker.ts')) {
  if (!ownerLocal()) throw new Error('Owner-local mode is required; worker is disabled on Vercel');
  const release = exclusive('worker'); let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopping = true; });
  let nextCleanup = Date.now() + 60000;
  const timer = setInterval(() => { heartbeat(); if (Date.now() >= nextCleanup) { try { expire(); } catch { /* An admission write may hold the lock; retry on the next maintenance tick. */ } nextCleanup = Date.now() + 60000; } }, 2000); heartbeat();
  try {
    expire();
    for (const job of jobs().filter(j => j.status === 'RUNNING')) updateJob(job.key, { status: 'QUEUED', phase: 'Owner worker restarted; confirming saved checkpoints before resume' });
    while (!stopping) {
      const job = jobs().find(j => j.status === 'QUEUED');
      if (job) { await processJob(job); console.log(JSON.stringify({ key: job.key, status: getJob(job.key)?.status, requests: getJob(job.key)?.requests })); }
      else await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally { clearInterval(timer); release(); }
}
