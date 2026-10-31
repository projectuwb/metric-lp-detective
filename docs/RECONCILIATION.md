# Preferred position checkpoint reconciliation

The independent tests and exact contract formulas are documented in
[LP_SWAP_ATTRIBUTION_VALIDATION.md](LP_SWAP_ATTRIBUTION_VALIDATION.md).

Replay begins at deployment 126502643; selected deposit is block 126509253.
The fully covered interval ends at **126553642**, not the current chain head.
Three swaps/five bin legs and the competing add are replayed across all 20 selected
bins. Exact result and independent historical Solidity removal quote both return:

- CRCLB: `26251431710839737408` base units (18 decimals).
- USDT: `3877219497229389546289` base units (18 decimals).

Differences are `[0, 0]`, permitted tolerance `[0, 0]`. LP fees are already inside
bin reserves; competing add changes the denominator and creates shared floor dust,
not another LP's funding being credited as selected trading income. The observed
selected entitlement change caused by the competing add is zero.

Run `npm run verify:fixture` offline against the saved real receipts, historical
raw storage and `eth_call` results. The expected checkpoint fixture is
`fixtures/expected/preferred-position-checkpoint.json`. Stage 1 remains incomplete:
no lifetime exit/current balance claim, oracle reference context or PnL is asserted.
