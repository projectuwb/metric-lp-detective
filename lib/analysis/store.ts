import { readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync, rmSync, existsSync, statSync, openSync, closeSync, fsyncSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { keccak256, toBytes } from 'viem';
import { positionIdentity } from '../domain/position';
import { SERVICE_LIMITS, type AnalysisContext, type AnalysisJob } from './types';
export const storeRoot = () => path.resolve(/* turbopackIgnore: true */ process.env.LP_ANALYSIS_DIR ?? 'artifacts/analysis-beta');
export const ownerLocal = () => process.env.LP_ANALYSIS_MODE === 'owner-local' && !process.env.VERCEL;
export const readJson = <T = any>(file: string): T => JSON.parse(readFileSync(file, 'utf8'));
export function atomicJson(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = file + '.' + randomUUID() + '.tmp', fd = openSync(temporary, 'wx', 0o600);
  try { writeFileSync(fd, JSON.stringify(value, (_, v) => typeof v === 'bigint' ? String(v) : v, 2)); fsyncSync(fd); }
  finally { closeSync(fd); }
  renameSync(temporary, file);
}
export function context(): AnalysisContext { return readJson(path.join(process.cwd(), '.web-data/context.json')); }
export function jobKey(id: string, c: AnalysisContext) { return createHash('sha256').update(JSON.stringify([1, c.chainId, c.pool.toLowerCase(), positionIdentity(id), c.indexEndHash, c.sourceHash, c.accountingVersion])).digest('hex'); }
export function jobFolder(key: string) { if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid job identifier'); return path.join(storeRoot(), 'jobs', key); }
const fileFor = (key: string) => path.join(jobFolder(key), 'job.json');
export function getJob(key: string): AnalysisJob | null {
  const file = fileFor(key); if (!existsSync(file)) return null;
  const job = readJson<AnalysisJob>(file);
  return Date.parse(job.expiresAt) > Date.now() ? job : null;
}
function processInfo(pid: number) {
  try { const stat = readFileSync('/proc/' + pid + '/stat', 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).split(' '); } catch { return null; }
}
export function isAlive(pid: number, start?: string) {
  const info = processInfo(pid); if (info && (info[0] === 'Z' || start && info[19] !== start)) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code !== 'ESRCH'; }
}
export function exclusive(name: string) {
  const lock = path.join(storeRoot(), name + '.lock'); mkdirSync(storeRoot(), { recursive: true, mode: 0o700 });
  if (existsSync(lock)) {
    const owner = path.join(lock, 'owner.json');
    const saved = existsSync(owner) ? readJson(owner) : null;
    if (saved ? !isAlive(saved.pid, saved.start) : Date.now() - statSync(lock).mtimeMs > 10000) rmSync(lock, { recursive: true, force: true });
  }
  mkdirSync(lock); atomicJson(path.join(lock, 'owner.json'), { pid: process.pid, start: processInfo(process.pid)?.[19] });
  return () => rmSync(lock, { recursive: true, force: true });
}
function locked<T>(work: () => T): T { const release = exclusive('mutation'); try { return work(); } finally { release(); } }
function daily() {
  const file = path.join(storeRoot(), 'budget.json'), day = new Date().toISOString().slice(0, 10);
  const old = existsSync(file) ? readJson(file) : null;
  return old?.day === day ? old as { day: string; issued: number; jobs: number } : { day, issued: 0, jobs: 0 };
}
export class AnalysisLimit extends Error { constructor(public state: 'RATE_LIMITED' | 'UNSUPPORTED' | 'FAILED', message: string) { super(message); } }
export function submit(id: string, c = context()) {
  id = positionIdentity(id); const key = jobKey(id, c);
  return locked(() => {
    const previous = getJob(key); if (previous) return { job: previous, created: false };
    const budget = daily();
    if (budget.jobs >= SERVICE_LIMITS.dailyJobs || budget.issued >= SERVICE_LIMITS.dailyRequests) throw new AnalysisLimit('RATE_LIMITED', 'Owner beta daily quota reached; no new request saved.');
    const now = new Date().toISOString();
    const job: AnalysisJob = { key, id, slug: keccak256(toBytes(id)).slice(2, 18), context: c, status: 'QUEUED', phase: 'Persisted; awaiting the owner worker', createdAt: now, updatedAt: now, expiresAt: new Date(Date.now() + 86400000).toISOString(), attempts: 0, requests: 0, completedCheckpoints: 0, totalCheckpoints: 0 };
    // Budget admission is reserved first: a crash can under-admit, never over-admit.
    atomicJson(path.join(storeRoot(), 'budget.json'), { ...budget, jobs: budget.jobs + 1 });
    // Expired requests are a fresh job, not an unnoticed reuse of expired proof/cache.
    rmSync(jobFolder(key), { recursive: true, force: true }); atomicJson(fileFor(key), job);
    return { job, created: true };
  });
}
export function updateJob(key: string, change: Partial<AnalysisJob>) {
  return locked(() => { const job = getJob(key); if (!job) throw new Error('Job expired or absent');
    if (change.status === 'VERIFIED' && job.cancelled) throw new AnalysisLimit('FAILED', 'Cancelled job cannot be promoted');
    const next = { ...job, ...change, key: job.key, id: job.id, context: job.context, updatedAt: new Date().toISOString() }; atomicJson(fileFor(key), next); return next; });
}
export function reserveRequest(key: string) {
  return locked(() => {
    const job = getJob(key); if (!job || job.cancelled) throw new AnalysisLimit('FAILED', 'Analysis cancelled or expired');
    const budget = daily();
    if (job.requests >= SERVICE_LIMITS.jobRequests || budget.issued >= SERVICE_LIMITS.dailyRequests) throw new AnalysisLimit('RATE_LIMITED', 'Persistent job/day RPC budget exhausted. No request sent.');
    atomicJson(path.join(storeRoot(), 'budget.json'), { ...budget, issued: budget.issued + 1 });
    atomicJson(fileFor(key), { ...job, requests: job.requests + 1, updatedAt: new Date().toISOString() });
    return job.requests + 1;
  });
}
export function retryJob(key: string) {
  const job = getJob(key); if (!job || !['PARTIAL', 'FAILED', 'RATE_LIMITED'].includes(job.status)) throw new Error('This job cannot be retried');
  if (job.requests >= SERVICE_LIMITS.jobRequests || job.attempts >= SERVICE_LIMITS.attempts || daily().issued >= SERVICE_LIMITS.dailyRequests) throw new AnalysisLimit('RATE_LIMITED', 'Remaining persistent request/attempt budget is exhausted');
  return updateJob(key, { status: 'QUEUED', phase: 'Owner requested bounded retry; successful checkpoints retained', cancelled: false, error: undefined });
}
export function jobs() {
  const dir = path.join(storeRoot(), 'jobs'); if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(k => /^[a-f0-9]{64}$/.test(k)).map(getJob).filter((j): j is AnalysisJob => !!j).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
export function expire() {
  return locked(() => { const dir = path.join(storeRoot(), 'jobs'); if (!existsSync(dir)) return;
    for (const key of readdirSync(dir).filter(k => /^[a-f0-9]{64}$/.test(k))) if (!getJob(key)) rmSync(jobFolder(key), { recursive: true, force: true }); });
}
export function heartbeat() { atomicJson(path.join(storeRoot(), 'heartbeat.json'), { at: Date.now(), pid: process.pid }); }
export function workerOnline() { const file = path.join(storeRoot(), 'heartbeat.json'); if (!existsSync(file)) return false; const h = readJson(file); return Date.now() - h.at < 30000 && isAlive(h.pid); }
