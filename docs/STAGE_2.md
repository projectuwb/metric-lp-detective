# Stage 2 — second position and reusable reconstruction

Issue #4 was read in full from the public GitHub issue. Work starts from main
9c1bc7d (PR #3). Stage 1B remains PARTIAL for the original sample.

## Second position: VERIFIED inventory, closed lifecycle

BNB Chain 56; only the existing CRCLB/USDT pool. Provider
`0x3eB210eAa4026f62D027fafABA1fa5592feBb06A`, salt
`363274826789293944322560`. Historical owner code at initial funding is `0x`;
this is a provider position, not inferred ownership behind a manager.

| Action | Block | Log index | Transaction |
|---|---:|---:|---|
| Initial deposit | 128750025 | 840 | `0xa072e353ca8cd375bbc562df0693f5955f48308fdd9b04eab7cfc0ed090d0ce6` |
| Additional deposit | 128750137 | 492 | `0x018eb226bb4373f419b47b4a473ad4d333b17040517a3c1ec5e26e888cb57ca4` |
| Additional deposit | 128750274 | 280 | `0xe55c7863a6dda4f30883e1392b2bbbb0dbf5ebe2c7cfa009d71e4cd3fc2ef33d` |
| Full withdrawal | 128752283 | 419 | `0x1eecbac1ff505109332535ec78f76c26079a1120ab99383012e9dcf645f1633a` |

Bins 2–5. Nine attributable swaps and one rounding adjustment produce fourteen
replay rows. The generic builder uses the original per-bin ledger and whole-pool
share changes; it does not allocate pool volume. Original accounting is unchanged.

Evidence: `fixtures/positions/632f7d8c3d6ef54f/`. Fifteen historical checkpoints
compare all 100 bins' reserves, total shares and position shares (6,000 exact
comparisons). Twelve independent full-withdrawal eth_calls agree exactly. Four
actual receipts reconcile liquidity flows with token transfers. Seven saved full
transaction traces independently yield nine execution quotes matching pool Swap logs.
Raw calldata, returns, block hashes, log indexes and trace outputs are retained.
Permitted tolerance: zero base units. Endpoint balances: exactly zero CRCLB/USDT.
Thirteen historical block-end marks cover every replay block plus indexed head.
These marks are distinct from the nine execution-time quotes.

## Bounded reusable proof pipeline

`npm run analyse:position -- --id <publicProvider:uint80Salt>` uses the saved
complete pool index, not an unrestricted wallet crawl. It accepts one position,
at most 100 swaps and 20 checkpoints. A single worker has a hard 100-request budget,
minimum one-second pacing, finite RPC timeouts, and stops on rate limits. The
captured second-position run used 69 requests, followed by 15 paced canonical-header
confirmations (84 total RPC requests). No bulk trace scan was launched.

`npm run verify:position -- 632f7d8c3d6ef54f` is fully offline and independently
checks raw storage slots, calldata, receipts, traces and the pinned source-index
hash. Only passing artifacts may become a playable registered sample. Collection
alone yields PARTIAL; the verifier yields VERIFIED. Public chain fixtures contain
no provider URL or credentials. Contract-provider beneficial ownership remains
UNSUPPORTED until independently proved.

The CLI is a bounded research worker, not a durable hosted queue. No web request
claims QUEUED/PROCESSING or launches scans. Arbitrary discovered positions remain
indexed-only until independently reconciled. The smallest next infrastructure
decision is a durable job store plus one rate-limited worker, with explicit
per-position budgets and checkpoint reuse; no service has been provisioned.
Completed verified artifacts are idempotently revalidated and reused with zero
remote requests; they are never overwritten by a partial retry. New captures
check block hashes before and after their state/mark reads. The original capture
has separately saved canonical-header confirmations; these confirm current
canonical identity, not intermediate transaction state within a block.
The collector does not yet resume partially saved checkpoints;
the existing oracle-recovery pipeline remains separately resumable.

## Valuation limits

Use actual funded/withdrawn token amounts, not rounded entitlement deltas, for
cashflows. Initial entry rounding can make withdrawable inventory a few base units
smaller than the deposit. Values use verified historical block-end provider marks,
not execution references, interpolated observations, a live price or a USD peg.
The selected event's inventory is valued at that block's end, not its execution
time; later events in the same block can affect that mark. Gas is excluded.

The original holding convention retains each actually funded token and delivers
the same token withdrawals. This second position ultimately withdraws more USDT
than the holding basket contains after selling CRCLB. Its final matched-withdrawal
holding comparison is UNSUPPORTED; cashflow-aware absolute PnL is still derivable.
Do not replace that null benchmark with zero or a fictional sale.

## Integration and rollback

Keep the original sample as the default. Remove the second sample registration
to disable it without altering evidence or original accounting. Reverting Stage 2
commits restores the PR #3 application. No Vercel deployment is initiated here;
a branch push is not proof of a deployment. Hosted runtime verification remains
separate from local production-browser checks.

## Public analysis status

`GET /api/positions/[provider:salt]/status` returns VERIFIED, INDEXED_ONLY or
UNSUPPORTED with the indexed head/hash, last independently verified block where
applicable, `queueAvailable: false` and `progress: null`. Input is canonicalized,
uint80-bounded, rate-limited and never used as a filesystem path. The offline
collector writes real PROCESSING counts and PARTIAL, FAILED, UNSUPPORTED or
RATE_LIMITED outcomes to its artifact status; successful offline verification
yields VERIFIED. No hosted progress or retries are claimed for an absent worker.

A durable job implementation would need a job key comprising chain/pool,
provider/salt, index end hash and accounting version, a bounded single-worker
lease/retry policy and immutable artifact storage. Reuse the current provider
quota and run one explicit job at a time. Existing fixtures plus a CLI worker
are the zero-new-service proof of concept; hosted always-on cost and provider
throughput have not been measured and no paid service is required for the demos.
