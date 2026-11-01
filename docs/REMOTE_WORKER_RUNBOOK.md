# Browser-only owner reconstruction pilot

## Stage 6 update — bounded allocations, measured ranges, no paid activation

The active Free policy still permits 100 combined RPC attempts/day, 100 lifetime
attempts/job, ten trace attempts/day and two analysis allocations/day. New runs
reserve their computed bounded requests/cost rather than the entire day. Old
full-100 reservations are retained without refunds. Both owner workflows share
the durable ledger/concurrency group. Failure, cancellation or runner loss cannot
release reserved capacity or reset lifetime counters.

The existing key's 30,000-block liquidity-topic range was measured against saved
complete data in an explicitly approved 12-call probe. Discovery refresh on main
can explicitly authorise 20/40/80 calls within the same 100/day global cap; no
automatic campaign or cap increase occurs. Source/ABI/report provenance, canonical
event/boundary checks and the separate accounting-index gate remain. No recent
index refresh or fifth replay was executed in this task.

No paid policy is enabled. Ordinary card PAYG/automatic overage are excluded.
Prepaid/alternative endpoint configuration requires explicit owner approval,
confirmed account/credit/terms and a hard all-in sub-$10 ceiling. Never add a
management token or payment flow to the site. Existing secret is unchanged;
optional `LP_RPC_URL` is unused without an approved policy/private binding.
See [Stage 6](STAGE_6.md) and [the prepaid decision](RPC_PREPAID_PILOT.md).

The Stage 4/5 full-day descriptions below are dated historical receipts and are
superseded for new Stage 6 allocations; their existing reservations stay binding.

## Current owner path — Stage 5

