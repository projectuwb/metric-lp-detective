# METRIC LP DETECTIVE
## Product scope, execution plan, and Codex build specification

**Version:** 1.0  
**Prepared:** 30 October 2026  
**Project type:** New, independent, read-only web application  
**MVP network:** BNB Smart Chain (chain ID `56`)  
**MVP protocol/pool:** Metric OMM, **CRCLB/USDT**  
**Pool contract to verify:** `0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4`  
**Status:** Build brief; **not** a claim that a historical LP has already been reconstructed.

> **Codex directive:** Deliver a verifiable reconstruction of **one real LP position in this one pool** before expanding features, chains, or pools. Build the smallest useful product that tells the truth about what happened to the LP's assets. If the on-chain data or accounting cannot establish a number, show **unavailable / not yet verified** rather than an estimate disguised as fact.

---

## 1. Vision and motivation

**One-sentence proposition:** Enter a public wallet address, select a Metric liquidity position, and **play back what actually happened to its stock and stablecoin holdings**—trade by trade, with source transactions, oracle/reference prices, active bins, balances, and an explainable performance bridge.

### The user problem

A conventional LP dashboard shows current balance, TVL, fees or aggregate Trading PnL. That does not explain **why** the position changed. Users want answers such as:

- What exactly did I deposit, into which bins, at what reference price?
- Which trades actually touched the bins **while I owned liquidity shares**? How much of those trades was attributable to my position?
- When did my LP buy CRCLB, sell CRCLB, or hold steady? What changed in USDT?
- What were the **on-chain reference** and **pool's relative deviation/price** at each event, and how were executable bid/ask prices determined?
- Why did my position become more stock-heavy or stablecoin-heavy?
- How much of my dollar gain/loss was attributable to market movement, trading/inventory changes, earned spread/fees, and my own adds/removals?
- Did my LP make money in dollars? Did it outperform **holding the same tokens actually funded at entry**? Did it outperform leaving my **original pre-funding wallet** alone, where that wallet baseline is known?
- How would the experience differ if I had exited at a specific historical moment? **Clearly label counterfactuals as hypothetical.**

The inspiration came from a real educational experiment: a user described a ~$1,510 initial CRCL-related LP, roughly 7.5 stock-linked tokens plus stables before or near entry, and later ~17.08 stock-linked tokens with a ~$1,320 marked value after the asset declined. **These approximate numbers are a design motivation only, not verified blockchain data and not test fixtures for the final product.** The core lesson is that a moving oracle-relative bin range is not a guarantee of favourable inventory outcomes.

### Success experience

A first-time visitor should be able to:

1. Open a public URL (no download or local server).
2. Select a **verified public demo LP** or paste a public `0x…` wallet address (no wallet connection).
3. Click **Analyse** and immediately see actual, truthful progress.
4. Choose a position if the wallet has several Metric salts / LP positions.
5. Press **Play** and watch the reference, pool deviation, active bins, stock/USDT holdings, and value change along a real chronological timeline.
6. Click any event to learn **what changed, why, and which transaction proves it**.
7. See both **absolute LP dollar PnL** and **relative-to-holding performance**, with confidence/source labels.

**Product tone:** friendly, vivid, animated, visually clear and educational, **not** a trading signal or return-maximisation service. Aim for understanding in minutes, not a trading terminal that requires a tutorial.

---

## 2. MVP boundaries — keep this sharply scoped

### IN SCOPE for first release

