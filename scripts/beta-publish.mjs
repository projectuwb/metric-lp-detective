// Explicit owner command only; no web request can invoke Git or access its credentials.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const key = process.argv[process.argv.indexOf('--job') + 1];
if (process.env.VERCEL || !process.argv.includes('--job') || !/^[a-f0-9]{64}$/.test(key ?? '')) throw new Error('Owner-only publication requires --job <verified-key>');
const run = (cmd, args, capture = false) => execFileSync(cmd, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', env: process.env });
if (run('git', ['status', '--porcelain'], true).trim()) throw new Error('Working tree must be clean before automated publication; existing work is left untouched.');
run('git', ['fetch', 'origin', 'main']);
try { run('git', ['cat-file', '-e', 'FETCH_HEAD:scripts/beta-export.ts'], true); }
catch { throw new Error('Stage 3 must reach main before this standalone publication command can base a new evidence branch on it.'); }
const branch = 'codex/analysis-' + key.slice(0, 16);
run('git', ['switch', '-c', branch, 'FETCH_HEAD']);
run(process.execPath, ['--max-old-space-size=4096', '--import', 'tsx', 'scripts/beta-export.ts', '--job', key]);
for (const script of ['check', 'build', 'check:client', 'test:e2e']) run('npm', ['run', script]);
run('git', ['add', 'fixtures/positions']);
run('npm', ['run', 'scan:credentials', '--', '--staged']); run('git', ['diff', '--cached', '--check']);
if (!run('git', ['diff', '--cached', '--name-only'], true).trim()) { console.log('Evidence already published; no new commit.'); process.exit(0); }
run('git', ['commit', '-m', 'Publish independently verified owner-requested position ' + key.slice(0, 12)]);
run('git', ['push', '-u', 'origin', branch]);
const commit = run('git', ['rev-parse', 'HEAD'], true).trim(); console.log(JSON.stringify({ pushed: true, branch, commit }));
const temporary = mkdtempSync(path.join(tmpdir(), 'metric-analysis-pr-')), body = path.join(temporary, 'body.md');
writeFileSync(body, 'Publishes an explicitly owner-requested position after independent zero-discrepancy reconciliation.\n\nAll local checks, production build, client credential scan and browser tests passed. Original samples and evidence are unchanged. No paid service, security setting or deployment command was changed.\n\nJob key: ' + key + '\n');
try {
  run('gh', ['pr', 'create', '--base', 'main', '--head', branch, '--title', 'Publish verified owner-requested LP replay', '--body-file', body]);
  // GitHub enforces required checks/reviews; no admin or bypass options.
  run('gh', ['pr', 'merge', branch, '--merge', '--auto']);
  console.log('Pull request created; policy-controlled automatic merge requested. A merge/deployment is not yet confirmed.');
} catch { console.log('Branch is pushed. PR creation/automatic merge was unavailable; no policy was bypassed and no deployment was initiated.'); }
