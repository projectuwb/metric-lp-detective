# Real public Stage 0 evidence

Actual SolidRPC BNB Chain results for the single Metric CRCLB/USDT pool. No endpoint,
key, response headers, invented receipts or wallet outcomes are included.

- `manifest.json`: acquisition context, coverage, topics, position IDs, exact bin
  allocations and SHA-256 checksums of the four full receipt files.
- `*.receipt.json`: unmodified public RPC receipts.
- `*.header.json`: selected public block-header fields matching the receipts.
- `code-and-identity.json`: pool/library runtime, deployment boundary, immutables
  and token metadata.
- `historical-reads.json`: deployer/provider checks and sampled position shares.
- `source-match.json`: compiler/runtime comparison and declared normalization ranges.

Run `npm test` offline or `NODE_USE_ENV_PROXY=1 npm run verify:stage0:live` with the
server provider configured. Artificial codec vectors remain under `fixtures/unit/`.
These fixtures do not reconstruct LP history or earnings.