- Exactly **one pool**: CRCLB/USDT on BNB Chain, verified on-chain before processing.
- Public wallet-address lookup **without connection, signature, approval, or contract write**.
- Discovery of positions associated with a wallet, keyed as the **contract actually defines ownership** (potentially provider + position salt). Confirm exact definitions and account for vault/router-managed positions.
- One **preselected public demo position** with an auditable starting deposit and a reconstructable timeline. Prefer a closed position if data permits; an active position is acceptable if the current state can be verified.
- Historical `LiquidityAdded`, `LiquidityRemoved`, `Swap`, `BinSwapped`, relevant oracle/provider updates and other applicable events, as validated against the deployed contract version.
- Accurate event ordering and token amounts, per-bin ownership/share accounting, and historical balance reconstruction **as far as on-chain evidence permits**.
- Replay UI with transaction-linked events, readable bin ladder, inventory and value panels.
- Entry → now or entry → exit; reproducible dollar PnL and holding benchmarks **only once derivation is proven**.
- Clear progressive states: connecting → finding position → scanning blocks → decoding → reconciling → ready, plus error/cancel/retry and partial coverage indicators.
- Responsive desktop and mobile layout, no personal information required beyond the wallet query.

### OUT OF SCOPE for MVP

- Other pools, other chains, multi-pool portfolios, cross-chain bridging, automated LP management, bots, or suggested entry/exit signals.
- Wallet connect, signing, deposits, withdrawals, swaps, token approvals, or any write operations.
- Paid analytics subscriptions, user accounts, proprietary rankings, automated recommendations, token-price forecasts.
- Guaranteed real-time full indexing of every LP on every chain.
- Exact hypothetical alternative strategy backtests until historical accounting is validated.
- Deviation integration as an authoritative source of individual position PnL; use it for pool context and cross-checks only.

**Design constraint:** Do not import the old educational Playground or its synthetic trade engine. Start a **new repository** and build the real-data engine independently. Preserve the design principles (simple entry, one Play button, clear visuals), not the simulated mathematics.

---

## 3. Non-negotiable accounting principles

1. **Real data only in Real Replay.** Every displayed real swap, token delta, reference and position value must be traceable to transaction/log identifiers or a documented historical on-chain read.
2. **Position vs pool:** A swap involving a funded bin is **not automatically an equal swap for this LP**. Allocate its effect using the actual contract's position shares, total bin shares, fee accrual and rounding rules, including changes when other LPs add/remove liquidity.
3. **Reference vs pool price vs execution:** These are different measurements. Capture the reference applied **at execution**, deviation/bin/position, and actual executed token exchange price. Never silently replace them with a later spot quote.
4. **Reference updates do not themselves exchange tokens.** They change quote placement and marked valuation; inventory changes arise through applicable transactions and contract rules.
5. **Exact ordered history:** use `(blockNumber, transactionIndex, logIndex)` and relevant intra-transaction operations. A block-end archival state may not equal the state halfway through that block.
6. **Contract-defined maths:** Use deployed ABI and verified matching contract source/version, including precision, token ordering, fee legs, packed words, share distribution and position salts. Do not substitute Uniswap formulas or assume `LP share × volume = fees` without proving it.
7. **Fixed-point arithmetic:** Use `bigint` or an exact decimal library for token/base-unit/share maths. Apply token decimals, scale multipliers and Q formats explicitly. Never use JavaScript `number` for on-chain monetary accounting.
8. **Accounting consistency:** Starting amounts + attributable swaps + fees + adds/removes + known adjustments should reconcile to on-chain reads/withdrawal amounts to a justified, documented rounding tolerance.
9. **No fake precision:** Show a source/confidence state per series: `VERIFIED EVENT`, `RECONSTRUCTED + RECONCILED`, `DERIVED FROM VERIFIED INPUTS`, `ESTIMATED`, or `UNAVAILABLE`. Clearly distinguish source price from valuation convention.
10. **Historic reference nuance:** If an oracle update occurred during the same block or transaction, resolve the correct state at the event. A Pyth Hermes timestamp series alone might not prove the exact on-chain reference used for a swap. Mark such values unverified unless the provider/transaction evidence resolves them.
11. **Economic benchmarks:** Distinguish LP value vs original deposited capital, vs holding **post-funding entry tokens**, and (when original wallet transfers are available and valuation justified) vs original **pre-funding wallet**. A result relative to holding is **not necessarily an actual dollar loss**.
12. **Accrual and attribution:** Determine how LP earnings, protocol and curator cuts, uncollected earnings and removed assets are represented; do not double-count fees that already remain in bins. Document the reconciliation bridge.

