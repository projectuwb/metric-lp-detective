import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeAbiParameters, decodeEventLog, decodeFunctionResult, decodeFunctionData, encodeAbiParameters, keccak256, parseAbi, encodeEventTopics, type Hex } from 'viem';
import { historyInputs } from './reconstruct-history.js';
import { positionReplay } from '../lib/metric/positionReplay.js';
import { executionQuotes, PROVIDER, QUOTE_SELECTOR } from '../lib/metric/oracleTrace.js';
import { POOL, TOKEN0, TOKEN1 } from '../lib/chain/poolConfig.js';
import { signedPair } from '../lib/chain/decode.js';
export function verifyPosition(slug: string, capturedRoot?: URL) {
  if (!/^[0-9a-f]{16}$/.test(slug)) throw new Error('Invalid artifact identifier');
  const root = capturedRoot ?? new URL('../fixtures/positions/' + slug + '/', import.meta.url);
  const read = (name: string) => JSON.parse(readFileSync(new URL(name, root), 'utf8'));
  const config = read('config.json'), h = historyInputs();
  assert.equal(config.pool, POOL); assert.equal(config.chainId, 56); assert.equal(config.ownerCode, '0x');
  assert.equal(config.sourceHash, keccak256(readFileSync(new URL('../fixtures/history/pool-logs.json.gz', import.meta.url))));
  assert.equal(config.indexEndHash, h.acquisition.endHash);
  const quotes = read('quotes.json'), quoteMap = new Map<string, any>(quotes.map((q: any) => [q.transactionHash + ':' + q.logIndex, q]));
  const r = positionReplay(h.logs, h.abi, config.id, quoteMap);
  assert.deepEqual(r.final.map(String), config.final);
  const byBin = new Map<string, typeof r.replay.transitions>();
  for (const t of r.replay.transitions) { const list = byBin.get(String(t.bin)) ?? []; list.push(t); byBin.set(String(t.bin), list); }
  const batchAbi = h.abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
  const states = read('states.json'); let comparisons = 0, withdrawalChecks = 0;
  assert.equal(states.find((s: any) => s.block === config.through)?.blockHash, config.indexEndHash);
  for (const state of states) {
    // Older captures use a separately saved canonical-header confirmation.
    if (state.postCallHash) assert.equal(state.postCallHash, state.blockHash);
    else {
      const headers = read('canonical-headers.json');
      const header = headers.find((b: any) => BigInt(b.number) === BigInt(state.block));
      assert.equal(header?.hash, state.blockHash); assert.equal(header?.timestamp, state.timestamp);
    }
    assert.equal(state.call.to, POOL);
    const requested = decodeFunctionData({ abi: batchAbi, data: state.call.data });
    const expectedSlots: Hex[] = [];
    const [owner, salt] = config.id.split(':');
    for (let bin = -50; bin < 50; bin++) {
      for (const base of [4n, 5n]) expectedSlots.push(keccak256(encodeAbiParameters([{ type: 'int256' }, { type: 'uint256' }], [BigInt(bin), base])));
      const key = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint80' }, { type: 'int16' }], [owner, BigInt(salt), bin]));
      expectedSlots.push(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [key, 6n])));
    }
    assert.deepEqual(requested.args, [expectedSlots]);
    const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: state.raw }) as readonly Hex[];
    assert.equal(words.length, 300);
    let amount0 = 0n, amount1 = 0n;
    const ownedBins: bigint[] = [], ownedShares: bigint[] = [];
    for (let i = 0; i < 100; i++) {
      const bin = BigInt(i - 50), word = BigInt(words[i * 3]);
      const reserve0 = word & ((1n << 104n) - 1n), reserve1 = word >> 104n & ((1n << 104n) - 1n);
      const total = BigInt(words[i * 3 + 1]), held = BigInt(words[i * 3 + 2]);
      const last = (byBin.get(String(bin)) ?? []).filter(t => t.block <= BigInt(state.block)).at(-1)?.after;
      assert.equal(last?.reserve0 ?? 0n, reserve0); assert.equal(last?.reserve1 ?? 0n, reserve1);
      assert.equal(last?.totalShares ?? 0n, total); assert.equal(last?.shares[config.id] ?? 0n, held); comparisons += 4;
      if (held) { assert.ok(total >= held); amount0 += reserve0 * held / total; amount1 += reserve1 * held / total; ownedBins.push(bin); ownedShares.push(held); }
    }
    const row = r.events.filter(e => BigInt(e.block) <= BigInt(state.block)).at(-1);
    assert.deepEqual(row?.after ?? ['0', '0'], [String(amount0), String(amount1)]);
    if (state.withdrawal) {
      assert.equal(state.withdrawal.request.to, POOL); assert.equal(state.withdrawal.request.from.toLowerCase(), owner);
      const actual = decodeFunctionResult({ abi: h.abi, functionName: 'removeLiquidity', data: state.withdrawal.result }) as readonly bigint[];
      assert.deepEqual([...actual], [amount0, amount1]);
      const call = decodeFunctionData({ abi: h.abi, data: state.withdrawal.request.data });
      const args = call.args as unknown as [string, bigint, { binIdxs: bigint[]; shares: bigint[] }, Hex];
      assert.equal(call.functionName, 'removeLiquidity'); assert.equal(args[0].toLowerCase() + ':' + args[1], config.id);
      assert.deepEqual(args[2], { binIdxs: ownedBins, shares: ownedShares }); withdrawalChecks++;
    }
    assert.ok(h.logs.filter(l => BigInt(l.blockNumber) === BigInt(state.block)).every(l => l.blockHash === state.blockHash));
  }
  const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
  const transferTopic = encodeEventTopics({ abi: transferAbi, eventName: 'Transfer' })[0];
  for (const tx of new Set(r.funding.map(f => f.transactionHash))) {
    const receipt = read('receipts/' + tx + '.json'); assert.equal(receipt.status, '0x1');
    const poolLogs = h.logs.filter(l => l.transactionHash === tx);
    for (const log of poolLogs) { const actual = receipt.logs.find((l: any) => l.logIndex === log.logIndex); assert.deepEqual([actual.data, actual.topics, receipt.blockHash], [log.data, log.topics, log.blockHash]); }
    const expected = r.funding.filter(f => f.transactionHash === tx).reduce<[bigint, bigint]>((n, f) => [n[0] + BigInt(f.tokens[0]), n[1] + BigInt(f.tokens[1])], [0n, 0n]);
    const transfers: [bigint, bigint] = [0n, 0n];
    for (const log of receipt.logs) {
      if (log.topics[0] !== transferTopic || ![TOKEN0.toLowerCase(), TOKEN1.toLowerCase()].includes(log.address.toLowerCase())) continue;
      const event = decodeEventLog({ abi: transferAbi, topics: log.topics as [Hex, ...Hex[]], data: log.data as Hex });
      const i = log.address.toLowerCase() === TOKEN0.toLowerCase() ? 0 : 1;
      if (event.args.to.toLowerCase() === POOL.toLowerCase()) transfers[i] += event.args.value;
      if (event.args.from.toLowerCase() === POOL.toLowerCase()) transfers[i] -= event.args.value;
    }
    assert.deepEqual(transfers, expected);
  }
  const traceFiles = readdirSync(new URL('traces/', root));
  assert.deepEqual(traceFiles.map(f => f.replace('.json.gz', '')).sort(), [...new Set<string>(quotes.map((q: any) => q.transactionHash))].sort());
  for (const file of traceFiles) {
    const trace = JSON.parse(gunzipSync(readFileSync(new URL('traces/' + file, root))).toString());
    const extracted = executionQuotes(trace), tx = file.replace('.json.gz', ''), saved = quotes.filter((q: any) => q.transactionHash === tx);
    assert.equal(extracted.length, saved.length);
    const swapLogs = h.logs.filter(l => l.transactionHash === tx).map(log => ({ log, decoded: decodeEventLog({ abi: h.abi, topics: log.topics as any, data: log.data as Hex }) })).filter(e => e.decoded.eventName === 'Swap');
    assert.equal(swapLogs.length, extracted.length);
    for (const [i, q] of extracted.entries()) {
      assert.deepEqual([q.bidX64, q.askX64, q.referenceX64, q.poolOutput], [BigInt(saved[i].bidX64), BigInt(saved[i].askX64), BigInt(saved[i].referenceX64), saved[i].poolOutput]);
      const { log, decoded } = swapLogs[i], pair = signedPair((decoded.args as any).amountDeltas);
      assert.deepEqual([q.amount0, q.amount1], [pair.high, pair.low]);
      assert.deepEqual([saved[i].blockHash, saved[i].block, saved[i].logIndex], [log.blockHash, BigInt(log.blockNumber).toString(), BigInt(log.logIndex).toString()]);
    }
  }
  assert.equal(new Set(quotes.map((q: any) => q.transactionHash + ':' + q.logIndex)).size, quotes.length);
  assert.equal(r.events.filter(e => e.type === 'swap').length, r.events.filter(e => e.reference).length);
  for (const mark of read('marks.json')) if (mark.result) {
    assert.equal(mark.request.to, PROVIDER); assert.equal(mark.request.data, QUOTE_SELECTOR);
    assert.equal(states.find((s: any) => s.block === mark.block)?.blockHash, mark.blockHash);
    const [bid, ask, ref] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], mark.result);
    assert.ok(bid > 0n && bid < ask && bid <= ref && ref <= ask); assert.equal(String(ref), mark.referenceX64);
  }
  return { config, replay: r, states, marks: read('marks.json'), verification: { status: 'VERIFIED', id: config.id, slug, swaps: r.events.filter(e => e.type === 'swap').length, events: r.events.length, checkpoints: states.length, storageComparisons: comparisons, withdrawalChecks, closed: r.final.every(n => n === 0n), final: r.final.map(String), tolerance: '0', from: r.events[0].block, lastEventBlock: r.events.at(-1)!.block, indexedThrough: config.through, executionQuoteEvents: r.events.filter(e => e.reference).length } };
}
if (process.argv[1]?.endsWith('verify-position.ts')) {
  const slug = process.argv[2];
  try { const { verification } = verifyPosition(slug); const root = new URL('../fixtures/positions/' + slug + '/', import.meta.url); writeFileSync(new URL('verification.json', root), JSON.stringify(verification, null, 2)); const status = JSON.parse(readFileSync(new URL('status.json', root), 'utf8')); writeFileSync(new URL('status.json', root), JSON.stringify({ ...status, status: 'VERIFIED', phase: 'independent offline reconciliation passed' }, null, 2)); console.log(JSON.stringify(verification)); }
  catch (e) { console.error('Position NOT VERIFIED: ' + (e instanceof Error ? e.message : 'reconciliation failed')); process.exitCode = 1; }
}
