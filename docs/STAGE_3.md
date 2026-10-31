# Stage 3 — exit economics and controlled new-wallet analysis

Started 1 November 2026 (Australia/Sydney), from main 3720e12 (PR #5).
Issue #7 was read in full and takes priority over Issue #6; Issue #4 and the
original specification remain the accounting/security contract.

## Gate 1: PASS — exit and selected-point economics

The nine-swap example now has a prominent Exit Summary, jump markers for initial
funding, additional funding and full closure, and start/selected comparison.
The original position has additional-funding and partial-withdrawal markers.
A full close is determined from remaining bin shares, not an arbitrary zero token
value. Re-entry markers retain clearly labelled lifetime cashflow accounting.

The hero shows total contributions, all actual token distributions, still-invested
inventory and net outcome. The inventory/holding detail remains expandable; zero
remaining inventory and -100% token inventory change are not displayed as a loss.

For each signed funding flow f at block b, using p_b = referenceX64 / 2^64:

- USDT-equivalent = CRCLB_f * p_b + USDT_f.
- Hypothetical CRCLB-equivalent = CRCLB_f + USDT_f / p_b.
- Net in each unit = sum(distributions at their own marks) + remaining inventory
  at selected-block mark - sum(contributions at their own marks).

All operations retain exact reduced BigInt rationals. No per-flow truncation or
floating-point monetary arithmetic. Display truncates to six decimals. A percentage
uses total marked contributions in that unit; it is not time-weighted or annualized.
Missing selected/cashflow marks yield unavailable, not a substituted execution quote.
Contributions and distributions remain separately visible where their marks exist.
Gas is excluded and retained LP fees are not counted again.

### Verified full-close example

Provider 0x3eB210eAa4026f62D027fafABA1fa5592feBb06A,
salt 363274826789293944322560, selected event 13 / block 128752283.

| Quantity | Actual CRCLB | Actual USDT | USDT-equivalent | Hypothetical CRCLB-equivalent |
|---|---:|---:|---:|---:|
| All contributions | 6.139892490136691462 | 4050.862375118152962428 | 4545.540314 | 56.418276 |
| All distributions | 0 | 4543.728066440139855352 | 4543.728066 | 56.504077 |
| Remaining LP | 0 | 0 | 0.000000 | 0.000000 |
| Net reference-marked outcome | — | — | -1.812248 | +0.085800 |

The signs can differ because the unit of account and flow-time marks differ.
Positive CRCLB-equivalent is not actual CRCLB profit or a conversion transaction.
A separate hypothetical settlement selector translates only the selected withdrawal
mix at that same withdrawal block's reference. It excludes spread/slippage/gas and
never changes the actual received-token figures. The matched-token-withdrawal holding
benchmark remains unsupported for this full-close example; no fictional sale is added.

Every prior add/removal remains in the dated transaction ledger. At the original
sample's partial withdrawal, previously received USDT stays visible alongside its
remaining CRCLB/USDT inventory; additions are capital, not investment income.
Source receipts, raw references and all prior independent checkpoints are preserved.

Validation: npm run check passes (65 tests and all original checks), independent
Python Fraction verifies 190 exact value/percentage quantities over 19 selected
real-event points, pinned source/runtime verification passes, production build and
client credential scan pass, all 10 production Chromium tests pass. Original 61
tests and 8 browser tests remain in place. Screenshots are local test artifacts,
not blockchain evidence. Stage 1B remains PARTIAL.

## Gate 2: implementation in progress — no hosted queue claim

See STAGE_3_ARCHITECTURE.md for the no-cost go/no-go decision. No new paid service,
Vercel project, provider plan, permission expansion or deployment has been created.
The full hosted release gate must remain PARTIAL until a new-wallet processing
path has been proved and production availability is separately verified.

## Gate 2 / 3: OWNER-LOCAL PROVEN; PUBLIC ON-DEMAND PARTIAL

The owner-local disk queue, separate worker, explicit request/download/import,
read-cache/checkpoint recovery, quota ledger and immutable checksum-checked replay
promotion are implemented. A real new-wallet test has passed. This is not merely a
third prebuilt sample: the previously indexed-only position was submitted by the
browser to the actual queue and became playable only after independent validation.
The build now also discovers intentionally exported owner artifacts generically.
See [the operational runbook](OWNER_BETA_RUNBOOK.md).

### New entered wallet and chain evidence

Provider `0xA19899f6B8416D8266F0D4f14688C8c6eeAec818`,
salt `671085802901633847509096`.

- Initial add: block 129056551, log 215,
  `0x372a325001d88a19b6e3f39322e6a05cff7c3fd6fc23f30a1d4bf2072ec3b879`.
- Full withdrawal: block 129093793, log 161,
  `0xf468cdefc138331bddc0d8bef4d52bc304ce3345b0e32e56cb9dae2f5d943829`.
- Ten swaps, twelve total events, fifteen checkpoints, 6,000 exact storage
  comparisons, twelve historical full-withdrawal calls, two real liquidity
  receipts, ten raw transaction traces/ten execution quotes and thirteen block-end
  marks. Final inventory [0,0]; permitted discrepancy zero base units.
- Add block hash:
  `0x5a273cd544c6fba9b9b04b2f30c466661fe6c66e6b65e9442124c3a806df0a77`.
- Withdrawal block hash:
  `0xb43a4b348faaa8ab8cc63100a8e5adec375ca23542b9027eae6c0abf930d0c88`.
- Independent fixed-head reconciliation through 130841348, hash
  `0xd4b50c9afe0934057d61ccf2821e30c5b6dbf3553b6348ccb846e9f5a074ea7e`.

Actual entry: 0 CRCLB + 99.999999999999999883 USDT. Actual distributions:
0 CRCLB + 99.956637992935193954 USDT. Fully closed reference-marked cashflow PnL:
-0.043362 USDT-equivalent, or +0.012225 hypothetical flow-time CRCLB-equivalent.
The exact-token holding benchmark is feasible here: holding PnL 0, LP versus holding
-0.043362 USDT-equivalent. Zero initial stock percentage is N/A, not division by zero.

All raw and observational proof is in `fixtures/positions/dcc159a95741b233/`.
The browser job key is
`92177d753cb2865a0e9152d59f3d2d7cd5c8b07bc99d40087665257177e1076b`.
The successful run used 86 attempts: four identity/head reads, thirty checkpoint
headers, fifteen storage calls, twelve withdrawal calls, thirteen quote calls,
two receipts and ten traces. No original-sample bulk recovery was launched.

An initial private-browser attempt exposed Next's internal localhost-vs-Host
normalization and made no job/RPC request. Host/origin checks were corrected and
security regression-tested; zombie-process lease recovery was also fixed. The
successful request and its data were not replaced by mocks. Synthetic rate-limit
unit vectors are separate from this actual successful provider run.

### What remains incomplete

Public Vercel mode intentionally offers file download, not fictitious admission.
The owner can import/process/publish that file on existing resources; the private
beta can process other eligible indexed wallets without code changes. A truly
hosted authenticated admission/worker/shared-store path is not provisioned. Stage 3
is therefore PARTIAL against the full public release gate. The smallest decision
is to keep the operational owner-run handoff, or authorize/configure a specific
free durable authenticated relay/worker arrangement; no paid service is assumed.

GitHub API access still returns Forbidden; permissions/branch protections and
automatic PR/merge cannot be inspected through it. No main change, Vercel project,
production environment setting, paid plan or deployment command is implied by a
feature-branch push. Stage 1B remains PARTIAL. Existing samples stay available;
remove the owner artifact registration to roll back additional playback, or revert
Stage 3 commits to restore Stage 2. Stop the beta process to disable private analysis.