**Stop rule:** If a chosen real LP cannot be reconstructed with adequate historical information, explain the missing dependency and select another public demo position. Never paper over missing on-chain history with synthetic fills.

---

## 4. Data acquisition and source hierarchy

### Canonical sources, in priority order

1. **BNB Chain contract logs and historical on-chain state** for the verified Metric pool, Price Provider and required related contracts.
2. **Metric's published protocol contracts, deployed ABI, docs and contract-version-specific maths.** Verify the deployed pool bytecode/proxy/implementation and whether source revision matches.
3. **Provider/oracle update transactions and/or historical provider state** necessary to reconstruct the reference and bid/ask at execution.
4. **Metric public API** for current pool metadata and supplemental checks (not a replacement for historic state).
5. **Deviation** for pool identification, independent liquidity/volume context and cross-checks; its published methodology explicitly notes limitations on historical LP PnL and markouts.

### MVP pool

- Network: BNB Smart Chain, `chainId=56`.
- Market: `CRCLB/USDT` (stock-linked token, not the underlying NYSE share).
- Candidate pool address: `0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4`.
- Verify contract address, token0/token1 addresses, decimals, pool generation/version, price provider, and creation/deployment block **programmatically at startup** before building fixtures.
- Independently verify the candidate address using Metric deployment references and the live Deviation pool page. Do not infer token decimals or use a fixed bid/ask spread.

### Provider/API architecture

- A **server-side, read-only** adapter requests BNB Chain history. The browser **must never** call SolidRPC/Alchemy/Etherscan historical RPC directly.
- Use a provider with archive/historical `eth_getLogs` and, for reconciliation, historical `eth_call` / equivalent archive state, plus ability to retrieve transaction receipts; evaluate free tiers honestly and document limits.
- RPC/API credentials live in **server environment variables only**, never the client bundle or GitHub.
- Query in provider-compatible bounded block ranges; dynamically shrink on errors; retry with capped backoff; respect 429/rate and result limits; deduplicate by `chainId+txHash+logIndex`; persist safe **pool-level event caches** if needed.
- For full lifetime history, discover the **actual first add** for the selected position. Never interpret a seven-day scan with no add/remove events as proof that the position does not exist. Scanning from the pool deployment block can be necessary; optimise with historical index discovery and cache, not by silently truncating.
- For scalability, prefer pre-indexing the **one pool's public events** rather than repeating a complete chain scan for each wallet. A database is optional at first, but add it if request duration/hosting timeouts require persistent cursors, indexed pool events or long-running jobs.
- Provide a traceable provenance record: `chain`, `pool`, `block`, `tx`, `log`, `event`, `source`, `decoderVersion`, `reconciled`.

### Wallet ownership details

- Determine whether a provider address is the end user's wallet, a vault, or router/manager contract; don't misattribute a vault position to an unrelated owner.
- Multiple salts/positions under one provider must remain separate.
- If a wallet interacts via a manager and no provable wallet→position linkage exists, show an **unsupported ownership path** instead of claiming the LP was found.

---

## 5. Core event and accounting model

Create independently testable modules, not a large component that mixes parsing, state and visuals.

### Raw event record

`chainId, pool, blockNumber, blockHash, timestamp, transactionHash, transactionIndex, logIndex, emittingContract, topic0, rawData, decodedEvent, decodingVersion`

### Position identity and activity

`provider, positionSalt / actual position identifier, binIndex, shareUnits, creditedToken0, creditedToken1, transactionKind, associatedTx`

Confirm actual types and semantics from deployed contracts. Support multiple deposits, incremental removals and ownership/beneficiary distinctions.

### Bin state snapshots

At every relevant transition, track (as contract permits):

