import { describe, expect, it } from 'vitest';
import { verifyHistory } from '../scripts/verify-history.js';
describe('complete selected-position history: real on-chain evidence', () => {
  it('reconciles all 100 pool bins and selected shares around every selected modification and at fixed head', () => {
    const result = verifyHistory();
    expect(result.status).toBe('PASS');
    expect(result.through).toBe('130841348');
    expect(result.final).toEqual(['22973419195727555217', '5657408436562991299915']);
    expect(result.storageComparisons).toBe(2800);
    expect(result.withdrawalExecutions).toBe(6);
    expect(result.selectedLiquidityTransactions).toBe(3);
    expect(result.closed).toBe(false);
  }, 120000);
});
