import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { historyInputs, key } from './reconstruct-history.js';
import { verifyHistory } from './verify-history.js';
import { verifyOracle } from './verify-oracle.js';
import { verifiedPerformance } from './verify-performance.js';
import { verifyPosition } from './verify-position.js';
import { positionReplay } from '../lib/metric/positionReplay.js';
import { performance, formatUsdt } from '../lib/metric/valuation.js';
import type { PositionSummary, ReplayMeta, Amounts, BlockMark } from '../lib/domain/web.js';
import { encodeEventTopics } from 'viem';
import { sourceAbi } from '../lib/chain/decode.js';

verifyHistory(); verifyOracle(); verifiedPerformance();
const h = historyInputs();
const destination = new URL('../.web-data/', import.meta.url);
rmSync(destination, { recursive: true, force: true }); mkdirSync(destination, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(new URL(name, destination), JSON.stringify(value));
const quotes = new Map<string, any>();
for (const file of readdirSync(new URL('../fixtures/oracle/', import.meta.url)).filter(f => /^quotes-\d+\.json.gz$/.test(f))) {
  const witnesses = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/oracle/' + file, import.meta.url))).toString());
  for (const witness of witnesses) for (const q of witness.swaps) quotes.set(witness.transactionHash + ':' + q.logIndex, q);
}
const original = positionReplay(h.logs, h.abi, key, quotes);
const small = verifyPosition('632f7d8c3d6ef54f');
const enabled = new Set([key, small.config.id]);
const liquidityTopics = new Set((['LiquidityAdded', 'LiquidityRemoved'] as const).map(eventName => encodeEventTopics({ abi: sourceAbi, eventName })[0]));
const positionMap = new Map<string, PositionSummary>();
for (const log of h.logs) if (liquidityTopics.has(log.topics[0] as `0x${string}`)) {
  const provider = '0x' + log.topics[1].slice(-40).toLowerCase(), salt = BigInt(log.topics[2]).toString(), id = provider + ':' + salt, block = BigInt(log.blockNumber).toString();
  const previous = positionMap.get(id);
  positionMap.set(id, { id, provider, salt, firstBlock: previous?.firstBlock ?? block, lastBlock: block, status: enabled.has(id) ? 'reconciled' : 'indexed-only' });
}
const positions = [...positionMap.values()];
const pageSize = 128;
const registry: { id: string; directory: string; label: string }[] = [];
function publish(id: string, directory: string, label: string, r: ReturnType<typeof positionReplay>, marks: BlockMark[], sourceHashes: Record<string, string>) {
  if (directory) mkdirSync(new URL(directory + '/', destination), { recursive: true });
  const prefix = directory ? directory + '/' : '';
  const events = r.events, balance = r.final.map(String) as Amounts;
  const funding = r.funding.map(f => ({ index: events.findIndex(e => e.transactionHash === f.transactionHash && e.logIndex === f.logIndex), block: f.block, tokens: f.tokens }));
  if (funding.some(f => f.index < 0)) throw new Error('Missing funding event');
  const endpoint = marks.find(m => m.block === h.acquisition.to);
  if (!endpoint) throw new Error('Endpoint mark missing');
  const p = performance(r.final, funding.map(f => ({ block: f.block, tokens: f.tokens.map(BigInt) as [bigint, bigint] })), new Map(marks.map(m => [m.block, BigInt(m.referenceX64)])), endpoint.block);
  if (p.status === 'UNAVAILABLE') throw new Error('Registered sample lacks endpoint cashflow marks');
  for (let i = 0; i < events.length; i += pageSize) save(prefix + 'events-' + i / pageSize + '.json', events.slice(i, i + pageSize));
  const chart = events.filter((_, i) => i % Math.ceil(events.length / 400) === 0 || i === events.length - 1).map(e => ({ index: e.index, block: e.block, balances: e.after }));
  const refs = events.filter(e => e.reference);
  const metadata: ReplayMeta = { id, label, closed: r.final.every(n => n === 0n), initialFunding: funding[0].tokens, funding, marks,
    eventCount: events.length, pageSize, from: h.acquisition.from, through: h.acquisition.to, final: balance, positionsCount: positions.length, chart,
    referencePoints: refs.filter((_, i) => i % Math.ceil(refs.length / 350) === 0 || i === refs.length - 1).map(e => ({ index: e.index, referenceX64: e.reference!.referenceX64 })),
    performance: { finalValue: formatUsdt(p.finalValue), cashflowPnl: formatUsdt(p.cashflowPnl), holdingPnl: p.holdingPnl === null ? null : formatUsdt(p.holdingPnl), vsHolding: p.vsHolding === null ? null : formatUsdt(p.vsHolding), unit: 'USDT-equivalent' },
    endpointReference: { block: endpoint.block, referenceX64: endpoint.referenceX64 }, executionQuotes: refs.length, oracleStatus: 'PARTIAL', sourceHashes };
  save(prefix + 'metadata.json', metadata); registry.push({ id, directory, label });
  console.log(JSON.stringify({ position: label, events: events.length, pages: Math.ceil(events.length / pageSize), executionQuotes: refs.length, closed: metadata.closed }));
}
const originalMarks = JSON.parse(readFileSync(new URL('../fixtures/history/valuation-inputs.json', import.meta.url), 'utf8')).records.map((m: any) => ({ block: m.block, blockHash: m.blockHash, timestamp: m.timestamp, referenceX64: m.referenceX64, kind: 'BLOCK_END' }));
const sourceHashes = Object.fromEntries(['position-history.json', 'historical-state.json', 'valuation-inputs.json'].map(f => [f, createHash('sha256').update(readFileSync(new URL('../fixtures/history/' + f, import.meta.url))).digest('hex')]));
publish(key, '', 'Original sample · 26,202 swaps', original, originalMarks, sourceHashes);
const smallMarks = small.marks.filter((m: any) => m.result).map((m: any) => ({ block: m.block, blockHash: m.blockHash, timestamp: m.timestamp, referenceX64: m.referenceX64, kind: 'BLOCK_END' }));
publish(small.config.id, small.config.slug, 'Smaller sample · 9 swaps · closed', small.replay, smallMarks, { poolIndex: small.config.sourceHash, checkpointEvidence: createHash('sha256').update(readFileSync(new URL('../fixtures/positions/' + small.config.slug + '/states.json', import.meta.url))).digest('hex') });
save('positions.json', positions); save('registry.json', registry);
save('manifest.json', { schema: 2, selectedPosition: key, playable: registry.map(r => r.id), eventCount: original.events.length, pageSize, inventoryVerified: true, adjustmentEvents: original.events.filter(e => e.type === 'rounding').length });
