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
