export const Q64 = 1n << 64n;
export type Tokens = readonly [bigint, bigint];
export interface Flow { block: string; tokens: Tokens }
// Numerators are USDT base units times Q64: no floating point or intermediate rounding.
export const markedNumerator = (tokens: Tokens, referenceX64: bigint) => tokens[0] * referenceX64 + tokens[1] * Q64;
export function performance(final: Tokens, flows: readonly Flow[], prices: ReadonlyMap<string, bigint>, endpoint: string) {
  if (![endpoint, ...flows.map(f => f.block)].every(b => (prices.get(b) ?? 0n) > 0n)) return { status: 'UNAVAILABLE' as const, reason: 'Missing verified reference for an endpoint or cashflow; no price substituted' };
  const endpointPrice = prices.get(endpoint)!;
  const net: [bigint, bigint] = [0n, 0n]; let fundingValue = 0n, feasible = true;
  for (const flow of flows) {
    net[0] += flow.tokens[0]; net[1] += flow.tokens[1];
    if (net.some(v => v < 0n)) feasible = false;
    fundingValue += markedNumerator(flow.tokens, prices.get(flow.block)!);
  }
  const finalValue = markedNumerator(final, endpointPrice);
  const holdingValue = markedNumerator(net, endpointPrice);
  return { status: 'DERIVED_FROM_VERIFIED_INPUTS' as const, denominator: Q64, unit: 'USDT base units', finalValue, cashflowPnl: finalValue - fundingValue, holdingPnl: feasible ? holdingValue - fundingValue : null, vsHolding: feasible ? finalValue - holdingValue : null, netFundedTokens: net, holdingConvention: 'Hold each actually funded token; deliver the same token withdrawals at their historical times; unsupported if any holding inventory would go negative', valuationConvention: 'Historical on-chain provider reference at each cashflow block end and fixed endpoint; not execution prices or independently verified USD; gas excluded' };
}
export function formatUsdt(numerator: bigint, decimals = 6) {
  const sign = numerator < 0n ? '-' : '', amount = numerator < 0n ? -numerator : numerator;
  const units = amount * 10n ** BigInt(decimals) / (Q64 * 10n ** 18n);
  return `${sign}${units / 10n ** BigInt(decimals)}.${(units % 10n ** BigInt(decimals)).toString().padStart(decimals, '0')}`;
}
