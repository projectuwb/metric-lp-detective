import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Abi } from 'viem';
import { validateAttribution } from '../scripts/verify-attribution.js';
import { replayPool, portfolio, floorMulDiv } from '../lib/metric/positionLedger.js';

const source = JSON.parse(readFileSync(new URL('../fixtures/attribution/pool-logs.json', import.meta.url), 'utf8'));
const abi: Abi = JSON.parse(readFileSync(new URL('../fixtures/abi/MetricOmmPool.json', import.meta.url), 'utf8'));

describe('independent real on-chain LP attribution validation', () => {
  const report = validateAttribution();
  for (const name of ['A', 'B', 'C', 'D']) it(`Test ${name} independently verifies against historical state/contract execution`, () => {
    expect(report.results[name].status).toBe('PASS');
  });
  it('checks all 20 funded bins and both positions against 12 historical states', () => {
    expect(report.storageComparisons).toBe(1200);
    expect(report.quoteComparisons).toBe(56);
    expect(report.coverage).toMatchObject({ logCount: 11, swapCount: 3, binStepCount: 5, unknownEvents: 0 });
  });
  it('reconciles the full selected position with zero tolerance to actual historical removal eth_call', () => {
    const evidence = report.results.D.evidence as { reconstructed: bigint[]; independentlyExecuted: bigint[]; difference: bigint[] };
    expect(evidence.reconstructed).toEqual([26251431710839737408n, 3877219497229389546289n]);
    expect(evidence.reconstructed).toEqual(evidence.independentlyExecuted);
    expect(evidence.difference).toEqual([0n, 0n]);
  });
  it('rejects the entire shared-bin swap as selected LP inventory', () => {
    const leg = report.swaps.at(-1)!.legs[0];
    expect(leg.positionDelta[report.primary]).toEqual([-42302065066472796n, 3455044295754653575n]);
    expect(leg.poolDelta).toEqual([-151734189374346232n, 12392972887848282518n]);
    expect(leg.positionDelta[report.primary]).not.toEqual(leg.poolDelta);
    expect(leg.before.shares[report.primary] + leg.before.shares[report.secondary]).toBe(leg.before.totalShares);
  });
  it('accounts for other-provider addition even though selected share units stay fixed', () => {
    const evidence = report.results.C.evidence as { competitorAdd: { before: any; after: any; positionDelta: Record<string, bigint[]> } };
    const { before, after, positionDelta } = evidence.competitorAdd;
    expect(before.shares[report.primary]).toBe(after.shares[report.primary]);
    expect(before.totalShares).toBe(7397760061908989030n);
    expect(after.totalShares).toBe(26535185088855730787n);
    expect(positionDelta[report.primary]).toEqual([0n, 0n]);
    const withoutCompetingAdd = source.logs.filter((l: any) => l.transactionHash !== '0x6a72450dbeb1d0697369ee41479f0bd0d274d6c7c0253b009ca3c6590809e31f');
    // Missing the competitor also makes the supplied real swap exceed replayed
    // reserves, so it must fail before any claimed final reconciliation.
    expect(() => replayPool(withoutCompetingAdd, abi)).toThrow('Invalid uint104 reserve');
  });
  it('uses differences of floored entitlements, with shared dust accounted separately', () => {
    const leg = report.swaps.at(-1)!.legs[0];
    const sum = leg.positionDelta[report.primary][0] + leg.positionDelta[report.secondary][0];
    expect(sum).toBe(leg.poolDelta[0] + 1n); // one base unit of pre-existing shared dust consumed
    const key = report.primary;
    expect(leg.positionDelta[key][0]).toBe(floorMulDiv(leg.after.reserve0, leg.after.shares[key], leg.after.totalShares) - floorMulDiv(leg.before.reserve0, leg.before.shares[key], leg.before.totalShares));
  });
  it('retains exact portfolio before/after for each swap, not one-bin subtotals', () => {
    for (const swap of report.swaps) {
      expect(swap.selectedAfter.map((n, i) => n - swap.selectedBefore[i])).toEqual(swap.selectedTokenDeltas);
      expect(swap.referencePrice).toBeNull();
    }
  });
  it('excludes actual swaps in later-funded bins when the backup position had no shares yet', () => {
    expect(report.notAttributableToBackup).toHaveLength(3);
    expect(report.notAttributableToBackup[0]).toMatchObject({ block: 126532510n, logIndex: 184n, bin: 0n, sharesAtExecution: 0n, delta: [0n, 0n] });
  });
  it('fails duplicate or unknown event coverage and sorts actual events chronologically', () => {
    expect(() => replayPool([...source.logs, source.logs[1]], abi)).toThrow('Duplicate');
    expect(() => replayPool([{ ...source.logs[0], topics: [`0x${'f'.repeat(64)}`] }], abi)).toThrow();
    const reversed = replayPool([...source.logs].reverse(), abi);
    expect(portfolio(reversed.bins, report.primary)).toEqual([26251431710839737408n, 3877219497229389546289n]);
  });
});
