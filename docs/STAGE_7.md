# Stage 7 — new-wallet release gate (NOT COMPLETE)

Stage 6 main: `5cf3a38f9b8ac9366c70be879b7f8a5a5ad5e1bc` (PR #15).
No fifth position has been independently reconstructed by this development yet.
No new RPC attempts, payments, account changes, secrets or infrastructure.

## Offline candidate and explicit approval boundary

Position: `0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603`.
New provider, unregistered. The saved pool index shows a deposit at **128019133**
and full removal at **128019250**, with **zero attributable swaps**. This is
index evidence, NOT independent verification of balances or PnL.

An exhaustive offline owner/share-per-bin activity count matches all four known
positions (26,202 / 9 / 1 / 10 swaps). No previously untested provider has 1–10
attributable swaps. The smallest nonzero untested case has 11, beyond the existing
ten-trace cap; that cap has not been weakened. Swaps elsewhere in the pool during
an LP's lifetime are not attributed to the LP.

Reproduce without RPC:

```sh
npm run preflight:position -- 0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603
```

Five checkpoints: 128019132, 128019133, 128019249, 128019250, 130841348.
Expected **26 requests**, conservative reservation/hard stop **31 attempts**
including failures. Method breakdown: chain identity 1, code 2, headers 11,
historical calls 10 (five storage, two withdrawal simulations, three marks),
funding receipts 2, traces 0. The actual owner job's durable meter enforces its
31-attempt reservation; no automatic retries, paid fallback or index scan.

**Approval pending:** one pilot on **2 November 2026 UTC**, no earlier than
**11:00 a.m. Sydney on 2 November**. The previous UTC day's legacy 100-request
reservation remains fully consumed. The old 12-call Stage 6 research approval
is not authorization for this reconstruction. No run should start without the
new position/count/day approval. No charge is authorized.

After approval, the owner opens the existing site's public wallet field, enters
`0xa598e2658ef74196f498b00b289a7d5d64a42cd7`, selects salt
`615031639178913965778603`, copies its ID, follows **Open owner-run workflow**,
and submits **Run workflow** on main with that ID and resume **off**. Existing
GitHub login and installed `BNB_RPC_URL` secret suffice. No local program,
download, credential paste, manual registration or PR management is needed.
The website handoff submits no job and claims no processing progress.

Connected GitHub tools in this session have no workflow-dispatch operation;
the cloud's enforced network allowlist excludes `api.github.com`. One actual
owner Run action is therefore required. Never work around that policy or ask
for an exposed write token. After dispatch, Codex can monitor, review and merge
the validated evidence branch with the connected GitHub tools.

## Actual public operational acceptance

`Production wallet acceptance` runs after successful **main Validate**, with a
read-only token, no RPC secrets, no dispatch API and no artifact storage upload.
It polls the existing production `/api/release` until the **exact main commit**
and its independently prepared playable registry are observed. Then it enters
the candidate wallet, selects its salt and inspects the public app in Chromium
at mobile width. `PUBLIC_BROWSER_PROOF` in actual Actions logs is the receipt.

Before real evidence is published it must report
`ANALYSIS_NEEDED_OWNER_HANDOFF_PROVEN`; it checks the copied ID and absence of
playback. After actual owner evidence is independently verified, exported,
merged and deployed, the same test must report `VERIFIED_PUBLIC_REPLAY_PROVEN`:
all event pages, each playhead inventory, every attributable swap witness,
full-close payout/PnL, source link and no mobile overflow. It makes no RPC calls.
It cannot convert a missing registration into a sample or manufacture progress.

The same interaction is exercised by local production-build browser tests with
`mode: LOCAL_REGRESSION`; those are not public deployment evidence. The cloud
cannot directly open the Vercel origin under its existing network policy. The
public GitHub runner test checks the actual origin; a Vercel Ready status alone
is insufficient to claim the wallet flow succeeded.

## Discovery and full accounting are separate

Published checked deployment-origin coverage remains **126502643–130841348**.
Stage 6's dated finalized observation is **131119667**, at
**2026-11-01T21:18:28Z**; this is NOT a freshly checked chain head. No later
continuous window has been scanned/published here.

Liquidity-topic discovery uses the existing measured Free-account 30,000-block
profile, with ABI/source/report provenance. Explicit range/result-limit errors
split a page into complete inclusive halves; 429, quota and temporary errors
stop immediately. Every subattempt uses the existing shared meter. Canonical
checks still cover all event blocks and both page boundaries before commit;
an unfinished page never advances coverage. FOUND / NONE FOUND IN CHECKED
WINDOW / NOT CHECKED YET and managed-ownership caveats are preserved.

The dated 278,319-block gap needs ten 30k liquidity pages: **34 + E** calls on a
fresh run, where E is distinct event blocks, plus discarded pages/failures and
five setup calls per resumed run. The previous 1k approach needed at least 841.
A possible next discovery task is one **20-attempt** owner refresh, with no
promise that the entire gap fits. This is a proposal, NOT authorization.

`Owner full accounting index capture` is a separate, main-only, owner-dispatch
workflow. It takes an **exact target block** and **20/40/60-attempt** ceiling;
shares concurrency, global 100/day reservations and exact cost accounting with
analysis/discovery; no refunds, reruns or automatic spending. It uses all pool
events (no liquidity filter), deployment-origin bin ledger and owner changes.
Pages begin at 130841349, initially at most **1000 blocks**. Explicit dense
result/range failures shrink the range; single-block saturation fails closed.
No 30k capability is inferred for dense all-event logs.

Every completed accounting page persists an independent historical `extsload`
result for reserves and total shares of **all 100 bins**, exact requested slots,
page logs/checksum, source/version and canonical boundary. Replay compares
reserves, total shares and sum of attributed owner shares with **zero base-unit
tolerance**. Canonical event blocks and pre/post state-read boundary hashes are
checked. Budget exhaustion retains only completed reconciled pages. A new run
checks baseline and saved-head canonicality and independently rechecks saved
storage evidence before sending further requests. Provider errors stop the run.

Public candidate evidence goes to `fixtures/accounting/candidate.json` via a
validated evidence branch. `prepare:web` / `verify:accounting` independently
recheck it, rather than trusting a saved PASS. Its honest status is
`POOL_LEDGER_RECONCILED_POSITION_PROOFS_REQUIRED`.

**The candidate is deliberately not selected by the published LP replay engine.**
Existing immutable proof source hashes and heads remain fixed. Extending the
versioned LP-job context, collecting new LP-specific state/removal simulations,
receipts, trace witnesses and reference marks, and independently verifying them
are still required to enable later LPs. Capturing liquidity events or passing a
pool-wide boundary check alone never unlocks later positions. This is an
implemented acquisition/reconciliation bridge, not completed current-chain LP
replay support.

Accounting calls on an uninterrupted fresh job: **4 setup + 4 per page + E**,
where E is distinct event blocks; resume adds one saved-head check. Range failures
cost header + failed log request before subdivision. The dated gap at 1k pages
requires at least **1120 + E** calls (279 pages), before errors/resumes. Actual
density/range feasibility after the pinned head is NOT MEASURED; no cost or
catch-up completion is promised from an offline estimate.

A precise next accounting experiment, separately requiring approval, is
**130841349–130842348**, maximum **20 attempts**, on an allowed UTC day after
the wallet pilot; expected **8 + E** calls if a single page succeeds. It may
pause without completing any page if activity requires more canonical reads.
The report will measure actual density, range fallback, attempts and reconciled
through-block. It never spends beyond the approved attempt count. No paid mode
is needed for this proposal and none is enabled.

## Release status

| Capability | Current operational state |
| --- | --- |
| Old-window provider/salt discovery | Existing checked 236-position index |
| Later liquidity discovery | Bounded owner workflow implemented; not live refreshed |
| Later full accounting | Bounded capture/reconciliation candidate workflow implemented; not live run |
| Fifth independent reconstruction | Pending exact pilot approval and actual owner dispatch |
| Public fifth-wallet replay | NOT VERIFIED; release gate remains open |
| Anonymous reconstruction | Not authorized or enabled |
| Larger positions | Existing job/checkpoint/trace limits apply; staged work required |

Existing accounting/PnL math, four verified proofs, partial contributions and
withdrawals, actual-token bridge, selected-point comparisons, infeasible holding
explanations and clearly hypothetical settlement conversions are preserved.
