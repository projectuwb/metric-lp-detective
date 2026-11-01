# RPC pilot decision — Free first, no payment authorised

Reviewed 2 November 2026 (Australia/Sydney), Issue #14 scope update. **Preferred
provider: the existing SolidRPC Free account. Do not fund anything yet.** The
measured improvements below address request efficiency before buying credit.
No paid account, subscription change, funding intent, wallet signature or payment
was created. The committed active policy permits **$0 charges and 100 combined
RPC attempts/day**; advertised provider capacity is not automatic app permission.

## What the existing account actually demonstrated

The owner explicitly approved one separate **12-attempt read-only research probe**.
It ran at one call/second on 2026-11-01 at 21:18 UTC / 2 November at 08:18 Sydney.
The immutable sanitized record is
`fixtures/rpc/solidrpc-free-probe.json`; no endpoint/key is in it.

| Observation | Actual evidence |
|---|---|
| Account-wide quota/rate | Headers: 10,000/day, 10 calls/s. Billable use increased from 38 before the probe to 50 after it; 9,950 remained. These are dated snapshots, not a current balance. |
| Logs: 1k / 5k / 10k / 30k blocks | All matched the complete saved pool index exactly: 2 / 4 / 4 / 8 liquidity events respectively. The 30k query took 1.180 seconds. |
| Provider-topic filtering | A 30k provider-filtered query matched all three expected liquidity events exactly. Provider is indexed topic 1, salt topic 2; Swap sender/recipient is not LP ownership. |
| Archive reads | Historical `eth_call` reference and `eth_getStorageAt` matched retained independent evidence. Chain 56, pinned canonical head and pool runtime hash matched. |
| Historical trace | HTTP 200 returned, but the comparison harness contains a BigInt JSON serialization defect; the raw failure type was not retained, so a separate trace mismatch cannot be excluded. **New trace comparison NOT VERIFIED.** The harness is fixed/tested offline; the 12-call allowance was not exceeded. The previously verified fourth-position trace is unchanged. |
| Chain coverage | Pinned 130841348 → observed finalised 131119667: **278,319 blocks unscanned**. Head hash and observation time are retained. The website displays dated lag without extending its checked window. |
| Billing settings | The observed quota/rate match the published Free offer. The RPC key does not expose Billing, overage settings, tax profile, prepaid eligibility or credit expiry. Those remain unconfirmed; no management credential was requested. |

These range results apply to the tested existing key and **liquidity-topic
queries**. They do not prove that all-event accounting scans, dense windows, a
new prepaid key or another provider accept the same range. Future range/result
errors stop within the reservation. No result is silently truncated into coverage.

## Provider decision — only two alternatives considered

| Provider/product | Stablecoin / price | Required BNB methods and eligibility | Decision |
|---|---|---|---|
| Existing SolidRPC Free | $0; advertised 10k/day. Actual headers match. | Archive state/calls/logs observed; retained exact historical trace proof. 30k liquidity ranges measured. Existing Billing not inspectable with an RPC-only key. | **GO for bounded free work after its explicit run allowance.** No purchase needed for small pilots. |
| SolidRPC new agent prepaid | Advertised **$4/million billable method calls**, **$1 minimum USDC on Base**. Funding quote separates gross payment, included tax and usable credit. | Same BNB catalogue advertised. The new-account prepaid product is distinct from existing Free/card PAYG; existing-account conversion is **not established**. A new key/account still needs method/capability checks. | **Conditional fallback only; NOT READY TO FUND.** Confirm eligibility, binding quote, expiry/refunds and provider-enforced exhaustion first. |
| TheRPC | Cached official page advertises USDC top-ups, no monthly minimum and a **$0.39/million CU promotional** rate. Settlement chain, actual minimum and current terms unconfirmed. | Page advertises BNB/archive/debug. It also says heavy traces/archive/ranges cost more CU, despite flat-method marketing elsewhere. Current page/docs timed out; no key or exact historical-method test exists. | **NO-GO now:** no binding per-method cost, hard-exhaustion terms or independently tested BNB depth. Do not equate CUs to calls. |
| GetBlock | Official FAQ accepts USDC/USDT via NOWPayments. RPC Starter advertised about **$39/month**, above the limit. Current generic Credits have a $5 minimum, but Credits are not RPC CUs. | Official BNB logs, archive and callTracer documentation exists; archive access is a paid RPC-plan feature. No evidence that a $5 credit top-up buys the required sub-$10 archive RPC product. | **NO-GO for this budget.** Do not buy a subscription or infer a cheaper eligible product. |

