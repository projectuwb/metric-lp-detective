// Trusted GitHub Actions control plane only. Never imported by a web route.
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { positionIdentity } from '../domain/position';
import { SERVICE_LIMITS, type AnalysisContext } from './types';
import { jobKey, AnalysisLimit } from './store';
import type { Rpc } from '../chain/rpc';

export const REPOSITORY = 'projectuwb/metric-lp-detective';
export const STATE_BRANCH = 'codex/analysis-worker-state';
export const WORKFLOW = 'owner-analysis.yml';
export interface RunIdentity { repository: string; actor: string; ref: string; event: string; runId: string; attempt: string; sha: string }
export function authorizeRun(run: RunIdentity) {
  if (run.repository !== REPOSITORY || run.actor !== 'projectuwb' || run.ref !== 'refs/heads/main' || run.event !== 'workflow_dispatch' || run.attempt !== '1' || !/^\d{1,20}$/.test(run.runId) || !/^[a-f0-9]{40}$/.test(run.sha)) {
    throw new Error('Only the repository owner may dispatch the trusted main workflow. Use a new dispatch, not Re-run jobs.');
  }
}
export const contextHash = (c: AnalysisContext) => createHash('sha256').update(JSON.stringify(c)).digest('hex');
export function reservationRpc(rpc: Rpc, day: string, now = () => new Date()): Rpc {
  return (method, params) => {
    if (now().toISOString().slice(0, 10) !== day) throw new AnalysisLimit('RATE_LIMITED', 'UTC reservation day ended; no further RPC sent');
    return rpc(method, params);
  };
}
export interface Reservation { day: string; runId: string; key: string; requests: number }
export interface Snapshot { runId: string; key: string; contextHash: string; expiresAt: string; sha256: string; gzip: string }
export interface RemoteState { schema: 1; reservations: Reservation[]; snapshot?: Snapshot }
const hash = (v: string) => /^[a-f0-9]{64}$/.test(v);
export function checkedState(value: unknown): RemoteState {
  const s = value as RemoteState;
  if (!s || s.schema !== 1 || !Array.isArray(s.reservations) || s.reservations.length > 100 || s.reservations.some(r => !/^\d{4}-\d{2}-\d{2}$/.test(r.day) || !/^\d{1,20}$/.test(r.runId) || !hash(r.key) || r.requests !== SERVICE_LIMITS.jobRequests)) throw new Error('Remote budget ledger invalid; refusing all RPC work');
  if (new Set(s.reservations.map(r => r.runId)).size !== s.reservations.length) throw new Error('Duplicate remote reservation');
  if (s.snapshot && (!hash(s.snapshot.key) || !hash(s.snapshot.sha256) || !hash(s.snapshot.contextHash) || !/^\d{1,20}$/.test(s.snapshot.runId) || !Number.isFinite(Date.parse(s.snapshot.expiresAt)) || typeof s.snapshot.gzip !== 'string' || s.snapshot.gzip.length > 24_000_000)) throw new Error('Remote checkpoint envelope invalid');
  return s;
}
export function reserveRun(state: RemoteState, runId: string, key: string, now = new Date()): RemoteState {
  checkedState(state);
  if (!hash(key) || !/^\d{1,20}$/.test(runId)) throw new Error('Invalid reservation identity');
  const day = now.toISOString().slice(0, 10);
  if (state.reservations.some(r => r.runId === runId) || state.reservations.filter(r => r.day === day).reduce((n, r) => n + r.requests, 0) + SERVICE_LIMITS.jobRequests > SERVICE_LIMITS.dailyRequests) throw new Error('Daily RPC allowance already reserved. No RPC sent; dispatch on the next UTC day.');
  // Reserve the entire allowance before the first request. No refunds, even on cancellation.
  return { ...state, reservations: [...state.reservations.filter(r => r.day >= new Date(now.getTime() - 8 * 86400000).toISOString().slice(0, 10)), { day, runId, key, requests: SERVICE_LIMITS.jobRequests }] };
}

