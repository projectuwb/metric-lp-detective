# Metric LP Detective

New independent, read-only investigation of Metric CRCLB/USDT on BNB Chain.
The [build specification](Metric_LP_Detective_Codex_Build_Spec.md) is the contract.
Standing autonomous Git instructions are in [AGENTS.md](AGENTS.md); milestones,
commit hashes and outstanding issues are in [the development log](docs/DEVELOPMENT_LOG.md).
**Stage 0 identity/source/ABI and real-deposit gate passed.** Individual-LP
attribution now passes real Tests A–D through checkpoint `126553642`.
**Stage 1 is not fully complete**: lifetime/current state and exact oracle context
are unverified.

Verified pool: `0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4`, chain 56.
Actual deployment/add/swap receipts, two public LP candidates and exact per-bin
allocations are saved. The bounded position inventory is reconstructed and matches
historical withdrawal-contract execution with zero difference. No dashboard,
wallet connection, historical price series or earnings/PnL claims exist.

- [Protocol audit](docs/PROTOCOL_AUDIT.md): deployed identity/source match,
  accounting semantics, candidates and unresolved Stage 1 questions.
- [Data feasibility](docs/DATA_FEASIBILITY.md): actual RPC results, coverage,
  redacted failures, limits and reproducibility commands.
- [Raw fixture manifest](fixtures/raw/manifest.json): transaction/block/log IDs,
  bin/share allocations and receipt checksums.
- [Individual-LP attribution validation](docs/LP_SWAP_ATTRIBUTION_VALIDATION.md):
  separate A–D results, shared-bin allocation, rounding dust and exact checkpoint.
- [Reconciliation](docs/RECONCILIATION.md): independent historical entitlement check.

## Checks

Node.js 24+ and npm. Offline tests use actual fixed receipts plus separately
labelled artificial codec vectors; no credential needed.

```sh
npm ci --ignore-scripts
npm test
npm run typecheck
npm run scan:credentials
# Or run all automated integration gates:
npm run check
```

42 tests and typecheck passed. Validate the real attribution fixture offline:

```sh
npm run verify:fixture
```

With server-only `BNB_RPC_URL` configured and its
hostname allowed, preserve proxy/CA trust and run:

```sh
NODE_USE_ENV_PROXY=1 npm run verify:stage0:live
NODE_USE_ENV_PROXY=1 npm run audit:rpc -- 130794081 130795080
NODE_USE_ENV_PROXY=1 npm run capture:attribution
npm run verify:fixture
```

Provider errors identify the method and redacted category/code. No endpoint/key
is printed or saved. Never commit `.env` or use a `NEXT_PUBLIC_` credential.
Public sample receipts are stored, not user wallet search history. No browser RPC,
write transactions or other pools/chains are implemented. Full lifetime coverage,
closure and applied oracle quotes remain unverified. Per-LP swap attribution is
verified for the explicit early interval only. See the validation report before
extending coverage; no dashboard work has started.
