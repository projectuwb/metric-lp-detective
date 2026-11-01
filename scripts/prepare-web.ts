import { mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, existsSync, renameSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { historyInputs, key } from './reconstruct-history.js';
import { verifyHistory } from './verify-history.js';
import { verifyOracle } from './verify-oracle.js';
import { verifiedPerformance } from './verify-performance.js';
import { verifyPosition } from './verify-position.js';
import { positionReplay } from '../lib/metric/positionReplay.js';
import { createReplayBundle } from '../lib/analysis/bundle.js';
import { accountingVersion } from '../lib/analysis/version.js';
import type { PositionSummary, ReplayMeta, Amounts, BlockMark } from '../lib/domain/web.js';
import { liquidityPositions } from '../lib/chain/discovery.js';
import { checkedDiscoveryIndex } from '../lib/chain/discoveryIndex.js';
import { publishedRangeProfile } from '../lib/chain/rpcCapabilities.js';

verifyHistory(); verifyOracle(); verifiedPerformance();
const h = historyInputs();
// Keep the last complete index available while the replacement is being verified.
const destination = new URL('../artifacts/web-data-staging/', import.meta.url);
rmSync(destination, { recursive: true, force: true }); mkdirSync(destination, { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(new URL(name, destination), JSON.stringify(value));
const quotes = new Map<string, any>();
for (const file of readdirSync(new URL('../fixtures/oracle/', import.meta.url)).filter(f => /^quotes-\d+\.json.gz$/.test(f))) {
  const witnesses = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/oracle/' + file, import.meta.url))).toString());
  for (const witness of witnesses) for (const q of witness.swaps) quotes.set(witness.transactionHash + ':' + q.logIndex, q);
}
const original = positionReplay(h.logs, h.abi, key, quotes);
const small = verifyPosition('632f7d8c3d6ef54f');
const additional = readdirSync(new URL('../fixtures/positions/', import.meta.url)).filter(slug => /^[a-f0-9]{16}$/.test(slug) && slug !== '632f7d8c3d6ef54f' && existsSync(new URL('../fixtures/positions/' + slug + '/request-proof.json', import.meta.url))).sort().map(slug => verifyPosition(slug));
const enabled = new Set([key, small.config.id, ...additional.map(v => v.config.id)]);
const discoveryBase = { chainId: 56 as const, pool: h.logs[0].address, from: h.acquisition.from, through: h.acquisition.to, headHash: h.acquisition.endHash, sourceHash: small.config.sourceHash, accountingVersion: accountingVersion() };
const discoveryFile = new URL('../fixtures/discovery/index.json', import.meta.url);
const discovery = existsSync(discoveryFile) ? checkedDiscoveryIndex(JSON.parse(readFileSync(discoveryFile, 'utf8')), discoveryBase) : null;
if (discovery?.rangeProfile && JSON.stringify(discovery.rangeProfile) !== JSON.stringify(publishedRangeProfile(discoveryBase.sourceHash))) throw new Error('Published discovery range profile does not match retained probe evidence');
const discoveryLogs = [...h.logs, ...(discovery?.pages.flatMap(p => p.logs) ?? [])];
const positions = liquidityPositions(discoveryLogs, enabled);
const pageSize = 128;
const registry: { id: string; directory: string; label: string }[] = [];
function publish(id: string, directory: string, label: string, r: ReturnType<typeof positionReplay>, marks: BlockMark[], sourceHashes: Record<string, string>) {
  if (directory) mkdirSync(new URL(directory + '/', destination), { recursive: true });
  const prefix = directory ? directory + '/' : '';
  const { metadata, pages } = createReplayBundle(id, label, r, marks, sourceHashes, h.acquisition.from, h.acquisition.to, positions.length);
  for (const [i, page] of pages.entries()) save(prefix + 'events-' + i + '.json', page);
  save(prefix + 'metadata.json', metadata); registry.push({ id, directory, label });
  console.log(JSON.stringify({ position: label, events: metadata.eventCount, pages: pages.length, executionQuotes: metadata.executionQuotes, closed: metadata.closed }));
}
const originalMarks = JSON.parse(readFileSync(new URL('../fixtures/history/valuation-inputs.json', import.meta.url), 'utf8')).records.map((m: any) => ({ block: m.block, blockHash: m.blockHash, timestamp: m.timestamp, referenceX64: m.referenceX64, kind: 'BLOCK_END' }));
const sourceHashes = Object.fromEntries(['position-history.json', 'historical-state.json', 'valuation-inputs.json'].map(f => [f, createHash('sha256').update(readFileSync(new URL('../fixtures/history/' + f, import.meta.url))).digest('hex')]));
publish(key, '', 'Original sample · 26,202 swaps', original, originalMarks, sourceHashes);
const smallMarks = small.marks.filter((m: any) => m.result).map((m: any) => ({ block: m.block, blockHash: m.blockHash, timestamp: m.timestamp, referenceX64: m.referenceX64, kind: 'BLOCK_END' }));
publish(small.config.id, small.config.slug, 'Smaller sample · 9 swaps · closed', small.replay, smallMarks, { poolIndex: small.config.sourceHash, checkpointEvidence: createHash('sha256').update(readFileSync(new URL('../fixtures/positions/' + small.config.slug + '/states.json', import.meta.url))).digest('hex') });
for (const v of additional) {
  const marks = v.marks.filter((m: any) => m.result).map((m: any) => ({ block: m.block, blockHash: m.blockHash, timestamp: m.timestamp, referenceX64: m.referenceX64, kind: 'BLOCK_END' as const }));
  publish(v.config.id, v.config.slug, 'Verified owner-requested position · ' + v.verification.swaps + ' swaps', v.replay, marks, { poolIndex: v.config.sourceHash, checkpointEvidence: createHash('sha256').update(readFileSync(new URL('../fixtures/positions/' + v.config.slug + '/states.json', import.meta.url))).digest('hex') });
}
save('positions.json', positions); save('registry.json', registry);
save('manifest.json', { schema: 2, selectedPosition: key, playable: registry.map(r => r.id), eventCount: original.events.length, pageSize, inventoryVerified: true, adjustmentEvents: original.events.filter(e => e.type === 'rounding').length });

save('context.json', { chainId: 56, pool: h.logs[0].address, indexEnd: h.acquisition.to, indexEndHash: h.acquisition.endHash, sourceHash: small.config.sourceHash, accountingVersion: accountingVersion() });
const discoveryEnd = discovery?.pages.at(-1)?.through ?? h.acquisition.to;
const probe = JSON.parse(readFileSync(new URL('../fixtures/rpc/solidrpc-free-probe.json', import.meta.url), 'utf8'));
const observedHead = probe.results.find((r: any) => r.name === 'finalised chain head' && r.status === 'PASS')?.result;
const probeObservation = observedHead ? { block: observedHead.block, hash: observedHead.hash, observedAt: probe.observedAt } : null;
const indexedObservation = discovery?.observedFinalizedHead ?? null;
const observation = indexedObservation && (!probeObservation || Date.parse(indexedObservation.observedAt) >= Date.parse(probeObservation.observedAt)) ? indexedObservation : probeObservation;
save('discovery.json', { ...discoveryBase, through: discoveryEnd, headHash: discovery?.pages.at(-1)?.headHash ?? h.acquisition.endHash,
  replayThrough: h.acquisition.to, replayHeadHash: h.acquisition.endHash,
  refreshState: 'OWNER_REFRESH_REQUIRED', observedFinalizedHead: observation,
  recentHeadLag: observation ? String(BigInt(observation.block) - BigInt(discoveryEnd)) : null });
const published = new URL('../.web-data/', import.meta.url), previous = new URL('../artifacts/previous-web-data/', import.meta.url);
rmSync(previous, { recursive: true, force: true });
if (existsSync(published)) renameSync(published, previous);
try { renameSync(destination, published); }
catch (error) { if (!existsSync(published) && existsSync(previous)) renameSync(previous, published); throw error; }
rmSync(previous, { recursive: true, force: true });
