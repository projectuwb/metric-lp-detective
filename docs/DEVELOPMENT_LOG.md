# Development log

Dates use Australia/Sydney. Commits are recorded in a subsequent log update to
avoid circular self-hashes. Git history is authoritative for this file's own commit.

| Date | Milestone | Validation / status | Commit |
|---|---|---|---|
| 2026-10-31 | Original build specification on main | Project contract preserved unchanged | `baed2e9b24e16fa7cc6ee66489c0afd5438424bb` |
| 2026-10-31 | Stage 0 deployment/source/ABI audit, two genuine deposits, historical RPC/receipt evidence | Pool + linked library source matched; historical receipts verified | `ee6399503063dd1df2e935410d71436c98b8e02e` |
| 2026-10-31 | Stage 1 individual-LP attribution A–D through checkpoint 126553642 | 42 tests, typecheck, fixture validation pass; 1,200 storage comparisons and 56 historical withdrawal eth_call results match; zero reconciliation tolerance | `ee6399503063dd1df2e935410d71436c98b8e02e` |
| 2026-10-31 | Autonomous workflow | AGENTS.md, reusable credential scanner, combined check command and offline CI; feature branch `codex/preserve-stage0-stage1` | `ee6399503063dd1df2e935410d71436c98b8e02e` |

Outstanding: Stage 1 is incomplete beyond the declared checkpoint. Execution-time
oracle references, later/current history and a real competing-removal example are
unverified. No dashboard, deployment, paid infrastructure or repository security
changes are authorized by this workflow task.

Git access: existing HTTPS Git proxy reads and push dry-run succeed. GitHub API
access is blocked by environment egress (`CONNECT HTTP 403` to `api.github.com`).
An additive allowlist draft was saved with existing domains preserved. Until it is
applied, repository API permissions, branch protections, PRs and merge checks cannot
be inspected. Never bypass that block by pushing substantial work directly to main.
Push and merge outcomes will be recorded once observed, not assumed from a dry-run.

## Preservation outcome — 2026-10-31

`ee6399503063dd1df2e935410d71436c98b8e02e` was pushed successfully to
`origin/codex/preserve-stage0-stage1`; `git ls-remote` confirmed the identical SHA.
All verified Stage 0 and bounded Stage 1 evidence is now preserved in GitHub.
AGENTS.md, the credential scanner and combined check command are included.

Validation before that push: 42/42 tests passed, typecheck passed, attribution
A-D/checkpoint fixture validation passed, 60 project files/58 staged files scanned
with zero findings. Negative scanner checks rejected a credential-shaped sample
and a .env file without disclosing their contents. No tests were weakened.

This follow-up adds offline GitHub Actions CI with immutable official action SHAs,
read-only repository permissions and no RPC secret requirement. Local checks pass;
GitHub-hosted CI status remains unobserved because API access is blocked. No PR or
main merge is claimed. Apply the saved api.github.com egress addition in environment
settings, then publish the environment; the agent can retry API access, inspect
policies, create the PR and merge after required checks. No new token is requested
until the existing injected authentication has been tested with API connectivity.

## Stage 1A — 2026-10-31

