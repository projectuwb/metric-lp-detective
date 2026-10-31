import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import type { ReplayMeta, ReplayEvent } from '../lib/domain/web.js';
import { lifecycleOutcome } from '../lib/metric/outcome.js';
const root = new URL('../.web-data/', import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const records = [];
for (const item of read('registry.json')) {
  const prefix = item.directory ? item.directory + '/' : '', meta: ReplayMeta = read(prefix + 'metadata.json');
  const indices = new Set(meta.eventCount < 100 ? Array.from({ length: meta.eventCount }, (_, i) => i) : [0, 1, meta.eventCount - 1, ...meta.milestones.map(m => m.index)]);
  for (const index of indices) {
    const event: ReplayEvent = read(prefix + 'events-' + Math.floor(index / meta.pageSize) + '.json').find((e: ReplayEvent) => e.index === index);
    const o = lifecycleOutcome(meta, event);
    records.push({ id: meta.id, directory: item.directory, index, block: event.block, usdt: o.usdt, stock: o.stock, settlement: o.settlement });
  }
}
mkdirSync(new URL('../artifacts/', import.meta.url), { recursive: true });
writeFileSync(new URL('../artifacts/outcomes.json', import.meta.url), JSON.stringify(records, (_, v) => typeof v === 'bigint' ? String(v) : v, 2));
console.log(JSON.stringify({ outcomeChecks: records.length, source: 'verified replay events and historical marks' }));