SolidRPC's ordinary card PAYG and opt-in paid-plan overage can charge automatically:
they are excluded. Promo-credit non-expiry rules must not be transplanted to
agent-prepaid USDC; expiry/refund conditions for this proposed account are still
**NOT CONFIRMED**. Its public onboarding advertises a facilitator-based Base
payment without a payer ETH gas transaction; this is not an all-in fee guarantee.
The public capabilities/terms/OpenAPI lookups were unavailable through the
research tool, so a provisioning/payment path is not claimed operational.

Primary sources, checked for this decision:
[SolidRPC pricing](https://solidrpc.io/docs/pricing),
[agent/prepaid guide](https://solidrpc.io/docs/agents),
[public onboarding contract](https://api.solidrpc.io/agent/v1/onboarding),
[BNB methods/range](https://solidrpc.io/docs/chains/bnb-smart-chain),
[rate limits](https://solidrpc.io/docs/rate-limits),
[TheRPC catalogue](https://therpc.io/),
[GetBlock pricing](https://getblock.io/pricing/),
[RPC plans](https://getblock.io/rpc-api/),
[payment FAQ](https://getblock.io/faq/),
[BNB trace method](https://docs.getblock.io/api-reference/bnb-smart-chain-bsc/debug_tracetransaction-bsc).

## Reproducible requests and costs

Run **`npm run estimate:rpc`** offline. No endpoint is contacted. Reconstruction
uses `4 + 3C + W + M + F + T`: C checkpoint blocks, W historical withdrawal calls,
M historical marks, F funding receipts, T distinct trace transactions. The safe
preflight upper bound uses W=M=C. Cached identical reads consume no new provider
calls; canonical headers still need rechecking on resume. Errors/timeouts consume
our attempt/cost reservation even if the provider eventually waives a charge.

| Task / stated assumptions | RPC calls | Hypothetical prepaid cost at $4/million |
|---|---:|---:|
| Unfamiliar wallet, already published full window | **0** per lookup | $0 |
| Recent 278,319-block gap, old 1k paging, no liquidity events | **841 minimum** | $0.003364 |
| Same gap, measured 30k paging, no liquidity events | **34 minimum** | $0.000136 |
| Same gap, illustrative 8 event blocks per 30k window | **114**, plus resumes/failed pages | $0.000456 |
| Entire deployment→observed head, targeted logs only | **154 log calls minimum**, versus 4,618 at 1k | $0.000616 before headers/verification |
| Retained real 1-swap position | **38**: chain 1, code 2, headers 15, calls 16, receipts 3, trace 1 | $0.000152 |
| Retained real 10-swap position | **86**: chain 1, code 2, headers 31, calls 40, receipts 2, traces 10 | $0.000344 |
| Illustrative 100 swaps, 105 checkpoint blocks, 100 distinct traces | **631** | $0.002524 |
| Illustrative 1,000 swaps, 1,005 checkpoint blocks/traces 1,000 | **6,031** | $0.024124 |
| Daily index maintenance at the observed average ~191,950 blocks/day | **25 minimum**; **81** with illustrative 8 event blocks/window | $0.000100–$0.000324 |

Dollar figures are arithmetic scenarios, **not charges or binding quotes**.
Existing Free calls cost $0 within its confirmed plan/quota with no paid billing
mode. Node-returned errors may bill as calls; batches do not reduce billable
method count. Retried/dropped/dense pages, competing LP rounding events, source
extensions and resume headers add work. Same-block swaps can reduce distinct
headers/traces; other liquidity can increase checkpoints. A cost estimate does
not establish adequate marks or independent reconciliation.

The 100/1,000-swap scenarios **cannot run under today's 100-lifetime-attempt,
20-checkpoint, 10-trace limits**. Buying credit does not lift them. Larger jobs
still need a separately approved staged capture design with cumulative accounting,
source-safe caches and final independent reconciliation; no fresh-job cap reset.

## Measurable product path and discovery choice

Three discovery approaches were assessed:

1. **Shared forward liquidity index using measured 30k windows — selected.**
   Versioned contiguous pages, canonical event-block/boundary checks, finality,
   original head/accounting provenance and ABI/report hashes remain. Owner Actions
   can explicitly choose 20/40/80 calls within the unchanged combined 100/day.
   It reserves that amount rather than wasting all 100 on a 20-call job. The
   observed range is 30× wider and the gap's no-event verified-work lower bound
   falls from 841 to 34 calls. This refresh has **not** run live in Stage 6.
2. **Targeted provider-topic scanning.** Proven at 30k on the existing key;
   reduces data volume, not the deployment→head window count. Reuse the old
   shared baseline and scan only missing forward windows. Finding a recent
   position does not supply all intervening pool events needed to reconstruct it.
3. **Explorer/index service.** No authenticated explorer key or independently
   complete pool-specific index was available. Etherscan's public chain catalogue
   does not establish free BNB log availability from the source/ABI Free rule.
   Do not assume BscScan scraping or an undocumented subgraph solves coverage.
   [Explorer plan/chain source](https://docs.etherscan.io/supported-chains).

The published index still ends at 130841348. New forward liquidity pages do not
extend the full accounting dataset: later positions remain ANALYSIS NEEDED /
accounting-index extension required. The current website can discover unfamiliar
direct providers in the named window; an owner-run job must collect receipts,
storage/withdrawal checkpoints and dated marks before a new replay unlocks.

First small candidate remains **unverified**:
`0xa598e2658ef74196f498b00b289a7d5d64a42cd7:615031639178913965778603`.
Offline preflight: zero swaps, two events, five checkpoints, <=31 reads. The owner
may choose a different previously untested wallet. Website → Copy position ID →
Open owner-run workflow → Run workflow on main, with an explicit approved
allowance/day. No fifth job was dispatched here: the approval covered only 12
research calls, not a new reconstruction or catch-up campaign.

## Implemented usage controls

- Default `config/rpc-usage-policy.json`: existing endpoint only, Free, 100/day,
  100/job, 10 trace attempts/day, two analysis allocations/day, **$0** paid budget.
- Analysis and index share the existing concurrency group and non-force state
  branch. Bounded request/trace/cost allocations must be remotely committed and
  confirmed **before** RPC. Old full-100 reservations are retained without refunds.
- Exact integer nanodollar costs are reserved at locked prices. Each actual
  transport attempt is saved locally first under a single-writer lock, including
  failures. A stale crash lock stops further sends without releasing costs. Checkpointed
  method counts and upper-bound costs are retained remotely. Crash/lost latest
  progress cannot refund the reservation or reset lifetime counters.
- Paid mode requires an explicit owner approval reference, confirmed settled
  credit/terms/price, no overage, no recurrence/top-up, usage <= credit, and total
  provider payments + external fees **strictly < $10**. Free→paid policy transition
  needs an explicit previous-policy hash and preserves prior allocations; a paid
  ledger cannot be reset by changing accounts/configuration. No payment API exists.
- Unmetered prepaid transport is refused. `LP_RPC_URL` is an optional server-only
  alternative; existing secrets are unchanged. It needs its own approved policy,
  private binding and chain/historical-method capability proof. No auto-failover.
- HTTP 402/429 stop; no automatic recharge, paid fallback or unbounded retries.
  Identical cached reads are reused by the unchanged replay worker. Actions
  summaries show reserved/recorded usage and remaining authorised cost budget,
  clearly labelled as conservative bounds rather than invoices.
- No anonymous dispatch or browser RPC/payment credentials. Independent zero-
  discrepancy reconciliation, complete marks and all checks still gate promotion.

## Optional prepaid tranche and the one owner payment action

**Prepared fallback proposal only:** new SolidRPC prepaid, **US$1 USDC on Base**
gross (tax included in its binding quote), with **US$2 maximum all-in** including
external funding fees. Usable credit is `quoted gross − included tax`; at $4/M,
`floor(credit USD × 250,000)` is the credit-funded call ceiling. For example,
US$0.90 usable credit buys at most 225,000 calls, not 250,000. The app still limits
each approved run/day and does not automatically consume the purchased balance.

This is **NO-GO to execute today**: existing-account eligibility, exact gross/tax/
credit/fees, credit expiry/refunds and provider-enforced no-debt exhaustion must
be confirmed. Do not invent a total or ask for approval of an unknown quote.
If a provider cannot guarantee a hard prepaid stop with no excess charging,
reject it. Ordinary card PAYG is not an acceptable substitute.

Once those fields are known, the **single owner payment action** is to approve
that exact provider/account/credit/call ceiling and all-in quote, then complete
one payment in the provider-owned interface. If that interface cannot provision
this offer without a separately authorised account-creation/payment process,
stop; do not add a wallet or crypto flow to LP Detective. No private key, wallet
connection, extra Vercel token, recurring charge or automatic top-up is requested.

## Release gates

| Gate | Result |
|---|---|
| Existing free capacity and wider historical liquidity ranges | **PASS**, 12 actual approved calls; trace comparison limitation retained |
| Accurate current-wallet discovery | **PARTIAL**: pinned-window only; newer head/lag shown honestly |
| New incremental refresh implementation | **PASS offline; live refresh NOT VERIFIED** |
| Fifth hosted owner-run replay | **NOT VERIFIED**, needs chosen wallet + explicit run allowance |
| Public self-service | **NOT ENABLED**; owner copy-and-run path retained |
| Paid pilot | **PROPOSAL ONLY / NO-GO to fund until exact eligibility and quote** |
| New charges/accounts/subscriptions | **NONE** |

Final validation, branch and CI receipt are in DEVELOPMENT_LOG.md. Original four
replays, exact accounting and Stage 1B PARTIAL are preserved. This task pushes a
feature branch; no main merge or Stage 6 production deployment is claimed.
