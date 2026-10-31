# Stage 0 protocol audit — VERIFIED DEPOSIT EXIT GATE PASSED

Audit performed 31 October 2026 (Australia/Sydney). Project contract:
[`Metric_LP_Detective_Codex_Build_Spec.md`](../Metric_LP_Detective_Codex_Build_Spec.md).
This document records the Stage 0 audit. The subsequent bounded reconstruction is
documented in [LP_SWAP_ATTRIBUTION_VALIDATION.md](LP_SWAP_ATTRIBUTION_VALIDATION.md).
No UI, price history or PnL is implemented; Stage 1 is not fully complete.

## Evidence and identity

Verified on 31 October 2026 using the configured server-side SolidRPC endpoint.
The Stage 0 gate passes for pool identity, deployed source/ABI interpretation,
real add/swap receipts and two distinct public deposited positions. This does not
assert lifetime coverage, a closed position, exact historical reference quotes,
LP swap attribution, reconstructed balances or PnL by itself. The later attribution
report validates those inventory capabilities for one explicit checkpoint interval.

| Item | Verified observation |
|---|---|
| Network | `eth_chainId = 0x38` (56); live repeat head `130795938` |
| Pool | `0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4` |
| Token0 | CRCLB `0x80f3D493EBCe97e343c53D29a137942416B4ffC0`, 18 decimals |
| Token1 | USDT `0x55d398326f99059fF775485246999027B3197955`, 18 decimals |
| Scale multipliers | Both `1`; confirmed with `getImmutables()` |
| Factory | `0x2a53833cc95548cf52c7b159110e22D3a9018f32`; matches official deployment docs |
| Deployer | `0x2E0A99A2E352043d1CA489cF45bf7B511BCcC738`; factory historical/current `poolDeployer()` matches docs |
| Deployment block | `126502643`; preceding block has no code; factory PoolCreated receipt confirms creation |
| Creation tx | `0x600833c852f7ef412cf3653b788dd35642e48ecbbb43776317dc20286300a804` |
| Runtime | 20,024 bytes; direct MetricOmmPool runtime, not a forwarding proxy |
| Pool code Keccak-256 | `0x680a3f08381d929a747413e52c8523feffd16c92f49ec774b181f4682de3aad6` |
| Linked LiquidityLib | `0xe0b1576ac63a582e6740a7e1dcfbbef730539cd4`, 6,220 bytes, source match verified |
| Library code Keccak-256 | `0x11b5f5a0ca47a5649216a19ce5b7485da3d715a5d7c48c46155b44a3096ce683` |
| Immutable price provider | `0xd352e157Fd2BAd7b8B524013151B19b0a90b79BC`; provider token0/token1 reads match |
| Configured bins | `-50..49` |
| Extensions | `0xE4038fA09f0bB9963068afaF97BE0c045155090D` (stop-loss); `0xEbc53e61078976118E384f110c262A263decB84B` (velocity guard) |

Pool runtime at deployment equals runtime at checkpoint `130795080`. Source match
uses solc `0.8.35+commit.47b9dedd`, optimizer 1999 runs, viaIR, Cancun and no metadata
bytecode hash, with pinned OpenZeppelin `dde766bd542e4a1695fe8e4a07dc03b77305f367`.
Only compiler-declared immutable/link regions are normalized. The library link
and its immutable self-address are checked separately; actual pool immutable
values are saved from `getImmutables()`. See `fixtures/raw/source-match.json` and
`code-and-identity.json`. This is a normalized source match, not an assertion that
unpatched compiler bytes literally equal constructor-patched runtime.

Official deployment docs and Deviation now respond successfully. Deviation
independently labels the pool CRCLB/USDT and lists the same token addresses and
18/18 decimals. Token names differ: on-chain names are `Circle Internet Group Inc.`
and `Tether USD`; Deviation uses descriptive labels. Symbols/addresses/decimals
are taken from chain reads, not those display labels. BscScan still responds HTTP
403; explorer source verification was not used as evidence. Official references
are saved under `fixtures/references/`.

