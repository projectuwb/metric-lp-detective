import type { FundingPoint } from './web';
// Explain the infeasibility only; never simulate a trade or produce a new benchmark.
export function holdingExplanation(flows: readonly FundingPoint[]) {
  const tokens = [0n, 0n]; let needsStock = false, needsStable = false;
  for (const f of flows) {
    f.tokens.forEach((n, i) => { tokens[i] += BigInt(n); });
    needsStock ||= tokens[0] < 0n; needsStable ||= tokens[1] < 0n;
  }
  const trade = needsStable && !needsStock ? 'stock sale' : needsStock && !needsStable ? 'stock purchase' : 'token exchange';
  return `A like-for-like holding comparison would need an assumed ${trade}; not calculated.`;
}
