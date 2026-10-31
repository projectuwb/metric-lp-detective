# Stage 1A — complete selected-position inventory to fixed head

**PASS through block 130841348**, hash
`0xd4b50c9afe0934057d61ccf2821e30c5b6dbf3553b6348ccb846e9f5a074ea7e`.
This is a fixed, dated endpoint (head minus 200 at acquisition), not an assertion
about a continuously moving current balance or a closed position.

Main synced at `dd123da` after PR #1. Earlier checkpoint fixtures/tests are retained.

Full unfiltered pool history: deployment 126502643 through 130841348, 434 contiguous
pages, 62,207 logs, 26,203 terminal swaps and 35,456 bin steps. There are 236 distinct
provider/salt identities. The selected position owns shares during 26,202 swaps,
covering 35,429 relevant bin steps. All other LP adds/removes participate in total
share/reserve reconstruction; no pool-volume allocation is used.

Selected provider `0x3216FBdef81Be1842A80D648C83C7aa10bc00787`, salt
`198136120981933274567974`:

| Event | Block | Log | Transaction |
|---|---:|---:|---|
| Initial add | 126509253 | 30 | `0xbe072d693de89938c714e49795610ee589df1e90773c21a234268fcc46ac9e87` |
| Additional add | 126663082 | 9 | `0x12cb5a33bdf0dcba17472cf9c62eb07c3b67951fad9fea9ac73d4b38ef9f97fc` |
| Partial removal | 128844379 | 188 | `0x5288f6d7b6a9e95bc27c011ad70b5ce87171eef909a177e7b9e7f7143f459867` |

Raw successful receipts are saved. Exact per-bin token/share changes are retained
in `fixtures/history/position-history.json`. Every position modification is included;
the salt is not merged with another position by the same owner.

Final entitled inventory:

- CRCLB: `22973419195727555217` base units = **22.973419195727555217**.
- USDT: `5657408436562991299915` base units = **5657.408436562991299915**.

Independent evidence: all 100 bins' token reserves, total shares and selected
shares match historical storage at seven boundaries (before/after all three
liquidity transactions plus endpoint): **2,800 exact comparisons**. Six nonempty
states also match the Solidity contract's historical full-position withdrawal
execution via read-only `eth_call`. No transaction is broadcast or claimed as an
actual withdrawal. The selected position remains open at the endpoint.

Rounding follows the existing source-matched ledger: ceil adds, floor per-bin
withdrawable entitlement, scale 1/1 and LP fees already inside reserves. Tolerance
is **zero base units**. Target-filtered snapshots reduce retained memory while
tracking every competing position for total-share invariants. Original unfiltered
checkpoint tests continue to run.

Reproduce:

```sh
npm run verify:history
# With server-only configured RPC, optional fresh bounded acquisition/reconciliation:
NODE_USE_ENV_PROXY=1 npm run capture:history
NODE_USE_ENV_PROXY=1 npm run reconstruct:history
```

`fixtures/history/acquisition.json` records coverage and a repeated endpoint hash;
`pool-logs.json.gz` contains the actual public logs. Historical state/withdrawal
call data and return data are saved separately, and the offline verifier checks
them against a fresh full replay. Private endpoint/key values are excluded.

Stage 1B is separate: execution-time references are not inferred from this ledger.
Performance results must name their valuation convention and availability. No
dashboard, dollar PnL or fully completed Stage 1 claim follows from Stage 1A alone.