Public source was successfully downloaded from the official repositories:

- Core: [Metricxyz/pool-contracts](https://github.com/Metricxyz/pool-contracts/tree/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3), revision `ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3`.
- Periphery: [Metricxyz/periphery-contracts](https://github.com/Metricxyz/periphery-contracts/tree/53cbe784f1a0db07c48790d27828d452b31c2978), revision `53cbe784f1a0db07c48790d27828d452b31c2978`.

**The following interpretation is matched to the pool and library runtime.**
Compiled full ABIs are saved under `fixtures/abi/`.
Core README pins Foundry 1.7.1 and solc 0.8.35, identifies several historical audit
tags, and describes a post-audit precision change. Latest source alone is not proof
of what was deployed. We compiled and matched the pinned revision as described above.

## Source locations and ownership

Paths below are relative to the pinned core source; links use that exact revision.

- [`contracts/libraries/LiquidityLib.sol`](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/libraries/LiquidityLib.sol): `addLiquidity`, `removeLiquidity`, `_positionBinKey`, `_deltasScaledToExternal`.
- [`contracts/libraries/PoolStateLibrary.sol`](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/libraries/PoolStateLibrary.sol): storage layout and EXTSLOAD accessors. Slots 4/5/6 are bin state, total shares, position-bin shares **in this revision**.
- [`contracts/MetricOmmPool.sol`](https://github.com/Metricxyz/pool-contracts/blob/ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3/contracts/MetricOmmPool.sol): liquidity entry points, `_swapCore`, `_executeSwap`, `_getBidAskReferencePriceX64`, factory controls.
- `contracts/types/PoolStorage.sol`, `PoolOperation.sol`, `Packed.sol`: storage, tuple and word layouts.
- `contracts/interfaces/IMetricOmmPool/IMetricOmmPoolActions.sol`: exact event interface.
- `contracts/libraries/SwapMath.sol`, `FeeMath.sol`: bin update and rounding, spread/notional fee split.
- `contracts/interfaces/IMetricOmmPoolFactory/IMetricOmmPoolFactory.sol`: `PoolCreated`.
- `contracts/MetricOmmPoolFactory.sol`, `MetricOmmPoolDeployer.sol`: factory/deployment logic. The deployer uses CREATE2; factory creation and deployment-boundary evidence are saved.

Position ownership is **not** the transaction sender by default. The per-bin key is
`keccak256(abi.encode(address owner, uint80 salt, int16 bin))`. Multiple salts must
remain separate. Core add accepts an owner; remove requires `msg.sender == owner`
and transfers removed tokens to that owner. Shares are pool mappings, not assumed
ERC20 LP balances or transferable NFTs.

Periphery `contracts/MetricOmmPoolLiquidityAdder.sol` supports explicit-owner and
caller-as-owner overloads. Its callback payer is the caller, which can differ from
the position owner. A manager/vault owner must not be attributed to its depositor
without an independent ownership path. No particular router, vault or user path
has been source-audited for the historical callback contract. In both saved adds,
receipt sender and funding transfer sender equal the emitted provider, which had
no code at the deposit block. Receipt destination was
`0x06cb6c245cd9219262442a7730d9484b3cfdd901`, not the current documentation
liquidity-adder address. Do not retroactively assign the latest router identity
to that historical callback path.

## Event signatures and units

ABI canonical signatures below resolve Solidity user-defined packed types to
`uint256` and the balance struct to `(int256,int256)`. Topic hashes can be obtained
from `sourceAbi` using viem; they are not proof of an observed log.

| Canonical signature | Interpretation in pinned source |
|---|---|
| `LiquidityAdded(address,uint80,int256[],(int256,int256)[],uint256[])` | Indexed provider and salt; three parallel arrays: bins, scaled balance deltas, minted shares. Zero-share input rows remain with zero deltas. |
| `LiquidityRemoved(address,uint80,int256[],(int256,int256)[],uint256[])` | Indexed provider and salt; positive shares burned, nonpositive scaled balance deltas. Provider equals removing caller. |
| `BinSwapped(int256,uint256,uint256)` | One bin routing step, potentially many per swap. Bin index is not indexed. Delta word high/low signed int128 = scaled token0/token1 changes. Fee word high/low unsigned uint128 = LP/platform legs in scaled input-token units. |
| `Swap(address,address,uint256,uint256,uint256)` | Indexed sender/recipient; terminal swap summary. Native token deltas high/low signed int128 = token0/token1, positive means pool gained. Platform fee word high/low = spread/notional legs, **not token0/token1**, scaled. |

Swap details low bits 0–103 = uint104 within-bin position; 104–119 = signed int16
final bin; bit 120 = exact-input flag. Pair halves require separate sign extension.
Do not count every BinSwapped as a separate contract swap. Group by actual ordered
swap boundaries, not just transaction hash: multiple calls can occur in one tx.

The decoder is labelled `metric-v1:<revision>` and reports deployed schema
verification. That flag describes the schema, not the authenticity of arbitrary
input logs. Real-receipt tests verify emitter, transaction/block identity,
checksummed fixture bytes, indexed fields, bin arrays, transfers and share reads.
Artificial codec vectors remain separate. LiquidityRemoved ABI/maths are matched
to source, but no real removal receipt has yet been decoded.

## Shares, balances, rounding and fees

Internal scale multiplier per token is
`10^(max(18, decimals0, decimals1) - tokenDecimals)` according to `PoolImmutables`.
Actual token decimals are 18/18 and multipliers are 1/1. Use bigint.

On add into an existing bin, each scaled token debit is
`ceil(binBalance * sharesAdded / binTotalShares)`. Into an empty bin the immutable
initial scaled amount per 1e18 shares applies. Below current bin it seeds token1;
above it seeds token0; in current bin composition is prorated by uint104 position.
Operational minimums and uint104 balance limits apply. Total scaled input converts
to native amounts with ceil after summing per-bin deltas; this is not necessarily
the sum of individually rounded native deltas. Callback transfers can overpay.

On removal, per-bin scaled entitlement is
`floor(binBalance * sharesRemoved / binTotalShares)`. Remaining nonzero shares have
an operational minimum. Sum scaled removals, then floor division by multiplier
gives native payout. Residual dust is not unexplained trading profit.

`SwapMath` credits the bin with gross input minus platform fees and removes output.
The LP fee leg **already remains in the bin delta**: adding it to reserves a second
time double-counts it. Platform is protocol + admin; it is withheld and tracked
separately, with spread and notional breakdown on Swap. Fee rates can change via
factory controls and bin fee updates. No fixed spread or `share × volume` fee
approximation is justified. Actual config, extensions, rounding and pending-fee
settlement need deployed-version review before Stage 1 implementation.

Reconstruct total bin reserves and all LP share changes, including competitors.
A funded bin does not prove a swap affected a specific position while it held no
shares. Fractional per-LP economic attribution and withdrawable rounded entitlement
are different; Stage 1 must define its rounding bridge and reconcile independently.

## Oracle and ordering

`IPriceProvider.getQuote()` is **not view**. It returns bid, ask, reference in
Q64.64 whole-token token1/token0 ratios. Core expects a geometric-mid-like reference
but validates bid/ask ordering, inclusive reference bounds and an asymmetry tolerance,
not exact mathematical equality to sqrt(bid*ask).

In `swap`, quote retrieval precedes `_swapCore` / beforeSwap extension, bin steps,
token callback, afterSwap and terminal Swap emission. Extensions and callbacks
make intra-transaction ordering material. Swap/BinSwapped events do not themselves
include that reference quote. Historical block-end `eth_call`, later spot data or
Hermes timestamps alone cannot prove the precise quote used. Provider source,
update receipts and possibly transaction tracing/re-execution may be needed.
Keep reference null/unavailable until that evidence exists. `getSellAndBuyPrices`
can itself update the provider; it is informational, not a historical fill.

Bin prices use distance from reference, with distance in E6 and conversion
`referenceX64 * (1e6 + distanceE6) / 1e6`; bin lengths are configured, not a presumed
universal tick grid. Exact execution includes bin position and fee math. Oracle
movement alone must never create token deltas.

Sort ledger by `(blockNumber, transactionIndex, logIndex)` and preserve all relevant
intra-transaction legs. A coherent fixed block header/hash and coverage inventory
are prerequisites, not a cure for an unavailable intra-block oracle reference.

## Real deposited LP candidates

Preferred:

- Provider `0x3216FBdef81Be1842A80D648C83C7aa10bc00787`
- Salt `198136120981933274567974` (uint80)
- Add tx `0xbe072d693de89938c714e49795610ee589df1e90773c21a234268fcc46ac9e87`
- Block `126509253`, log index `30`
- Bins `-10..-1`: each minted `7405263970792914954` shares and credited
  `299999999999999999756` USDT base units, zero CRCLB.
- Bins `0..9`: each minted `7397760061908989030` shares and credited
  `3703727957680262727` CRCLB base units, zero USDT.
- Total funded **37.037279576802627270 CRCLB** and
  **2999.999999999999997560 USDT**. These are funding amounts, not valuations.
- Historical `extsload` confirms bin -10 shares at the add block.

Backup:

- Provider `0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4`
- Salt `1068754547228601823113491`
- Add tx `0x6a72450dbeb1d0697369ee41479f0bd0d274d6c7c0253b009ca3c6590809e31f`
- Block `126543141`, log index `206`, bins `-8..9`
- Total funded **76.591824182733276404 CRCLB** and
  **7768.658870160351262353 USDT**.
- Exact per-bin scaled deltas/share allocations: `fixtures/raw/manifest.json`.
  Historical bin -8 share read matches the emitted shares.

Both successful add receipts have exact token Transfer totals equal to summed
bin deltas (multipliers are one). Both providers were externally owned/no-code
accounts at these blocks and funded the observed deposits directly. This proves
the recorded position/funding path, not off-chain identity or beneficial ownership.
No removal was found for the preferred provider+salt over the explicitly bounded
range `126509253..126609252`; this does not establish that it remains active.

Real swap validation: tx
`0x485250b8cdd5b91c53cce53ba4e2f4bba97a49f82b7a8aa8b8e3da3441682d6a`,
block `130794396`: BinSwapped log `260`, terminal Swap log `265`, bin `4`.
Pool native flows were `-4311896455105456463` CRCLB base units and
`+315695719201870999999` USDT base units. Token Transfers match; bin USDT credit
plus withheld platform fee equals gross input. LP fee already remains in the bin.
No allocation of this swap to either candidate is claimed.

## Stage 1 questions (not implemented)

1. Recover full position and competing-share history through a verifiable exit or checkpoint.
2. Establish all fee/extension/admin updates in that interval and their accounting effects.
3. Recover exact quote applied before each swap, including intra-transaction oracle ordering.
4. Define fractional attribution versus rounded withdrawable entitlement and reconcile dust.
5. Verify every required bin state and final native balances independently.
6. Define an evidence-backed valuation convention and funded-token holding benchmark.

The user subsequently authorized the mandatory attribution investigation. Its
bounded first-add-to-checkpoint reconstruction, real A–D cases and independent
archive/contract-execution reconciliation are in LP_SWAP_ATTRIBUTION_VALIDATION.
Longer history and exact applied references remain open. No dashboard or PnL claims.

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
