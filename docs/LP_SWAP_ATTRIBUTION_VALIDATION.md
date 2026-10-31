# Individual LP swap attribution validation

Validated 31 October 2026 (Australia/Sydney). **A, B, C and D PASS for the stated
historical checkpoint interval. Stage 1 is NOT declared fully complete.**
This is a deterministic reconstruction of actual public events, compared with
historical chain state and actual contract execution through read-only `eth_call`.
No transaction was signed or broadcast; no withdrawal is claimed to have occurred.

## Scope and evidence

- Chain 56, pool `0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4` only.
- Pool logs queried from deployment `126502643` through checkpoint `126553642`,
  inclusive: 51 contiguous pages of 1,000 blocks, 11 logs, 3 swaps, 5 bin legs,
  2 liquidity adds, 1 reviewed non-inventory configuration update, 0 unknown events.
- Selected position P: provider `0x3216FBdef81Be1842A80D648C83C7aa10bc00787`,
  salt `198136120981933274567974`, 20 bins `-10..9`.
- Other position Q: provider `0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4`,
  salt `1068754547228601823113491`, bins `-8..9`.
- Selected first add: `0xbe072d693de89938c714e49795610ee589df1e90773c21a234268fcc46ac9e87`,
  block `126509253`, log `30`. Logs from deployment establish no earlier add.
- All queried events are matched to complete successful receipts. Canonical block
  hashes are saved and checked at the event-bearing boundaries. No recent-window
  assumption is used to initialize ownership.
- 12 historical snapshots: 20 bins each, reserve0/reserve1, total shares, both
  positions' shares; **1,200 comparisons, zero differences**. Includes before/after
  every swap and deposit plus deployment and the endpoint.
- **56 successful historical removal `eth_call` executions**: full positions and
  bins 0/1/2 where owned. Returned native payouts match reconstructed entitlements.
  Each call specifies the real owner, salt and archived share quantities. These
  are independent executed withdrawal quotes, not real withdrawal transactions.
- `eth_getStorageAt` independently agrees with batched `extsload` for bin 1 at
  all 12 snapshots. Batched reads are decoded using the explicit `bytes32[]`
  overload, not name-only ABI dispatch.

| Required test | Result | Verified boundary |
|---|---|---|
| A — single LP bin | **PASS** | Bin 0, first swap, blocks `126532509 -> 126532510` |
| B — shared bin | **PASS** | Bin 1, blocks `126552253 -> 126552254`, two positions |
| C — changing shares | **PASS** | Q adds to bin 1 at `126543141`, then shared swap |
| D — full-position reconciliation | **PASS — checkpoint scope** | P first add through `126553642`, all 20 funded bins |

These results do not assert current balances, a final lifetime exit, full history
through now, historical reference prices, PnL or a validated removal-event path.

## Deployed source and exact math

Source/runtime matching is documented in [PROTOCOL_AUDIT.md](PROTOCOL_AUDIT.md),
including the linked LiquidityLib. Pinned core revision:
`ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3`.

- [LiquidityLib](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/libraries/LiquidityLib.sol):
  `_positionBinKey`, `addLiquidity` (existing-bin ceil `Math.mulDiv`),
  `removeLiquidity` (per-bin floor `Math.mulDiv`, then scale conversion).
- [PoolStateLibrary](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/libraries/PoolStateLibrary.sol):
  `_calculateBinStateSlot`, `_calculateBinTotalSharesSlot`, `_toPositionBinKey`,
  `_calculatePositionBinSharesSlot`, `_decodeBinState`.
- [SwapMath](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/libraries/SwapMath.sol):
  `buyToken0InBinSpecifiedIn`, `buyToken0InBinSpecifiedOut` and corresponding
  token1 functions update scaled bin balances and return deltas/fee legs.
- [MetricOmmPool](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/MetricOmmPool.sol):
  `_executeSwap` emits `BinSwapped` after applying exact in-bin math;
  `_getUpdatedFeeData` handles platform surplus/pending fees separately;
  `removeLiquidity` requires the caller to be the owner.

For bin b, owner o, salt a:

