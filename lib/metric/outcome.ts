import type { ReplayMeta, ReplayEvent, FundingPoint } from '../domain/web';
import { rational, plus, minus, type Rational } from './rational';
import { Q64 } from './valuation';
export type Currency = 'USDT' | 'CRCLB';
// Both tokens have 18 decimals. Return exact rational base units: no rounding of flows.
export function translated(tokens: readonly bigint[], referenceX64: bigint, currency: Currency): Rational {
  if (referenceX64 <= 0n) throw new Error('Verified positive reference required');
  return rational(tokens[0] * referenceX64 + tokens[1] * Q64, currency === 'USDT' ? Q64 : referenceX64);
}
export function lifecycleOutcome(meta: ReplayMeta, event: ReplayEvent) {
  const flows = meta.funding.filter(f => f.index <= event.index);
  const prices = new Map(meta.marks.map(m => [m.block, BigInt(m.referenceX64)]));
  const contributed = [0n, 0n], distributed = [0n, 0n], remaining = event.after.map(BigInt);
  for (const f of flows) f.tokens.forEach((v, i) => { const n = BigInt(v); if (n < 0n) distributed[i] -= n; else contributed[i] += n; });
  function flowValue(f: FundingPoint, currency: Currency) {
    const p = prices.get(f.block); return p && p > 0n ? translated(f.tokens.map(BigInt), p, currency) : null;
  }
  function values(currency: Currency) {
    let input = rational(0n), output = rational(0n), inputsKnown = true, outputsKnown = true;
    for (const f of flows) {
      const deposit = f.tokens.every(v => BigInt(v) >= 0n), v = flowValue(f, currency);
      if (deposit) { if (v) input = plus(input, v); else inputsKnown = false; }
      else { if (v) output = minus(output, v); else outputsKnown = false; }
    }
    const price = prices.get(event.block), held = price && price > 0n ? translated(remaining, price, currency) : null;
    const net = inputsKnown && outputsKnown && held ? minus(plus(output, held), input) : null;
    return { input: inputsKnown ? input : null, output: outputsKnown ? output : null, held, net,
      percentage: net && input.n > 0n ? rational(net.n * input.d * 100n, net.d * input.n) : null };
  }
  const selectedFlow = flows.find(f => f.index === event.index && f.tokens.some(t => BigInt(t) < 0n));
  const selectedWithdrawal = selectedFlow ? selectedFlow.tokens.map(v => -BigInt(v)) : null;
  const price = prices.get(event.block);
  return { contributed, distributed, remaining, netTokens: remaining.map((v, i) => v + distributed[i] - contributed[i]), flows,
    closedHere: meta.milestones?.some(m => m.index === event.index && m.kind === 'FULL_CLOSE') ?? false,
    usdt: values('USDT'), stock: values('CRCLB'), flowValue,
    selectedWithdrawal,
    settlement: selectedWithdrawal && price && price > 0n ? { USDT: translated(selectedWithdrawal, price, 'USDT'), CRCLB: translated(selectedWithdrawal, price, 'CRCLB') } : null };
}
