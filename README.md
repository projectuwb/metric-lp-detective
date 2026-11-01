# Metric LP Detective

Stage 6: the existing SolidRPC key demonstrated 30k-block liquidity queries and
10k/day quota headers in an owner-approved 12-call probe. New shared request/cost
reservations keep the active app at 100/day and **$0 paid budget**, while allowing
indexing and small reconstructions to share that day. No payment or fifth replay
was executed. Current coverage and larger-job limits remain explicit. See
[the RPC pilot decision](docs/RPC_PREPAID_PILOT.md),
[Stage 6 gates](docs/STAGE_6.md), and the
[current owner workflow](docs/REMOTE_WORKER_RUNBOOK.md).

A functional browser MVP is available. See [viewing and hosting instructions](docs/VISUAL_MVP.md).
With Node 24+, run `npm ci --ignore-scripts` then `npm run dev`; open the address
printed by Next.js and choose **Try the verified sample**. No RPC key is needed
for this fixed indexed demo. The owner reports the main branch is deployed on Vercel. This task initiates no deployment.

New independent, read-only investigation of Metric CRCLB/USDT on BNB Chain.
The [build specification](Metric_LP_Detective_Codex_Build_Spec.md) is the contract.
Standing autonomous Git instructions are in [AGENTS.md](AGENTS.md); milestones,
commit hashes and outstanding issues are in [the development log](docs/DEVELOPMENT_LOG.md).
**Stage 0 identity/source/ABI and real-deposit gate passed.** Original individual-LP
attribution A–D tests remain intact. Stage 1A now reconciles the complete selected
position through fixed head `130841348` (two adds, one partial removal).
**Stage 1B is partial**: 2,014 execution-trace transactions are verified; remaining
execution quote coverage is rate-limited. Block-end reference performance is
separately verified and explicitly labelled.

Verified pool: `0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4`, chain 56.
Actual deployment/add/swap receipts, two public LP candidates and exact per-bin
allocations are saved. The bounded position inventory is reconstructed and matches
historical withdrawal-contract execution with zero difference. The visual MVP replays that verified inventory without wallet connection or trading.
Reference-marked endpoint performance is explicitly labelled; execution-price
coverage remains partial.

- [Protocol audit](docs/PROTOCOL_AUDIT.md): deployed identity/source match,
  accounting semantics, candidates and unresolved Stage 1 questions.
- [Data feasibility](docs/DATA_FEASIBILITY.md): actual RPC results, coverage,
  redacted failures, limits and reproducibility commands.
- [Raw fixture manifest](fixtures/raw/manifest.json): transaction/block/log IDs,
  bin/share allocations and receipt checksums.
- [Individual-LP attribution validation](docs/LP_SWAP_ATTRIBUTION_VALIDATION.md):
  separate A–D results, shared-bin allocation, rounding dust and exact checkpoint.
- [Reconciliation](docs/RECONCILIATION.md): independent historical entitlement check.

## Checks

