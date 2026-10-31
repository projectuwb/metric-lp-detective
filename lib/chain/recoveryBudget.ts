export function recoveryBudget(maximum = 50, intervalMs = 1000, wait: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms))) {
  if (!Number.isInteger(maximum) || maximum < 1 || maximum > 100 || intervalMs < 1000) throw new Error('Unsafe recovery budget');
  let issued = 0, next = 0, paused = false;
  return {
    get issued() { return issued; },
    get paused() { return paused; },
    async run<T>(work: () => Promise<T>): Promise<T> {
      if (paused || issued >= maximum) throw new Error('RECOVERY_BUDGET_PAUSED');
      issued++;
      const delay = Math.max(0, next - Date.now()); next = Math.max(next, Date.now()) + intervalMs;
      await wait(delay);
      if (paused) throw new Error('RECOVERY_BUDGET_PAUSED');
      try { return await work(); }
      catch (error) {
        if (error && typeof error === 'object' && 'kind' in error && error.kind === 'rate') paused = true;
        throw error;
      }
    },
  };
}
