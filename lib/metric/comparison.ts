import type { ReplayMeta, ReplayEvent } from '../domain/web';
import { performance, formatUsdt, markedNumerator } from './valuation';
// Token and value arithmetic stays in integers; display formatting is the only truncation.
export function selectedComparison(meta: ReplayMeta, event: ReplayEvent) {
  const flows = meta.funding.filter(f => f.index <= event.index);
  const deposits = [0n, 0n], withdrawals = [0n, 0n];
  for (const f of flows) f.tokens.forEach((v, i) => { const n = BigInt(v); if (n >= 0n) deposits[i] += n; else withdrawals[i] -= n; });
  const current = event.after.map(BigInt), initial = meta.initialFunding.map(BigInt);
  const difference = current.map((n, i) => n - initial[i]);
  const percent = difference.map((n, i) => initial[i] === 0n ? null : n * 10000n / initial[i]);
  const net = deposits.map((n, i) => n - withdrawals[i]);
  const flowAdjusted = current.map((n, i) => n - net[i]);
  const prices = new Map(meta.marks.map(m => [m.block, BigInt(m.referenceX64)]));
  const mark = meta.marks.find(m => m.block === event.block) ?? null;
  const initialMark = meta.marks.find(m => m.block === meta.funding[0].block) ?? null;
  const initialValue = initialMark ? formatUsdt(markedNumerator(initial as [bigint, bigint], BigInt(initialMark.referenceX64))) : null;
  const p = performance(current as [bigint, bigint], flows.map(f => ({ block: f.block, tokens: f.tokens.map(BigInt) as [bigint, bigint] })), prices, event.block);
  return { initial, initialMark, initialValue, current, difference, percent, deposits, withdrawals, net, flowAdjusted, mark,
    valuation: p.status === 'UNAVAILABLE' ? { status: p.status, reason: p.reason } : {
      status: p.status, value: formatUsdt(p.finalValue), pnl: formatUsdt(p.cashflowPnl),
      holdingPnl: p.holdingPnl === null ? null : formatUsdt(p.holdingPnl), vsHolding: p.vsHolding === null ? null : formatUsdt(p.vsHolding),
    } };
}
