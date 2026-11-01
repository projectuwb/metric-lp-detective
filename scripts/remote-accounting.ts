// Main-only owner workflow. No wallet searches, public trigger or browser RPC.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { keccak256 } from 'viem';
import { execFileSync } from 'node:child_process';
import { authorizeRun, github, loadState, saveState, reserveBudgetedRun, reservationRpc, REPOSITORY, rejectSecrets, type RunIdentity } from '../lib/analysis/remote';
import { usagePolicy, usageMeter, checkpointUsage, usageSummary, formatNanoUsd } from '../lib/analysis/usageBudget';
import { advanceAccounting, checkedAccountingIndex, type AccountingIndex } from '../lib/chain/accountingIndex';
import { historyInputs } from './reconstruct-history';
import { configuredRpc } from '../lib/chain/rpc';
import { atomicJson } from '../lib/analysis/store';

// Avoid importing server-only into the Actions runner: read prepared context directly.
const summary = (s: string) => { console.log(s); if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n'); };
async function main() {
  const run: RunIdentity = { repository: process.env.GITHUB_REPOSITORY ?? '', actor: process.env.GITHUB_ACTOR ?? '', ref: process.env.GITHUB_REF ?? '', event: process.env.GITHUB_EVENT_NAME ?? '', runId: process.env.GITHUB_RUN_ID ?? '', attempt: process.env.GITHUB_RUN_ATTEMPT ?? '', sha: process.env.GITHUB_SHA ?? '' };
  authorizeRun(run);
  const git = (args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.VERCEL || git(['rev-parse', 'HEAD']) !== run.sha) throw new Error('Trusted Actions source required');
  if (git(['status', '--porcelain'])) throw new Error('Clean source required before accounting update');
  const budget = Number(process.env.INDEX_RPC_BUDGET);
  if (!Number.isInteger(budget) || budget < 9 || budget > 100) throw new Error('Choose an explicit 9..100 request accounting budget within shared daily allowance');
  if (!process.env[usagePolicy().endpointEnv]) throw new Error('Missing approved Actions RPC secret; no RPC sent');
  const coverage = JSON.parse(readFileSync('.web-data/discovery.json', 'utf8'));
  const base: AccountingIndex['base'] = { chainId: coverage.chainId, pool: coverage.pool, from: coverage.from, through: coverage.replayThrough, headHash: coverage.replayHeadHash ?? coverage.headHash, sourceHash: coverage.sourceHash, accountingVersion: coverage.accountingVersion };
  const published: AccountingIndex | null = existsSync('fixtures/accounting/candidate.json') ? JSON.parse(readFileSync('fixtures/accounting/candidate.json', 'utf8')) : null;
  const targetInput = process.env.ACCOUNTING_TARGET ?? '';
  if (!/^\d+$/.test(targetInput)) throw new Error('Explicit accounting target required before reservation');
  const api = github(), loaded = await loadState(api);
  const index = checkedAccountingIndex(loaded.state.accounting ?? published ?? { schema: 1, base, pages: [], observedFinalizedHead: null }, base);
  if (published && (index.pages.length < published.pages.length || published.pages.some((p, i) => p.sha256 !== index.pages[i]?.sha256))) throw new Error('Durable index is behind or conflicts with published evidence');
  const key = createHash('sha256').update('accounting:' + JSON.stringify(base)).digest('hex');
  // Only this job's actual request ceiling is reserved. Legacy 100-request
  // reservations are never refunded; global request/cost/trace caps still apply.
  const policy = usagePolicy(), state = reserveBudgetedRun(loaded.state, run.runId, key, policy, budget, 0, 'accounting');
  state.accounting = index;
  let head = await saveState(api, state, loaded.head, 'Reserve bounded accounting capture ' + run.runId);
  summary(`Owner-only full pool accounting capture: ${budget} RPC attempts reserved within the shared ${policy.dailyRequests}/day cap. ${policy.mode}; no top-ups or public trigger. All pool events and independent 100-bin storage checkpoints; no LP replay promotion.`);
  const meter = usageMeter(state.usage!.allocations.at(-1)!, policy, 'artifacts/accounting-usage-attempts.json');
  let failure: unknown;
  try {
    const h = historyInputs();
    if (keccak256(readFileSync('fixtures/history/pool-logs.json.gz')) !== base.sourceHash) throw new Error('Accounting baseline source hash mismatch');
    const target = process.env.ACCOUNTING_TARGET ?? '';
    if (!/^\d+$/.test(target)) throw new Error('Explicit owner-approved accounting target required');
    const result = await advanceAccounting(index, h.logs, h.abi, reservationRpc(configuredRpc({ policy, beforeAttempt: meter.beforeAttempt }), state.reservations.at(-1)!.day), budget, target, current => { state.accounting = current; });
    summary(`Index state ${result.state}; ${result.requests}/${budget} attempts; last scanned block ${index.pages.at(-1)?.through ?? base.through}.`);
  } catch (e) { failure = e; }
  // Even on a provider failure, retain only completed, canonical, checksummed pages.
  state.usage = checkpointUsage(state.usage!, policy, meter.current());
  head = await saveState(api, state, head, 'Retain accounting coverage checkpoint ' + run.runId);
  const costs = usageSummary(state.usage, policy);
  summary(`Cumulative reserved provider cost ${formatNanoUsd(costs.reservedNanoUsd)}; remaining authorised cost budget ${formatNanoUsd(costs.remainingNanoUsd)}. Unused reservation capacity is not refunded.`);
  if (failure) throw failure;
  atomicJson('fixtures/accounting/candidate.json', index);
  execFileSync('npm', ['run', 'prepare:web'], { stdio: 'inherit' });
  execFileSync('npm', ['run', 'typecheck'], { stdio: 'inherit' });
  execFileSync('npm', ['run', 'scan:credentials'], { stdio: 'inherit' });
  const branch = 'codex/accounting-index-' + run.runId;
  git(['switch', '-c', branch]); git(['config', 'user.name', 'github-actions[bot]']); git(['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
  git(['add', '--', 'fixtures/accounting/candidate.json']);
  execFileSync('npm', ['run', 'scan:credentials', '--', '--staged'], { stdio: 'inherit' }); git(['diff', '--cached', '--check']);
  git(['commit', '-m', 'Checkpoint bounded owner-authorised accounting capture']);
  if (!process.env.GH_TOKEN) throw new Error('Missing Actions publication token');
  const auth = Buffer.from('x-access-token:' + process.env.GH_TOKEN).toString('base64');
  try { execFileSync('git', ['push', 'origin', branch], { stdio: 'pipe', env: { ...process.env, GIT_TRACE: '0', GIT_TRACE_CURL: '0', GIT_CURL_VERBOSE: '0', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'http.https://github.com/.extraheader', GIT_CONFIG_VALUE_0: 'AUTHORIZATION: basic ' + auth } }); }
  catch { throw new Error('Index evidence push failed; details redacted'); }
  const sha = git(['rev-parse', 'HEAD']);
  summary(`Accounting candidate evidence branch pushed: ${branch} at ${sha}. Candidate is NOT selected by the published replay engine; new positions remain locked until versioned LP proofs exist. Integration and deployment are not confirmed.`);
  await api.request('POST', `/repos/${REPOSITORY}/actions/workflows/validate.yml/dispatches`, { ref: branch });
  try {
    const pr = await api.request('POST', `/repos/${REPOSITORY}/pulls`, { base: 'main', head: branch, title: 'Capture independently reconciled pool accounting extension', body: `Bounded owner index refresh: https://github.com/${REPOSITORY}/actions/runs/${run.runId}\n\nFull pool ledger candidate only; original published accounting head and all LP proofs preserved. Versioned per-position state, withdrawal, receipt and mark proofs remain mandatory before new replay. Full Validate workflow dispatched on this branch; integrate only after checks pass. No deployment is claimed.` });
    summary(`Review accounting update: ${pr.html_url}`);
  } catch { summary(`PR unavailable. Integrate the evidence branch through the connected GitHub account after Validate succeeds: https://github.com/${REPOSITORY}/compare/main...${branch}`); }
}
main().catch(e => { let message = e instanceof Error ? e.message : 'Index refresh failed'; try { rejectSecrets(message); } catch { message = 'Index refresh failed (details redacted)'; } console.error(message); process.exitCode = 1; });