- Bin index / deviation from current reference; exact bin price formula.
- Total bin shares and LP-specific shares.
- Token0/token1 reserves, per-share accounting, fees/Edge accrued; token scaling and rounding.
- Relevant swap deltas, pending or realised fees, and pause/guardrail conditions if applicable.

### Position timeline rows

`eventTime, eventType, refPrice, refVerification, poolDeviation, activeBin, executionPrice, executionVerification, lpStockBefore, lpStableBefore, lpStockDelta, lpStableDelta, earnedFeeDelta, lpStockAfter, lpStableAfter, markPrice, lpUsdValue, holdUsdValue, cumulativeContributions, evidenceIds, reconciliationStatus`

If the exact reference or per-LP attribution cannot be verified, keep the corresponding fields null with a reason. For a swap touching several bins, retain **per-bin** legs and an optionally aggregated transaction row; never inflate the swap count by conflating these.

### Example of a trustworthy explanation (presentation pattern, not fixture data)

> "This executed sell trade crossed bin +2. While your position owned X% of that bin's shares, its attributable stock balance increased by Y and its stablecoin balance decreased by Z (as reconstructed from contract accounting). The provider reference used was $P, and the actual executed price was $Q. View transaction." 

Only generate this narrative once `X, Y, Z, P, Q` are supported; otherwise say exactly what could not be determined.

---

## 6. User experience: one simple workflow

### Opening screen — no analytics wall

**Heading:** "Find out what really happened to your Metric LP."  
**Primary input:** Public wallet address (optional).  
**Alternative:** "Try a verified real LP" (no wallet required).  
**Fixed context tag:** `Metric · CRCLB/USDT · BNB Chain`.  
**Primary action:** `Analyse LP`.  
**Privacy microcopy:** "Read-only. No wallet connection. Address sent to the blockchain data service for lookup; not saved as an account."  
**Progress:** always visible as soon as Analyse is clicked, with stage, count, coverage window, cancel/retry, and real error messages. No infinite progress indicator after failure.

### Position selector

If multiple salts/positions: small cards showing verifiable first/last liquidity event, whether closed/active and any limits in confidence. Never merge separate positions automatically.

### Replay screen — only four core visual areas

1. **Top summary:** Starting funds, current/exit stock and stable balances, LP value, dollar PnL and vs-hold result. Clearly state baseline and current/exit valuation timestamp.
2. **Two connected charts:** External/on-chain reference price and the actual execution/deviation markers; inventory/value timeline. A shared playhead shows one historical moment.
3. **Moving bin ladder:** User's selected/funded bins, active pool bin, and changes in stock/stable composition. Oracle/reference shifts move relative price levels; executions change inventory. Avoid animating unverified bin states.
4. **What just happened?** A one- or two-sentence event explanation, token movement, exact source links; expandable expert event table beneath.

Controls: `Play / Pause`, `Previous event`, `Next event`, replay speed, scrubber, `Reset`, source link. Default sensible speed, make large histories navigable by major moments and event filters.

### Visual storytelling requirements

- Stock in purple; stablecoin in teal; reference in blue; actual buy/sell transactions have distinct shapes or colours and clear legends.
- A lively but understandable replay—animate **real** token balance transfers only on attributed swaps; when reference moves independently, highlight the moved price labels but leave token quantities stable.
- Tooltip distinguishes a contract swap, an LP add/remove and a reference-price update.
- At any event, show "shares bought/sold by this LP" and "change in USDT" where reconstructed; show a dash otherwise.
- Convey not just absolute return, but the underlying explanation: market exposure + trading effect + deposits/withdrawals + earned trading income without double-counting.
- Display confidence as small plain-language labels rather than cluttering the default screen.
- Mobile usable; accessible contrast, keyboard navigation, reduced-motion support.

### Important empty/error states