```text
key       = keccak256(abi.encode(address o, uint80 a, int16 b))
position  = mapping at slot 6 keyed by key
S         = total shares in mapping at slot 5 keyed by bin b
R0, R1    = uint104 scaled balances in mapping at slot 4
s         = this position's shares
E_i       = floor(R_i * s / S), or 0 when s = 0
LP change = floor(R_after * s_after / S_after)
          - floor(R_before * s_before / S_before)
```

The pool does **not** run a per-LP distribution loop on swaps. Swaps change the
shared reserves; LP entitlement changes implicitly through s/S. There is no LP
fee-growth checkpoint/debt accumulator or per-position fee-claim balance in this
matched source. LP income remains in reserves and is realized through withdrawal.
The per-position share mapping is changed by liquidity mint/burn, not swaps.
Platform fee settlement can be lazy; it does not mint LP shares or add a second LP
fee credit to the bins. Position ownership units s stay fixed between its own
mint/burn operations, but **s/S is not fixed when other positions mint/burn**.
Even fixed s/S yields changing token entitlement as reserves trade/retain fees.

Add to a nonempty bin: each token input is `ceil(R_i * addedShares / S)`.
Remove: each scaled output is `floor(R_i * removedShares / S)`; native payout is
`floor(sum(per-bin scaled outputs) / tokenScaleMultiplier)`. All native amounts in
this pool use 18 decimals; both immutable scale multipliers are 1. Code uses bigint
only for monetary/share arithmetic. The reserve ceiling is uint104, not a float.

For each swap step, packed signed high/low halves are scaled token0/token1 bin
deltas. Fee high/low halves are LP/platform input-token fees. Source carves fees
with integer Q64.64 multiplication/division; LP fee is total carved fee minus the
platform part, and bin credit is gross input minus platform fees. **LP fee is
already in the emitted bin delta. Never add it again.** We use the real emitted
post-rounding deltas rather than inventing a price or rerunning a hypothetical fill.

A position's economic share of an LP fee is the exact rational `feeLP * s / S`.
That is not a separately credited integer balance. Withdrawal-floor effects depend
on all reserves. The machine-readable report retains each fee numerator/denominator;
actual attributable token changes are differences of floored entitlements. In
particular, `floor(deltaR*s/S)` is not a safe replacement, especially for signed
negative deltas and existing fractional dust.

## Test A — PASS: one verified LP in bin 0

Transaction `0xb4f8bea7a1ba7a5b89cc4876c7d9bc215d5a5dec615a6c4508ff31b484a6918c`,
block `126532510`, BinSwapped log `184`, terminal Swap log `188`.
Only P owned bin 0 in the entire deposit-to-swap interval: P shares and total shares
were both `7397760061908989030`. The other position had not yet deposited.

All following token amounts are exact base units (18 decimals):

| Bin 0 / P | CRCLB | USDT |
|---|---:|---:|
| Before | 3703727957680262727 | 0 |
| Pool delta = P delta | -3682759984279235586 | 298909851633504834959 |
| After | 20967973401027141 | 298909851633504834959 |

LP fee: `2540743472601943` USDT base units, already retained; platform fee:
`448366495165041`. Exact bin reserves/share mappings and read-only removal outputs
at both historical boundaries agree. **Discrepancy: 0; tolerance: 0.**

## Test B — PASS: two LP positions share bin 1

Transaction `0xf5ec0f818fa9ab68963fd23daede91029f4c164fe471948961b743887c3ce171`,
block `126552254`, bin 1 log `99`; bin 2 log `100`; terminal Swap log `104`.
There is exactly one transition for bin 1 in this block, so the previous block-end
and this block-end are valid independent before/after boundaries for that leg.

Shares before and after this swap are unchanged:

| Position | Shares |
|---|---:|
| P | 7397760061908989030 |
| Q | 19137425026946741757 |
| Total | 26535185088855730787 |

| Bin 1 / position | CRCLB before | CRCLB delta | CRCLB after | USDT before | USDT delta | USDT after |
|---|---:|---:|---:|---:|---:|---:|
| Pool | 151734189374346232 | -151734189374346232 | 0 | 1066061456754416376006 | 12392972887848282518 | 1078454429642264658524 |
| P | 42302065066472796 | -42302065066472796 | 0 | 297207908741156784639 | 3455044295754653575 | 300662953036911438214 |
| Q | 109432124307873435 | -109432124307873435 | 0 | 768853548013259591366 | 8937928592093628943 | 777791476605353220309 |