The original remote pilot is **VERIFIED**: real run
[41293561165](https://github.com/projectuwb/metric-lp-detective/actions/runs/41293561165)
published the fourth position through merged PR #12. Main's Vercel status is
success; public playback was owner-verified. Do not repeat that reconstruction or
recreate its secret. The dated Stage 4 implementation notes below are historical.

For another position, use the website's **Copy position ID** → **Open owner-run
workflow** → **Run workflow**, branch **main**, paste into `position_id`.
Leave resume off for new work. Follow the actual GitHub run, then its passing
evidence PR/branch. If GitHub cannot create the PR, ChatGPT's connected GitHub
integration can integrate the pushed branch after checks pass. Refresh the site
after merge and successful Vercel deployment; verified replay unlocks generically.
No terminal, download, PAT or public dispatch token is required.

The full 2026-11-01 UTC provider allowance is already reserved by the fourth run.
Failed jobs do not refund reservations. On a new day, use explicit checkpoint
resume only for the latest matching unexpired incomplete job; never reset its
lifetime cap. Already published positions skip reconstruction entirely.

Stage 5 adds **Owner discovery index refresh** (`owner-discovery.yml`) after its
code reaches main. Choose a 5/10/20-attempt budget there to increment discovery
coverage. It shares the provider day and worker concurrency with reconstruction;
do not run both expecting separate allowances. It creates a discovery-evidence
branch, not new verified LP PnL. Later-history replays still need a full accounting
index extension. Live execution of the new refresh is not yet verified.
See [Stage 5 evidence and limitations](STAGE_5.md).

## Historical Stage 4 implementation receipt

Stage 4 status: **PARTIAL — implementation tested offline; real Actions execution,
new-wallet reconciliation on that runner, merge and public replay NOT VERIFIED.**
No repository secret/setting or deployment was changed by implementation.

## One-time owner setup (no terminal)

1. Integrate the Stage 4 development PR into **main** through the connected GitHub
   account. The main-only workflow deliberately refuses feature-branch dispatches.
2. In [repository Actions secrets](https://github.com/projectuwb/metric-lp-detective/settings/secrets/actions),
   approve adding the repository **secret** `BNB_RPC_URL`, using the existing BNB
   endpoint. The cloud environment variable is not a GitHub secret. Do not use an
   Actions variable, workflow input, issue, chat, `.env` commit or Vercel public
   variable. This is an essential new secret requiring the owner's explicit approval;
   the agent has not copied or created it.
3. Open [Owner LP reconstruction](https://github.com/projectuwb/metric-lp-detective/actions/workflows/owner-analysis.yml),
   choose **Run workflow**, branch **main**, and paste a provider:salt copied from
   the site into `position_id`. Leave `resume_checkpoint` off for a new job.
   GitHub login authenticates the owner. No app token or local tools are needed.

The workflow requests `contents:write` for its durable reservation/evidence
branches, `pull-requests:write` for its evidence PR, and `actions:write` solely to
dispatch the existing read-only Validate workflow on the evidence branch.
Review/approve this narrowly scoped workflow through the code integration; no
global security setting is changed automatically. If repository policy refuses
writes, the admission step fails **before RPC**. Do not relax branch protections.
If Actions-created PRs are disabled, the tested evidence branch is still pushed;
integrate it through the connected GitHub account. Enabling that optional Actions
PR setting is an owner permission decision, not a requirement to reconstruct.
No PAT, GitHub App, Vercel token, OAuth service, new account or paid plan is needed.

## First real pilot — candidate, not a verified replay

Paste:

```text
0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba:880320313732695054146242
```

This provider has **no published verified replay** at Stage 4 implementation.
Offline replay of the saved complete pool index finds four events, one swap/one
trace, seven checkpoint blocks, two deposits and a full withdrawal. The
conservative upper bound is **43 reads**. Eligibility is not independent proof of
balances, historical EOA code, provider access or successful remote execution.

| Indexed event | Block / log | Transaction |
|---|---|---|
| First deposit | 129628417 / 234 | `0x0e805d49bad7bcc6b0fc1959513e587b5af42fad35130d7f28a80145f4fcd282` |
| Swap | 129628619 / 293 | `0xe7f667bc4e71febdb65fc026eb3b6f0ec6ddb95ddcd7b060b6ed2ba835265af0` |
| Additional deposit | 129628749 / 183 | `0x60a19fdcc2afde0f632bc1bad2f5e91163f4ba29b1aa4e66d6b40a1a4d8c408d` |
| Full withdrawal | 129629243 / 234 | `0x464dcae72fa48897c3dd75056217d4fa95bf3e4510dcc86c0397f4d6d40e72cc` |

The indexed ledger predicts final inventory [0,0]. **Not yet independently
verified**: no fourth fixture, historical marks, profit claim, runner receipt or
playback registration is fabricated. Admission rechecks eligibility rather than
trusting this table. A previously considered eleven-swap position was rejected
because it needs eleven traces; the ten-trace cap was preserved.

The existing local proof ledger already used 86 requests on 2026-10-31 UTC.
No further live acquisition was started during implementation. Do not run the
local beta and remote worker on the same provider day without accounting for
their combined usage; their ledgers cannot observe unrelated provider clients.

## What happens after Run workflow

GitHub shows actual queued/running/completed/failed states. The site opens an
external link; it **does not dispatch, persist, accept or poll a hosted request**.
Copying an ID is not acceptance. Anonymous visitors cannot consume RPC allowance.

1. Only `projectuwb`, repository `projectuwb/metric-lp-detective`, a fresh
   `workflow_dispatch` on main and the exact checked-out source commit are accepted.
   Fork/PR triggers, other actors, other refs and **Re-run jobs** are refused.
2. The offline index/ABI/accounting context and input must be valid. Published
   replays return without extra work. Unknown/outside-window positions and jobs
   exceeding bounds stop before any RPC. Missing secret stops here too.
3. A non-force Git commit to `codex/analysis-worker-state` reserves **all 100**
   requests for that UTC day, and its remote ref is confirmed before RPC access.
   No refund: failures/cancellation cannot reset quota. This permits at most one
   remote attempt/day, stricter than the existing two-new-jobs/day admission cap.
4. The existing collector runs, paced at least one second, with 100 lifetime
   attempts/job, fewer than 100 swaps, twenty checkpoints, ten traces, three job
   attempts and a fifteen-minute worker deadline. It stops at the first 429 or
   other provider failure, and before spending across UTC midnight. No automatic
   retry, paid fallback, unrestricted scan or blockchain write exists.
5. Independent verification checks all 100 bins' reserves/total shares/position
   shares, full-withdrawal calls, liquidity receipts, source hashes and recovered
   execution witnesses. Tolerance remains **zero base units**. Execution prices
   and block-end marks remain distinct. Failed/partial results cannot publish.
6. A sanitized, checksummed checkpoint is committed even after a provider error.
   On success, raw evidence plus `request-proof.json` and **actual**
   `remote-proof.json` are exported. Automated math/fixture/type/credential checks,
   production build, client scan and the production-browser suite must pass before
   an evidence branch is pushed. An unexpected diff stops publication.
7. The worker explicitly dispatches **Validate** on the evidence branch:
   `GITHUB_TOKEN` pushes/PR creation do not start other Actions workflows. It
   proposes a PR and requests normal policy-controlled auto-merge where allowed;
   required reviews/checks are never spoofed or bypassed. Permission/rules failures
   leave the tested branch and actionable links in the run summary. A successful
   PR request is not a confirmed merge.

Main's existing Vercel integration is kept. No script runs `vercel deploy` or
creates a project. After actual merge, verify the existing Vercel deployment is
**Ready**, then look up the pilot wallet on the public site, select the salt above,
inspect its real swap and exit transaction, and check final [0,0] against the
independent verification report. Record deployment URL/commit and browser evidence
separately. `remote-proof.json` intentionally says
`productionDeploymentVerified:false` until production is actually observed.

## Failure, resume and privacy

The run summary reports the exact failed RPC method with a redacted classification
and numeric provider/HTTP code where available. Never paste raw provider responses
or endpoints into an issue. HTTP 429 stops requests immediately; do not retry the
same day. The entire reservation stays consumed even if no call succeeded.

For an incomplete matching job, use a **new Run workflow** on the next UTC day
and explicitly select `resume_checkpoint`. Restore requires the same position,
index-head/source/accounting hashes, unexpired checkpoint, checksums and remaining
lifetime/attempt budgets. Successful RPC cache entries are reused and incomplete
checkpoint reuse rechecks canonical headers. A mismatched/expired/exhausted
checkpoint is refused, without silently starting fresh work. A fresh job after
expiry needs a new explicit dispatch with resume off.

An unexpired position job **cannot** be restarted with resume off to reset its
lifetime counters, even on the next UTC day. The durable reservation records the
exact expiry. Resume requires the latest attempt's checkpoint; after a hard loss,
an older snapshot cannot prove how many additional requests were spent. That case
is refused until job expiry rather than undercounting requests. A new job's local
expiry is clamped to the durable expiry so API latency cannot open a reset gap.

Only allowlisted JSON/compressed public-chain files are restored; symlinks,
path traversal, changed identities/budgets, corrupted compression/checksums,
oversized input and configured credentials are rejected. Partial progress survives
**only after the checkpoint commit succeeds**. Abrupt cancellation/runner loss
before that step can lose current progress; the already durable reservation still
prevents overspending. There is no promise of a persistent Vercel filesystem.

The current resumable checkpoint is usable for at most 24 hours; the next checkpoint
replaces it. Git history intentionally retains the explicit public position/chain
evidence and quota receipts indefinitely, including failed-job public inputs.
Do not dispatch if you do not consent to that publication. No searched-wallet/IP
history, endpoint, key, user account or private wallet data is stored. Searches
remain ephemeral. Immutable verified fixtures are retained under the normal Git
evidence policy. No Actions artifact upload, paid storage/database or new cache is
introduced. The workflow excludes its orphan state branch from ordinary CI.

## Cost and observed limitations

GitHub's current [billing documentation source](https://github.com/github/docs/blob/main/content/billing/concepts/product-billing/github-actions.md)
states standard GitHub-hosted runners are free in public repositories. This worker
uses standard `ubuntu-24.04`, refuses private repositories, and creates no larger
runner, artifact-storage plan or billable service. Existing npm caching is removed
from this worker to avoid adding storage usage. Fair-use, Actions availability and
existing RPC rate limits still apply; unlimited/free-at-scale capacity is not
asserted. No alternative managed service is necessary for this owner-only pilot.

At implementation time the cloud GitHub API check failed exactly:
`Get "https://api.github.com/repos/projectuwb/metric-lp-detective": Forbidden`.
HTTPS egress to `api.github.com:443` in the environment's **enforced** network
allowlist is required for the agent to inspect secrets/settings, dispatch and
observe runner/policy state. A runtime variable does not prove a repo secret
exists. Git transport works; a branch push does not prove merge or deployment.

The live remote/public release gates remain **NOT VERIFIED** until the first
actual owner dispatch and deployment replay succeed. Offline fixture transport
tests and a copy-ID browser test do not count as that proof.

## Stage 7 bounded accounting capture and public acceptance

See [STAGE_7.md](STAGE_7.md) for the pending exact new-wallet budget, UTC day,
owner Run action and precise unapproved index experiments. The fifth position
remains unverified until a real independently reconciled Actions result is
published. The existing secret does not need reinstalling.

`owner-accounting.yml` captures a full-event, independently reconciled pool index
candidate at an explicit target and attempt cap, sharing the existing state
branch and daily cost/request reservations. It does not promote LP replays or
extend the website's accounting head. Never dispatch it under a liquidity-only
or wallet-only approval. `verify:accounting` rechecks every saved boundary.

`production-acceptance.yml` uses no RPC/key/write token: after main Validate it
checks the exact deployed commit and the unfamiliar wallet through the existing
public UI. Its actual `PUBLIC_BROWSER_PROOF` distinguishes a working owner
handoff from a verified playable result. A local browser PASS is separate from
this public deployment receipt.
