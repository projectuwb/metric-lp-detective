import { existsSync, readFileSync, renameSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReplayBundle } from './bundle';
import { atomicJson, context, getJob, jobFolder, jobs, ownerLocal, readJson, updateJob } from './store';
import type { verifyPosition } from '../../scripts/verify-position';
import type { ReplayMeta, ReplayEvent } from '../domain/web';
const digest = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
export function promote(key: string, verified: ReturnType<typeof verifyPosition>) {
  const job = getJob(key); if (!job || job.cancelled) throw new Error('Job cancelled or absent');
  if (verified.config.id !== job.id || verified.config.indexEndHash !== job.context.indexEndHash || verified.config.sourceHash !== job.context.sourceHash) throw new Error('Verified artifact/job identity mismatch');
  const folder = jobFolder(key), pending = path.join(folder, 'pending-replay'), target = path.join(folder, 'replay');
  const marks = verified.marks.filter((m: any) => m.result).map((m: any) => ({ block: m.block, blockHash: m.blockHash, timestamp: m.timestamp, referenceX64: m.referenceX64, kind: 'BLOCK_END' as const }));
  const { metadata, pages } = createReplayBundle(job.id, 'Owner-verified position · ' + verified.verification.swaps + ' swaps', verified.replay, marks, { poolIndex: job.context.sourceHash, jobKey: key }, '126502643', job.context.indexEnd, 236);
  if (existsSync(target)) {
    // Recover a crash between atomic bundle rename and status promotion, without overwriting.
    const manifest = readJson(path.join(target, 'integrity.json'));
    if (manifest.key !== key || manifest.id !== job.id || JSON.stringify(readJson(path.join(target, 'metadata.json'))) !== JSON.stringify(metadata)) throw new Error('Existing immutable bundle differs from independently verified replay');
    for (const [i, page] of pages.entries()) if (JSON.stringify(readJson(path.join(target, 'events-' + i + '.json'))) !== JSON.stringify(page)) throw new Error('Existing bundle page mismatch');
    for (const [file, hash] of Object.entries(manifest.files)) if (!/^(metadata|events-\d+)\.json$/.test(file) || digest(readFileSync(path.join(target, file))) !== hash) throw new Error('Existing immutable bundle checksum mismatch');
    updateJob(key, { status: 'VERIFIED', phase: 'Recovered verified immutable replay', verification: verified.verification, bundleHash: digest(readFileSync(path.join(target, 'integrity.json'))), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), error: undefined }); return;
  }
  rmSync(pending, { recursive: true, force: true }); mkdirSync(pending, { recursive: true });
  const files: Record<string, string> = {};
  const save = (name: string, value: unknown) => { const file = path.join(pending, name); atomicJson(file, value); files[name] = digest(readFileSync(file)); };
  save('metadata.json', metadata); for (const [i, page] of pages.entries()) save('events-' + i + '.json', page);
  atomicJson(path.join(pending, 'integrity.json'), { schema: 1, key, id: job.id, context: job.context, files });
  const bundleHash = digest(readFileSync(path.join(pending, 'integrity.json')));
  if (getJob(key)?.cancelled) throw new Error('Analysis cancelled before promotion');
  renameSync(pending, target);
  updateJob(key, { status: 'VERIFIED', phase: 'Independent reconciliation passed; immutable replay available', verification: verified.verification, bundleHash, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), error: undefined });
}
export function runtimeJobs() {
  if (!ownerLocal()) return [];
  const c = context();
  return jobs().filter(j => j.status === 'VERIFIED' && !j.cancelled && j.context.accountingVersion === c.accountingVersion && j.context.indexEndHash === c.indexEndHash && j.context.sourceHash === c.sourceHash);
}
function verifiedJob(id: string) { return runtimeJobs().find(j => j.id === id) ?? null; }
function readChecked<T>(key: string, file: string): T {
  const job = getJob(key), root = path.join(jobFolder(key), 'replay');
  if (!job || job.status !== 'VERIFIED') throw new Error('Replay is not verified');
  const bytes = readFileSync(path.join(root, 'integrity.json'));
  if (digest(bytes) !== job.bundleHash) throw new Error('Replay manifest checksum mismatch');
  const manifest = JSON.parse(bytes.toString());
  if (manifest.key !== key || manifest.id !== job.id || !/^(metadata|events-\d+)\.json$/.test(file)) throw new Error('Replay manifest identity mismatch');
  const value = readFileSync(path.join(root, file)); if (digest(value) !== manifest.files[file]) throw new Error('Replay page checksum mismatch');
  return JSON.parse(value.toString()) as T;
}
export function runtimeMeta(id: string) { const job = verifiedJob(id); return job ? readChecked<ReplayMeta>(job.key, 'metadata.json') : null; }
export function runtimePage(id: string, page: number) { const job = verifiedJob(id); return job ? readChecked<ReplayEvent[]>(job.key, 'events-' + page + '.json') : null; }
export function runtimeVerified(id: string) { return !!verifiedJob(id); }
