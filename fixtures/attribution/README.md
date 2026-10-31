# Real individual-LP attribution evidence

Actual chain-56 pool logs and receipts, historical storage responses, and read-only
historical contract execution. Endpoint/key values are excluded. No signed or
broadcast transaction exists. Withdrawal calls are independent entitlement quotes,
not recorded withdrawals. No artificial chain observations are included here.

Scope: pool deployment 126502643 through checkpoint 126553642. Run
`npm run verify:fixture` for A-D and exact checkpoint reconciliation.
`NODE_USE_ENV_PROXY=1 npm run capture:attribution` refreshes the bounded real evidence;
then rerun verification. See docs/LP_SWAP_ATTRIBUTION_VALIDATION.md for coverage,
math, rounding dust, every transaction/leg and explicit unverified work.
