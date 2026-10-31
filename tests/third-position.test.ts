import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
import { verifyPosition } from '../scripts/verify-position';
import { getMeta, getPage, positionsFor } from '../lib/server/replay';
import { lifecycleOutcome } from '../lib/metric/outcome';
import { selectedComparison } from '../lib/metric/comparison';
import { decimal } from '../lib/metric/rational';
const id = '0xa19899f6b8416d8266f0d4f14688c8c6eeaec818:671085802901633847509096';
describe('previously non-playable third wallet: actual persisted request and independent chain proof', () => {
  it('rechecks every raw checkpoint, receipt and witness from the real 86-request job', () => {
    const { verification } = verifyPosition('dcc159a95741b233');
    expect(verification).toMatchObject({ id, swaps: 10, events: 12, checkpoints: 15, storageComparisons: 6000, withdrawalChecks: 12, final: ['0', '0'], tolerance: '0', executionQuoteEvents: 10 });
    const proof = JSON.parse(readFileSync('fixtures/positions/dcc159a95741b233/browser-proof.json', 'utf8'));
    expect(proof).toMatchObject({ positionId: id, initialState: 'INDEXED_ONLY', acceptedState: 'QUEUED', processingObserved: 'RUNNING', browserContextClosedAndReopened: true, finalJob: { status: 'VERIFIED', requests: 86 }, mode: 'OWNER_LOCAL_DURABLE', productionDeploymentVerified: false });
    expect(proof.finalJob.verification).toEqual(verification);
  }, 60000);
  it('makes the requested provider/salt playable without a demo-only allowlist, including actual zero-stock entry', () => {
    const meta = getMeta(id), events = getPage(id, 0)!.events, end = events.at(-1)!;
    expect(positionsFor(id.split(':')[0]).find(p => p.id === id)?.status).toBe('reconciled');
    expect(meta.initialFunding).toEqual(['0', '99999999999999999883']);
    expect(meta.eventCount).toBe(12); expect(end.after).toEqual(['0', '0']);
    const o = lifecycleOutcome(meta, end);
    expect(o.distributed).toEqual([0n, 99956637992935193954n]);
    expect(decimal(o.usdt.net!)).toBe('-0.043362'); expect(o.closedHere).toBe(true);
    expect(selectedComparison(meta, events[0]).percent[0]).toBeNull();
    expect(meta.performance).toMatchObject({ cashflowPnl: '-0.043362', holdingPnl: '0.000000', vsHolding: '-0.043362' });
    expect(events.filter(e => e.type === 'swap').every(e => e.reference?.kind === 'EXECUTION')).toBe(true);
  });
});
