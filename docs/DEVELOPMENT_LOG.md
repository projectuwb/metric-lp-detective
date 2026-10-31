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
