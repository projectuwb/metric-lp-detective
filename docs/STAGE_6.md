# Stage 6 — measured Free RPC efficiency and spending safeguards

2 November 2026 (Australia/Sydney). Base main `6cb218f1535892431f2ae9dbe21b2f1ce261d480`
(PR #13). No earlier Stage 6 branch/local changes were present. Read the amended
Issue #14 and retained Stage 1–5/source/worker requirements.

The [RPC pilot decision](RPC_PREPAID_PILOT.md) contains the provider comparison,
actual 12-call probe, reproducible per-method estimates, limits, proposed prepaid
tranche and remaining account/quote questions. **Use existing Free first.** No
paid account, funding intent, payment, subscription or secret was created/changed.

| Gate | Result |
|---|---|
| 6A: economical discovery method | PASS for the measured improvement: existing-key 30k liquidity ranges match saved complete data; 10 recent log windows instead of 279 at the observed head. |
| 6A: actual current coverage | PARTIAL: published index remains through 130841348. Observed head 131119667 is dated, not indexed coverage. |
| 6A: shared safe budgets | Implemented/offline tested: bounded per-job reservations, cumulative exact cost counters, old reservations retained, global defaults unchanged at 100/day/$0. |
| 6B: fifth hosted unfamiliar-wallet proof | NOT VERIFIED. The owner approved only 12 research calls; no new reconstruction/campaign was authorised or dispatched. |
| 6B: browser route | Existing owner copy-ID/Run workflow route retained; first/last liquidity transaction links added. No public trigger, token, fake queue or fake job state. |
| 6C: accounting and replay | Original four immutable proofs and exact accounting unchanged. Small positions retain existing independently verified pipeline. Stage 1B remains PARTIAL. |
| 6C: large staged jobs | Design/estimates only. 100 lifetime attempts, 20 checkpoints and 10 traces are not reset or lifted by buying credit. |
| 6D: delivery | Full validation/branch/CI receipt in DEVELOPMENT_LOG.md; no main merge or production deployment claimed. |

The real probe used exactly 12 attempts and reported Free usage 38→50, with
9,950 remaining at that time. Its trace comparison harness contained a BigInt JSON
serialization defect; the exact raw failure was not retained, so the report
remains failed for that comparison. A saved-trace
offline regression fixes the harness without any extra live request. No fifth LP
or new price evidence was invented, and no fourth LP reconstruction was repeated.

Wider pages carry the measured account alias, source/ABI hash and retained probe
checksum; incompatible/new prepaid accounts revert to the conservative range
until separately checked. Event blocks and page boundaries still require
canonical checks. Source continuity, range/result failures, reorg refusal,
independent checkpoint promotion and browser secret exclusion remain gates.

The account's observed 10k/day provider quota is different from the active app's
100/day cap. A future owner-approved **250–500 Free attempts/day** could accommodate
the illustrative ~81-call daily liquidity maintenance plus a zero-swap candidate
(<=31) and one ten-swap job (~86). This is an estimate, **not activated permission**;
ten global trace attempts/day, two analysis allocations/day, per-job limits,
other account users, real event density and current quota still constrain it.
The checked-in policy stays at 100/day. Old full-day reservations are not refunded.

Minimal next live action after code integration: owner chooses an unfamiliar
wallet and approves a named position's bounded run/day, then uses the existing
main-only Owner LP reconstruction UI. Candidate
`0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603`
remains indexed-only with an offline <=31-read preflight. Verify it independently,
integrate its passing evidence branch and separately observe Vercel before claiming
new public playback. No payment is needed to attempt that small Free pilot.