- Invalid address.
- Wallet has no verifiable position in this pool.
- Position was established before available data window; history incomplete.
- Provider rate limit or temporary outage.
- Reference price at trade unverified.
- Reconstruction mismatch: show the mismatch and block any asserted exact PnL.
- No historical liquidity event in recent period **does not** mean no active LP.

---

## 7. Staged execution plan and hard acceptance gates

### Stage 0 — Source and feasibility audit (do this FIRST)

**Deliverables**

- `docs/PROTOCOL_AUDIT.md`: deployed pool, token and provider addresses, ABI/source revision, important source-code locations, deployed contract version, event signatures, bin/swap/fee/position accounting notes, oracle verification method.
- `docs/DATA_FEASIBILITY.md`: chosen provider, example RPC calls, source coverage, approximate rate/cost limits, archive capability, historical starting block, handling of large ranges.
- Proof of reading real pool logs: save a small **public, non-sensitive** `fixtures/raw/` sample with tx hashes and exact corresponding receipts.
- Identify at least **two candidate public LP positions** from the pool with one preferred demo candidate (a closed position is ideal if it gives more complete validation).

**Exit gate:** Correct pool identity and event decoders proven against **real public receipts**; at least one LP position with a verifiable deposit discovered. **If this fails, stop and report a precise blocker.** Do not create synthetic wallet results.

### Stage 1 — One-position on-chain reconstruction (ENGINE before UX)

**Deliverables**

- Deterministic decoder and chronological event ledger for **one chosen LP position**.
- Position-level balance reconstruction and share changes through the relevant bins and swaps, respecting contract rules.
- Historical reference and execution/deviation context with source labels.
- Machine-readable `fixtures/expected/<position-id>.json` with snapshot dates/blocks and expected final balances confirmed by archive calls or actual withdrawal receipts.
- `docs/RECONCILIATION.md` documenting every input/output and remaining discrepancy; script `npm run verify:fixture`.

**Exit gate:** For every covered swap relevant to that LP's bins, explain whether it affected the LP and why; **reconcile attributable final token balances** against independent on-chain state/withdrawals within stated on-chain rounding rules. Incomplete events ⇒ label **partial**, not "fully reconstructed". If exact allocation is not possible, first document why and do not fabricate per-swap deltas.

### Stage 2 — Simple deployed MVP (one pool, real demo + wallet lookup)

**Deliverables**

- New responsive Next.js/TypeScript web app with server-side blockchain adapter.
- Real LP demo preloaded; public address input finds positions and provides event history.
- Play/Pause timeline, bin ladder and event explanation; verification links to BscScan.
- Background/progress strategy suitable for the hosting platform (streamed progress or polling); proper retries, cancellation, endpoint input checks and status end states.
- Deployed on a public test URL via GitHub → Vercel (or equivalent managed platform) with keys as server secrets.
- Read-only security controls and privacy safeguards.

**Exit gate:** Nontechnical tester can open URL, press `Try a verified real LP`, press `Play`, understand inventory changes and open an independent transaction proof. A new valid wallet either works or returns a truthful actionable state; no browser CORS errors; no secret exposed in client bundle.

### Stage 3 — PnL explanation and independent validation

**Deliverables**

- Position-level value through time with explicitly specified on-chain provider-reference convention.
- Cash-flow-aware dollar PnL, earned income where verified, relative-to-hold benchmark from entry **funded tokens**, and optional pre-funding-wallet benchmark only when inputs are trustworthy.
- Reconciliation report available under `How this was calculated` with per-series verified/derived/unknown labels.
- Independent comparison with available Metric interface figures and Deviation where apples-to-apples metrics exist; document differing definitions rather than forcing agreement.
- Regression tests against at least one **second real LP position from the same pool**, preferably with different bin placement and a partial withdrawal.

**Exit gate:** Demonstrably correct event-to-balance and final-value calculations across **two distinct real positions**; no estimated source prices presented as historical execution facts. Differences from Metric's UI traced to definitions, time, price source, or specific accounting data—not hand-waved.

