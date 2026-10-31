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
