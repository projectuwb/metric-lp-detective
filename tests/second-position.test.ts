import { describe, it, expect } from 'vitest';
import { verifyPosition } from '../scripts/verify-position';
import { historyInputs } from '../scripts/reconstruct-history';
import { positionReplay } from '../lib/metric/positionReplay';
const slug = '632f7d8c3d6ef54f';
describe('second real LP: independent historical state and receipts', () => {
  it('reconciles every event checkpoint, raw shares, reserves, withdrawals and traces exactly', () => {
    const { verification, replay, marks } = verifyPosition(slug);
    expect(verification).toMatchObject({ status: 'VERIFIED', swaps: 9, events: 14, checkpoints: 15, storageComparisons: 6000, withdrawalChecks: 12, closed: true, final: ['0', '0'], tolerance: '0', executionQuoteEvents: 9 });
    expect(replay.funding.map(f => f.type)).toEqual(['deposit', 'deposit', 'deposit', 'withdrawal']);
    expect(replay.events.filter(e => e.type === 'rounding')).toHaveLength(1);
    expect(new Set(marks.filter((m: any) => m.result).map((m: any) => m.block))).toEqual(new Set([...replay.events.map(e => e.block), '130841348']));
  }, 60000);
  it('supports a real no-swap prefix and rejects absent/invalid position identities', () => {
    const h = historyInputs(), id = '0x3eb210eaa4026f62d027fafaba1fa5592febb06a:363274826789293944322560';
    const prefix = positionReplay(h.logs.filter(l => BigInt(l.blockNumber) <= 128750025n), h.abi, id);
    expect(prefix.events.map(e => e.type)).toEqual(['deposit']);
    expect(prefix.final.every(n => n > 0n)).toBe(true);
    expect(() => positionReplay([], h.abi, id)).toThrow('not found');
    expect(() => positionReplay([], h.abi, '../secret')).toThrow('Invalid');
    expect(() => verifyPosition('../secret')).toThrow('Invalid');
  }, 60000);
});
