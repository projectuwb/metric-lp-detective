# Stage 1B — execution quote recovery and performance

**PARTIAL. Do not declare full Stage 1B or Stage 1 complete.**
Stage 1A inventory is independently reconciled through fixed block 130841348.
All figures below refer to that fixed endpoint and the selected provider/salt.

## Exact execution-time prices: verified subset

SolidRPC supports read-only `debug_traceTransaction` with `callTracer`. We recover
actual successful pool `swap` invocations and their provider `getQuote()` calls,
not block-end values or Hermes timestamps. The pool runtime is source-matched.
The provider is `0xd352e157Fd2BAd7b8B524013151B19b0a90b79BC`.

For each witness we save trace path, pool input/output and the provider call tree
with its raw ABI return. Third uint128 is the actual Q64.64 reference returned to
the pool; the other two are bid/ask. We reject failed parents, failed quotes,
ambiguous/missing calls and invalid bounds. Call order must match terminal Swap
logs, and each pool call's returned native amounts must match that log's signed
deltas. This resolves same-transaction oracle updates without substituting later
quotes. Multiple successful swaps in one transaction remain separate.

- 2,014 selected-position-related transactions have saved witnesses.
- Those transactions contain 2,146 validated pool swap executions.
- Total target: 25,191 transactions; **23,177 remain NOT VERIFIED**.
- A complete raw call-tree probe is saved for
  `0xb4f8bea7a1ba7a5b89cc4876c7d9bc215d5a5dec615a6c4508ff31b484a6918c`.
  Other witnesses are documented extracts from actual RPC callTracer results.
- Each witness includes tx/block/hash/log IDs and raw returned values. Files are
  compressed in `fixtures/oracle/quotes-*.json.gz`; verification cross-checks them
  against the full real pool event index.

Published oracle source reviewed:
`Metricxyz/oracle-contracts@7525bbd6b536bcd0c283de18af256fe54d629456`.
`AnchoredPriceProvider.getQuote/_getQuote` returns the anchor reference independently
of source-shaped bid/ask; `OracleBase.price` emits PriceRead but not the price value.
This source review alone is not a bytecode match for every historical oracle.
Exact quote assertions rely on observed provider return values consumed by the
source-matched pool, not an assumed oracle implementation or off-chain series.

## Provider rate limit and resumability

High-concurrency recovery (24 workers) encountered:
`debug_traceTransaction: RPC rate (code 429)`.
Examples and corrective action are saved in `rate-limit-observation.json`.
The bulk scan was stopped and successful results were exported without further
network requests. No missing quote was replaced by a mock or a block-end quote.

The visual MVP update bounds the worker to 1..2 concurrent requests (default 1),
at least one second between reservations, and 50 remote attempts per invocation
(default; hard maximum 100). Retries consume budget. The first rate response
opens the circuit so queued work cannot issue more remote requests. It resumes from local caches and committed compressed witnesses.
Missing witnesses keep PARTIAL status. No provider plan or paid infrastructure was
changed. Cheapest sound continuation: resume at concurrency 1 under the existing
provider's documented trace quota, or obtain an explicitly approved higher quota.
Do not claim a complete trace series until the coverage manifest and all witnesses
agree with every target transaction. A background/resumable run is preferable to
forcing a full scan into a serverless request.

```sh
npm run verify:oracle
ORACLE_TRACE_CONCURRENCY=1 NODE_USE_ENV_PROXY=1 npm run capture:oracle
npm run verify:oracle
```

## Performance under an explicit, separately verified valuation convention

After stopping the rate-limited scan, four low-volume historical reads succeeded:
provider `getQuote()` through `eth_call`, at block ends 126509253 (initial add),
126663082 (second add), 128844379 (partial removal) and 130841348 (endpoint).
Raw calls/returns and canonical block hashes are saved in
`fixtures/history/valuation-inputs.json` and matched to the inventory state.

**These are historical block-end provider references, not execution-time quotes.**
They are permitted inputs to the following named mark-to-reference convention;
they do not fill the gaps in the execution quote series. Reference values are
USDT per CRCLB. Treating USDT as a unit of account is not independent verification
of its USD peg. No underlying NYSE-share or later current-market prices are used.

Exact arithmetic retains a common Q64 denominator with bigint; no intermediate
monetary rounding. For token base quantities (18 decimals):

```text
marked value numerator = CRCLB_base * referenceX64 + USDT_base * 2^64
cashflow PnL = endpoint marked value - sum(signed funding flow marked at its block end)
```

Adds are positive funding flows; actual partial removals are negative. Credited
funding/removal quantities are independently matched to token Transfer receipts.
Gas, transaction fees external to the pool, and original pre-funding-wallet
performance are excluded. Retained LP fees already enter reconstructed inventory;
no extra fee-income term is added.

Holding benchmark: retain each actually deposited token and fund the same token
withdrawals at their historical times. Check every prefix remains nonnegative;
otherwise this benchmark is unsupported. It is not a strategy simulation or a
pre-funding-wallet baseline. In this history the partial withdrawal is USDT-only,
so this holding cashflow convention requires no invented trades.

Derived results in **USDT-equivalent**, six decimals truncated toward zero:

| Measure | Result |
|---|---:|
| Endpoint LP marked value | 7339.340769 |
| Cashflow-aware LP PnL | -171.228472 |
| Same-funded-token holding PnL | -288.448915 |
| LP performance versus that holding benchmark | +117.220443 |

Negative absolute marked PnL and positive relative performance are compatible.
The bridge `LP PnL = holding PnL + relative performance` holds exactly before
formatting. This is reference-marked performance under the stated convention,
not realized dollar profit or an assertion about per-swap execution price.

A separate Python `Fraction` calculator parses raw ABI reference words and checks
final value, both PnLs and the holding bridge independently of the TypeScript code.
The machine-readable result stores exact numerators/denominator and provenance.
Missing valuation inputs return UNAVAILABLE, never zero or substituted prices.

```sh
npm run verify:performance
```

## Remaining acceptance work

- Recover the remaining execution witnesses within provider limits.
- Validate any desired per-event valuation series against the exact execution
  references rather than interpolating between recovered samples.
- Finalize price/deviation/execution presentation and reconciliation confidence
  labels before any dashboard. Do not infer realised LP earnings from pool volume.
- The fixed endpoint is open; future live head movement needs an explicitly newer
  anchored acquisition, not a current-balance claim from these files.

Stage 1A is complete to its declared fixed head. Stage 1B has verified execution
quote samples and independently checked historical-reference performance, but
**full execution-time price coverage remains incomplete**.
