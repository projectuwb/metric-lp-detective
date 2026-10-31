import { describe, expect, it, vi } from 'vitest';
import { configuredRpc, getPoolLogs, RpcFailure, type RawLog, type Rpc } from '../lib/chain/rpc.js';
import { POOL } from '../lib/chain/poolConfig.js';
// Artificial transport responses, never historical evidence or LP results.
const log = (block = '0x1', idx = '0x0'): RawLog => ({ address: POOL, blockNumber: block, blockHash: `0x${'a'.repeat(64)}`, transactionHash: `0x${'b'.repeat(64)}`, transactionIndex: '0x0', logIndex: idx, topics: [], data: '0x' });
const noSleep = async () => {};
describe('bounded retrieval', () => {
  it('paginates inclusive ranges without gaps', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue([]);
    await getPoolLogs(rpc, 1n, 5n, { pageSize: 2n });
    expect(rpc.mock.calls.map(c => c[1])).toEqual([
      [{ address: POOL, fromBlock: '0x1', toBlock: '0x2' }],
      [{ address: POOL, fromBlock: '0x3', toBlock: '0x4' }],
      [{ address: POOL, fromBlock: '0x5', toBlock: '0x5' }],
    ]);
  });
  it('shrinks oversized range and does not skip failed cursor', async () => {
    const rpc = vi.fn<Rpc>().mockRejectedValueOnce(new RpcFailure('range')).mockResolvedValue([]);
    await getPoolLogs(rpc, 1n, 4n, { pageSize: 4n });
    expect(rpc.mock.calls.map(c => (c[1][0] as { fromBlock: string }).fromBlock)).toEqual(['0x1', '0x1', '0x3']);
  });
  it('caps rate retries and reports them', async () => {
    const rpc = vi.fn<Rpc>().mockRejectedValue(new RpcFailure('rate'));
    const progress = vi.fn();
    await expect(getPoolLogs(rpc, 1n, 1n, { sleep: noSleep, progress })).rejects.toThrow('RPC rate');
    expect(rpc).toHaveBeenCalledTimes(4);
    expect(progress.mock.calls.filter(c => c[0].state === 'retry')).toHaveLength(3);
  });
  it('fails authorization immediately', async () => {
    const rpc = vi.fn<Rpc>().mockRejectedValue(new RpcFailure('denied'));
    await expect(getPoolLogs(rpc, 1n, 1n)).rejects.toThrow('denied');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('deduplicates and sorts logs by chain order', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue([log('0x1', '0x2'), log(), log()]);
    const result = await getPoolLogs(rpc, 1n, 1n);
    expect(result.map(l => l.logIndex)).toEqual(['0x0', '0x2']);
  });
  it('rejects conflicting block hashes and removed logs', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue([log(), { ...log('0x1', '0x1'), blockHash: `0x${'c'.repeat(64)}` }]);
    await expect(getPoolLogs(rpc, 1n, 1n)).rejects.toThrow('Reorg');
    rpc.mockResolvedValue([{ ...log(), removed: true }]);
    await expect(getPoolLogs(rpc, 1n, 1n)).rejects.toThrow('invalid');
  });
  it('refuses potentially truncated single-block results', async () => {
    const rpc = vi.fn<Rpc>().mockResolvedValue([log()]);
    await expect(getPoolLogs(rpc, 1n, 1n, { pageSize: 1n, resultCap: 1 })).rejects.toThrow('Single-block');
  });
  it('rejects out-of-range responses and page exhaustion', async () => {
    await expect(getPoolLogs(async () => [log('0x2')], 1n, 1n)).rejects.toThrow('invalid');
    await expect(getPoolLogs(async () => [], 1n, 2n, { pageSize: 1n, maxPages: 1 })).rejects.toThrow('coverage incomplete');
  });
  it('bounds scans and honors cancellation', async () => {
    const rpc = vi.fn<Rpc>();
    await expect(getPoolLogs(rpc, 0n, 100000n)).rejects.toThrow('100000');
    await expect(getPoolLogs(rpc, 0n, 1n, { signal: AbortSignal.abort() })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('missing provider is explicit', () => {
    vi.stubEnv('BNB_RPC_URL', '');
    try { expect(() => configuredRpc()).toThrow('RPC configuration'); }
    finally { vi.unstubAllEnvs(); }
  });
  it('recovers a transient error without advancing the cursor', async () => {
    const rpc = vi.fn<Rpc>().mockRejectedValueOnce(new RpcFailure('temporary')).mockResolvedValue([log()]);
    expect(await getPoolLogs(rpc, 1n, 1n, { sleep: noSleep })).toHaveLength(1);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });
  it('does not expose provider error text containing credentials', async () => {
    vi.stubEnv('BNB_RPC_URL', 'https://provider.invalid/private-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: -32000, message: 'unauthorized secret=do-not-print' } }))));
    try {
      await expect(configuredRpc()('eth_chainId', [])).rejects.toThrow('RPC denied (code -32000)');
      await expect(configuredRpc()('eth_sendRawTransaction', [])).rejects.toThrow('invalid');
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
  it('reports exact failing method and classifies execution reverts without leaking provider text', async () => {
    vi.stubEnv('BNB_RPC_URL', 'https://provider.invalid/private-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 3, message: 'execution reverted secret=do-not-print' } }))));
    try {
      await expect(configuredRpc()('eth_call', [])).rejects.toMatchObject({ method: 'eth_call', kind: 'reverted', code: 3, message: 'eth_call: RPC reverted (code 3)' });
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
  it('reports HTTP status without including the response body or keyed endpoint', async () => {
    vi.stubEnv('BNB_RPC_URL', 'https://provider.invalid/private-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private-key do-not-print', { status: 403 })));
    try {
      await expect(configuredRpc()('eth_getLogs', [])).rejects.toMatchObject({ method: 'eth_getLogs', kind: 'denied', code: 403, message: 'eth_getLogs: RPC denied (code 403)' });
    } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
  });
});
