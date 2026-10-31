import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
import { POST } from '../app/api/positions/route';
import { GET as metadata } from '../app/api/replay/route';
import { GET as events } from '../app/api/replay/[id]/events/route';
import { getMeta, getPage } from '../lib/server/replay';
describe('bounded public server API and generated ledger', () => {
  it('discovers sample provider/salt and scopes no-results to indexed history', async () => {
    const response = await POST(new Request('http://local/api/positions', { method: 'POST', body: JSON.stringify({ wallet: '0x3216FBdef81Be1842A80D648C83C7aa10bc00787' }) }));
    const body = await response.json();
    expect(body.positions.some((p: any) => p.salt === '198136120981933274567974' && p.status === 'reconciled')).toBe(true);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const empty = await POST(new Request('http://local/api/positions', { method: 'POST', body: JSON.stringify({ wallet: '0x000000000000000000000000000000000000dEaD' }) }));
    expect((await empty.json()).positions).toEqual([]);
  });
  it('rejects invalid/oversized input, invalid pages and unreconciled positions', async () => {
    expect((await POST(new Request('http://local/api/positions', { method: 'POST', body: JSON.stringify({ wallet: 'bad' }) }))).status).toBe(400);
    expect((await POST(new Request('http://local/api/positions', { method: 'POST', body: 'a'.repeat(1025) }))).status).toBe(413);
    const id = getMeta().id;
    expect((await events(new Request('http://local?page=-1'), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect((await events(new Request('http://local?page=99999'), { params: Promise.resolve({ id }) })).status).toBe(400);
    expect((await events(new Request('http://local?page=0'), { params: Promise.resolve({ id: 'other' }) })).status).toBe(409);
  });
  it('bounds charts and pages and exposes partial confidence without credentials', async () => {
    const meta = await (await metadata()).json();
    expect(meta.chart.length).toBeLessThanOrEqual(401);
    expect(meta.eventCount).toBe(26282); expect(meta.oracleStatus).toBe('PARTIAL');
    const page = await (await events(new Request('http://local?page=0'), { params: Promise.resolve({ id: meta.id }) })).json();
    expect(page.events).toHaveLength(128);
    expect(JSON.stringify({ meta, page })).not.toContain('BNB_RPC_URL');
    expect(JSON.stringify({ meta, page })).not.toContain('solidrpc');
    expect(page.events[1].reference.kind).toBe('EXECUTION');
  });
  it('all web events telescope exactly and independent historical withdrawal checkpoints agree', () => {
    const meta = getMeta(); let previous = ['0', '0'];
    const all = Array.from({ length: Math.ceil(meta.eventCount / meta.pageSize) }, (_, p) => getPage(meta.id, p)!.events).flat();
    for (const event of all) {
      expect(event.before).toEqual(previous);
      expect(event.after.map((v, i) => (BigInt(v) - BigInt(event.before[i])).toString())).toEqual(event.delta);
      previous = event.after;
    }
    expect(previous).toEqual(['22973419195727555217', '5657408436562991299915']);
    const evidence = JSON.parse(readFileSync('fixtures/history/historical-state.json', 'utf8'));
    for (const state of evidence.states) if (state.withdrawal) {
      const last = all.filter(e => BigInt(e.block) <= BigInt(state.block)).at(-1)!;
      expect(last.after).toEqual(state.withdrawal.amounts);
    }
    expect(all.some(e => e.type === 'rounding')).toBe(true);
  });
});
