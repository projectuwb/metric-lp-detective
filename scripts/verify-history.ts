import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeFunctionData, decodeFunctionResult, decodeEventLog, parseAbi, encodeEventTopics, type Hex } from 'viem';
import { reconstruct, key } from './reconstruct-history.js';
import { replayPool, portfolio } from '../lib/metric/positionLedger.js';
import { POOL, TOKEN0, TOKEN1 } from '../lib/chain/poolConfig.js';
export function verifyHistory() {
  const h = reconstruct();
  let cursor = BigInt(h.acquisition.from);
  for (const p of h.acquisition.pages) { assert.equal(BigInt(p.from), cursor); cursor = BigInt(p.to) + 1n; }
  assert.equal(cursor, BigInt(h.acquisition.to) + 1n);
  assert.equal(h.logs.length, h.acquisition.pages.reduce((n: number, p: any) => n + p.count, 0));
  const evidence = JSON.parse(readFileSync(new URL('../fixtures/history/historical-state.json', import.meta.url), 'utf8'));
  const batchAbi = h.abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
  let comparisons = 0, withdrawals = 0;
  for (const s of evidence.states) {
    const partial = replayPool(h.logs.filter(l => BigInt(l.blockNumber) <= BigInt(s.block)), h.abi, { entitlementPositions: [key] });
    const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: s.raw }) as readonly Hex[];
    assert.equal(words.length, 300);
    const call = decodeFunctionData({ abi: batchAbi, data: s.call.data });
    assert.equal((call.args![0] as readonly Hex[]).length, 300);
    for (let i = 0; i < 100; i++) {
      const state = partial.bins.get(BigInt(i - 50)), word = BigInt(words[i * 3]);
      assert.equal(state?.reserve0 ?? 0n, word & ((1n << 104n) - 1n));
      assert.equal(state?.reserve1 ?? 0n, word >> 104n & ((1n << 104n) - 1n));
      assert.equal(state?.totalShares ?? 0n, BigInt(words[i * 3 + 1]));
      assert.equal(state?.positions.get(key) ?? 0n, BigInt(words[i * 3 + 2])); comparisons += 4;
    }
    if (s.withdrawal) {
      const actual = decodeFunctionResult({ abi: h.abi, functionName: 'removeLiquidity', data: s.withdrawal.result }) as readonly bigint[];
      assert.deepEqual([...actual], portfolio(partial.bins, key)); withdrawals++;
    }
    const blockLogs = h.logs.filter(l => BigInt(l.blockNumber) === BigInt(s.block));
    assert.ok(blockLogs.every(l => l.blockHash === s.blockHash));
  }
  const txs = [...new Set(h.funding.map(t => t.transactionHash))];
  const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  const transferTopic = encodeEventTopics({ abi: transferAbi, eventName: 'Transfer' })[0];
  for (const tx of txs) {
    const receipt = JSON.parse(readFileSync(new URL(`../fixtures/history/receipts/${tx}.json`, import.meta.url), 'utf8'));
    assert.equal(receipt.status, '0x1');
    const expected = h.funding.filter(t => t.transactionHash === tx).reduce<[bigint, bigint]>((n, t) => [n[0] + t.poolDelta[0], n[1] + t.poolDelta[1]], [0n, 0n]);
    const transferred: [bigint, bigint] = [0n, 0n];
    for (const log of receipt.logs) {
      if (log.topics[0] !== transferTopic || ![TOKEN0.toLowerCase(), TOKEN1.toLowerCase()].includes(log.address.toLowerCase())) continue;
      const event = decodeEventLog({ abi: transferAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex, strict: true });
      const i = log.address.toLowerCase() === TOKEN0.toLowerCase() ? 0 : 1;
      if (event.args.to.toLowerCase() === POOL.toLowerCase()) transferred[i] += event.args.value;
      if (event.args.from.toLowerCase() === POOL.toLowerCase()) transferred[i] -= event.args.value;
    }
    assert.deepEqual(transferred, expected, 'Funding/removal token Transfers differ from credited pool flows');
    for (const l of h.logs.filter(l => l.transactionHash === tx)) {
      const raw = receipt.logs.find((r: any) => r.logIndex === l.logIndex);
      assert.deepEqual([raw.data, raw.topics, receipt.blockHash], [l.data, l.topics, l.blockHash]);
    }
  }
  return { status: 'PASS', scope: 'DEPLOYMENT_TO_FIXED_HEAD', through: h.acquisition.to, endHash: h.acquisition.endHash, position: key, ...h.counts, final: h.final.map(String), storageComparisons: comparisons, withdrawalExecutions: withdrawals, selectedLiquidityTransactions: txs.length, toleranceBaseUnits: '0', closed: ![...h.replay.bins.values()].some(b => (b.positions.get(key) ?? 0n) > 0n), oracleVerified: false };
}
if (process.argv[1]?.endsWith('verify-history.ts')) {
  try { const result = verifyHistory(); writeFileSync(new URL('../fixtures/history/verification.json', import.meta.url), JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify(result)); }
  catch { console.error('FAIL: complete-history reconciliation did not pass'); process.exitCode = 1; }
}
