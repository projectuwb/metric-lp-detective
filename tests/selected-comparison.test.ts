import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { getMeta, getPage, positionsFor, getRegistry } from '../lib/server/replay';
import { GET } from '../app/api/replay/route';
import { SMALL_SAMPLE_ID } from '../lib/domain/samples';
import { selectedComparison } from '../lib/metric/comparison';
import { positionIdentity } from '../lib/domain/position';
import { GET as analysisStatus } from '../app/api/positions/[id]/status/route';
describe('initial inventory, multiple funding flows and selected-point valuation', () => {
  const meta = getMeta(SMALL_SAMPLE_ID), events = getPage(meta.id, 0)!.events;
  it('registers only independently reconciled positions and keeps each salt isolated', async () => {
    expect(positionIdentity('0x3eB210eAa4026f62D027fafABA1fa5592feBb06A:0001')).toBe('0x3eb210eaa4026f62d027fafaba1fa5592febb06a:1');
    expect(() => positionIdentity(SMALL_SAMPLE_ID.split(':')[0] + ':' + (1n << 80n))).toThrow('uint80');
    expect(getRegistry()).toHaveLength(2);
    expect(meta.eventCount).toBe(14); expect(meta.closed).toBe(true);
    expect(events.filter(e => e.type === 'swap')).toHaveLength(9);
    expect(events.every(e => e.type !== 'swap' || e.reference?.kind === 'EXECUTION')).toBe(true);
    const detected = positionsFor(SMALL_SAMPLE_ID.split(':')[0]);
    expect(detected.find(p => p.id === SMALL_SAMPLE_ID)?.status).toBe('reconciled');
    expect(detected.length).toBeGreaterThan(1);
    const other = detected.find(p => p.id !== SMALL_SAMPLE_ID)!;
    expect(other.status).toBe('indexed-only'); expect(getPage(other.id, 0)).toBeNull();
    expect((await GET(new Request('http://local/api/replay?id=' + encodeURIComponent(SMALL_SAMPLE_ID)))).status).toBe(200);
    expect((await GET(new Request('http://local/api/replay?id=../../secret'))).status).toBe(409);
    expect(() => getPage(meta.id, 1)).toThrow('INVALID_PAGE');
  });
  it('separates actual funding from floor-rounded entitlements and later deposits', () => {
    const first = selectedComparison(meta, events[0]);
    expect(first.initial.map(String)).toEqual(['5581308503708253008', '3906222415174827386047']);
    expect(first.difference).toEqual([-1n, -4n]);
    expect(first.initialValue).toBe('4355.903941');
    expect(first.deposits).toEqual(first.initial); expect(first.withdrawals).toEqual([0n, 0n]);
    const beforeSecond = selectedComparison(meta, events[3]), afterSecond = selectedComparison(meta, events[4]);
    expect(afterSecond.deposits[0] - beforeSecond.deposits[0]).toBe(433769151916363882n);
    expect(afterSecond.deposits[1] - beforeSecond.deposits[1]).toBe(112248401005050293734n);
    expect(afterSecond.valuation.status).toBe('DERIVED_FROM_VERIFIED_INPUTS');
  });
  it('reports actual verified/indexed-only coverage without promising a background queue', async () => {
    const request = new Request('http://local/status');
    const verified = await analysisStatus(request, { params: Promise.resolve({ id: SMALL_SAMPLE_ID }) });
    expect(await verified.json()).toMatchObject({ status: 'VERIFIED', queueAvailable: false, progress: null, lastVerifiedBlock: '130841348', coverage: { through: '130841348', blockHash: '0xd4b50c9afe0934057d61ccf2821e30c5b6dbf3553b6348ccb846e9f5a074ea7e' } });
    const other = positionsFor(SMALL_SAMPLE_ID.split(':')[0]).find(p => p.status === 'indexed-only')!;
    const result = await analysisStatus(request, { params: Promise.resolve({ id: other.id }) });
    expect(await result.json()).toMatchObject({ status: 'INDEXED_ONLY', queueAvailable: false, progress: null, lastVerifiedBlock: null });
    expect((await analysisStatus(request, { params: Promise.resolve({ id: '../../secret' }) })).status).toBe(400);
    const absent = await analysisStatus(request, { params: Promise.resolve({ id: '0x000000000000000000000000000000000000dead:0' }) });
    expect(absent.status).toBe(404); expect((await absent.json()).status).toBe('UNSUPPORTED');
  });
  it('full withdrawal is a cashflow, not a complete loss; unsupported holding stays null', () => {
    const c = selectedComparison(meta, events.at(-1)!);
    expect(c.current).toEqual([0n, 0n]); expect(c.percent).toEqual([-10000n, -10000n]);
    expect(c.withdrawals).toEqual([0n, 4543728066440139855352n]);
    expect(c.deposits).toEqual([6139892490136691462n, 4050862375118152962428n]);
    expect(c.flowAdjusted).toEqual([-6139892490136691462n, 492865691321986892924n]);
    expect(c.valuation).toMatchObject({ status: 'DERIVED_FROM_VERIFIED_INPUTS', value: '0.000000', pnl: '-1.812248', vsHolding: null });
  });
  it('never substitutes execution prices, endpoint marks or zeros for missing marks', () => {
    const swap = events[1]; expect(swap.reference).not.toBeNull();
    expect(selectedComparison({ ...meta, marks: meta.marks.filter(m => m.block !== swap.block) }, swap).valuation.status).toBe('UNAVAILABLE');
    expect(selectedComparison({ ...meta, marks: meta.marks.filter(m => m.block !== meta.funding[0].block) }, swap).valuation.status).toBe('UNAVAILABLE');
    const zeroInitial = selectedComparison({ ...meta, initialFunding: ['0', meta.initialFunding[1]] }, swap);
    expect(zeroInitial.percent[0]).toBeNull();
    const original = getMeta(), last = getPage(original.id, Math.floor((original.eventCount - 1) / original.pageSize))!.events.at(-1)!;
    expect(selectedComparison(original, last).valuation.status).toBe('UNAVAILABLE');
    expect(original.performance).toMatchObject({ cashflowPnl: '-171.228472', vsHolding: '117.220443' });
  });
});
