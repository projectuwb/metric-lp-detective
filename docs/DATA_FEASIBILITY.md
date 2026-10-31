# Stage 0 data feasibility — REAL DEPOSIT GATE PASSED

Verified 31 October 2026 (Australia/Sydney) using the configured server-side
SolidRPC endpoint. URL and key are absent from reports and fixtures. No mock data
was substituted. This document records Stage 0. Subsequent bounded Stage 1
attribution evidence is in [LP_SWAP_ATTRIBUTION_VALIDATION.md](LP_SWAP_ATTRIBUTION_VALIDATION.md);
Stage 1 is not fully complete, and dashboard work has not started.

## Connectivity and exercised capabilities

| Method | Actual result |
|---|---|
| `eth_chainId` | `0x38` = BNB Chain 56 |
| `eth_blockNumber` | Initial `130795001`; repeat live verification `130795938` |
| `eth_getCode` | First pool code at `126502643`; previous block returns `0x` |
| `eth_getLogs` | Two deposits found; recent fixed range `130794081..130795080` returned 10 logs |
| `eth_getTransactionReceipt` | Four successful receipts, independently re-fetched and matched |
| `eth_getBlockByNumber` | Receipt block hashes matched canonical headers |
| `eth_call` | Immutables, token metadata, provider token pair, deployer and historical position shares succeeded |

Archive state was exercised at add blocks `126509253` and `126543141`, where a
sampled bin's position shares match each event. This establishes those historical
calls, not universal archive retention or transaction-trace availability.
Official Metric deployment docs and Deviation now work; BscScan still returns HTTP
403. Source matching used compilation plus RPC runtime, not explorer verification.

## Real evidence

`fixtures/raw/manifest.json` records acquisition time, chain/pool, source revision,
positions, exact bin allocations, topic hashes, receipt SHA-256 checksums and query
coverage. Four full public receipts, selected block-header fields, raw code,
immutables and historical reads are retained. Endpoint, key and response headers
are excluded. Artificial codec vectors remain separately under `fixtures/unit/`.

Preferred: provider `0x3216FBdef81Be1842A80D648C83C7aa10bc00787`, salt
`198136120981933274567974`; add tx
`0xbe072d693de89938c714e49795610ee589df1e90773c21a234268fcc46ac9e87`,
block `126509253`, log `30`, bins `-10..9`.

Backup: provider `0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4`, salt
`1068754547228601823113491`; add tx
`0x6a72450dbeb1d0697369ee41479f0bd0d274d6c7c0253b009ca3c6590809e31f`,
block `126543141`, log `206`, bins `-8..9`.

In both adds, receipt sender and token funding sender equal the emitted provider;
each provider had no code at that block. Summed bin deltas exactly match actual
token Transfers into the pool (scale multipliers 1/1). These are real position and
funding paths, not a claim about a person's off-chain identity.

The saved swap at block `130794396` proves BinSwapped/Swap decoding and the
bin/platform-fee/native-transfer bridge. No attribution to either candidate is
claimed. LiquidityRemoved ABI and math match source, but no real removal receipt
has been tested. Preferred position removal search `126509253..126609252` returned
no events; later closure/active status is unknown.

## Coverage and provider limits

- Add-topic discovery: 41 contiguous 1,000-block ranges,
  `126502643..126543642`, two distinct owner/salt adds.
- All-event queries: 1,000 deployment blocks, 1,000 recent blocks and both individual
  deposit blocks during live verification. Most lifetime coverage is unscanned.
- Optional preferred owner/salt removal-topic search: 100 contiguous 1,000-block
  ranges. The exact no-result coverage is saved in the manifest.
- Deployment through checkpoint `130795080` spans 4,292,438 inclusive blocks.
  The all-event queries cover 2,002 distinct blocks; 4,290,436 blocks remain
  unqueried for all-event coverage. Topic-only discovery does not fill those gaps.
  No complete lifetime event count, LP swap ledger or position reconstruction exists.
- A 50,000-block filtered request failed with RPC `-32602`. 1,000-block pages
  succeeded. Exact maximum range/result cap, plan quotas, cost/rate limits and
  production throughput are unverified; no free/unlimited tier is assumed.

The reader allows at most 100,000 blocks per invocation, defaults to 1,000-block
pages, halves range/result-size errors without advancing the cursor, retries
rate/temporary failures four times maximum with 250/500/1,000ms backoff, and fails
authorization/invalid/reverted calls immediately. Timeout is 20 seconds; response
limit 8 MB. Page/log budgets fail explicitly. It validates emitter and bounds,
sorts block/transaction/log numerically, deduplicates chain+tx+log, rejects removed
or conflicting logs/block hashes, and reports progress/retry/shrink counts.
Cancellation is checked between requests; in-flight work is timeout-bounded.