### Stage 4 — Hardening and future expansion (AFTER MVP passes)

- Improve indexing/retention/performance for large wallets and active positions; caching, job queue or database only when justified by real usage.
- Add richer analyses: per-bin attribution, profitable/unprofitable inventory round trips, opportunity cost, fee vs adverse-selection breakouts, verified oracle-to-execution markouts.
- Optional what-if exit and hold simulations, clearly marked hypothetical and calculated from previously verified history.
- Only then design multi-pool plug-in adapters, pool selectors, other chains, third-party data collaboration and optional wallet connect.

**Rule:** Do not proceed to the next stage until its exit gate is documented as passing with evidence.

---

## 8. Technical architecture (lean, automated, secure)

**Recommended first implementation:** Next.js + TypeScript, a simple charting library, a server-side RPC client such as viem, Vitest/unit tests and Playwright smoke tests. Use GitHub source control and Vercel or comparable deploy. This is a recommendation, not a demand if Codex finds a materially simpler reliable design.

Suggested modules:

```text
app/
  page.tsx                   # first-screen wallet or public demo
  lp/[position]/page.tsx      # real replay
  api/analyse/route.ts        # validated server-side lookup
  api/jobs/[id]/route.ts      # status/progress if needed
components/
  WalletSearch.tsx
  ReplayPlayer.tsx
  ReferenceAndExecution.tsx
  BinLadder.tsx
  InventoryPanel.tsx
  EventExplanation.tsx
lib/
  chain/poolConfig.ts        # one pool only; verified addresses
  chain/rpc.ts               # server-side env / retries / backfill
  chain/decode.ts            # deployed ABI and versions
  metric/binAccounting.ts    # EXACT on-chain maths
  metric/positionLedger.ts   # provider + salt, user shares
  metric/oracleHistory.ts    # reference at execution
  metric/reconcile.ts        # invariant checks
  metric/valuation.ts        # transparent benchmarks
  domain/types.ts            # source-labelled event model
fixtures/
  raw/                       # small real public log sample
  expected/                  # independently verified checkpoints
docs/
  PROTOCOL_AUDIT.md
  DATA_FEASIBILITY.md
  RECONCILIATION.md
  PRIVACY_AND_LIMITATIONS.md
```

**Important hosting constraint:** Vercel serverless request duration, memory and background-job limits may not suit full-chain-history scans. If a scan exceeds practical limits, add **minimal** checkpointed background indexing or a small managed worker; expose honest progress. Do not use a fake in-memory "job" that vanishes between stateless serverless requests. For stage 2 a preindexed public demo and a bounded wallet scan may be sufficient.

**Privacy & security:** No wallet connection, signatures, write RPCs, keys in frontend, tracking wallets as users, or intentional persistent storage of searched addresses. Validate addresses and restrict queries to the one pool/chain; protect endpoints with rate limiting, bounded response sizes, timeouts and read-only operation. Do not log full input addresses or RPC secrets. Explain that the app hosting provider/RPC provider may still record request metadata. Store **public pool event data** if caching is needed, not user search history. Never ask for seed phrases or private keys.

---

## 9. Test plan and quality bar

### Unit and property tests

- Decode actual event fixtures into expected addresses, token deltas, bin IDs and share deltas.
- Token decimal/scaling/fee calculations using fixed-point maths and extremes of small/large amounts.
- Same-block events, multiple swaps per transaction, missing logs, duplicate logs and reorg/changed block hash handling.
- Add → swap → partial removal → add → final removal, including multiple salts and changing competitor liquidity.
- Historical reference update ordering and historical call boundary checks.
- No fee double-counting; user LP share never greater than valid total share; token amount invariants.
- Different benchmark definitions produce explicitly different numbers when pre-funding differs from funded tokens.

### Integration and end-to-end tests

