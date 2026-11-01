import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { authorizeRun, reserveRun, requireResume, checkedState, github, loadState, saveState, snapshot, restoreSnapshot, rejectSecrets, reservationRpc, type GitHub, type Snapshot } from '../lib/analysis/remote';
import { atomicJson, context, submit, jobFolder, readJson } from '../lib/analysis/store';
import { SMALL_SAMPLE_ID } from '../lib/domain/samples';
const folders: string[] = [];
const temporary = () => { const dir = mkdtempSync(path.join(os.tmpdir(), 'metric-remote-test-')); folders.push(dir); return dir; };
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const owner = { repository: 'projectuwb/metric-lp-detective', actor: 'projectuwb', ref: 'refs/heads/main', event: 'workflow_dispatch', runId: '123456789', attempt: '1', sha: 'a'.repeat(40) };
it('admits only an owner dispatch of trusted main, never forks, PRs, other actors or reruns', () => {
  expect(() => authorizeRun(owner)).not.toThrow();
  for (const change of [{ actor: 'visitor' }, { repository: 'other/repo' }, { ref: 'refs/heads/codex/untrusted' }, { event: 'pull_request_target' }, { attempt: '2' }, { runId: '$(command)' }, { sha: '../main' }]) expect(() => authorizeRun({ ...owner, ...change })).toThrow();
});
it('reserves all 100 daily attempts durably, across jobs/retries/cancellation, with no refund', () => {
  const dir = temporary(), file = path.join(dir, 'state.json'), key = 'a'.repeat(64), day = new Date('2026-10-31T23:59:00Z');
  const reserved = reserveRun({ schema: 1, reservations: [] }, '1', key, day); atomicJson(file, reserved);
  // Simulate a different ephemeral runner, not an in-memory rate limiter.
  expect(() => reserveRun(readJson(file), '2', 'b'.repeat(64), day)).toThrow('Daily RPC');
  expect(() => reserveRun(readJson(file), '1', key, new Date('2026-11-01'))).toThrow();
  expect(reserveRun(readJson(file), '2', key, new Date('2026-11-01')).reservations).toHaveLength(2);
  expect(() => checkedState({ ...reserved, reservations: [{ ...reserved.reservations[0], requests: 1 }] })).toThrow();
});
it('confirms the remote commit before RPC admission and never force-updates state', async () => {
  const calls: { method: string; route: string; body: any }[] = [];
  let head: string | null = null, corrupt = false, stored: any;
  const api: GitHub = { async request(method, route, body: any) {
    calls.push({ method, route, body });
    if (method === 'GET' && route.includes('/git/ref/')) return head ? { object: { sha: corrupt ? 'raced' : head } } : null;
    if (route.includes('/git/blobs')) { if (method === 'POST') { stored = body.content; return { sha: 'blob' }; } return { encoding: 'base64', size: stored.length, content: Buffer.from(stored).toString('base64') }; }
    if (route.includes('/git/trees')) return method === 'POST' ? { sha: 'tree' } : { tree: [{ path: 'state.json', type: 'blob', mode: '100644', sha: 'blob' }] };
    if (route.includes('/git/commits')) return method === 'POST' ? { sha: head ? 'second' : 'first' } : { tree: { sha: 'tree' } };
    if (route.includes('/git/refs')) { head = body.sha; return {}; }
    throw new Error('Unexpected mocked control-plane operation');
  } };
  const initial = await loadState(api); expect(initial.head).toBeNull();
  const state = reserveRun(initial.state, '1', 'a'.repeat(64));
  expect(await saveState(api, state, null, 'reservation')).toBe('first');
  expect((await loadState(api)).state).toEqual(state);
  expect(await saveState(api, state, 'first', 'checkpoint')).toBe('second');
  expect(calls.find(c => c.method === 'PATCH')?.body.force).toBe(false);
  corrupt = true;
  await expect(saveState(api, state, 'second', 'raced')).rejects.toThrow('lost a race');
});
it('cannot reset a live job across UTC days or reuse a checkpoint from before a lost attempt', () => {
  const key = 'a'.repeat(64), firstDay = new Date('2026-10-31T23:00:00Z'), nextDay = new Date('2026-11-01T01:00:00Z');
  let state = reserveRun({ schema: 1, reservations: [] }, '1', key, firstDay);
  expect(() => requireResume(state, key, false, nextDay.getTime())).toThrow('cannot reset');
  expect(() => requireResume(state, key, true, nextDay.getTime())).toThrow('spent requests are unknown');
  state.snapshot = { runId: '1', key, contextHash: key, expiresAt: state.reservations[0].expiresAt, sha256: key, gzip: '' };
  expect(() => requireResume(state, key, true, nextDay.getTime())).not.toThrow();
  state = reserveRun(state, '2', key, nextDay, state.reservations[0].expiresAt);
  // The runner was lost after reservation: never go back to run 1's counters.
  expect(() => requireResume(state, key, true, nextDay.getTime())).toThrow('latest attempt');
  expect(() => requireResume(state, key, false, Date.parse(state.reservations[0].expiresAt) + 1)).not.toThrow();
});
it('stops before any request could spend a reservation across UTC midnight', async () => {
  const rpc = vi.fn(async () => '0x38');
  await expect(reservationRpc(rpc, '2026-10-31', () => new Date('2026-10-31T23:59:59Z'))('eth_chainId', [])).resolves.toBe('0x38');
  expect(() => reservationRpc(rpc, '2026-10-31', () => new Date('2026-11-01T00:00:00Z'))('eth_chainId', [])).toThrow('UTC reservation day ended');
  expect(rpc).toHaveBeenCalledTimes(1);
});
it('redacts network/HTTP diagnostics and restricts the GitHub API to this repository', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('private provider details', { status: 403 }));
  const api = github('unit-test-only-placeholder');
  await expect(api.request('GET', '/repos/projectuwb/metric-lp-detective/git/ref/heads/main')).rejects.toThrow('HTTP 403 (body redacted)');
  await expect(api.request('GET', '/repos/attacker/repo/contents')).rejects.toThrow('outside');
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
  await expect(api.request('GET', '/repos/projectuwb/metric-lp-detective/git/ref/heads/codex/analysis-worker-state')).resolves.toBeNull();
  await expect(api.request('POST', '/repos/projectuwb/metric-lp-detective/git/refs', {})).rejects.toThrow('POST /repos/projectuwb/metric-lp-detective/git/refs: HTTP 404');
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
  await expect(api.request('POST', '/repos/projectuwb/metric-lp-detective/actions/workflows/validate.yml/dispatches', { ref: 'codex/evidence' })).resolves.toEqual({ accepted: true });
  vi.mocked(fetch).mockRejectedValue(new Error('private endpoint'));
  await expect(api.request('GET', '/repos/projectuwb/metric-lp-detective/pulls')).rejects.toThrow('network error (details redacted)');
});
function capture() {
  const root = temporary(); vi.stubEnv('LP_ANALYSIS_DIR', root);
  const c = context(), job = submit(SMALL_SAMPLE_ID, c).job, folder = jobFolder(job.key);
  atomicJson(path.join(folder, 'capture/states.json'), [{ realFixture: 'fixtures/positions/632f7d8c3d6ef54f/states.json' }]);
  const s = snapshot(folder, job.key, c, '123', job.expiresAt);
  return { c, job, folder, s };
}
it('roundtrips bounded public checkpoint files and preserves lifetime usage and context', () => {
  const { c, job, s } = capture(), destination = path.join(temporary(), 'restored');
  restoreSnapshot(s, destination, job.key, c);
  expect(readJson(path.join(destination, 'job.json'))).toMatchObject({ key: job.key, requests: 0, attempts: 0 });
  expect(() => restoreSnapshot(s, path.join(temporary(), 'bad'), 'b'.repeat(64), c)).toThrow('another position');
  expect(() => restoreSnapshot(s, path.join(temporary(), 'bad'), job.key, { ...c, sourceHash: 'changed' })).toThrow('another position');
  expect(() => restoreSnapshot(s, path.join(temporary(), 'bad'), job.key, c, Date.parse(s.expiresAt) + 1)).toThrow('expired');
  expect(() => restoreSnapshot({ ...s, sha256: '0'.repeat(64) }, path.join(temporary(), 'bad'), job.key, c)).toThrow('checksum');
});
it('rejects path traversal, foreign identities, exhausted attempt counts and credentials before restoring', () => {
  const { c, job, s } = capture();
  const envelope = (files: Record<string, string>): Snapshot => { const raw = Buffer.from(JSON.stringify(files)); return { ...s, gzip: gzipSync(raw).toString('base64'), sha256: createHash('sha256').update(raw).digest('hex') }; };
  const encodedJob = Buffer.from(JSON.stringify(job)).toString('base64');
  expect(() => restoreSnapshot(envelope({ 'job.json': encodedJob, '../escape.json': encodedJob }), path.join(temporary(), 'bad'), job.key, c)).toThrow('Unsafe');
  for (const change of [{ id: job.id.replace('3eb2', '3eb3') }, { attempts: 3 }, { requests: 101 }, { slug: '../escape' }]) {
    const bad = Buffer.from(JSON.stringify({ ...job, ...change })).toString('base64');
    expect(() => restoreSnapshot(envelope({ 'job.json': bad }), path.join(temporary(), 'bad'), job.key, c)).toThrow('identity/budget/expiry');
  }
  vi.stubEnv('BNB_RPC_URL', 'https://example.invalid/opaque-provider-placeholder-credential');
  expect(() => rejectSecrets('opaque-provider-placeholder-credential')).toThrow('Credential');
  expect(() => restoreSnapshot(envelope({ 'job.json': encodedJob, 'capture/status.json': Buffer.from(JSON.stringify({ accidental: 'opaque-provider-placeholder-credential' })).toString('base64') }), path.join(temporary(), 'bad'), job.key, c)).toThrow('Credential');
});
it('keeps RPC secrets out of shell input expressions, public endpoints and offline validation', () => {
  const workflow = readFileSync('.github/workflows/owner-analysis.yml', 'utf8');
  expect(workflow).toContain('persist-credentials: false'); expect(workflow).toContain('cancel-in-progress: false');
  expect(workflow).toContain('github.ref == \'refs/heads/main\'');
  expect(workflow).not.toContain('pull_request_target'); expect(workflow).not.toContain('ubuntu-latest-');
  for (const line of workflow.split('\n').filter(line => /run:/.test(line))) expect(line).not.toContain('${{');
  expect(readFileSync('.github/workflows/validate.yml', 'utf8')).not.toContain('BNB_RPC_URL');
  expect(readFileSync('app/api/analysis/route.ts', 'utf8')).not.toContain('remote-analysis');
});
