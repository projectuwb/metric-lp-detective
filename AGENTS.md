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
