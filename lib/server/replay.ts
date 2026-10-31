import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { PositionSummary, ReplayEvent, ReplayMeta } from '../domain/web';
const root = path.join(process.cwd(), '.web-data');
function read<T>(file: string): T { return JSON.parse(readFileSync(path.join(root, file), 'utf8')) as T; }
export const getMeta = () => read<ReplayMeta>('metadata.json');
export const getPositions = () => read<PositionSummary[]>('positions.json');
export function getPage(id: string, page: number) {
  const meta = getMeta();
  if (id !== meta.id) return null;
  if (!Number.isSafeInteger(page) || page < 0 || page >= Math.ceil(meta.eventCount / meta.pageSize)) throw new Error('INVALID_PAGE');
  return { page, total: meta.eventCount, events: read<ReplayEvent[]>(`events-${page}.json`) };
}
// No wallet input is cached or persisted. Public pool data is indexed at build.
export function positionsFor(wallet: string) { return getPositions().filter(p => p.provider.toLowerCase() === wallet.toLowerCase()); }
