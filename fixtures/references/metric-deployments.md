> For the complete documentation index, see [llms.txt](https://docs.metric.xyz/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://docs.metric.xyz/reference/supported-chains-and-deployments.md).

# Contract addresses

Current Metric contract addresses (factory, router, oracles, price providers, extensions) and supported chains.

Metric is live on Ethereum, BNB Smart Chain and Robinhood Chain.

{% hint style="success" %}
**These are the current `v1` addresses.** Jump to [Core](#core), [Periphery](#periphery), [Extensions](#extensions) or [Oracles and price providers](#oracle-and-price-provider-layer).
{% endhint %}

{% hint style="warning" %}
**Only use the addresses on this page.** Older contract generations still exist on chain but are deprecated. If an address is not listed here, do not deploy against it or route to it.
{% endhint %}

### Chains

The same contract set is deployed on all three chains.

| Chain             | Chain ID | Public API (no key) | Partner-tier key |
| ----------------- | -------- | ------------------- | ---------------- |
| Ethereum          | 1        | ✅                   | ✅                |
| BNB Smart Chain   | 56       | ✅                   | ✅                |
| Robinhood Chain   | 4663     | ✅                   | ✅                |
| Base              | 8453     | —                   | ✅                |
| Arbitrum One      | 42161    | —                   | ✅                |
| HyperEVM          | 999      | —                   | ✅                |
| Polygon PoS       | 137      | —                   | ✅                |
| Avalanche C-Chain | 43114    | —                   | ✅                |
| Monad             | 143      | —                   | ✅                |
| MegaETH           | 4326     | —                   | ✅                |

Use these chain IDs as the `{chain_id}` path parameter in the [API](/reference/api.md).

{% hint style="info" %}
A deployed oracle contract does not guarantee that a feed is configured or enabled on that chain. Discover live chain and feed availability through the API.
{% endhint %}

### Why the addresses are the same everywhere

This release uses deterministic CREATE2/CREATE3 deployments, so each contract has the same address on every chain in the table. Addresses are still version-specific: a future deployment can use a new salt and therefore a new address.

### Core

| Contract                | Address                                      |
| ----------------------- | -------------------------------------------- |
| `MetricOmmPoolFactory`  | `0x2a53833cc95548cf52c7b159110e22D3a9018f32` |
| `MetricOmmPoolDeployer` | `0x2E0A99A2E352043d1CA489cF45bf7B511BCcC738` |

### Periphery

| Contract                      | Address                                      |
| ----------------------------- | -------------------------------------------- |
| `MetricOmmSimpleRouter`       | `0x02201E6f13c41506c7Bb635d7543F98826229aB7` |
| `ExternalSwapExecutor`        | `0x578C80DeC5D4Aa1F2879985e6e8d91Fc268e4AC2` |
| `MetricOmmSwapQuoter`         | `0x3B9ea79f482094323d06064E637a7F4528560fcb` |
| `MetricOmmPoolDataProvider`   | `0x83d66c5934b1525ee82e6E772c76c7acC778bBB7` |
| `MetricOmmPoolLiquidityAdder` | `0x49A0dcb8dBD304B80aA475026cC558d4baE54382` |

### Extensions

| Contract                       | Address                                      |
| ------------------------------ | -------------------------------------------- |
| `OracleValueStopLossExtension` | `0xE4038fA09f0bB9963068afaF97BE0c045155090D` |
| `DepositAllowlistExtension`    | `0x65FBa4Ee8f50772aB384f19e5520DdA420B1B47D` |
| `PriceVelocityGuardExtension`  | `0xEbc53e61078976118E384f110c262A263decB84B` |
| `SwapAllowlistExtension`       | `0x4Ca8d78873f0a66445CC05f9A1E705f1a58A6582` |

Metric's API does not index `SwapAllowlistExtension` membership, and its routes and quotes do not check it.

### Oracle & Price Provider layer

| Contract                    | Address                                      |
| --------------------------- | -------------------------------------------- |
| `CompressedOracleV1`        | `0xE844701934D9C6085B292e428F41b911cC0b3872` |
| `PriceProviderFactory`      | `0x050502eE4Da0eE2a9D44eE6046310F9f1532aCF2` |
| `PythOracle`                | `0x30a88bf894D1b806125a23ebf23D715496fD7102` |
| `ChainlinkOracle`           | `0x810A649974f21bB6D3b2E781597EdBDAabe82228` |
| `AnchoredProviderFactory`   | `0xb0eAE19259500Ac4Ca59b9a5cb8cDB2Da8076F0A` |
| `MultiplierOracle`          | `0x6c38232B0597ef335bCdC86029cDc9e23A17F166` |
| `B20AssetParams`            | `0x1D4995C8d5e8946cd2A60Baa25802Bb7D877E41c` |
| `RobinhoodStockTokenParams` | `0xCefea5dE67DF272c994d8a67cB4dd4bB495EE420` |

The [Multiplier Oracle](/how-pools-work/oracles.md#multiplier-oracle-tokenized-stocks) contracts are deployed only on the chains with tokenized stocks: `MultiplierOracle` on Base and Robinhood Chain, `B20AssetParams` on Base, and `RobinhoodStockTokenParams` on Robinhood Chain.

PUR, Flashbots' Priority Update Registry, is not a Metric contract. Flashbots redeploys it, so take its current address from the [PUR repository](https://github.com/flashbots/priority-update-registry).

### Fee policy

Do not infer live fee rates from the deployment. Protocol defaults and caps are on-chain factory state, while curator fees are set per pool.

* Protocol defaults and caps: `GET /public/v1/evm/factory-settings`
* A pool's live rates: pool metadata (`spreadAdminFeeE6`, `adminNotionalFeeE8`, and related fields)

See [Fees](/use-metric/fees.md) for the full breakdown.

### ABIs and source

The current ABI downloads are attached to [Smart contracts](/reference/smart-contracts.md).

| What                              | Where                                                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Oracle & Price Provider contracts | [oracles-contracts](https://github.com/Metricxyz/oracle-contracts)                                                   |
| Pool contracts                    | [pool-contracts](https://github.com/Metricxyz/pool-contracts)                                                        |
| Periphery contracts               | [metric-periphery](https://github.com/Metricxyz/periphery-contracts)                                                 |
| TypeScript SDK                    | [sdk](https://github.com/Metricxyz/sdk) · [npm package](https://www.npmjs.com/package/@metric.xyz/metric-omm-sdk-v1) |
