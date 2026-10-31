import { expect, it } from 'vitest';
import { recoveryBudget } from '../lib/chain/recoveryBudget.js';
it('caps actual remote invocations rather than merely counting transactions', async () => {
  const budget = recoveryBudget(2, 1000, async () => {});
  let calls = 0;
  await budget.run(async () => ++calls); await budget.run(async () => ++calls);
  await expect(budget.run(async () => ++calls)).rejects.toThrow('RECOVERY_BUDGET_PAUSED');
  expect(calls).toBe(2);
});
it('opens the circuit on a rate response and never issues another request', async () => {
  const budget = recoveryBudget(50, 1000, async () => {});
  await expect(budget.run(async () => { throw { kind: 'rate' }; })).rejects.toEqual({ kind: 'rate' });
  let calls = 0;
  await expect(budget.run(async () => ++calls)).rejects.toThrow();
  expect(calls).toBe(0); expect(budget.paused).toBe(true);
});
it('rejects unsafe limits and imposes spacing on concurrently reserved work', async () => {
  expect(() => recoveryBudget(101)).toThrow();
  expect(() => recoveryBudget(1, 50)).toThrow();
  const waits: number[] = [], budget = recoveryBudget(3, 1000, async ms => { waits.push(ms); });
  await Promise.all([budget.run(async () => 1), budget.run(async () => 2)]);
  expect(waits[1]).toBeGreaterThanOrEqual(990);
});
