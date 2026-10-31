import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PositionSummary, ReplayEvent, ReplayMeta } from '../domain/web';
import { runtimeMeta, runtimePage, runtimeJobs } from '../analysis/artifact';
const root = path.join(process.cwd(), '.web-data');
function read<T>(file: string): T { return JSON.parse(readFileSync(path.join(root, file), 'utf8')) as T; }
export const getRegistry = () => read<{ id: string; directory: string; label: string }[]>('registry.json');
function directory(id?: string) {
  const entry = id ? getRegistry().find(r => r.id === id) : getRegistry()[0];
  return entry ? entry.directory ? entry.directory + '/' : '' : null;
}
export function getMeta(id?: string): ReplayMeta {
  const prefix = directory(id); if (prefix === null) { const meta = id ? runtimeMeta(id) : null; if (meta) return meta; throw new Error('UNSUPPORTED_POSITION'); }
  return read<ReplayMeta>(prefix + 'metadata.json');
}
export const getPositions = () => { const verified = new Set(runtimeJobs().map(j => j.id)); return read<PositionSummary[]>('positions.json').map(p => p.status === 'indexed-only' && verified.has(p.id) ? { ...p, status: 'reconciled' as const } : p); };
export function getPage(id: string, page: number) {
  const prefix = directory(id);
  const dynamic = prefix === null ? runtimeMeta(id) : null;
  if (prefix === null && !dynamic) return null;
  const meta = dynamic ?? getMeta(id);
  if (!Number.isSafeInteger(page) || page < 0 || page >= Math.ceil(meta.eventCount / meta.pageSize)) throw new Error('INVALID_PAGE');
  return { page, total: meta.eventCount, events: dynamic ? runtimePage(id, page)! : read<ReplayEvent[]>(`${prefix}events-${page}.json`) };
}
// No wallet input is cached or persisted. Public pool data is indexed at build.
export function positionsFor(wallet: string) { return getPositions().filter(p => p.provider.toLowerCase() === wallet.toLowerCase()); }