LP fee retained in bin 1 is `598292052562106` USDT base units; platform fee withheld
is `105580950452136`. Economic fee fractions use the two share numerators over the
same total above. They are not added to the token deltas a second time.

Historical storage and independent single-bin removal calls validate **both** LPs
before and after. Sum of LP CRCLB deltas is one base unit less negative than the
pool's delta: pre-swap unallocated floor dust was 1 CRCLB base unit; after it is 0.
USDT floor dust remains 1. Thus `sum(LP deltas) + change(dust) = pool delta` exactly.
This is explained rounding, not an unexplained reconciliation tolerance.
**Per-position discrepancy: 0; tolerance: 0.**

## Test C — PASS: another LP changes the denominator

Q add transaction
`0x6a72450dbeb1d0697369ee41479f0bd0d274d6c7c0253b009ca3c6590809e31f`,
block `126543141`, log `206`. Test examines its bin 1 row.

- P shares stay `7397760061908989030`.
- Total shares change from `7397760061908989030` to `26535185088855730787`.
- P fraction changes from 1 to `7397760061908989030/26535185088855730787`.
- Q mints `19137425026946741757` shares, adding `109432124307873436` CRCLB and
  `768853548013259591367` USDT base units according to source ceil math.
- P's floored entitlement remains `42302065066472796` CRCLB and
  `297207908741156784639` USDT base units. No fee/income is invented from this add.
- The first later bin 1 swap is the Test B transaction. It uses the **new**
  denominator, giving P the limited delta in Test B rather than the entire trade.

Both deposit boundaries and subsequent swap boundaries match historical mappings
and executed withdrawal quotes. **Discrepancy: 0; tolerance: 0.** The mutation test
that omits Q's real add fails reserve invariants; it cannot silently reconcile.
C is verified using an **add**. A real competing-removal interval is **NOT VERIFIED**;
the removal branch is implemented from source but has not received equivalent
real-world validation here.

## Test D — PASS: full-position reconciliation to a declared checkpoint

All selected position bins `-10..9` are replayed from its first deposit through
checkpoint `126553642`; replay initialization begins at pool deployment. Every
one of the interval's 3 swaps (5 bin legs) is included, including the 2-bin swap
at block `126532512`. Q's add updates all affected denominators. No selected LP
add/remove occurs after its initial funding in this interval.

| P cash/inventory bridge | CRCLB base units | USDT base units |
|---|---:|---:|
| Starting credited / withdrawable inventory | 37037279576802627270 | 2999999999999999997560 |
| Sum attributable swap changes, fees already included | -10785847865962889862 | 877219497229389548729 |
| Entitlement change from competitor rounding | 0 | 0 |
| Reconstructed checkpoint entitlement | 26251431710839737408 | 3877219497229389546289 |
| Independent complete historical removeLiquidity eth_call | 26251431710839737408 | 3877219497229389546289 |
| Difference | **0** | **0** |

Checkpoint amounts: **26.251431710839737408 CRCLB** and
**3877.219497229389546289 USDT**. These are exact withdrawable token entitlements
at this checkpoint, not current balances, realized withdrawal proceeds or dollar PnL.
The independent full-position call uses P as caller and every archived owned share.
Its Solidity execution floors per bin and sums/converts natively, independently
of our event replay. All 20 reserve/share states also match directly.

**Allowed reconciliation tolerance is zero native base units.** Contract floors
and scale conversion are exactly reproducible; a nonzero difference fails. We do
not add a blanket dust allowance. Fractional economic interests across different
owners can leave bounded bin dust: for n positive-share positions each token's
sum of floored entitlements leaves an integer dust in `[0,n-1]` scaled units.
That separate dust identity is explicitly checked in B, not used to excuse an
incorrect individual withdrawal amount.

## Every covered swap and ownership filtering

Exact full-position before/after token quantities for P follow. Event-to-bin legs,
fee fractions and full per-LP/bin state are in `validation-results.json`.