A provider silently truncating below the configured count cap is still possible;
receipt and independent coverage checks remain necessary. Returned-log conflict
detection is not finality proof; live verification checks canonical headers.
An empty filtered/recent scan never proves lifetime absence.

## Failed operations and redacted diagnostics

| Exact method / operation | Redacted error | Outcome |
|---|---|---|
| Pool `eth_call`: `FACTORY()`, `TOKEN0()`, `TOKEN1()`, `token0()`, `token1()` | RPC code `3`, execution reverted | Unsupported getters; successful `getImmutables()` supplies metadata |
| `eth_getLogs`, add topic, `126502643..126552642` | RPC range error, code `-32602` | Same cursor retried successfully with 1,000-block pages |
| HTTPS GET BscScan pool page | HTTP `403` | Used source compilation and RPC evidence |

Initial code-3 probes had the old generic `temporary` label. The transport now
classifies execution reverts explicitly, includes exact RPC method and numeric
HTTP/RPC code, and suppresses raw provider messages, bodies and URL. No failed
operation was silently replaced by synthetic data or another chain/provider.

## Reproduce

Use Node 24+, a server-only `BNB_RPC_URL` and the allowed endpoint hostname. Preserve
inherited proxy and CA trust. Node fetch uses the managed proxy with
`NODE_USE_ENV_PROXY=1`. Offline receipt tests require no provider credential.

```sh
cd /workspace/metric-lp-detective
npm ci --ignore-scripts
npm test
npm run typecheck
NODE_USE_ENV_PROXY=1 npm run verify:stage0:live
NODE_USE_ENV_PROXY=1 npm run audit:rpc -- 130794081 130795080
```

Live verification re-fetches four fixed receipts, checks identity/logs/canonical
headers, verifies code before/at deployment and confirms deposit logs/recent range.
It never writes the endpoint. To reproduce source comparison, checkout official
core revision `ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3`, initialize its pinned
OpenZeppelin submodule, then run:

```sh
node scripts/compile-source.mjs /path/to/pinned/pool-contracts
node scripts/verify-source.mjs
```

Compilation uses installed solc 0.8.35 and writes ignored `artifacts/`. Verification
compares saved public code and updates `fixtures/raw/source-match.json`. Compiler
settings, normalized ranges and linked library/address checks are explicit there.
Generated full ABIs live under `fixtures/abi/`; tests do not need the source
checkout. No environment draft was reapplied or published during this task.

## Validation and next gate

- `npm test`: **30 passed**, 3 files, zero failures/skips after correcting the new
  receipt tests to select Transfer topic0 explicitly. Tokens also emit other events.
- `npm run typecheck`: **passed**.
- `npm run verify:stage0:live`: **passed**; four receipts and 10 historical logs matched.
- Compiled pool/library source comparison: **passed**, masking only declared
  immutable/link regions and checking linked/self-address fields separately.
- Credential scan: 39 project files checked against the configured endpoint and
  likely credential components; **zero matches**. No secret values were printed.
- Lint/UI build/smoke: unrun, no frontend exists. Real removal integration,
  execution-time reference and position reconstruction/reconciliation remain unrun.

Stage 0 identity/source/ABI and real-deposit gate passes with these limits. The
smallest proposed Stage 1 task is the preferred provider+salt ledger from first add
through a selected independently verifiable checkpoint, with touched-bin swaps,
competing shares and final token entitlement reconciled to archive state/withdrawal.
Keep exact reference null where execution-time evidence is absent. Await Stage 1
approval at the Stage 0 handoff. The subsequently authorized attribution task has
now verified inventory through checkpoint `126553642`; no PnL was implemented.

The sanitized repeat-verification transcript is saved as
`fixtures/raw/verification-run.ndjson`; its final run observed head `130796529`.

## Stage 2 update — 2026-10-31

The second sample provider `0x3eB210eAa4026f62D027fafABA1fa5592feBb06A`, salt
`363274826789293944322560`, is independently reconciled: 9 swaps, three deposits
and full withdrawal, bins 2–5, 15 historical checkpoints, 6,000 exact storage
comparisons and 12 historical withdrawal calls; zero base-unit discrepancy.
Four actual receipts and seven raw transaction traces (nine swap quotes) are retained under
`fixtures/positions/632f7d8c3d6ef54f/`. The bounded capture used 69 RPC requests plus 15 canonical-header confirmations
(84 total), one worker, at least one-second pacing. No unrestricted trace scan ran.
Thirteen block-end reference marks cover all twelve event blocks plus fixed head.
The original sample and all original verification evidence remain unchanged.
See [Stage 2](STAGE_2.md) for transaction/log identifiers, reproduction, valuation
limits and incomplete arbitrary-wallet support. Stage 1B remains PARTIAL overall.
