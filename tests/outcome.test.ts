import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { getMeta, getPage } from '../lib/server/replay';
import { SMALL_SAMPLE_ID } from '../lib/domain/samples';
import { lifecycleOutcome, translated } from '../lib/metric/outcome';
import { decimal, plus, rational } from '../lib/metric/rational';
describe('exit economics: actual cashflows and exact reference-equivalent translations', () => {
  const meta = getMeta(SMALL_SAMPLE_ID), events = getPage(meta.id, 0)!.events;
  it('full close returns capital, not a 100% loss, and includes all three contributions', () => {
    const o = lifecycleOutcome(meta, events.at(-1)!);
    expect(o.closedHere).toBe(true); expect(o.remaining).toEqual([0n, 0n]);
    expect(o.distributed).toEqual([0n, 4543728066440139855352n]);
    expect(o.contributed).toEqual([6139892490136691462n, 4050862375118152962428n]);
    expect(decimal(o.usdt.input!)).toBe('4545.540314'); expect(decimal(o.usdt.output!)).toBe('4543.728066');
    expect(decimal(o.usdt.net!)).toBe('-1.812248');
    expect(decimal(o.stock.net!)).toBe('0.085800'); expect(decimal(o.stock.output!)).toBe('56.504077');
    // Flow-time stock translation can differ in sign; it is not actual CRCLB profit.
    const finalOnly = translated([0n, 1n], BigInt(meta.marks.find(m => m.block === events.at(-1)!.block)!.referenceX64), 'CRCLB');
    const wrong = rational(o.usdt.net!.n * finalOnly.n, o.usdt.net!.d * finalOnly.d);
    expect(o.stock.net).not.toEqual(wrong);
    expect(o.settlement?.USDT).toEqual(o.usdt.output); expect(o.settlement?.CRCLB).toEqual(o.stock.output);
  });
  it('counts only prior cashflows, keeps the partial withdrawal separate from remaining inventory', () => {
    expect(lifecycleOutcome(meta, events[3]).contributed).toEqual(meta.initialFunding.map(BigInt));
    const original = getMeta(), withdrawal = original.milestones.find(m => m.kind === 'PARTIAL_WITHDRAWAL')!;
    const e = getPage(original.id, Math.floor(withdrawal.index / original.pageSize))!.events.find(e => e.index === withdrawal.index)!;
    const o = lifecycleOutcome(original, e);
    expect(o.closedHere).toBe(false); expect(o.distributed).toEqual([0n, 1489456801526956294126n]);
    expect(o.remaining.some(n => n > 0n)).toBe(true); expect(o.usdt.net).not.toBeNull();
    expect(o.usdt.net).toEqual(plus(plus(o.usdt.output!, o.usdt.held!), rational(-o.usdt.input!.n, o.usdt.input!.d)));
  });
  it('keeps known cashflow marks while missing selected marks make net and conversions unavailable', () => {
    const end = events.at(-1)!, missing = { ...meta, marks: meta.marks.filter(m => m.block !== end.block) };
    const o = lifecycleOutcome(missing, end);
    expect(o.usdt.net).toBeNull(); expect(o.stock.net).toBeNull(); expect(o.settlement).toBeNull();
    expect(o.usdt.input).not.toBeNull(); expect(o.distributed[1]).toBeGreaterThan(0n);
    const missingContribution = lifecycleOutcome({ ...meta, marks: meta.marks.filter(m => m.block !== meta.funding[1].block) }, end);
    expect(missingContribution.usdt.input).toBeNull(); expect(missingContribution.stock.net).toBeNull();
    expect(missingContribution.usdt.output).not.toBeNull();
  });
  it('uses exact rational sums, supports zero-stock funding and rejects zero references', () => {
    const o = lifecycleOutcome({ ...meta, initialFunding: ['0', meta.initialFunding[1]] }, events[0]);
    expect(o.usdt.net).not.toBeNull();
    expect(plus(rational(1n, 3n), rational(1n, 7n))).toEqual(rational(10n, 21n));
    expect(decimal(rational(-1n, 100000000n))).toBe('0.000000');
    expect(() => translated([0n, 1n], 0n, 'CRCLB')).toThrow('positive reference');
    expect(meta.milestones.map(m => m.kind)).toEqual(['INITIAL_DEPOSIT', 'ADD', 'ADD', 'FULL_CLOSE']);
  });
});