export interface GitHub { request(method: string, route: string, body?: unknown): Promise<any> }
export function github(token = process.env.GH_TOKEN): GitHub {
  if (!token) throw new Error('Missing Actions token; no RPC work authorized');
  return { async request(method, route, body) {
    if (!route.startsWith(`/repos/${REPOSITORY}/`)) throw new Error('GitHub route outside the one repository');
    let response: Response;
    try { response = await fetch('https://api.github.com' + route, { method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error(`GitHub ${method} ${route.split('?')[0]}: network error (details redacted)`); }
    if (response.status === 404 && method === 'GET' && route === `/repos/${REPOSITORY}/git/ref/heads/${STATE_BRANCH}`) return null;
    if (!response.ok) throw new Error(`GitHub ${method} ${route.split('?')[0]}: HTTP ${response.status} (body redacted)`);
    if (response.status === 204) return { accepted: true };
    try { return await response.json(); } catch { throw new Error('Invalid GitHub response (details redacted)'); }
  } };
}
const base = `/repos/${REPOSITORY}`;
export async function loadState(api: GitHub): Promise<{ state: RemoteState; head: string | null }> {
  const ref = await api.request('GET', base + '/git/ref/heads/' + STATE_BRANCH);
  if (!ref) return { state: { schema: 1, reservations: [] }, head: null };
  const head = ref.object.sha, commit = await api.request('GET', base + '/git/commits/' + head);
  const tree = await api.request('GET', base + '/git/trees/' + commit.tree.sha);
  const file = tree?.tree?.find((f: any) => f.path === 'state.json' && f.type === 'blob' && f.mode === '100644');
  if (!file || tree.truncated) throw new Error('Remote state branch malformed; refusing all RPC work');
  const blob = await api.request('GET', base + '/git/blobs/' + file.sha);
  if (blob?.encoding !== 'base64' || blob.size > 32_000_000) throw new Error('Remote state blob invalid');
  return { state: checkedState(JSON.parse(Buffer.from(blob.content, 'base64').toString())), head };
}
export async function saveState(api: GitHub, state: RemoteState, head: string | null, message: string) {
  const blob = await api.request('POST', base + '/git/blobs', { content: JSON.stringify(checkedState(state)), encoding: 'utf-8' });
  const tree = await api.request('POST', base + '/git/trees', { tree: [{ path: 'state.json', mode: '100644', type: 'blob', sha: blob.sha }] });
  const commit = await api.request('POST', base + '/git/commits', { message, tree: tree.sha, parents: head ? [head] : [] });
  if (head) await api.request('PATCH', base + '/git/refs/heads/' + STATE_BRANCH, { sha: commit.sha, force: false });
  else await api.request('POST', base + '/git/refs', { ref: 'refs/heads/' + STATE_BRANCH, sha: commit.sha });
  // Confirm durable publication before granting access to the RPC secret.
  const confirmed = await api.request('GET', base + '/git/ref/heads/' + STATE_BRANCH);
  if (confirmed?.object?.sha !== commit.sha) throw new Error('Remote reservation lost a race; no RPC work authorized');
  return commit.sha as string;
}

const allowed = /^(?:job\.json|capture\/(?:capture-context|config|states|marks|quotes|status|verification)\.json|capture\/receipts\/0x[a-f0-9]{64}\.json|capture\/traces\/0x[a-f0-9]{64}\.json\.gz|cache\/[a-f0-9]{64}\.json)$/;
export function snapshot(folder: string, key: string, c: AnalysisContext, runId: string, expiresAt: string): Snapshot {
  const files: Record<string, string> = {};
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name), name = path.relative(folder, file).split(path.sep).join('/');
      if (entry.isSymbolicLink()) throw new Error('Checkpoint symlink rejected');
      if (entry.isDirectory()) { if (name !== 'replay' && !name.endsWith('.pending')) walk(file); }
      else if (allowed.test(name) && lstatSync(file).isFile()) files[name] = readFileSync(file).toString('base64');
    }
  }
  walk(folder);
  const raw = Buffer.from(JSON.stringify(files));
  if (raw.length > 32_000_000) throw new Error('Checkpoint size limit reached');
  // Public chain inputs only. Scan known secrets AND URL credential components.
  rejectSecrets(raw.toString());
  for (const [name, content] of Object.entries(files)) rejectSecrets((name.endsWith('.gz') ? gunzipSync(Buffer.from(content, 'base64'), { maxOutputLength: 8_000_000 }) : Buffer.from(content, 'base64')).toString());
  return { runId, key, contextHash: contextHash(c), expiresAt, sha256: createHash('sha256').update(raw).digest('hex'), gzip: gzipSync(raw).toString('base64') };
}
export function rejectSecrets(text: string) {
  const secrets = Object.entries(process.env).filter(([name, value]) => value && value.length >= 12 && /(?:TOKEN|SECRET|PASSWORD|RPC_URL|API_KEY)$/.test(name)).map(([, value]) => value!);
  try { const u = new URL(process.env.BNB_RPC_URL ?? 'https://example.invalid'); secrets.push(...[...u.searchParams.values(), ...u.pathname.split('/'), u.username, u.password].filter(v => v.length >= 8)); } catch { throw new Error('Invalid RPC configuration (redacted)'); }
  if (secrets.some(s => text.includes(s)) || /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b|-----BEGIN (?:\w+ )?PRIVATE KEY-----/.test(text)) throw new Error('Credential scan rejected checkpoint (matching data redacted)');
}
export function restoreSnapshot(s: Snapshot, folder: string, key: string, c: AnalysisContext, now = Date.now()) {
  if (s.key !== key || s.contextHash !== contextHash(c) || Date.parse(s.expiresAt) <= now) throw new Error('Checkpoint expired or belongs to another position/index/accounting version');
  const raw = gunzipSync(Buffer.from(s.gzip, 'base64'), { maxOutputLength: 32_000_000 });
  if (createHash('sha256').update(raw).digest('hex') !== s.sha256) throw new Error('Checkpoint checksum mismatch');
  const files = JSON.parse(raw.toString());
  if (!files || typeof files !== 'object' || Array.isArray(files) || Object.keys(files).length > 500 || !Object.hasOwn(files, 'job.json') || existsSync(folder)) throw new Error('Invalid checkpoint contents or nonempty destination');
  const decoded = Object.entries(files).map(([name, data]) => {
    if (!allowed.test(name) || typeof data !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error('Unsafe checkpoint path/content');
    const bytes = Buffer.from(data, 'base64');
    // Parse public JSON now; reject corrupted compressed inputs before any write.
    const text = (name.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 8_000_000 }) : bytes).toString(); JSON.parse(text); rejectSecrets(text);
    return [name, bytes] as const;
  });
  const job = JSON.parse(decoded.find(([name]) => name === 'job.json')![1].toString());
  if (job.key !== key || job.id !== positionIdentity(job.id) || jobKey(job.id, c) !== key || !/^[a-f0-9]{16}$/.test(job.slug) || contextHash(job.context) !== contextHash(c) || !Number.isSafeInteger(job.requests) || job.requests < 0 || job.requests > 100 || !Number.isSafeInteger(job.attempts) || job.attempts < 0 || job.attempts >= 3 || Date.parse(job.expiresAt) <= now || Date.parse(job.expiresAt) > now + 86400000) throw new Error('Checkpoint job identity/budget/expiry invalid');
  for (const [name, bytes] of decoded) { const file = path.join(folder, name); mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 }); writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 }); }
}
