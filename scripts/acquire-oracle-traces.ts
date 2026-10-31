import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
import { configuredRpc, RpcFailure } from '../lib/chain/rpc.js';
import { executionQuotes, type CallFrame } from '../lib/metric/oracleTrace.js';
import { historyInputs } from './reconstruct-history.js';
import { signedPair } from '../lib/chain/decode.js';
import { decodeEventLog } from 'viem';
import { recoveryBudget } from '../lib/chain/recoveryBudget.js';
const folder = new URL('../fixtures/oracle/', import.meta.url), cache = new URL('../artifacts/oracle-traces/', import.meta.url);
mkdirSync(folder, { recursive: true }); mkdirSync(cache, { recursive: true });
const json = (p: URL, v: unknown) => writeFileSync(p, JSON.stringify(v, (_, n) => typeof n === 'bigint' ? n.toString() : n));
let method = 'configuration';
try {
  // Resume after a fresh checkout as well as within the current cloud snapshot.
  for (const file of readdirSync(folder).filter(f => /^quotes-\d+\.json.gz$/.test(f))) {
    const saved = JSON.parse(gunzipSync(readFileSync(new URL(file, folder))).toString());
    for (const witness of saved) { const target = new URL(`${witness.transactionHash}.json`, cache); if (!existsSync(target)) json(target, witness); }
  }
  const rpc = configuredRpc(), h = historyInputs();
  const budget = recoveryBudget(Number(process.env.ORACLE_TRACE_REQUEST_BUDGET ?? '50'));
  const position = JSON.parse(readFileSync(new URL('../fixtures/history/position-history.json', import.meta.url), 'utf8'));
  const selected = new Set<string>(position.swaps.map((s: any) => s.transactionHash));
  const events = new Map<string, { block: string; blockHash: string; logIndex: string; amount0: bigint; amount1: bigint }[]>();
  for (const log of h.logs) if (selected.has(log.transactionHash)) {
    const event = decodeEventLog({ abi: h.abi, topics: log.topics as any, data: log.data as any });
    if (event.eventName !== 'Swap') continue;
    const pair = signedPair((event.args as any).amountDeltas);
    const list = events.get(log.transactionHash) ?? [];
    list.push({ block: BigInt(log.blockNumber).toString(), blockHash: log.blockHash, logIndex: BigInt(log.logIndex).toString(), amount0: pair.high, amount1: pair.low }); events.set(log.transactionHash, list);
  }
  const transactions = [...events.keys()], results: any[] = [], failures: any[] = [];
  let cursor = 0, done = 0, rateLimited = false;
  const cachedOnly = process.argv.includes('--cached-only');
  const report = () => json(new URL('coverage.json', folder), { method: 'debug_traceTransaction', tracer: 'callTracer', targetTransactions: transactions.length, completed: done, failures, status: done === transactions.length && !failures.length ? 'QUOTES_RECOVERED_NOT_VALUED' : 'PARTIAL', through: h.acquisition.to });
  report();
  async function worker() {
    for (;;) {
      const index = cursor++; if (index >= transactions.length) return;
      const tx = transactions[index], file = new URL(`${tx}.json`, cache);
      try {
        let witness;
        if (existsSync(file)) witness = JSON.parse(readFileSync(file, 'utf8'));
        else {
          if (cachedOnly || rateLimited) { failures.push({ transactionHash: tx, method: 'debug_traceTransaction', error: 'NOT VERIFIED: not requested after provider rate limit / cache-only export' }); continue; }
          let trace: CallFrame | undefined;
          for (let attempt = 0; attempt < 4; attempt++) {
            try { method = 'debug_traceTransaction'; trace = await budget.run(() => rpc(method, [tx, { tracer: 'callTracer', timeout: '15s' }])) as CallFrame; break; }
            catch (e) { if (!(e instanceof RpcFailure) || !['temporary', 'rate'].includes(e.kind) || attempt === 3) throw e; await new Promise(r => setTimeout(r, 500 * 2 ** attempt)); }
          }
          if (!trace) throw new Error('Missing trace');
          const quotes = executionQuotes(trace), logs = events.get(tx)!;
          if (quotes.length !== logs.length || quotes.some((q, i) => q.amount0 !== logs[i].amount0 || q.amount1 !== logs[i].amount1)) throw new Error('Trace calls do not match receipt-indexed pool swaps');
          witness = { transactionHash: tx, method: 'debug_traceTransaction', traceArguments: { tracer: 'callTracer', timeout: '15s' }, swaps: quotes.map((q, i) => ({ ...logs[i], ...q })) };
          json(file, witness);
        }
        results[index] = witness; done++;
      } catch (e) { if (e instanceof RpcFailure && e.kind === 'rate' || budget.paused || budget.issued >= Number(process.env.ORACLE_TRACE_REQUEST_BUDGET ?? '50')) rateLimited = true; failures.push({ transactionHash: tx, method, error: e instanceof RpcFailure ? e.message : rateLimited ? 'NOT VERIFIED: invocation stopped by request budget/rate circuit breaker' : 'Trace identity/decoding mismatch' }); }
      if ((done + failures.length) % 100 === 0) { console.log(JSON.stringify({ recovered: done, failed: failures.length, total: transactions.length })); report(); }
    }
  }
  const concurrency = Number(process.env.ORACLE_TRACE_CONCURRENCY ?? '1');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2) throw new Error('Trace concurrency must be 1..2');
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  for (let i = 0; i < results.length; i += 500) writeFileSync(new URL(`quotes-${String(i / 500).padStart(3, '0')}.json.gz`, folder), gzipSync(JSON.stringify(results.slice(i, i + 500).filter(Boolean))));
  report(); console.log(JSON.stringify({ recovered: done, failed: failures.length, total: transactions.length }));
} catch (e) { console.error(JSON.stringify({ method, error: e instanceof RpcFailure ? e.message : 'Trace acquisition failed' })); process.exitCode = 1; }