Node.js 24+ and npm. Offline tests use actual fixed receipts plus separately
labelled artificial codec vectors; no credential needed.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run scan:credentials
# Or run all automated integration gates:
npm run check
```

Run the complete check suite and production-browser tests before integrating any change. Validate the real attribution fixture offline:

```sh
npm run verify:fixture
```

With server-only `BNB_RPC_URL` configured and its
hostname allowed, preserve proxy/CA trust and run:

```sh
NODE_USE_ENV_PROXY=1 npm run verify:stage0:live
NODE_USE_ENV_PROXY=1 npm run audit:rpc -- 130794081 130795080
NODE_USE_ENV_PROXY=1 npm run capture:attribution
npm run verify:fixture
```

Provider errors identify the method and redacted category/code. No endpoint/key
is printed or saved. Never commit `.env` or use a `NEXT_PUBLIC_` credential.
Public sample receipts are stored, not user wallet search history. No browser RPC,
write transactions or other pools/chains are implemented. Inventory coverage is verified through the fixed head;
the original sample remains open, while the second sample has a verified full withdrawal. Complete execution-quote coverage for the original remains unverified. Per-LP swap
attribution is reconciled across the full acquired interval. See the validation report before
extending coverage.

Latest milestones: [Stage 1A history](docs/STAGE_1A_HISTORY.md) and
[Stage 1B oracle/performance](docs/STAGE_1B_ORACLE_PERFORMANCE.md).
Run `npm run verify:history`, `npm run verify:oracle` and
`npm run verify:performance`; `npm run check` includes all checks.

## Stage 2

Two independently reconciled samples are playable. **Try the smaller sample · 9
swaps** follows three deposits through full withdrawal in fourteen real events.
Initial-versus-selected inventory, cumulative funding/withdrawals and selected-point
cashflow PnL use exact token accounting and separately labelled historical
block-end marks. Missing prices stay unavailable. A holding basket that cannot
fund the same withdrawals is explicitly unsupported.

See [Stage 2 evidence and limits](docs/STAGE_2.md). To reproduce the bounded
proof for one other provider/salt (server-side RPC required):

```sh
NODE_USE_ENV_PROXY=1 npm run analyse:position -- --id publicProvider:uint80Salt
npm run verify:position -- 632f7d8c3d6ef54f
```

The verifier above rechecks the saved second sample offline. The collector writes
a deterministic artifact identifier for the requested position; use that identifier
to verify a new capture. Arbitrary hosted-wallet replay is not yet enabled:
other detected positions remain indexed-only; there is no hidden job queue.
Both browser demonstrations require no RPC configuration or new infrastructure.

## Stage 3

The exit summary now leads with **Total put in → Received → Still in LP → Net**,
with USDT-equivalent, hypothetical flow-time CRCLB-equivalent and actual-token
views. Full exits and partial withdrawals retain distributions instead of treating
zero remaining inventory as a loss. Historical marks, timestamps, a dated flow
ledger and clearly hypothetical settlement translation explain the result.

An owner-controlled, disk-backed new-wallet beta is functional on an existing
trusted machine: build, run `npm run beta`, open `http://127.0.0.1:3100`, input a
public wallet and explicitly request its bounded reconstruction. A real new-wallet
browser test survived close/reopen, independently reconciled with zero discrepancy
and unlocked replay. Its proof is now published in the repository and playable
through normal wallet lookup. Both original demos remain; the nine-swap demo is
the first/easiest choice.

**Public hosted analysis remains PARTIAL:** Vercel does not pretend to have a
queue. It offers a browser request download for owner import/process/publication.
No new paid service or hosting project was created. See [Stage 3 evidence](docs/STAGE_3.md),
[the owner runbook](docs/OWNER_BETA_RUNBOOK.md) and [the architecture decision](docs/STAGE_3_ARCHITECTURE.md).

## Stage 4 — browser-only owner workflow (fourth replay verified)

PR #12 published the real one-swap fourth LP from owner Actions run 41293561165
(38 RPC attempts, seven checkpoints, 2,800 storage comparisons, zero discrepancy).
It is merged and the existing Vercel deployment succeeded. Do not repeat that
reconstruction. The Stage 4 notes below describe its original implementation.

## Stage 5 — truthful wallet coverage and clearer PnL

Wallet discovery distinguishes FOUND, NONE FOUND IN CHECKED WINDOW, later blocks
NOT CHECKED YET, and unknown managed-position ownership. Each separate salt shows
first/last activity and indexed versus verified replay. Feasible holding
comparisons are optional; an infeasible comparison explains the assumed stock
sale without suggesting that cashflow PnL is unavailable.

New replay: **Copy position ID** → **Open owner-run workflow** → **Run workflow**
on **main**. This is authenticated owner work, not an anonymous queue. Published
verified evidence unlocks replay automatically after integration and deployment.
The new owner-only incremental discovery workflow uses fixed 5–20-request budgets,
1000-block windows, checksummed canonical checkpoints and the existing shared
daily reservation. It has not been run live; recent coverage remains explicit.
Larger jobs need a staged owner review rather than a permanent unsupported label.
See [Stage 5 gates and quota limits](docs/STAGE_5.md) and the
[current browser-only runbook](docs/REMOTE_WORKER_RUNBOOK.md).

### Historical Stage 4 implementation notes

New indexed positions now offer **Copy position ID → Open owner Request Analysis
workflow**. The owner authorizes a bounded reconstruction in GitHub's browser UI;
no local installation, file upload, public write token or anonymous RPC queue is
introduced. The primary nine-swap demo opens directly at its Exit Summary with
Start / Payout / Net; deposit navigation and all three verified replays remain.

The workflow implements durable daily reservations, safe explicit checkpoint
resume, exact independent reconciliation, all tests/build/browser gates and
feature-branch/PR publication. Standard public-repo Ubuntu runners only; no new
paid infrastructure or deployment command. Actual GitHub Actions execution and a
fourth public replay are **NOT VERIFIED**. The cloud RPC variable is not an
Actions secret. See [the three browser-only setup steps and real one-swap pilot](docs/REMOTE_WORKER_RUNBOOK.md)
and [Stage 4 release gates](docs/STAGE_4.md). Main-to-Vercel remains unchanged;
branch push, PR creation and auto-merge requests do not prove deployment.