- Read a fixed real public transaction receipt and decode the expected result.
- Query a bounded real block range with the configured provider and verify deterministic output.
- Replay chosen demo through end; final balances reconcile independently.
- Unknown wallet gets a clear `No position found in this verified coverage window` state, not a false definitive claim.
- RPC unavailable/429/timeout ⇒ visible error, stopped progress and safe retry.
- One click to public demo, play, pause, select any event, navigate to transaction proof.
- On mobile and desktop: responsive, labels readable, no inaccessible animation dependency.

### Proof-of-done checklist (must attach to each stage handoff)

- [ ] Source link + deployed pool identity checked
- [ ] Real transaction sample IDs included
- [ ] Contract/ABI and decoding version recorded
- [ ] All event coverage gaps explicitly counted
- [ ] Number of relevant swaps attributable to position shown, with methodology
- [ ] Start/end balance reconciliation evidence attached
- [ ] Reference/execution prices provenance labelled
- [ ] Dollar and versus-hold PnL definitions documented
- [ ] User-facing failure/progress states tested
- [ ] `npm test`, lint, typecheck and smoke test results reported
- [ ] Live environment build/deploy instructions documented

---

## 10. Development discipline for Codex

1. **Stage 0 only on first pass.** Research the deployment, contract events, position math and data access. Produce audit files plus one **real** deposited LP candidate and a raw receipt fixture. Do not spend the first pass designing a beautiful frontend without validated data.
2. Summarise blockers and decisions with evidence at the end of each stage; choose the smallest accurate approach.
3. At each follow-up, implement only the approved next stage. Keep code deployable; include tests and an understandable README with nontechnical setup instructions.
4. Where source docs contradict chain state, prefer verified deployed state, document the discrepancy, and do not silently choose.
5. Prefer automating verification/replay and provider pagination. Minimise actions required from the project owner (GitHub repo, deploy target, provider secret should be the only manual setup if possible).
6. Maintain test fixtures that can be rerun without depending on current prices or the live RPC.
7. **Be strict about what “real LP PnL” means:** it must be a reconciled position-specific result, not pool-volume-based fee estimates or a price-only proxy.

### Recommended Codex first-task acceptance

Return `PROTOCOL_AUDIT.md`, `DATA_FEASIBILITY.md`, the pool verification, one or more **real LP candidates with transaction evidence**, and the implementation plan for Stage 1. Do not claim success without a verifiable liquidity event and complete ABI interpretation.

---

## 11. Sources and essential reading (verify at implementation time)

**Official Metric protocol documentation**
- https://docs.metric.xyz/
- https://docs.metric.xyz/how-pools-work/liquidity-and-bins
- https://docs.metric.xyz/how-pools-work/price-providers
- https://docs.metric.xyz/use-metric/provide-and-manage-liquidity
- https://docs.metric.xyz/reference/supported-chains-and-deployments

**Metric source code**
- https://github.com/Metricxyz/pool-contracts
- https://github.com/Metricxyz/periphery-contracts

**One-pool verification and independent methodology**
- https://deviation.wtf/pools/bsc/0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4
- https://deviation.wtf/methodology
- https://bscscan.com/address/0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4

**Deployment/hosting**
- https://learn.chatgpt.com/docs/cloud
- https://vercel.com/docs

The addresses, APIs, deployed versions, fee settings, oracle source and account semantics **must be reverified** at development time. Deviation is unofficial and its historical position-level profitability information is incomplete; it is not a source of audited LP PnL.

---

## 12. Final definition of done

The MVP is **done** only when a visitor can open a URL and watch a verifiably real Metric CRCLB/USDT LP position evolve from an on-chain starting point, **with the position's attributable swaps, token movements, bin state, price evidence and final balances correctly reconciled**. The app must make it obvious **what happened**, **why the LP's asset mix changed**, **what is known versus unknown**, and **how performance compares to holding**.

The app should be approachable enough for a novice and auditable enough that an experienced DeFi LP can click through to the precise proof for every material number.
