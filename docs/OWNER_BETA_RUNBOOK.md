# Owner-controlled analysis beta

1 November 2026 (Australia/Sydney). **Operational on a trusted owner machine;
not a hosted public queue.** No new paid service or Vercel project is used.

## Start and use it

Node 24+, the existing server-side BNB_RPC_URL and current repository dependencies
are required. Preserve the runtime proxy/CA configuration. Do not put the RPC key
in an argument, browser, NEXT_PUBLIC variable, .env commit or downloaded request.

```sh
npm run build
npm run beta
```

Open `http://127.0.0.1:3100`, enter a public wallet and choose its provider/salt.
For an indexed-only position, click **Request verified reconstruction**. Acceptance
means a job was actually written to disk. The separate worker processes it;
closing/reopening the browser does not stop it. Keep the owner process and its disk
available. There is no uptime/turnaround promise. Use a trusted owner machine;
this loopback beta must not be exposed through public port forwarding or a shared
untrusted host. It does not provide an Internet authentication/account system.

Already verified positions open their replay without creating a duplicate job or
RPC work. Unknown ownership/large histories remain unsupported, not unlocked.

## Requests from the public Vercel website

The public website offers **Download owner analysis request** for indexed-only
positions. The file is created in the browser; it is not sent or queued. The owner
can import the file into the existing private worker:

```sh
npm run beta:import -- --file /path/to/metric-owner-analysis-request.json
```

This validates the fixed pool/head/accounting version and persists the job. Run
`npm run beta` against that same checkout/state directory to process it. Request
files with stale versions are rejected; download a current one. No owner setup on
Vercel is required for this file handoff, and no GitHub token reaches Vercel or the
browser. The handoff is not automated public job admission.

## Publish a completed verified job

After Stage 3 itself has reached main, from a clean checkout with the existing Git
identity and a Chromium installation:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run beta:publish -- --job JOB_KEY
```

This owner-only helper fetches main, creates an evidence branch, exports the raw
proof, runs the complete check/build/client/browser gates, scans the staged
credentials, commits and pushes. It attempts a PR and policy-controlled auto-merge
using `gh`; missing permissions/API access leave a pushed branch. It never uses an
admin/bypass flag or invokes deployment. The existing main-to-Vercel integration
may build merged changes; that requires separate deployment verification.

The helper is syntax-checked and guarded but its future main-based invocation has
not been run end-to-end here: Stage 3 is still on its feature branch. This task
performed the equivalent export/check/commit/push steps directly on that branch.

For inspection/export without Git side effects, use instead:

```sh
npm run beta:export -- --job JOB_KEY
```

Do not run export and then expect the clean-tree publish helper to accept those
uncommitted changes. Exported artifacts are automatically discovered by the build
and independently reverified; no wallet-specific application allowlist is edited.
Never overwrite a published artifact with different identity/head. A future indexed
head migration needs explicit versioned evidence handling.

Default state is `artifacts/analysis-beta`, ignored by Git. Set server-only
LP_ANALYSIS_DIR consistently for launcher/import/export/publish if using another
existing persistent directory. The actual live proof used
`artifacts/analysis-live-proof`. Moving/deleting an ephemeral cloud workspace loses
unpublished local state; this is not a cross-machine/shared managed queue.

## Budgets, states and recovery

- One worker per state directory, with PID/start-time lease and zombie/dead-process
  recovery. Same-origin loopback checks reject foreign hosts/forwarded clients;
  Vercel disables mutations regardless of mode flags.
- 100 swaps, 20 checkpoint blocks, 10 trace transactions, 100 remote attempts/job,
  100 remote attempts/day (UTC), two new jobs/day, three attempts/job. A worst-case
  preflight rejects positions that cannot fit the budget before issuing RPC calls.
  These caps apply to this configured queue, not unrelated applications using the
  same provider account. Remaining provider/free-tier allowance is not observable.
- One-second request spacing, first rate error stops the job, fifteen-minute
  attempt time budget and finite RPC timeouts. Failures count against reserved
  persistent quotas; cache hits do not. No automatic paid/bulk fallback.
- QUEUED follows a durable write. RUNNING reports actual phases/checkpoints and
  attempts. VERIFIED requires independent zero-discrepancy storage/withdrawal/
  receipt/trace checks and immutable bundle promotion. FAILED, PARTIAL,
  RATE_LIMITED and UNSUPPORTED keep playback locked.
- Explicit retry reuses successful checksummed read caches/checkpoints only under
  the same source context; incomplete-capture reuse reconfirms canonical headers.
  A restart recovers RUNNING jobs; a complete captured proof is reverified offline.
  A crash between bundle rename and status promotion is recovered without overwrite.
  Corrupted replay pages fail checksum verification.
- Cancel stops future requests and prevents promotion; a request already in flight
  can finish and still counts. A fully withdrawn position is not a cancelled job.
- API access expires unfinished jobs after one day and successful beta jobs after
  seven days. Disk cleanup runs on startup and periodic maintenance while the
  worker is running (possibly delayed by a busy CPU section); stopped disks retain
  files until the worker is restarted or the owner removes them. Published public
  chain evidence in Git is retained independently of this TTL.

Searches are not stored as user histories. Explicit reconstruction jobs necessarily
retain the public position ID and progress for the above bounded period. They store
no IP, wallet secret, RPC endpoint or API key. The owner may intentionally publish
verified public position/transaction evidence. Hosting/RPC infrastructure may retain
ordinary request metadata. No wallet connection, signing or blockchain writes occur.

## Actual live proof

`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:beta:live` is an
explicit RPC-consuming browser test, separate from offline CI. It requires a
previously non-playable eligible LIVE_POSITION_ID; rerunning the already published
third wallet as a new-wallet proof should fail rather than pretend it was new.
The saved successful run entered a new wallet, persisted QUEUED, observed RUNNING,
closed/reopened its browser context, independently verified, auto-unlocked replay,
stepped a real swap and inspected its full exit. It used 86 real RPC attempts.

`fixtures/positions/dcc159a95741b233/browser-proof.json` records this local production
proof. It explicitly says productionDeploymentVerified=false. The immutable raw
checkpoint/receipt/trace evidence is in the same folder. No public Vercel processing
or durable GitHub Actions job admission was proved or claimed.