| Transaction / block / terminal log | P CRCLB before | P CRCLB after | P USDT before | P USDT after |
|---|---:|---:|---:|---:|
| `0xb4f8bea7a1ba7a5b89cc4876c7d9bc215d5a5dec615a6c4508ff31b484a6918c` / 126532510 / 188 | 37037279576802627270 | 33354519592523391684 | 2999999999999999997560 | 3298909851633504832519 |
| `0x72e3c551c029f4a14e86c0b5c2c5038b93b9afa9b4debd54fb6c077a05e232ec` / 126532512 / 166 | 33354519592523391684 | 29672125726508574612 | 3298909851633504832519 | 3597819703267009667479 |
| `0xf5ec0f818fa9ab68963fd23daede91029f4c164fe471948961b743887c3ce171` / 126552254 / 104 | 29672125726508574612 | 26251431710839737408 | 3597819703267009667479 | 3877219497229389546289 |

All 5 legs in this interval genuinely change P's inventory; none is merely a
historically funded-bin match. A real exclusion example exists for Q: the first
swap above touches bin 0, which Q funds only later. At execution Q owned zero shares,
so its delta is exactly zero. The next swap's bin 0/bin 1 legs are likewise excluded
for Q. The report and regression test retain these actual historical examples.
Code distinguishes zero shares, nonzero shares with zero rounded token change,
and actual entitlement changes. No artificial evidence is used to claim a real
zero-rounded-change example; none was found in this small interval.

## Reproduce and limitations

Final checks: **42 tests passed across 4 files**, zero failed/skipped;
`npm run typecheck` and `npm run verify:fixture` passed. The full acquisition was
repeated successfully with no RPC/quote failures. Credential scan checked 56
project files and found zero configured endpoint/key-component matches.
Refresh invalidates older PASS reports until reconciliation succeeds again;
global fixture failures cannot silently retain a stale successful result.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run verify:fixture
# Optional repeat of the real acquisition (server-only BNB_RPC_URL required):
NODE_USE_ENV_PROXY=1 npm run capture:attribution
npm run verify:fixture
```

Files:

- `fixtures/attribution/pool-logs.json`: complete bounded pool event query.
- `fixtures/attribution/receipts/`: full successful public receipts, including
  every pool log in each sampled transaction, independently matched to the query.
- `fixtures/attribution/historical-state.json`: block hashes, raw slot responses,
  decoded state, actual call data/return data for ephemeral withdrawal quotes.
- `fixtures/attribution/validation-results.json`: PASS/FAIL/NOT VERIFIED results,
  exact before/after bin/position data, fee rationals and input checksums.
- `fixtures/expected/preferred-position-checkpoint.json`: independently checked D.
- `lib/metric/positionLedger.ts`: ordered replay and floor/ceil accounting.
- `scripts/verify-attribution.ts`: historical storage/contract-result validator.

A first local acquisition attempt selected the wrong return ABI for the overloaded
`extsload` and failed decoding (`Cannot convert x to a BigInt`). The RPC did not
fail. We fixed explicit `bytes32[]` overload selection, re-ran acquisition, and
validated raw lengths/decoded amounts. No data was substituted. There were no
historical RPC denials or withdrawal-quote failures in the successful runs.
The initial negative regression test incorrectly expected a returned state after
omitting Q's add; the replay correctly rejected impossible reserves. Its assertion
now expects that failure. Final validation results supersede those local test errors.

The fixtures were acquired through the configured SolidRPC provider. Event replay,
storage and executing contract math are independent validation paths on the same
chain, not separate provider attestations. Before/after block reads are valid for
these examples because the selected bin has one changing event at that block;
we do not pretend block-end reads prove arbitrary mid-block state. For multi-leg
swaps, intermediate steps follow exact ordered events; independent checks cover
the block boundaries and each changed bin. The pool has no nested successful swap
calls under its guard in these receipts; terminal Swap grouping is enforced.

This confirms individual-LP swap attribution and a full-position **checkpoint**
reconciliation. It does not complete Stage 1's intended longer history or oracle
context. Exact execution-time provider references remain null; no Q64 fill/price
or dollar earnings is invented. Current state, lifetime exit, real partial/competing
withdrawals and large-history performance remain NOT VERIFIED. Simplest next work:
extend this same deployment-origin pool index to a clearly selected later checkpoint
or real removal, retain exact share changes and archive reconciliation, and separately
recover applied provider quotes from transaction evidence where possible. No
pool-volume allocation or simulated-fill substitute is needed for inventory.