Synced main at dd123da (merged PR #1). Branch: codex/stage1-history-oracle.
Complete inventory history through fixed block 130841348 reconciles exactly: 62,207
pool logs, 26,202 selected-position swaps, 35,429 relevant bin steps, both adds and
the partial removal. Final balances and every sampled full-pool state agree with
archive reads; 2,800 storage checks and six withdrawal executions have zero error.
Validation: 43 tests, typecheck, original checkpoint fixture, full-history verifier
and credential scan passed. Execution quote recovery/performance is a separate
Stage 1B milestone and is not asserted complete by this commit.

## Stage 1B — 2026-10-31

Stage 1A milestone 4a7a633 was pushed to codex/stage1-history-oracle.
Execution quote recovery verified 2,014 transactions / 2,146 swaps; 23,177 target
transactions remain unverified after debug_traceTransaction HTTP 429. Recovery is
resumable and stops uncached requests after exhausting rate retries. No plan change.
Historical block-end valuation inputs at all three cashflow blocks and fixed head
were read successfully at low volume. Exact TypeScript performance reconciles with
an independent Python Fraction calculation; convention is USDT-equivalent reference
marks, not execution-price cashflows, USD peg verification or realized dollar PnL.
Stage 1B remains partial; no dashboard started. See STAGE_1B_ORACLE_PERFORMANCE.md.

Validation for the Stage 1B milestone: 47 tests pass, TypeScript passes, original
checkpoint fixture and complete-history reconciliation pass, all saved oracle
witnesses validate, independent Python performance verification passes, and
credential scanning (including decompressed gzip fixtures) reports zero findings.
A synthetic compressed credential sample was correctly rejected without exposing
its value. Two newly added strict-type errors were corrected before committing;
no reconciliation assertion was removed or relaxed.

## Visual MVP — 2026-10-31

Synced main f43614a from PR #2; branch codex/visual-mvp. Implemented Next.js frontend
and server-only indexed API, public wallet/provider/salt discovery, verified sample,
lazy 128-row event pages and 400-point overview, playback/scrubbing/inspection,
price confidence and explicit reference-marked endpoint PnL. The web timeline has
26,282 rows including 77 genuine rounding adjustments; all exact balances telescope
and match independent historical checkpoints and endpoint. No ledger/evidence or
original reconciliation tests were changed. Other positions remain indexed-only.

Validation: 54 tests pass, typecheck passes, all original fixture/history/oracle/
performance checks pass, production build passes, client asset credential check
passes and all 4 production Chromium tests pass (desktop, mobile, real swaps,
endpoint, wallet/salt, unsupported states, errors and retry). Credentials scan
reports zero findings. Next API bundles include all generated index files.

Stage 1B stays PARTIAL. Recovery design now caps one invocation at 50 remote attempts
(default), paces calls and opens its circuit on a rate response; no trace scan was
started. No public deployment, paid infrastructure or security settings changed.
Viewing/hosting steps and limitations are in docs/VISUAL_MVP.md. GitHub API remains
absent from this runtime allowlist, so PR/merge and hosted CI status are unobserved.

## MVP push and loading-state fix — 2026-10-31

MVP commit 763bb9d2613f9031c1cdb523d17ee7c5a22e3723 was pushed successfully to
origin/codex/visual-mvp. A final state review found that returning to a cached event
page while a different page was loading could leave its loading flag set. The
follow-up clears that flag on cached selection and adds a production browser
regression test. Production build and public-client credential scan passed again;
all 5 browser tests now pass. The prior 54-test full reconciliation/security suite
also passed; original ledger/evidence files remain unchanged. No public deployment
was initiated. Stage 1B remains PARTIAL and no trace recovery was launched.

## Stage 2A evidence milestone — 2026-10-31

Synced main 9c1bc7dd1bdd637c63928c24ece470aaad7e63f8 (PR #3); working branch
codex/stage2-second-position. Read Issue #4 in full via public github.com because
api.github.com still returns Forbidden. HTTPS git fetch works; main is unchanged.

Found and independently verified provider 0x3eb210eaa4026f62d027fafaba1fa5592febb06a,
salt 363274826789293944322560: 9 swaps, 3 deposits, 1 rounding adjustment, full
withdrawal, 14 rows. Historical range 128750025–128752283; index coverage verified
through 130841348. Fifteen checkpoints, 6,000 raw storage comparisons, twelve
historical withdrawal executions and four actual receipt token-transfer checks
reconcile with zero base-unit discrepancy. Seven raw traces verify all nine of this sample's
execution quotes; thirteen block-end marks cover all twelve event blocks + head.
Original source ledger and original reconciliation evidence/tests remain intact.

Capture: 69 paced read-only RPC requests; 15 further canonical-header reads, 84
total. No rate failure, unbounded scan, plan change or deployment. Repeating the
completed CLI job revalidates immutable artifacts with zero remote requests.
The general bounded CLI remains incomplete for large or contract-owned positions;
there is no hosted/durable queue. See docs/STAGE_2.md for evidence and limits.

Validated worktree: npm run check passes (61 tests, typecheck, original A–D fixtures,
full-history/oracle/performance checks, independent Python Fraction checks and
credential scan). Second sample cashflow PnL is -1.812248 USDT-equivalent; matched
holding after the full withdrawal is unsupported, not zero. Browser additions and
selected-point UI are the next milestone; Stage 1B stays PARTIAL overall.

## Stage 2 web milestone — 2026-10-31

Evidence commit 9b4f77e was pushed to origin/codex/stage2-second-position.
Both registered samples now use the same deterministic event builder. The original
26,282-row replay, endpoint balances and PnL remain unchanged. Smaller sample,
wallet/salt selection, exact inventory/flow comparisons, initial marked value,
selected-block mark/time and cashflow PnL are functional. Unsupported holding
and missing prices remain explicit. Added bounded public verification-status API;
no durable queue or arbitrary-wallet reconstruction is promised.

Final checks: npm run check PASS (61 tests, typecheck, all original fixture/history/
oracle/performance checks, independent Python checks and credential scan).
Production build PASS; all four API traces contain all 212 generated data files.
Client scan PASS (11 assets). All 8 production Chromium tests PASS, including the
original 5, the second lifecycle, mobile, multi-salt selection, sample switching
and failures/retry. A new browser test's ambiguous alert selector was corrected;
no reconciliation test was removed or weakened. Screenshots visually inspected.

GitHub API permission read still fails exactly:
Get "https://api.github.com/repos/projectuwb/metric-lp-detective": Forbidden.
HTTPS Git works. Required network capability: outbound HTTPS api.github.com:443.
Cannot observe required checks/policies or safely create/merge a PR through this
API. No direct main push, deployment command, paid service or setting change.
Stage 1B and arbitrary hosted-wallet replay remain incomplete as documented.

## Stage 2 push / CI receipt — 2026-10-31

Web milestone 97aa95b65c7fca4af096f7492c02630570ed24d6 was pushed successfully to
codex/stage2-second-position; remote ref was fetched and matches the local hash.
The public GitHub Actions page independently confirms SUCCESS for both evidence
commit 9b4f77e (run 41200743193) and web commit 97aa95b (run 41201033804).
This is observed CI evidence, not an inference from pushing. API access is still
Forbidden, so repository permission/protection queries and automatic PR/merge
remain blocked. Main is still 9c1bc7dd1bdd637c63928c24ece470aaad7e63f8.
No deployment was initiated or verified. This final documentation receipt does not
change code or chain evidence; the code milestone passed all local and remote gates.

## Stage 3.1 exit economics — 1 November 2026 (Australia/Sydney)

Synced actual main 3720e12 (PR #5); branch codex/stage3-outcomes-wallet-beta.
Read Issues #7 and #6 in full; #7 prioritizes exit explanation before processing.
Implemented cashflow bridge, full-close hero, dated flow ledger, start/selected
comparison, bin-share-based exit/re-entry markers, own-time exact CRCLB-equivalent
translation and separately labelled hypothetical settlement. Existing inventory
and unsupported holding detail remain accessible. No source ledger/old evidence
or reconciliation assertion was removed.

Validation: 65 tests, all original fixture/history/oracle/performance checks,
190 independent Python Fraction checks, typecheck and credential scan PASS.
Pinned source/runtime recompile PASS (initial sandbox subprocess restriction was
resolved with the supported execution permission). Production build/client scan
PASS; all 10 production browser tests PASS, including original 8 and phone layout.
Stage 1B stays PARTIAL. Gate 2 is not declared passed; architecture decision is
owner-local durable beta, no fake hosted queue or new paid service.

## Stage 3.2–3.3 owner beta / real wallet — 1 November 2026 (Australia/Sydney)

Exit milestone d881208 was pushed; GitHub Actions run 41243033629 independently
reports SUCCESS. Implemented loopback-only durable owner queue, one separate
worker, source-version idempotency, persistent per-job/day quotas, canonical
checkpoint/cache resume, failure/retry/cancel, immutable checksum-checked bundles
and generic owner-artifact export/registration. Public Vercel mode remains honest
file download, with no fake accepted/processing state or provider work in a request.

Real new input 0xa19899f6b8416d8266f0d4f14688c8c6eeaec818:671085802901633847509096
was INDEXED_ONLY, browser-submitted to persisted QUEUED, observed RUNNING, survived
browser-context close/reopen, reconciled with zero discrepancy and became playable.
Job 92177d753cb2865a0e9152d59f3d2d7cd5c8b07bc99d40087665257177e1076b: 86 real
RPC attempts, 15 checkpoints, 6,000 storage comparisons, 12 withdrawal executions,
10 swaps / 12 events, fully closed. Raw receipts/traces/state/marks and browser
proof exported under fixtures/positions/dcc159a95741b233. No extra provider reads
were needed to export/verify/publish. Source acquisition is unchanged.

An early local UI guard rejected Next's normalized Host before any job/RPC call;
corrected without removing foreign-origin/Vercel restrictions. Fixed observed
zombie lease recovery. A test expecting QUEUED for a now-published wallet exposed
an unnecessary duplicate-work case: verified replays now reuse without new jobs,
and the queued-status regression uses an actually unverified indexed position.
Original reconciliation assertions remain intact; registry membership now matches
the exact curated + verified-published set rather than a permanent count of two.

All 71 tests and full original checks PASS; Python verifies 310 exact values over
31 selected real events. Production build and client scan PASS; all 13 offline
production browser tests PASS, plus the separate real new-wallet test PASS (1.8m).
All six API traces contain all 215 generated data files and exclude private job
folders/Git metadata. No credential findings. The future clean-main publish helper
is guarded/syntax-checked; it cannot be fully exercised until Stage 3 reaches main.
Hosted on-demand Gate 2 and Stage 1B remain PARTIAL. No paid resource, new Vercel
project, permission/security setting or deployment command was created.

## Stage 3 push / CI / integration receipt — 1 November 2026 (Australia/Sydney)

Worker/evidence milestone 49f15bae0dd042bbdfba00b1c8c9017cab8734a0 is pushed to
codex/stage3-outcomes-wallet-beta. Public Actions run 41247811765 reports SUCCESS;
exit milestone d881208/run 41243033629 also reports SUCCESS. Remote branch fetch
matched local code. Main remains 3720e128ac611ec987582ee5e066d4a6ddca0e47.

Final production checks pass after the UI updates its position card to verified
when the replay loads; exit navigation is prominent, actual net token movement is
separate from return, and endpoint sign colors follow the numeric result.
Source recompile, all original independent reconciliation, 71 tests, 310 Fraction
checks, production build, client/staged credential scans, 13 offline browser tests
and the separate actual-RPC browser proof pass. Screenshots were visually inspected.

PR creation was attempted with a complete body file and failed exactly:
Post "https://api.github.com/graphql": Forbidden.
No branch-policy bypass or direct main push was attempted. Required capability is
HTTPS api.github.com:443 or another authorized GitHub integration connector.
Stage 3 remains PARTIAL for truly hosted on-demand jobs; the owner-local path is
operational and proved, public file handoff is honest. No new paid service,
provider upgrade, Vercel project, security setting or deployment was created.

## Stage 4 implementation — 1 November 2026 (Australia/Sydney)

Synced main 07fbef99e21a8a66800467d7b6bbdb194059f2c3 (PR #8, owner confirms
successful Vercel deployment). Read Issue #9 and all required contracts/runbooks.
Branch: codex/stage4-remote-owner-worker.

Implemented owner-only/main-only workflow_dispatch on standard public-repo Ubuntu,
validated provider/salt preflight, durable non-force full daily RPC reservation,
UTC rollover stop, checksummed sanitized checkpoint restore, existing exact
collector/verifier reuse, actual-run-only evidence export, all publication gates,
explicit read-only CI dispatch and policy-controlled branch/PR/auto-merge attempt.
No secret, repository setting, paid resource or deployment was created. Browser
copy-ID/workflow links replace the primary local-file handoff; clipboard failure
has a usable fallback. The nine-swap demo defaults to its Start / Payout / Net exit;
all three existing replays and initial-event playback remain operational.

Validation: npm run check PASS — 79/79 tests (71 existing plus 8 remote safety
checks), typecheck, original A–D attribution, full history, oracle/performance and
fixture/credential checks. Independent Python Fraction: 31 real selected points,
310 exact value/percentage comparisons PASS. Pinned source recompile/runtime,
library links and guard PASS. Production build and client scan PASS (11 assets).
All 16 production Chromium tests PASS (13 retained plus 3 remote/exit/clipboard
regressions); mobile handoff screenshot inspected. Focused remote/API tests and
workflow YAML parsing pass. Committed blockchain fixtures are unchanged; zero
reconciliation tolerance retained. Staged credential scan is required before commit.

Offline real-index research found a genuinely unpublished one-swap closed position:
0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba:880320313732695054146242;
7 checkpoints, 1 trace, <=43 reads. Tx/log evidence and minimal setup are in
REMOTE_WORKER_RUNBOOK.md. This is eligibility, NOT independent chain verification.
The eleven-swap candidate was refused because it exceeded the ten-trace cap.
No extra live requests were made: the existing local day ledger already records
86/100 attempts on 2026-10-31 UTC. No quota reset, fictional fixture or fourth
playback registration was introduced.

GitHub API check still fails exactly:
Get "https://api.github.com/repos/projectuwb/metric-lp-detective": Forbidden.
Enforced HTTPS egress to api.github.com:443 is missing; no alternative GitHub tool
is available. Repo Actions secret/settings/dispatch cannot be inspected or run.
Remote reconstruction, fourth independent fixture, main merge and new public replay
remain NOT VERIFIED. Stage 4 and original Stage 1B remain PARTIAL. The smallest
browser-only setup is integrate Stage 4, explicitly approve/add BNB_RPC_URL as a
repo Actions secret, then Run workflow on main with the documented pilot ID.

### Stage 4 Git receipt

Implementation 115f3df51fd3228bb8d113104459e2d71eab49eb is pushed to
origin/codex/stage4-remote-owner-worker; git ls-remote confirms the identical SHA.
Exact staged scan: 23 files, zero findings. Official actionlint v1.7.7 release
checksum verified; both workflows pass semantic lint (no workflow errors).
GitHub's public page shows Validate run 41251471309 in progress for this commit:
https://github.com/projectuwb/metric-lp-detective/actions/runs/41251471309

PR creation was attempted with a full description and failed exactly:
Post "https://api.github.com/graphql": Forbidden.
No PR/main merge or Stage 4 deployment is claimed. Main was fetched again and
remains 07fbef99e21a8a66800467d7b6bbdb194059f2c3. Integration can use the
connected GitHub account or restored enforced api.github.com:443 egress; no direct
main bypass was attempted. Remote owner reconstruction remains NOT VERIFIED until
its actual first dispatch, independent evidence and deployed replay are observed.

### Successful-checkpoint recovery regression

Documentation receipt bcebbae3868e82ca0e8ab4abc82e2ec26a761373 was pushed.
Hosted Validate run 41251471309 for implementation 115f3df completed SUCCESS,
including every check/build/client/browser/unchanged-fixture step.

The final test refinement also replaces a runner after a successful raw storage
checkpoint, restores the sanitized cache and lifetime counters, revalidates
canonical headers and completes the real saved nine-swap fixture in three bounded
attempts within 100 total requests. Independent 6,000 storage / 12 withdrawal
checks still agree exactly. Focused worker/remote suite: 9/9 PASS. Failures here
are explicitly synthetic transport tests over real saved chain inputs, not a new
RPC capture or proof of a live Actions worker. Production code/UI are unchanged
from the hosted-CI-passing implementation; all 16 production-browser checks remain
applicable. No new blockchain requests, evidence rewrites or secret/setting
changes were made. Stage 4 remote/public gate stays NOT VERIFIED.

### Cross-dispatch lifetime-budget hardening

Recovery milestone b080d9a34011c6aa5b23b0af558cdff8bf285dac is pushed; hosted
Validate run 41252076642 completed SUCCESS. Earlier implementation and receipt
runs 41251471309 / 41251782467 also completed SUCCESS.

Final review caught an admission loophole before integration: a later-day fresh
workflow could otherwise reset an unfinished job's counters when resume was left
off. Fixed by persisting the exact reservation/job expiry, requiring explicit
resume of any unexpired same-context job, and refusing a checkpoint older than
the latest reserved attempt (unknown spent requests after a lost runner). A fresh
local job inherits the durable expiry; API latency cannot extend its lifetime.
No RPC was sent while investigating or testing this issue.

Final npm run check PASS: 80/80 automated tests, typecheck, all original independent
reconciliation and performance checks, 310 exact Fraction comparisons, credential
scan (208 files, zero findings). The added safety test covers cross-UTC dispatch,
missing/latest/stale checkpoints and expiry. Actionlint still passes. Existing
production build/client scan and all 16 browser tests passed for the unchanged
web code; the final pushed revision also receives the complete hosted CI suite.
Original blockchain fixtures remain byte-for-byte unchanged. Remote Actions
reconstruction and fourth public replay remain NOT VERIFIED, and GitHub API PR /
merge remains blocked as recorded above. No secrets/settings/deployments changed.

### Owner Actions run 41293561165

Source 74794158a53e37ab5d25898e316ad36e911ffb97; job 678ce9b351abc03b9b4e6ee9d343f07bbfdacfed228403fc6706d07b10d0359d; 38 lifetime RPC attempts, 1 attempts, zero-discrepancy independent reconciliation. Automated checks, production build, client scan and production browser suite passed in this workflow before publication. Evidence branch codex/remote-analysis-678ce9b351abc03b-41293561165. Merge and Vercel deployment are not yet confirmed.
## Stage 5 — 1 November 2026 (Australia/Sydney)

Started from fetched main `a425954b029823a139325741876b96b3b181483f`,
including merged PR #12. Read AGENTS, original specification, Issues #7/#9/#11,
Stage 3/4 reports and owner/remote runbooks. Existing fourth-position Actions
receipt retained: run 41293561165, 38 actual RPC attempts, seven checkpoints,
2,800 storage comparisons, four withdrawal checks and zero discrepancy. Connected
GitHub confirms PR #12 merged and base-main Vercel status success; the owner had
already confirmed public playback. This task does not repeat that reconstruction.

Implemented explicit direct-provider discovery states, source/head/accounting
coverage, unknown recent lag and manager ownership caveat, multiple salts with
adds/removals/closed/re-entry episodes, and an HTTP 409 refusal for unscanned
requested windows. Failed lookups clear stale replay/results. Later discoveries
are distinct from the pinned accounting index; both UI and local admission refuse
later-history jobs. Published verified evidence unlocks playback generically,
including from the analysis status refresh.

Removed the infeasible holding KPI from both grids, explained the required
assumed stock sale/purchase, and made feasible holding comparison optional. Exact
integer/rational cashflow PnL and all original reconciliation logic are preserved.
Owner replay uses the existing copy-ID/GitHub workflow route; no public queue or
fictitious progress. Large jobs have an explicit staged-review explanation with
unchanged caps. STAGE_5.md records gates, throughput and remaining limits.

Added an owner-only main-dispatched incremental liquidity index workflow, using
the existing secret/standard runner/shared reservation state. Its fixed 5–20
attempt budget, canonical 1000-block pages, event-block/boundary checks, runtime
identity, durable cursor, source/checksum validation and explicit Validate dispatch
are implemented and offline tested. It does not change the accounting index or
publish unverified replay. Live refresh remains NOT VERIFIED; larger multi-day
replay scheduling remains unimplemented. A 20-call refresh cannot promise chain
catch-up. No background scan, paid infrastructure, secret, setting, public write
endpoint, merge or deployment was created.

The real state branch already reserves all 100 requests on 2026-11-01 UTC for
the fourth-position run. **Zero live RPC calls** were made here. Topic1/provider
and topic2/salt filtering were checked against the deployed ABI, saved real logs
and fourth-position liquidity receipt, not relabelled as a new live probe.
Offline preflight of another unregistered zero-swap position
`0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603`
predicts two events, five checkpoints and <=31 reads; it remains indexed-only.

Final validation after implementation:

- `npm run check`: PASS; **99 tests / 16 suites**, typecheck, original fixtures,
  history, oracle, performance, lifecycle outcomes and credential scan.
- Independent Python Fraction checks PASS, including **35 selected events / 350
  exact lifecycle comparisons**, original performance and second-position PnL.
- `npm run build`: PASS; Next production build. `npm run check:client`: PASS,
  11 browser assets. Chromium production-build E2E: **20/20 PASS** (all original
  16 tests retained plus four Stage 5 browser cases). Mobile screenshot reviewed.
- Pinned Solidity core and exact OpenZeppelin submodule compiled; source/runtime,
  library link and guard checks PASS. The old scratch checkout lacked submodule
  Git metadata, so a separate exact checkout was used under `/workspace/work/`;
  no repository validation was weakened to bypass that failure.
- `git diff --check`: PASS; no tracked fixture/evidence changes. Final staged
  credential scan is required immediately before commit/push.

Runtime diagnosis: the first shell networking attempt lacked execution-level
network permission. Repeating via the supported network-enabled execution profile
connected through the unchanged proxy and fetched GitHub main. No proxy, DNS,
credential or environment configuration was changed. Initial “cloud network
unavailable” diagnosis was too broad. GitHub ruleset collection is empty;
branch-protection details return integration HTTP 403, so no protection bypass or
integration is attempted. The deliverable is a validated feature branch; push/CI
receipt follows after publication.

### Stage 5 Git receipt

Implementation commit `445f4a24bd0a279fd13221ece26a841d9147149e` was pushed to
`codex/stage5-discovery`. Main was fetched again before push and remains an
ancestor; no merge/conflict or force push was needed. Exact staged credential
scan checked 32 files with zero findings; staged diff check passed. The push
started [Validate run 41300754049](https://github.com/projectuwb/metric-lp-detective/actions/runs/41300754049),
which was in progress when this receipt was written. Local final validation is
99 automated tests and 20 production-build Chromium tests PASS. No main merge or
production deployment of Stage 5 is claimed. The following documentation commit
records this implementation hash and push receipt; it does not change code.

## Stage 6 RPC scope update — 2 November 2026 (Australia/Sydney)

Started from fetched main `6cb218f1535892431f2ae9dbe21b2f1ce261d480` (PR #13).
No existing Stage 6 branch or local changes were found. Read amended Issue #14,
standing workflow/source/Stage 1–5 requirements and current worker/index code.
Reviewed official SolidRPC Free, agent-prepaid, BNB, pricing and rate-limit
documentation, plus only two stablecoin-funded alternatives: TheRPC and GetBlock.
Decision and sources: `docs/RPC_PREPAID_PILOT.md`; gate report: `docs/STAGE_6.md`.

The owner explicitly approved one separate 12-attempt existing-key research
probe. Exactly 12 read-only calls were made, one-second paced, with durable
pre-attempt recording. Actual headers showed 10,000/day, 10/s, billable usage
38→50 and remaining 9,950 at the observation. 1k/5k/10k/30k liquidity ranges and
30k provider filtering matched saved complete data; historical eth_call and
storage matched retained evidence. Pinned head/runtime matched. Observed finalised
head 131119667 leaves a 278,319-block gap from 130841348. Safe metadata is retained
in `fixtures/rpc/solidrpc-free-probe.json`; no endpoint/key or searched-wallet
history is stored. The local attempt record is in ignored work/.

The final trace returned HTTP 200 but its comparison was not verified: the harness
contained a BigInt JSON serialization defect and did not retain the raw failure
type, so a separate mismatch cannot be excluded. Fixed/tested offline using the
real saved trace. The failed comparison is not relabelled PASS, and no 13th call
was made. Existing fourth-position reconstruction/proof was not repeated; no new
position, quote or PnL is registered from the research probe.

Implemented measured-range provenance for 30k liquidity pages with source/ABI and
report hashes; canonical event-block/boundary/finality checks and old-page
compatibility remain. Unmeasured/new-account profiles retain conservative ranges.
The build checks the retained report checksum before publishing wider coverage.
No forward refresh campaign was executed; UI shows a dated head/lag while keeping
the actual checked window unchanged, plus first/last liquidity transaction links.

Implemented shared cost-aware index/replay reservations in the existing state
branch, preserving legacy full-100 reservations without refund. Default policy
is Free, 100/day, 100/job, ten trace attempts/day, two analysis allocations/day,
and $0 paid authority. Index allocations can explicitly reserve 20/40/80 rather
than wasting the entire day. Each attempt is locked and saved before send;
failures, lost runners and stale locks cannot refund/reset counters. Exact
nanodollar upper bounds, locked prices, cumulative costs, policy-transition
approval, strict all-in sub-$10/credit ceilings and no top-up/overage/recurrence
are enforced. Prepaid unmetered transport and unapproved alternatives are refused.
HTTP 402/429 stop. Optional LP_RPC_URL is a reference only; no secret was created
or changed. No payment/account-management/signing API exists in this code.

`npm run estimate:rpc` reproduces resource/cost scenarios offline. Existing Free
is preferred; a conditional $1-USDC-on-Base / <=$2-all-in fallback is not ready to
fund. Existing-account prepaid eligibility, binding fee/tax/credit quote and
expiry/refund/hard-stop terms remain unconfirmed. No payments, accounts, plan
changes, paid services, repo settings, main merge or production deployment were
made. No fifth hosted replay is claimed: the only approved live allowance was
the 12-call research probe. Larger staged jobs remain design/estimates only.

Final validation: `npm run check` PASS — **115 tests / 18 suites**, typecheck,
original fixtures/history/oracle/performance/outcomes and credential scan.
Independent Python Fraction checks include 35 selected events / 350 exact
lifecycle comparisons. Production build PASS, client credential scan PASS (11
assets), Chromium production-build browser suite **20/20 PASS**. Pinned core +
OpenZeppelin compilation/source/runtime/library/link/guard verification PASS,
using the existing exact checkout under /workspace/work/stage5/source-check/core.
No original position/history/raw evidence or accounting-engine file changed.
Final measured-profile/cost tests also PASS after clarifying the trace limitation.
YAML parsing and diff checks PASS; exact staged credential scan precedes commit.

GitHub connection reports repository push permission and an empty ruleset list;
branch-protection detail reads remain integration HTTP 403. No bypass/integration
is attempted. Deliverable branch: `codex/stage6-rpc-budget`; push/CI receipt follows.

### Stage 6 Git receipt and final prepaid guard

Implementation `1d015e5bce51d1574bcb00a6ab67da7bf233ff82` was pushed to
`codex/stage6-rpc-budget` after fetching main and confirming it remains an
ancestor. Exact staged scan: 30 files, zero findings. The push started
[Validate run 41353713433](https://github.com/projectuwb/metric-lp-detective/actions/runs/41353713433),
which was still running when this receipt was written. A final review additionally
bound prepaid transport to a policy-matching durable meter: a missing or no-op
callback is refused, with a regression assertion. Full `npm run check` again
passes all 115 tests and independent numerical/credential checks. No further
live RPC, paid action, account/secret change, merge or deployment occurred.
The follow-up commit records this hash/receipt and the tested guard; its own
Validate result must be observed separately before integration.

### Stage 7 — offline implementation; fifth-wallet gate still pending

Started from fetched main `5cf3a38f9b8ac9366c70be879b7f8a5a5ad5e1bc`
on `codex/stage7-new-wallet`. Read Issue #16, AGENTS, Stage 6, prepaid report
and remote-worker runbook. No new live RPC requests or charges. Existing four
positions were rechecked offline only; no RPC reconstruction was repeated.

Added reproducible offline owner/share-per-bin candidate preflight. Exhaustive
attribution reproduces all four known swap counts and finds no untested provider
with 1–10 attributable swaps. Proposed new provider/salt
`0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603`:
zero swaps, deposit/full removal, five checkpoints, expected 26 calls, hard
31-attempt reservation on 2 November UTC. New approval remains pending; no
workflow dispatch or index scan is authorized by the earlier 12-call probe.

Measured 30k liquidity windows now fall back on explicit range/result caps,
without retrying quota/rate/temporary errors or advancing an unfinished page.
Dense combined windows remain separately checksummed bounded pages. Added
main/owner-only full-event accounting candidate capture with exact target,
shared request/cost reservations, <=1k adaptive pages, canonical event/boundary
checks and independent 100-bin reserve/total/owner-share reconciliation. It does
not alter published source heads or unlock LPs. Candidate verification is part
of prepare:web/check. Versioned later LP job contexts/proofs and live catch-up
remain unfinished; docs give precise separately unapproved next experiments.

Added public release identity and read-only actual production browser acceptance
following main Validate. It enters the unfamiliar wallet and checks honest owner
handoff until real proof exists; then it steps every replay event and checks
inventory, witnesses, cashflow PnL and exit/source evidence. Actual Actions log
proof is separate from local regressions. No RPC secrets, public job dispatch,
repository write token, artifact storage upload or new host is involved.

Validation: full `npm run check` PASS (127 tests / 20 suites, types, original
A–D fixture/storage/execution checks, history/oracle/performance/outcomes,
independent Python Fraction checks, accounting candidate status NOT_CAPTURED,
credential scan zero findings). Final dense-discovery regression then added;
focused discovery/capability tests PASS **25/25**, final typecheck PASS.
Production build PASS; client credential check PASS (11 assets). Initial browser
launch found no Playwright-managed browser; reran using installed system Chromium
(`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium`), **22/22 PASS** against the
production build, including both shared operational acceptance paths. Pinned
source/library/runtime/link/guard compilation verification PASS. YAML parsing
and diff checks PASS. Exact staged scan required immediately before commit.

Cloud environment is running with its RPC binding ready, but its enforced
network policy excludes direct api.github.com and Vercel access. Connected
GitHub can manage normal PR integration, but exposes no workflow-dispatch tool;
one real owner Run workflow action remains necessary after exact RPC/day
approval. Do not bypass network policy or ask for the installed secret again.
No new independent wallet proof, merged Stage 7 change or public replay claimed
at this milestone. Git/CI/deployment receipt follows after observing it.
