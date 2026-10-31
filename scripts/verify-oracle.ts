import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeAbiParameters, decodeEventLog } from 'viem';
import { historyInputs } from './reconstruct-history.js';
import { executionQuotes, PROVIDER, QUOTE_SELECTOR } from '../lib/metric/oracleTrace.js';
import { POOL } from '../lib/chain/poolConfig.js';
import { signedPair } from '../lib/chain/decode.js';
export function verifyOracle() {
  const folder = new URL('../fixtures/oracle/', import.meta.url), h = historyInputs();
  const events = new Map(h.logs.map(l => [`${l.transactionHash}:${BigInt(l.logIndex)}`, l]));
  const coverage = JSON.parse(readFileSync(new URL('coverage.json', folder), 'utf8'));
  const seen = new Set<string>(); let transactions = 0, swaps = 0;
  for (const file of readdirSync(folder).filter(f => /^quotes-\d+\.json.gz$/.test(f))) {
    const witnesses = JSON.parse(gunzipSync(readFileSync(new URL(file, folder))).toString());
    for (const witness of witnesses) {
      if (seen.has(witness.transactionHash)) throw new Error('Duplicate quote witness');
      seen.add(witness.transactionHash); transactions++;
      for (const q of witness.swaps) {
        const log = events.get(`${witness.transactionHash}:${q.logIndex}`);
        if (!log || log.blockHash !== q.blockHash || BigInt(log.blockNumber).toString() !== q.block || q.providerCall.from.toLowerCase() !== POOL.toLowerCase() || q.providerCall.to.toLowerCase() !== PROVIDER || !q.providerCall.input.startsWith(QUOTE_SELECTOR) || q.providerCall.error) throw new Error('Execution witness identity mismatch');
        const event = decodeEventLog({ abi: h.abi, topics: log.topics as any, data: log.data as any });
        if (event.eventName !== 'Swap') throw new Error('Quote mapped to non-swap');
        const native = signedPair((event.args as any).amountDeltas);
        const [amount0, amount1] = decodeAbiParameters([{ type: 'int128' }, { type: 'int128' }], q.poolOutput);
        const [bid, ask, ref] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], q.providerCall.output);
        if (amount0 !== native.high || amount1 !== native.low || bid !== BigInt(q.bidX64) || ask !== BigInt(q.askX64) || ref !== BigInt(q.referenceX64) || !(bid > 0n && bid < ask && bid <= ref && ref <= ask)) throw new Error('Execution quote/flow mismatch');
        swaps++;
      }
    }
  }
  const probe = JSON.parse(gunzipSync(readFileSync(new URL('raw-trace-probe.json.gz', folder))).toString());
  const recovered = executionQuotes(probe.trace);
  if (recovered.length !== 1 || !seen.has(probe.tx)) throw new Error('Full raw trace probe missing');
  if (transactions !== coverage.completed) throw new Error('Coverage manifest differs from saved witnesses');
  return { status: transactions === coverage.targetTransactions ? 'COMPLETE' : 'PARTIAL', verifiedTransactions: transactions, verifiedSwaps: swaps, targetTransactions: coverage.targetTransactions, pendingTransactions: coverage.targetTransactions - transactions, fullRawTraceProbe: probe.tx, quoteMeaning: 'Exact Q64.64 bid/ask/reference returned to the pool within each recorded successful swap; no block-end substitution' };
}
if (process.argv[1]?.endsWith('verify-oracle.ts')) {
  try { const report = verifyOracle(); writeFileSync(new URL('../fixtures/oracle/verification.json', import.meta.url), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
  catch { console.error('Oracle witness verification failed; no verified quote claim'); process.exitCode = 1; }
}
