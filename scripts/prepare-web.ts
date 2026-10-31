import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { reconstruct, key } from './reconstruct-history.js';
import { verifyHistory } from './verify-history.js';
import { verifyOracle } from './verify-oracle.js';
import { verifiedPerformance } from './verify-performance.js';
import type { ReplayEvent, PositionSummary, ReplayMeta, Amounts, BinChange } from '../lib/domain/web.js';
import type { Transition } from '../lib/metric/positionLedger.js';
import { encodeEventTopics } from 'viem';
import { sourceAbi } from '../lib/chain/decode.js';

verifyHistory(); verifyOracle(); verifiedPerformance();
const h = reconstruct();
const destination = new URL('../.web-data/', import.meta.url);
rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(new URL(name, destination), JSON.stringify(value));
const quotes = new Map<string, any>();
for (const file of readdirSync(new URL('../fixtures/oracle/', import.meta.url)).filter(f => /^quotes-\d+\.json.gz$/.test(f))) {
  const witnesses = JSON.parse(gunzipSync(readFileSync(new URL(`../fixtures/oracle/${file}`, import.meta.url))).toString());
  for (const witness of witnesses) for (const q of witness.swaps) quotes.set(`${witness.transactionHash}:${q.logIndex}`, q);
}
const positions = [...h.replay.positions.entries()].map(([id, p]): PositionSummary => {
  const own = h.replay.transitions.filter(t => (t.before.shares[id] ?? 0n) !== (t.after.shares[id] ?? 0n));
  // Snapshot entitlements are filtered to the verified position; discover other
  // positions from the original indexed liquidity events below instead.
  return { id, provider: p.owner, salt: String(p.salt), firstBlock: own[0]?.block.toString() ?? '', lastBlock: own.at(-1)?.block.toString() ?? '', status: id === key ? 'reconciled' : 'indexed-only' };
});
const liquidityTopics = new Set((['LiquidityAdded', 'LiquidityRemoved'] as const).map(eventName => encodeEventTopics({ abi: sourceAbi, eventName })[0]));
// Indexed liquidity topics directly identify provider and salt; no user-query persistence.
for (const position of positions) {
  const logs = h.logs.filter(l => liquidityTopics.has(l.topics[0] as `0x${string}`) && l.topics.length === 3 && l.topics[1]?.toLowerCase().endsWith(position.provider.slice(2).toLowerCase()) && BigInt(l.topics[2]) === BigInt(position.salt));
  if (logs.length) { position.firstBlock = BigInt(logs[0].blockNumber).toString(); position.lastBlock = BigInt(logs.at(-1)!.blockNumber).toString(); }
}
const selectedFunding = new Set(h.funding.map(t => `${t.transactionHash}:${t.logIndex}`));
const changes = (t: Transition): BinChange => ({ bin: String(t.bin), logIndex: String(t.logIndex), sharesBefore: String(t.before.shares[key] ?? 0n), sharesAfter: String(t.after.shares[key] ?? 0n), totalBefore: String(t.before.totalShares), totalAfter: String(t.after.totalShares), before: (t.before.entitlements[key] ?? [0n, 0n]).map(String) as Amounts, after: (t.after.entitlements[key] ?? [0n, 0n]).map(String) as Amounts });
const entries: Omit<ReplayEvent, 'index' | 'before' | 'after'>[] = [];
for (const swap of h.relevant) {
  const quote = quotes.get(`${swap.transactionHash}:${swap.logIndex}`);
  const legs = swap.legs.filter(l => (l.before.shares[key] ?? 0n) > 0n);
  const delta = legs.reduce<[bigint, bigint]>((n, l) => [n[0] + l.positionDelta[key][0], n[1] + l.positionDelta[key][1]], [0n, 0n]);
  entries.push({ type: 'swap', block: String(swap.block), transactionHash: swap.transactionHash, logIndex: String(swap.logIndex), delta: delta.map(String) as Amounts, bins: legs.map(changes), reference: quote ? { kind: 'EXECUTION', referenceX64: quote.referenceX64, bidX64: quote.bidX64, askX64: quote.askX64 } : null, execution: { stockBase: String(swap.nativeDeltas[0] < 0n ? -swap.nativeDeltas[0] : swap.nativeDeltas[0]), stableBase: String(swap.nativeDeltas[1] < 0n ? -swap.nativeDeltas[1] : swap.nativeDeltas[1]) } });
}
const liquidity = new Map<string, Transition[]>();
for (const t of h.replay.transitions.filter(t => t.event !== 'BinSwapped')) {
  const id = `${t.transactionHash}:${t.logIndex}`;
  if (!selectedFunding.has(id) && (t.positionDelta[key] ?? [0n, 0n]).every(v => v === 0n)) continue;
  const list = liquidity.get(id) ?? []; list.push(t); liquidity.set(id, list);
}
for (const [id, rows] of liquidity) {
  const first = rows[0], own = selectedFunding.has(id);
  const delta = rows.reduce<[bigint, bigint]>((n, t) => [n[0] + (t.positionDelta[key]?.[0] ?? 0n), n[1] + (t.positionDelta[key]?.[1] ?? 0n)], [0n, 0n]);
  entries.push({ type: own ? first.event === 'LiquidityAdded' ? 'deposit' : 'withdrawal' : 'rounding', block: String(first.block), transactionHash: first.transactionHash, logIndex: String(first.logIndex), delta: delta.map(String) as Amounts, bins: rows.map(changes), reference: null, execution: null });
}
entries.sort((a, b) => BigInt(a.block) === BigInt(b.block) ? Number(BigInt(a.logIndex) - BigInt(b.logIndex)) : BigInt(a.block) < BigInt(b.block) ? -1 : 1);
let balance: [bigint, bigint] = [0n, 0n];
const events: ReplayEvent[] = entries.map((entry, index) => {
  const before = balance.map(String) as Amounts;
  balance = [balance[0] + BigInt(entry.delta[0]), balance[1] + BigInt(entry.delta[1])];
  if (balance.some(v => v < 0n)) throw new Error('Negative replay inventory');
  return { ...entry, index, before, after: balance.map(String) as Amounts };
});
if (String(balance) !== String(h.final)) throw new Error('Web replay differs from independent reconciliation');
const pageSize = 128;
for (let i = 0; i < events.length; i += pageSize) save(`events-${i / pageSize}.json`, events.slice(i, i + pageSize));
const chart = events.filter((_, i) => i % Math.ceil(events.length / 400) === 0 || i === events.length - 1).map(e => ({ index: e.index, block: e.block, balances: e.after }));
const refs = events.filter(e => e.reference);
const performance = JSON.parse(readFileSync(new URL('../fixtures/history/performance.json', import.meta.url), 'utf8')).display;
const endpoint = JSON.parse(readFileSync(new URL('../fixtures/history/valuation-inputs.json', import.meta.url), 'utf8')).records.find((r: any) => r.block === h.acquisition.to);
const sourceHashes = Object.fromEntries(['position-history.json', 'historical-state.json', 'valuation-inputs.json'].map(f => [f, createHash('sha256').update(readFileSync(new URL(`../fixtures/history/${f}`, import.meta.url))).digest('hex')]));
const metadata: ReplayMeta = { id: key, eventCount: events.length, pageSize, from: h.acquisition.from, through: h.acquisition.to, final: balance.map(String) as Amounts, positionsCount: positions.length, chart, referencePoints: refs.filter((_, i) => i % Math.ceil(refs.length / 350) === 0 || i === refs.length - 1).map(e => ({ index: e.index, referenceX64: e.reference!.referenceX64 })), performance, endpointReference: { block: endpoint.block, referenceX64: endpoint.referenceX64 }, executionQuotes: refs.length, oracleStatus: 'PARTIAL', sourceHashes };
save('positions.json', positions); save('metadata.json', metadata);
save('manifest.json', { schema: 1, selectedPosition: key, eventCount: events.length, pageSize, inventoryVerified: true, adjustmentEvents: events.filter(e => e.type === 'rounding').length });
console.log(JSON.stringify({ webEvents: events.length, pages: Math.ceil(events.length / pageSize), chartPoints: chart.length, endpointReconciled: true, executionQuotes: refs.length, indexedPositions: positions.length }));
