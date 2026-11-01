import { readFileSync } from 'node:fs';
import { reconstructionCalls, discoveryCalls } from '../lib/analysis/rpcEstimate';
import { formatNanoUsd } from '../lib/analysis/usageBudget';
const probe = JSON.parse(readFileSync('fixtures/rpc/solidrpc-free-probe.json', 'utf8'));
const head = probe.results.find((r: any) => r.name === 'finalised chain head').result;
const states = JSON.parse(readFileSync('fixtures/history/historical-state.json', 'utf8')).states;
const pin = states.find((s: any) => s.block === '130841348');
const elapsed = BigInt(Math.floor(Date.parse(probe.observedAt) / 1000)) - BigInt(pin.timestamp);
const blocksPerDay = BigInt(head.gapFromPinnedHead) * 86400n / elapsed;
const marked = (estimate: { total: number | string }) => ({ ...estimate, hypotheticalSolidRpcPrepaidAt4DollarsPerMillion: formatNanoUsd(String(BigInt(estimate.total) * 4000n)), existingFreeCost: '$0 if within the existing Free quota with no paid billing mode', notPaymentAuthorisation: true });
console.log(JSON.stringify({
  source: { observedAt: probe.observedAt, pin: '130841348', observedFinalizedHead: head.block, gap: head.gapFromPinnedHead, averageBlocksPerDaySincePin: String(blocksPerDay), averageIsNotFutureGuarantee: true },
  unfamiliarWalletInPublishedWindow: { rpcCalls: 0, source: 'cached complete pool discovery index' },
  recentDiscoveryMinimumAt1000: marked(discoveryCalls(BigInt(head.gapFromPinnedHead), 1000n)),
  recentDiscoveryMinimumAt30000: marked(discoveryCalls(BigInt(head.gapFromPinnedHead), 30000n)),
  recentDiscoveryIllustration8EventBlocksPer30000: marked(discoveryCalls(BigInt(head.gapFromPinnedHead), 30000n, 80n)),
  fullLifetimeLogsLowerBoundAt1000: String((BigInt(head.block) - 126502643n + 1000n) / 1000n),
  fullLifetimeLogsLowerBoundAt30000: String((BigInt(head.block) - 126502643n + 30000n) / 30000n),
  retainedRealOneSwap: marked(reconstructionCalls(7, 4, 5, 3, 1)),
  retainedRealTenSwaps: marked(reconstructionCalls(15, 12, 13, 2, 10)),
  illustrative100Swaps: { ...marked(reconstructionCalls(105, 105, 105, 2, 100)), status: 'STAGED_REVIEW_REQUIRED_NOT_EXECUTABLE_UNDER_CURRENT_CAPS' },
  illustrative1000Swaps: { ...marked(reconstructionCalls(1005, 1005, 1005, 2, 1000)), status: 'STAGED_REVIEW_REQUIRED_NOT_EXECUTABLE_UNDER_CURRENT_CAPS' },
  dailyMaintenanceNoEventMinimum: marked(discoveryCalls(blocksPerDay, 30000n)),
  dailyMaintenanceIllustration8EventBlocksPer30000: marked(discoveryCalls(blocksPerDay, 30000n, ((blocksPerDay + 29999n) / 30000n) * 8n)),
  limitations: ['Liquidity-only discovery does not extend the full accounting index or verify new replay.', '100/1000 swaps do not necessarily mean the same number of distinct trace transactions or blocks; these scenarios assume one of each per swap.', 'Trace/checkpoint/lifetime limits remain unchanged.', 'No paid account eligibility, tax/fee quote, expiry or prepaid credit is confirmed for this account.'],
}, null, 2));
