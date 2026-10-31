import type { ReplayMeta, Amounts, BlockMark } from '../domain/web';
import type { positionReplay } from '../metric/positionReplay';
import { performance, formatUsdt } from '../metric/valuation';
export function createReplayBundle(id: string, label: string, r: ReturnType<typeof positionReplay>, marks: BlockMark[], sourceHashes: Record<string, string>, from: string, through: string, positionsCount: number) {
  const pageSize = 128;
  const events = r.events, balance = r.final.map(String) as Amounts;
  const funding = r.funding.map(f => ({ index: events.findIndex(e => e.transactionHash === f.transactionHash && e.logIndex === f.logIndex), block: f.block, tokens: f.tokens, transactionHash: f.transactionHash, logIndex: f.logIndex }));
  const shares = new Map<string, bigint>();
  const milestones: ReplayMeta['milestones'] = []; let funded = false, exited = false;
  for (const e of events) {
    for (const b of e.bins) shares.set(b.bin, BigInt(b.sharesAfter));
    if (e.type === 'deposit') { milestones.push({ index: e.index, block: e.block, kind: !funded ? 'INITIAL_DEPOSIT' : exited ? 'REENTRY' : 'ADD' }); funded = true; exited = false; }
    if (e.type === 'withdrawal') { const closed = [...shares.values()].every(s => s === 0n); milestones.push({ index: e.index, block: e.block, kind: closed ? 'FULL_CLOSE' : 'PARTIAL_WITHDRAWAL' }); exited = closed; }
  }
  if (funding.some(f => f.index < 0)) throw new Error('Missing funding event');
  const endpoint = marks.find(m => m.block === through);
  if (!endpoint) throw new Error('Endpoint mark missing');
  const p = performance(r.final, funding.map(f => ({ block: f.block, tokens: f.tokens.map(BigInt) as [bigint, bigint] })), new Map(marks.map(m => [m.block, BigInt(m.referenceX64)])), endpoint.block);
  if (p.status === 'UNAVAILABLE') throw new Error('Registered sample lacks endpoint cashflow marks');
  const chart = events.filter((_, i) => i % Math.ceil(events.length / 400) === 0 || i === events.length - 1).map(e => ({ index: e.index, block: e.block, balances: e.after }));
  const refs = events.filter(e => e.reference);
  const metadata: ReplayMeta = { id, label, closed: r.final.every(n => n === 0n), initialFunding: funding[0].tokens, funding, marks, milestones,
    eventCount: events.length, pageSize, from, through, final: balance, positionsCount, chart,
    referencePoints: refs.filter((_, i) => i % Math.ceil(refs.length / 350) === 0 || i === refs.length - 1).map(e => ({ index: e.index, referenceX64: e.reference!.referenceX64 })),
    performance: { finalValue: formatUsdt(p.finalValue), cashflowPnl: formatUsdt(p.cashflowPnl), holdingPnl: p.holdingPnl === null ? null : formatUsdt(p.holdingPnl), vsHolding: p.vsHolding === null ? null : formatUsdt(p.vsHolding), unit: 'USDT-equivalent' },
    endpointReference: { block: endpoint.block, referenceX64: endpoint.referenceX64 }, executionQuotes: refs.length, oracleStatus: 'PARTIAL', sourceHashes };
  const pages = Array.from({ length: Math.ceil(events.length / pageSize) }, (_, i) => events.slice(i * pageSize, (i + 1) * pageSize));
  return { metadata, pages };
}
