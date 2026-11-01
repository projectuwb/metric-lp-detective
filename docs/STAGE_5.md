# Stage 5 — coverage, explainable PnL and bounded index refresh

1 November 2026 (Australia/Sydney). Base main:
`a425954b029823a139325741876b96b3b181483f` (PR #12). No fourth-position RPC
reconstruction was repeated. No service, billing plan, repository setting, secret
or deployment was created or changed.

## User flow now implemented

Paste a public wallet → **FOUND** direct-provider positions or **NONE FOUND IN
CHECKED WINDOW** → choose a separate salt → verified replay, or **Request verified
replay** with **Copy position ID** and **Open owner-run workflow**. The public site
does not submit a job. GitHub authenticates the owner, shows real run status and
retains its evidence branch. After independently verified evidence passes checks,
reaches main and the existing Vercel deployment succeeds, normal discovery enables
the replay without an application wallet allowlist. Already published evidence
causes the runner to return before any new RPC work.

Every lookup names chain 56, the one CRCLB/USDT pool, deployment block 126502643,
last scanned block, head hash, source-index hash and accounting version. Later
blocks explicitly say **NOT CHECKED YET**. Recent-head lag is unknown unless a real,
dated finalised-header observation exists. No live head call happens per search.
An explicitly requested outside-index range returns HTTP 409 / NOT_CHECKED_YET,
not a successful empty result. Narrower event-range searches are not offered.

Discovery identifies the event provider, not the beneficial owner behind a
manager, proxy or vault. That ownership path is explicitly unknown/unsupported;
neither an empty direct match nor an old snapshot proves a wallet has no LP.
Failed lookups clear the previous wallet's results and replay. Separate salts,
adds, removals, closed shares and reopened funding episodes are counted from
liquidity events with duplicate/conflict checks. Shares remaining in the checked
window are not labelled a current live balance.

Cashflow-aware LP PnL and selected inventory value remain primary. The isolated
“Unsupported” holding KPI is removed from both grids. Feasible comparisons are
optional under **Compare with simply holding**. Infeasible comparisons say:
“A like-for-like holding comparison would need an assumed stock sale; not
calculated.” No sale, conversion cost, new benchmark or accounting convention is
invented. Missing marks have source/coverage explanations. Original exact
integer/rational accounting and Stage 1B PARTIAL remain unchanged.

## Existing fourth-position proof — retained, not rerun

Provider `0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba`,
salt `880320313732695054146242`:

- Real [owner Actions run 41293561165](https://github.com/projectuwb/metric-lp-detective/actions/runs/41293561165):
  38 attempts, one swap, four replay events, seven checkpoints, 2,800 independent
  storage comparisons and four historical withdrawal checks; discrepancy zero.
- Evidence in `fixtures/positions/145ef95b632fc382/`, including real receipts,
  checkpoint hashes, marks, execution trace, request and runner proofs.
- [PR #12](https://github.com/projectuwb/metric-lp-detective/pull/12) merged to the
  base main above. Connected GitHub reports the base commit's Vercel status
  **success**, with [deployment status link](https://vercel.com/koen-djarus-projects/metric-lp-detective/H1sSpKBSMBP6v8o5ZCRGr8nwa2yx).
  Public playback was previously owner-verified. New browser regressions use this
  same published fixture; they do not manufacture a fifth live job.
- The durable state branch reserves the entire 100-attempt 2026-11-01 UTC provider
  allowance for that run, without refunds. Stage 5 therefore made **zero live RPC
  requests**. All blockchain validation here uses retained real source evidence.

## Concrete incremental index implementation

**Owner discovery index refresh** (`owner-discovery.yml`) is an additional
main-only manual owner workflow on the existing standard Ubuntu runner. Once this
code is integrated, choose Run workflow / main and a fixed 5, 10 or 20 attempt
budget. No local tools, new secret, public API trigger or deployment is needed.
The existing Actions secret is reused only inside Actions.

It shares the reconstruction concurrency group and the existing non-force,
confirmed `codex/analysis-worker-state` reservation. It reserves all 100 daily
provider requests with no refund, while index work itself is limited to the
chosen maximum of 20. Consequently an index job and a replay job cannot each
consume a new daily allowance. No refunds, retries after 429, midnight spillover,
paid fallback or automatic scheduling are introduced. Other provider clients
still need separate coordination; no shared code can observe their actual usage.

The scanner verifies chain, original pinned head, verified runtime code and the
latest durable cursor's canonical hash, and reads an actual `finalized` header.
Unsupported finality access stops safely; no guessed “finalised” head is used.
It scans only added/removed liquidity signatures in inclusive **1000-block**
pages, retaining per-page checksums and previous/head hashes. Before advancing,
it checks every event block against canonical headers and reconfirms the page
boundary. Budget exhaustion midway through a page discards that page. A 429,
source change, reorg, missing header, suspected result truncation or invalid
filter stops acquisition. The durable cursor only covers completed pages.

Completed pages and the dated head observation are saved in the existing state
branch; hard runner loss before that save can lose new progress, but cannot reset
the daily reservation. A later owner dispatch resumes the exact source/cursor,
not a deployment-origin rescan. An evidence branch with
`fixtures/discovery/index.json` is pushed and the full read-only Validate workflow
is explicitly dispatched. Integration requires its checks. The web build checks
hashes, source/version, contiguous ranges, decode semantics and share continuity
before extending discovery. Corrupt or gapped checkpoints cannot become coverage.

This **liquidity discovery index is separate from the original full accounting
index**. New positions are indexed-only. Newer activity requires a versioned full
pool accounting-index extension plus independent balance/receipt/mark checks
before replay; the site states this and withholds the obsolete replay-workflow
handoff for that later history. Published replay proofs are never overwritten.

Live execution of this refresh is **NOT VERIFIED**: today's reservation is already
consumed, and the new workflow must reach main before it may run. No refresh or
new chain head is fabricated in the web build.

## Targeted query feasibility and quota constraints

The verified deployed ABI and saved real receipt logs establish:
`topics[0] = LiquidityAdded OR LiquidityRemoved`, `topics[1] = left-zero-padded
provider address`, `topics[2] = uint80 salt`. Swap sender/recipient topics do not
establish LP ownership. The new owner-side query validates the ABI, response
provider/signature, bounds and removal flags. Tests compare the filter with the
fourth position's two real adds in blocks 129628000–129628999 and its actual
liquidity receipt. These are independent saved-source checks, **not a new live
RPC probe**.

Topic filtering reduces returned data but does not eliminate range requests.
Deployment through the existing head spans 4,338,706 blocks: **4,339 1000-block
requests** even before source/header checks. Repeating this for each random
wallet is incompatible with a 100-attempt daily budget. A shared incremental
liquidity index is preferable. Its 4 setup calls (5 when resuming), then at least
3 calls/page plus one per distinct event block, bound useful progress. A 5-call
budget may only observe the head; no coverage claim is made for unfinished work.
Full catch-up depends on real lag and event density; no completion estimate is
invented without a head observation.

Even with no liquidity events, a 20-call day advances at most five full windows
(5,000 blocks) after setup. This bounded manual refresh does **not** promise to
keep pace with BNB Chain. Before a catch-up campaign, the owner must approve its
fixed total/day budget against the actual existing RPC allowance; the current
100/day ceiling is not silently raised. If required throughput exceeds that
allowance, current-window discovery remains available with recent coverage
unverified. Topic filtering alone cannot fix that request-count constraint.

## Repeatable free-tier rollout

Small positions retain the existing one-worker owner pilot: 100 lifetime attempts,
20 checkpoints, 10 traces, at most 100 swaps locally / fewer than 100 remotely,
three explicit attempts and durable source-version deduplication. Eligibility
counts are a preflight, not proof of historical ownership, complete reference
marks or independent reconciliation. Missing evidence stays locked.

An additional **offline preflight example**, not a fifth verified replay:
`0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603`.
The pinned index predicts two events, zero swaps/traces, five checkpoints, at most
31 reads and final [0,0]. It is still indexed-only: no historical ownership, marks
or independent checkpoints have been acquired for it. On an available UTC quota
day the owner can copy this ID and use the ordinary reconstruction workflow.

Larger positions now describe **STAGED OWNER REVIEW**, not permanent analytical
impossibility. The next implementation would need an owner-approved *total*
lifecycle budget, distinct immutable capture stages, cached canonical headers,
an accumulating spent-request ledger and offline final reconciliation over all
stages before any promotion. Split receipt/checkpoint/trace stages over explicitly
authorised UTC days; do not create fresh jobs to reset the current 100-request
lifetime cap. This larger-job scheduler is **not implemented**. The owner must
first review event/checkpoint/trace counts and daily/total resource estimates.

For eventual public self-service, authenticated identity and server-side admission
with durable per-user and global reservations are prerequisites. Anonymous
repository writes or an exposed dispatch token cannot safely reuse the owner
workflow. No such relay, account, service or paid infrastructure is provisioned.
The current secure route needs GitHub owner authorisation because it spends a
limited shared RPC allowance and can publish repository evidence.

## Acceptance and validation

| Gate | Result | Evidence / limit |
|---|---|---|
| Clear holding/PnL presentation | PASS | Optional feasible comparator; human explanation for infeasible sales; unchanged exact math |
| Real remote fourth position | PASS, inherited | Actual run, retained proof, merged PR #12 and Vercel success; no reconstruction repeated |
| Accurate arbitrary-wallet discovery and replay route | PASS within stated coverage; recent coverage PARTIAL | 236 separate provider/salt positions, explicit unscanned/manager states, owner handoff and automatic evidence registration |
| Reusable processing and index architecture | PARTIAL | Existing bounded worker plus new resumable owner index workflow; live refresh and larger-job scheduler not verified/implemented |
| Original Stage 1B execution-reference coverage | PARTIAL | Preserved; no broad trace recovery |

Automated cases cover empty checked wallets, multiple real salts, the closed
one-swap fourth replay, outside-window requests, existing registered evidence,
owner preflight, 0/1/100+/huge swap counts, shared daily rate limits, infeasible
holding, provider/signature filtering, range paging, resume/corruption/reorg and
incomplete-page refusal. Existing independent mark-completeness, cashflow,
rounding, manager and evidence-to-playback tests remain mandatory. Final command
counts and branch/commit receipt are recorded in DEVELOPMENT_LOG.md.

Stage 5 development is delivered on a feature branch. It is not merged or deployed
by this task. Runtime shell networking initially failed under default execution
permissions; enabling network access for authorised commands fixed Git transport.
The proxy and cloud environment did not need configuration changes.
