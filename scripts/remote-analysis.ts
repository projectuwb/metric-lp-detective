// Invoked only by the owner-dispatched, main-only GitHub Actions workflow.
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { authorizeRun, contextHash, github, loadState, saveState, reserveRun, requireResume, snapshot, restoreSnapshot, reservationRpc, rejectSecrets, REPOSITORY, WORKFLOW, type RunIdentity } from '../lib/analysis/remote';
import { atomicJson, context, getJob, jobFolder, jobKey, readJson, storeRoot, submit, updateJob } from '../lib/analysis/store';
import { positionIdentity } from '../lib/domain/position';
import { positionPlan } from '../lib/analysis/collect';
import { configuredRpc } from '../lib/chain/rpc';
import { processJob } from './analysis-worker';
import { exportVerifiedJob } from './beta-export';

const run: RunIdentity = { repository: process.env.GITHUB_REPOSITORY ?? '', actor: process.env.GITHUB_ACTOR ?? '', ref: process.env.GITHUB_REF ?? '', event: process.env.GITHUB_EVENT_NAME ?? '', runId: process.env.GITHUB_RUN_ID ?? '', attempt: process.env.GITHUB_RUN_ATTEMPT ?? '', sha: process.env.GITHUB_SHA ?? '' };
const controlFile = path.join(storeRoot(), 'control.json');
const output = (name: string, value: string) => { if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); };
const summary = (value: string) => { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, value + '\n'); console.log(value); };
function control() {
  const saved = readJson(controlFile);
  if (saved.runId !== run.runId || saved.sha !== run.sha || saved.contextHash !== contextHash(context()) || jobKey(saved.id, context()) !== saved.key) throw new Error('Runner admission does not match this run/source');
  return saved;
}
async function main() {
  authorizeRun(run);
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.VERCEL || !process.env.LP_ANALYSIS_DIR) throw new Error('Trusted Actions runtime and explicit isolated worker directory required');
  const command = process.argv[2];
  if (command === 'admit') {
    const id = positionIdentity(process.env.POSITION_ID ?? ''), c = context(), key = jobKey(id, c);
    const positions = readJson<any[]>('.web-data/positions.json');
    const position = positions.find(p => p.id === id);
    if (!position) throw new Error('No provider/salt in the fixed indexed window. No RPC sent. Later history is unsupported, not absent forever.');
    if (position.status === 'reconciled') { summary('Verified replay already published. No reconstruction or RPC requests started.'); output('proceed', 'false'); return; }
    if (process.env.HAS_RPC_SECRET !== 'true') throw new Error('Missing repository Actions secret BNB_RPC_URL. No RPC sent. See docs/REMOTE_WORKER_RUNBOOK.md.');
    const plan = positionPlan(id);
    if (plan.r.events.filter(e => e.type === 'swap').length >= 100) throw new Error('Remote pilot requires fewer than 100 swaps');
    const api = github(), loaded = await loadState(api);
    const resuming = process.env.RESUME_CHECKPOINT === 'true';
    requireResume(loaded.state, key, resuming);
    if (resuming) {
      if (!loaded.state.snapshot) throw new Error('No saved remote checkpoint is available');
      restoreSnapshot(loaded.state.snapshot, jobFolder(key), key, c);
      const previous = getJob(key)!;
      if (!['RUNNING', 'FAILED', 'PARTIAL', 'RATE_LIMITED'].includes(previous.status) || previous.requests >= 100) throw new Error('Checkpoint is not retryable within the lifetime budget');
      updateJob(key, { status: 'QUEUED', cancelled: false, error: undefined, phase: 'Owner explicitly resumed a durable remote checkpoint' });
    }
    const state = reserveRun(loaded.state, run.runId, key, new Date(), getJob(key)?.expiresAt), head = await saveState(api, state, loaded.head, 'Reserve full bounded owner analysis allowance for run ' + run.runId);
    atomicJson(path.join(storeRoot(), 'budget.json'), { day: new Date().toISOString().slice(0, 10), issued: 0, jobs: 0 });
    const job = getJob(key) ?? submit(id, c).job;
    // New jobs inherit the exact durable expiry; GitHub API latency cannot open
    // a gap where fresh admission resets a still-live job's lifetime budget.
    updateJob(key, { expiresAt: state.reservations.at(-1)!.expiresAt });
    atomicJson(controlFile, { runId: run.runId, sha: run.sha, id, key, contextHash: contextHash(c), reservationDay: state.reservations.at(-1)!.day, reservationHead: head, initialRequests: job.requests });
    summary(`Owner authorization and durable 100-attempt reservation confirmed. Job ${key}; ${plan.r.events.length} events, ${plan.blocks.length} checkpoints, ${plan.swapTransactions.length} traces, <=${plan.upperBound} reads. No anonymous queue. Public evidence/checkpoints will be retained in Git.`);
    output('proceed', 'true'); output('key', key);
  } else if (command === 'work') {
    const saved = control(), job = getJob(saved.key);
    if (!job || job.status !== 'QUEUED') throw new Error('No admitted queued job');
    await processJob(job, reservationRpc(configuredRpc(), saved.reservationDay));
    const result = getJob(job.key)!;
    summary(`Actual worker state: ${result.status}; attempts ${result.attempts}/3; lifetime RPC attempts ${result.requests}/100; checkpoints ${result.completedCheckpoints}/${result.totalCheckpoints}. ${result.method ?? ''} ${result.error ?? ''}`);
    if (result.status !== 'VERIFIED') process.exitCode = 1;
  } else if (command === 'checkpoint') {
    const saved = control(), job = getJob(saved.key);
    if (!job) throw new Error('Missing admitted job');
    const api = github(), loaded = await loadState(api);
    if (!loaded.state.reservations.some(r => r.runId === run.runId && r.key === saved.key)) throw new Error('Durable reservation missing; checkpoint refused');
    loaded.state.snapshot = snapshot(jobFolder(saved.key), saved.key, context(), run.runId, new Date(Math.min(Date.parse(job.expiresAt), Date.now() + 86400000)).toISOString());
    await saveState(api, loaded.state, loaded.head, 'Save sanitized public-chain checkpoint for owner run ' + run.runId);
    summary(`Durable remote checkpoint saved. State ${job.status}; ${job.requests} lifetime attempts. A hard cancellation before this step can lose current progress; its full daily reservation remains consumed.`);
  } else if (command === 'export') {
    const saved = control(), job = getJob(saved.key)!;
    const destination = exportVerifiedJob(saved.key, 'GITHUB_ACTIONS_OWNER');
    atomicJson(path.join(destination, 'remote-proof.json'), { schema: 1, processingMode: 'GITHUB_ACTIONS_OWNER', repository: REPOSITORY, workflow: WORKFLOW, runId: run.runId, runUrl: `https://github.com/${REPOSITORY}/actions/runs/${run.runId}`, sourceCommit: run.sha, key: job.key, context: job.context, attempts: job.attempts, requests: job.requests, requestsThisRun: job.requests - saved.initialRequests, verification: job.verification, verifiedAt: job.updatedAt, reservationCommit: saved.reservationHead, productionDeploymentVerified: false, note: 'Actual Actions capture and independent reconciliation. Publication, merge and public Vercel replay require separate observation.' });
  } else if (command === 'publish') {
    const saved = control(), job = getJob(saved.key)!;
    if (job.status !== 'VERIFIED') throw new Error('Only verified evidence may be published');
    const branch = `codex/remote-analysis-${job.key.slice(0, 16)}-${run.runId}`;
    const git = (args: string[], capture = false) => execFileSync('git', args, { stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
    const changed = git(['status', '--porcelain', '-z', '--untracked-files=all'], true).split('\0').filter(Boolean);
    if (changed.some(line => !line.slice(3).startsWith(`fixtures/positions/${job.slug}/`))) throw new Error('Unexpected publication changes; owner review required');
    const log = `\n### Owner Actions run ${run.runId}\n\nSource ${run.sha}; job ${job.key}; ${job.requests} lifetime RPC attempts, ${job.attempts} attempts, zero-discrepancy independent reconciliation. Automated checks, production build, client scan and production browser suite passed in this workflow before publication. Evidence branch ${branch}. Merge and Vercel deployment are not yet confirmed.\n`;
    appendFileSync('docs/DEVELOPMENT_LOG.md', log);
    git(['switch', '-c', branch]);
    git(['config', 'user.name', 'github-actions[bot]']); git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
    git(['add', '--', `fixtures/positions/${job.slug}`, 'docs/DEVELOPMENT_LOG.md']);
    execFileSync('npm', ['run', 'scan:credentials', '--', '--staged'], { stdio: 'inherit' }); git(['diff', '--cached', '--check']);
    git(['commit', '-m', 'Publish independently verified owner Actions replay ' + job.key.slice(0, 12)]);
    // checkout does not persist credentials. Token stays in the child's environment, never argv/config.
    const auth = Buffer.from('x-access-token:' + (process.env.GH_TOKEN ?? '')).toString('base64');
    if (!process.env.GH_TOKEN) throw new Error('Missing publication token');
    try { execFileSync('git', ['push', 'origin', branch], { stdio: 'pipe', env: { ...process.env, GIT_TRACE: '0', GIT_TRACE_CURL: '0', GIT_CURL_VERBOSE: '0', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic ' + auth } }); }
    catch { throw new Error('Git push failed (authentication/transport details redacted); publication not confirmed'); }
    const commit = git(['rev-parse', 'HEAD'], true).trim();
    summary(`Evidence pushed: ${branch} at ${commit}. Publication tests passed. Main and public deployment are NOT yet confirmed.`);
    try {
      await github().request('POST', `/repos/${REPOSITORY}/actions/workflows/validate.yml/dispatches`, { ref: branch });
      summary('Existing read-only Validate workflow explicitly dispatched on the evidence branch, because GITHUB_TOKEN pushes do not trigger Actions automatically. Required checks are not bypassed.');
    } catch (e) { summary(`${e instanceof Error ? e.message : 'CI dispatch unavailable (redacted)'}. Required CI remains pending; no checks have been spoofed.`); }
    try {
      const pr = await github().request('POST', `/repos/${REPOSITORY}/pulls`, { base: 'main', head: branch, title: 'Publish verified owner-requested LP replay', body: `Real owner-dispatched reconstruction: https://github.com/${REPOSITORY}/actions/runs/${run.runId}\n\n${job.requests} lifetime RPC attempts, ${job.verification?.storageComparisons} storage comparisons, zero tolerance. All automated and production-browser checks passed before push. No deployment command or paid service.\n\nGITHUB_TOKEN-generated PRs do not trigger Actions automatically; the existing read-only Validate workflow is explicitly dispatched separately on this branch. Required checks/reviews still apply; no bypass is attempted. Public deployment is unverified.` });
      if (!pr?.number) throw new Error('No pull request returned');
      summary(`Pull request created: https://github.com/${REPOSITORY}/pull/${pr.number}`);
      try { execFileSync('gh', ['pr', 'merge', String(pr.number), '--auto', '--merge', '--repo', REPOSITORY], { stdio: 'pipe' }); summary('Policy-controlled auto-merge requested; this is not confirmation of merge or deployment.'); }
      catch { summary('Auto-merge unavailable or required checks/reviews pending. Branch and PR remain available; no rules bypassed.'); }
    } catch (e) { summary(`${e instanceof Error ? e.message : 'PR unavailable (redacted)'}. Evidence is pushed. Integrate through the connected GitHub account: https://github.com/${REPOSITORY}/compare/main...${branch}`); }
  } else throw new Error('Unknown trusted runner command');
}
main().catch(e => {
  let message = e instanceof SyntaxError ? 'Malformed public checkpoint/API JSON (details redacted)' : e instanceof Error ? e.message : 'Owner worker failed (details redacted)';
  try { rejectSecrets(message); } catch { message = 'Owner worker failed (sensitive details redacted)'; }
  console.error(message); process.exitCode = 1;
});
