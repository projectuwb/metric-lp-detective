// Offline resource arithmetic only. Estimates do not authorise a run or a payment.
export function reconstructionCalls(checkpoints: number, withdrawals: number, marks: number, fundingReceipts: number, traceTransactions: number) {
  if ([checkpoints, withdrawals, marks, fundingReceipts, traceTransactions].some(n => !Number.isSafeInteger(n) || n < 0) || withdrawals > checkpoints || marks > checkpoints) throw new Error('Invalid reconstruction estimate');
  const methods = { eth_chainId: 1, eth_getCode: 2, eth_getBlockByNumber: 1 + 2 * checkpoints, eth_call: checkpoints + withdrawals + marks, eth_getTransactionReceipt: fundingReceipts, debug_traceTransaction: traceTransactions };
  return { methods, total: Object.values(methods).reduce((n, v) => n + v, 0) };
}
export function discoveryCalls(blocks: bigint, pageSize: bigint, eventBlocks = 0n, resumes = 0n) {
  if (blocks < 0n || pageSize < 1n || pageSize > 30000n || eventBlocks < 0n || resumes < 0n) throw new Error('Invalid discovery estimate');
  const windows = (blocks + pageSize - 1n) / pageSize;
  return { windows: String(windows), total: String(4n + windows * 3n + eventBlocks + resumes * 5n), basis: '4 identity/finality setup calls + 3 per complete page + one per distinct event block + 5 per resume; discarded pages/errors/retries extra' };
}
