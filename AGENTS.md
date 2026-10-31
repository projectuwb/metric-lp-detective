# Metric LP Detective — standing development workflow

The repository owner authorizes autonomous routine Git work: create branches,
commit meaningful milestones/fixes frequently, push, create/update PRs and merge
after required checks pass. Do not ask the owner to perform steps available to
you. These instructions persist across future Codex tasks.

## Scope and evidence

- Read `Metric_LP_Detective_Codex_Build_Spec.md` and relevant audit documents.
  Implement only the stage/task the user has authorized; no unrequested dashboard.
- One read-only CRCLB/USDT Metric pool on BNB Chain. No signing, wallet connection,
  write transactions, invented chain observations, fills, prices or LP earnings.
- Keep reconstruction incomplete when independent evidence is missing. Preserve
  failed/incomplete research with truthful PASS/FAIL/NOT VERIFIED and coverage.
- Never remove or weaken blockchain reconciliation tests to obtain a green build.
  Resolve failures before merging; document blockers rather than relabeling them.
- Current evidence: Stage 0 verified; original A–D checkpoint tests are retained.
  Stage 1A inventory reconciles through fixed head 130841348, including both adds
  and a partial removal. Stage 1B quote/performance coverage remains separately
  labelled; never infer full verification from partial trace coverage. Consult
  the latest validation reports before extending these claims.
- The visual MVP is authorized and implemented. Consult docs/VISUAL_MVP.md.
  Only independently reconciled registered samples may claim verified replay; other positions are
  indexed-only. Never import research RPC transport into the browser. Stage 1B
  stays PARTIAL, with a default 50-request, one-worker recovery budget.
- Stage 2 adds a second closed position (9 swaps) and selected-point inventory /
  cashflow comparison. Read docs/STAGE_2.md. Verify new artifacts with
  scripts/verify-position.ts before registering playback; never trust cached status
  alone. Keep matched-withdrawal holding benchmarks null when infeasible and prices
  unavailable when the selected/cashflow block-end marks are missing. The bounded
  research CLI is not a hosted queue. Do not promise processing for indexed-only
  positions or overwrite a completed verified artifact with a partial retry.

## Git and validation

- Use the existing checkout; cloud tasks are already isolated. Do not create a
  worktree unless the user requests one. Preserve existing files and local work.
- Inspect status, remotes, current GitHub permissions, policies and required checks.
  Use a feature branch for substantial changes. Commit coherent verified progress
  promptly, including completed milestones and validated fixes.
- Before integration run `npm test`, `npm run typecheck`,
  `npm run verify:fixture`, `npm run scan:credentials` and `git diff --check`.
  Use `npm run check` for the automated commands. Reconcile generated fixture
  changes and inspect the staged diff; scan the exact index with
  `npm run scan:credentials -- --staged` immediately before committing/pushing.
- Web changes also require `npm run build`, `npm run check:client` and
  `npm run test:e2e` against production with an installed Chromium. These checks
  must not deploy the app; public deployment still requires owner approval.
- Blockchain acquisition changes also need relevant live RPC/fixture checks.
  Offline CI uses the saved real fixtures and needs no RPC secret. Record actual
  command outcomes, test counts, scope and unresolved errors in `docs/DEVELOPMENT_LOG.md`.
- Push completed work, create/update a PR, and merge automatically once repository
  policies and all required checks pass. Fetch current main and resolve divergence
  without overwriting another contributor's work. Never force push shared/main refs.
- Direct main pushes are allowed only for routine verified documentation or small
  maintenance when GitHub allows it and a PR adds unnecessary complexity.
  Substantial work belongs on a feature branch with a PR when available.
- Never bypass required reviews, status checks, rulesets, branch protections or
  security policies. Do not use administrative bypass/merge flags. If blocked,
  preserve the branch and report the exact missing capability/action.
- Add commit hashes to the concise development log in a subsequent commit (a
  commit cannot contain its own hash). Record push/merge outcomes accurately;
  never describe a saved local commit as pushed or a branch push as a merge.

## Credentials and external changes

- Never commit API keys, credentials, private/keyed RPC URLs, `.env` or secret
  files. An empty `.env.example` template is allowed. RPC keys remain server-side.
  Keep injected proxy/CA authentication; never print credential values or raw
  provider error bodies. Public chain wallet/transaction fixtures are permitted;
  searched wallet histories must not be collected persistently.
- No deployment, paid-infrastructure changes or repository security-setting
  changes without explicit user approval. Saving a draft is not applying or
  publishing it; do not publish an environment on the owner's behalf.
- End each task with completed work, validation, exact commit/branch/PR and
  pushed/merged status, plus blockers requiring owner action. Request only the
  precise missing permission when independent work is exhausted.

## Stage 3 operational boundaries

- Read docs/STAGE_3.md and docs/OWNER_BETA_RUNBOOK.md. Exit economics use exact
  rationals for each flow at its own historical mark; CRCLB-equivalent is
  hypothetical translation, not actual CRCLB received. Never turn zero LP inventory
  or a withdrawal into an investment loss, or invent a feasible holding benchmark.
- The owner-local disk queue/worker has a real new-wallet browser proof. It is
  loopback-only and always disabled on Vercel. Public mode downloads a request
  without claiming acceptance; hosted on-demand analysis remains PARTIAL.
- Preserve source-version deduplication, one worker, hard 100-attempt job/day caps,
  two new jobs/day, ten trace-transaction cap, conservative preflight and independent
  reconciliation before replay promotion. Never weaken caps to pass a fixture.
- Failed/cancelled/unverified artifacts stay locked. Preserve immutable published
  proof; additional replays are discovered from independently verified owner
  artifacts, not a manual wallet allowlist. Do not overwrite a different indexed
  head under the same published artifact path.
- Live RPC browser proof is explicit (`npm run test:beta:live`) and consumes real
  quota; default CI is offline. A previously published wallet must not be relabelled
  as a new live request. Keep published replay and original browser regressions.
- Owner publication can use beta:publish after Stage 3 reaches main; no Git write
  credentials belong in a browser/public job trigger. Never claim merge/deployment
  solely from a successful push or an auto-merge request.
