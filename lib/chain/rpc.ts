// Server-side only. No write methods, caller-selected contracts or wallet-query storage.
import { POOL } from './poolConfig.js';
import { usagePolicy, checkedPolicy, type UsagePolicy } from '../analysis/usageBudget.js';
export type Rpc = (method: string, params: unknown[]) => Promise<unknown>;
export class RpcFailure extends Error {
  method?: string;
  constructor(public kind: 'configuration' | 'denied' | 'rate' | 'quota' | 'range' | 'temporary' | 'invalid' | 'reverted', public code?: number) {
    super(`RPC ${kind}${code === undefined ? '' : ` (code ${code})`}`);
  }
}
function classify(message: string, code?: number): RpcFailure {
  if (code === 3 || /execution reverted/i.test(message)) return new RpcFailure('reverted', code);
  if (/unauthor|forbidden|denied|api.?key|access/i.test(message)) return new RpcFailure('denied', code);
  if (/rate|too many requests|429/i.test(message)) return new RpcFailure('rate', code);
  if (/range|too many (results|logs)|limit.*(block|result)|response size/i.test(message)) return new RpcFailure('range', code);
  return new RpcFailure(code === -32601 || code === -32602 ? 'invalid' : 'temporary', code);
}
const methods = new Set(['eth_chainId', 'eth_blockNumber', 'eth_getCode', 'eth_getLogs', 'eth_call', 'eth_getStorageAt', 'eth_getTransactionReceipt', 'eth_getBlockByNumber', 'debug_traceTransaction']);
export interface RpcObservation { method: string; httpStatus: number; quotaLimit?: number; quotaUsed?: number; quotaRemaining?: number; quotaResetSeconds?: number; quotaWindow?: 'day' | 'month'; rateLimit?: number }
export function configuredRpc(options: { policy?: UsagePolicy; beforeAttempt?: (method: string) => void; observe?: (o: RpcObservation) => void } = {}): Rpc {
  const policy = checkedPolicy(options.policy ?? usagePolicy());
  if (policy.mode === 'PREPAID' && !options.beforeAttempt) throw new RpcFailure('configuration');
  const endpoint = process.env[policy.endpointEnv];
  if (!endpoint) throw new RpcFailure('configuration');
  try { if (new URL(endpoint).protocol !== 'https:') throw 0; }
  catch { throw new RpcFailure('configuration'); }
  let id = 0;
  const request: Rpc = async (method, params) => {
    if (!methods.has(method)) throw new RpcFailure('invalid');
    options.beforeAttempt?.(method);
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
        signal: AbortSignal.timeout(20_000), redirect: 'error',
      });
    } catch { throw new RpcFailure('temporary'); }
    const observation: RpcObservation = { method, httpStatus: response.status };
    for (const [field, header] of [['quotaLimit', 'x-quota-limit'], ['quotaUsed', 'x-quota-used'], ['quotaRemaining', 'x-quota-remaining'], ['quotaResetSeconds', 'x-quota-reset'], ['rateLimit', 'x-ratelimit-limit']] as const) {
      const raw = response.headers.get(header); if (raw && /^\d{1,12}$/.test(raw) && Number.isSafeInteger(Number(raw))) observation[field] = Number(raw);
    }
    const window = response.headers.get('x-quota-window'); if (window === 'day' || window === 'month') observation.quotaWindow = window;
    options.observe?.(observation);
    if (!response.ok) throw new RpcFailure(response.status === 402 ? 'quota' : response.status === 429 ? 'rate' : [401, 403].includes(response.status) ? 'denied' : 'temporary', response.status);
    // Bound response memory; never include provider body, URL or credentials in diagnostics.
    if (Number(response.headers.get('content-length') ?? 0) > 8_000_000) {
      await response.body?.cancel(); throw new RpcFailure('range');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new RpcFailure('invalid');
    let body = ''; let bytes = 0; const decoder = new TextDecoder();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 8_000_000) { await reader.cancel(); throw new RpcFailure('range'); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      const data = JSON.parse(body);
      if (data.error) throw classify(String(data.error.message), Number.isSafeInteger(data.error.code) ? data.error.code : undefined);
      if (!Object.hasOwn(data, 'result')) throw new RpcFailure('invalid');
      return data.result;
    } catch (error) { if (error instanceof RpcFailure) throw error; throw new RpcFailure('invalid'); }
  };
  return async (method, params) => {
    try { return await request(method, params); }
    catch (error) {
      if (error instanceof RpcFailure) { error.method = method; error.message = `${method}: ${error.message}`; }
      throw error;
    }
  };
}
export interface RawLog {
  address: string; blockNumber: string; blockHash: string; transactionHash: string;
  transactionIndex: string; logIndex: string; topics: string[]; data: string; removed?: boolean;
}
const quantity = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-f]+$/i.test(s);
const hash = (s: unknown): s is string => typeof s === 'string' && /^0x[0-9a-f]{64}$/i.test(s);
export function checkedLogs(value: unknown, from: bigint, to: bigint): RawLog[] {
  if (!Array.isArray(value)) throw new RpcFailure('invalid');
  for (const l of value) {
    if (!l || typeof l.address !== 'string' || l.address.toLowerCase() !== POOL.toLowerCase() ||
      !quantity(l.blockNumber) || !quantity(l.transactionIndex) || !quantity(l.logIndex) ||
      !hash(l.blockHash) || !hash(l.transactionHash) || l.removed ||
      !Array.isArray(l.topics) || !l.topics.every(hash) || typeof l.data !== 'string' || !/^0x([0-9a-f]{2})*$/i.test(l.data) ||
      BigInt(l.blockNumber) < from || BigInt(l.blockNumber) > to) throw new RpcFailure('invalid');
  }
  return value;
}
export interface Progress { from: string; to: string; attempt: number; state: 'request' | 'retry' | 'shrink' | 'complete'; count?: number; reason?: string }
export async function getPoolLogs(rpc: Rpc, from: bigint, to: bigint, options: {
  pageSize?: bigint; maxPages?: number; resultCap?: number; signal?: AbortSignal;
  progress?: (p: Progress) => void; sleep?: (ms: number) => Promise<void>;
} = {}): Promise<RawLog[]> {
  if (from < 0n || to < from || to - from >= 100_000n) throw new Error('Require an explicit range of at most 100000 blocks');
  let size = options.pageSize ?? 1000n;
  if (size < 1n || size > 5000n) throw new Error('Page size must be 1..5000');
  const cap = options.resultCap ?? 1000;
  const maxPages = options.maxPages ?? 1000;
  if (!Number.isSafeInteger(cap) || cap < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1) throw new Error('Invalid limits');
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const logs = new Map<string, RawLog>();
  const blockHashes = new Map<string, string>();
  let cursor = from; let pages = 0;
  while (cursor <= to) {
    if (++pages > maxPages) throw new Error('Page budget exhausted; coverage incomplete');
    const end = cursor + size - 1n > to ? to : cursor + size - 1n;
    let batch: RawLog[] | undefined;
    for (let attempt = 0; attempt < 4; attempt++) {
      options.signal?.throwIfAborted();
      const progress = (state: Progress['state'], extra = {}) => options.progress?.({ from: cursor.toString(), to: end.toString(), attempt, state, ...extra });
      progress('request');
      try {
        batch = checkedLogs(await rpc('eth_getLogs', [{ address: POOL, fromBlock: `0x${cursor.toString(16)}`, toBlock: `0x${end.toString(16)}` }]), cursor, end);
        if (batch.length >= cap) throw new RpcFailure('range');
        progress('complete', { count: batch.length }); break;
      } catch (error) {
        if (!(error instanceof RpcFailure) || ['configuration', 'denied', 'quota', 'invalid', 'reverted'].includes(error.kind)) throw error;
        if (error.kind === 'range') {
          if (size === 1n) throw new Error('Single-block result limit; coverage incomplete');
          size = size / 2n || 1n; batch = undefined;
          progress('shrink', { reason: error.kind }); break;
        }
        if (attempt === 3) throw error;
        progress('retry', { reason: error.kind });
        await sleep(Math.min(250 * 2 ** attempt, 2000));
      }
    }
    if (!batch) continue; // Retry same cursor with a smaller inclusive interval.
    for (const log of batch) {
      const blockKey = BigInt(log.blockNumber).toString();
      const bh = blockHashes.get(blockKey);
      if (bh && bh !== log.blockHash.toLowerCase()) throw new Error('Reorg detected; discard scan and retry');
      blockHashes.set(blockKey, log.blockHash.toLowerCase());
      const key = `56:${log.transactionHash.toLowerCase()}:${BigInt(log.logIndex)}`;
      const prior = logs.get(key);
      if (prior && JSON.stringify(prior) !== JSON.stringify(log)) throw new Error('Conflicting duplicate; discard scan');
      logs.set(key, log);
      if (logs.size > 100_000) throw new Error('Log budget exhausted; coverage incomplete');
    }
    cursor = end + 1n;
  }
  return [...logs.values()].sort((a, b) => {
    for (const key of ['blockNumber', 'transactionIndex', 'logIndex'] as const) {
      const x = BigInt(a[key]), y = BigInt(b[key]); if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  });
}
