import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { verifyOracle } from '../scripts/verify-oracle.js';
import { verifiedPerformance } from '../scripts/verify-performance.js';
import { executionQuotes } from '../lib/metric/oracleTrace.js';
import { formatUsdt, performance } from '../lib/metric/valuation.js';
describe('real execution quotes and explicitly labelled historical performance', () => {
  it('validates every saved execution quote against actual ordered pool swap flows', () => {
    const result = verifyOracle();
    expect(result.status).toBe('PARTIAL');
    expect(result.verifiedTransactions).toBe(2014);
    expect(result.pendingTransactions).toBe(23177);
  });
  it('extracts the real full call-tree quote and ignores reverted parent operations', () => {
    const probe = JSON.parse(gunzipSync(readFileSync(new URL('../fixtures/oracle/raw-trace-probe.json.gz', import.meta.url))).toString());
    expect(executionQuotes(probe.trace)).toHaveLength(1);
    expect(executionQuotes({ ...probe.trace, error: 'artificial failure for mechanical filtering test' })).toEqual([]);
  });
  it('keeps absolute cashflow PnL distinct from the same-funded-token holding comparison', () => {
    const { result } = verifiedPerformance();
    expect(result.status).toBe('DERIVED_FROM_VERIFIED_INPUTS');
    if (result.status !== 'DERIVED_FROM_VERIFIED_INPUTS') throw new Error('Missing actual valuation inputs');
    expect(formatUsdt(result.cashflowPnl)).toBe('-171.228472');
    expect(formatUsdt(result.vsHolding!)).toBe('117.220443');
    expect(result.cashflowPnl).toBe(result.holdingPnl! + result.vsHolding!);
    expect(result.valuationConvention).toContain('block end');
  });
  it('returns unavailable rather than a fake zero or substituted quote', () => {
    expect(performance([1n, 2n], [{ block: '1', tokens: [1n, 2n] }], new Map(), '2').status).toBe('UNAVAILABLE');
  });
});
