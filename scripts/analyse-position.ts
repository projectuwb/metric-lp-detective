import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, decodeEventLog, keccak256, toBytes, toFunctionSelector, decodeAbiParameters, type Hex } from 'viem';
import { historyInputs } from './reconstruct-history.js';
import { positionReplay } from '../lib/metric/positionReplay.js';
import { configuredRpc, RpcFailure } from '../lib/chain/rpc.js';
import { recoveryBudget } from '../lib/chain/recoveryBudget.js';
import { POOL, RUNTIME_CODE_HASH } from '../lib/chain/poolConfig.js';
import { PROVIDER, executionQuotes } from '../lib/metric/oracleTrace.js';
import { signedPair } from '../lib/chain/decode.js';
import { positionIdentity } from '../lib/domain/position.js';
import { verifyPosition } from './verify-position.js';
const input = process.argv[process.argv.indexOf('--id') + 1];
if (!process.argv.includes('--id') || !/^0x[0-9a-fA-F]{40}:\d{1,25}$/.test(input ?? '')) throw new Error('Use --id publicProvider:uint80Salt');
const id = positionIdentity(input), [owner, salt] = id.split(':');
const slug = keccak256(toBytes(id)).slice(2, 18), root = new URL('../fixtures/positions/' + slug + '/', import.meta.url);
// A repeat of a completed job verifies and reuses immutable evidence, without RPC.
// Never overwrite a verified artifact with a newly failed/partial acquisition.
if (existsSync(new URL('status.json', root)) && JSON.parse(readFileSync(new URL('status.json', root), 'utf8')).status === 'VERIFIED') {
  try { const { verification } = verifyPosition(slug); console.log(JSON.stringify({ ...verification, reused: true, remoteRequests: 0 })); process.exit(0); }
  catch { console.error('Existing VERIFIED artifact failed offline validation; left unchanged. Review the source-index version before reacquiring.'); process.exit(1); }
}
mkdirSync(root, { recursive: true }); mkdirSync(new URL('receipts/', root), { recursive: true }); mkdirSync(new URL('traces/', root), { recursive: true });
const save = (name: string, value: unknown) => writeFileSync(new URL(name, root), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
let method = 'offline replay';
const status: any = { id, slug, status: 'PROCESSING', phase: 'replay', requests: 0, completedCheckpoints: 0, observedAt: new Date().toISOString() };
save('status.json', status);
try {
  const h = historyInputs(), r = positionReplay(h.logs, h.abi, id);
  if (r.events.filter(e => e.type === 'swap').length > 100) throw new Error('UNSUPPORTED: bounded proof-of-concept supports at most 100 swaps per position');
  const budget = recoveryBudget(100), rawRpc = configuredRpc();
  const rpc = async (m: string, args: unknown[]) => { method = m; try { return await budget.run(() => rawRpc(m, args)); } finally { status.requests = budget.issued; } };
  if (await rpc('eth_chainId', []) !== '0x38') throw new Error('Wrong chain');
  const end = h.acquisition.to, tag = '0x' + BigInt(end).toString(16);
  if (keccak256(await rpc('eth_getCode', [POOL, tag]) as Hex) !== RUNTIME_CODE_HASH) throw new Error('Pool runtime changed');
  const ownerCode = await rpc('eth_getCode', [owner, '0x' + BigInt(r.events[0].block).toString(16)]);
  if (ownerCode !== '0x') throw new Error('UNSUPPORTED: contract beneficial ownership needs separate proof');
  const blocks = [...new Set([end, (BigInt(r.events[0].block) - 1n).toString(), (BigInt(r.events.at(-1)!.block) - 1n).toString(), ...r.events.map(e => e.block)])].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
  if (blocks.length > 20) throw new Error('UNSUPPORTED: bounded proof-of-concept supports at most 20 checkpoints');
  const batchAbi = h.abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
  const states: any[] = [], marks: any[] = [], bins = Array.from({ length: 100 }, (_, i) => BigInt(i - 50));
  status.phase = 'historical state'; status.totalCheckpoints = blocks.length;
  for (const block of blocks) {
    const blockTag = '0x' + BigInt(block).toString(16), slots: Hex[] = [];
    for (const bin of bins) {
      for (const base of [4n, 5n]) slots.push(keccak256(encodeAbiParameters([{ type: 'int256' }, { type: 'uint256' }], [bin, base])));
      const positionKey = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint80' }, { type: 'int16' }], [owner as Hex, BigInt(salt), Number(bin)]));
      slots.push(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [positionKey, 6n])));
    }
    const header = await rpc('eth_getBlockByNumber', [blockTag, false]) as any;
    const call = { to: POOL, data: encodeFunctionData({ abi: batchAbi, functionName: 'extsload', args: [slots] }) };
    const raw = await rpc('eth_call', [call, blockTag]) as Hex;
    const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: raw }) as readonly Hex[];
    if (words.length !== 300) throw new Error('Incomplete storage response');
    const owned = bins.filter((_, i) => BigInt(words[i * 3 + 2]) > 0n);
    let withdrawal = null;
    if (owned.length) {
      const request = { from: owner, to: POOL, data: encodeFunctionData({ abi: h.abi, functionName: 'removeLiquidity', args: [owner, BigInt(salt), { binIdxs: owned, shares: owned.map(b => BigInt(words[Number(b + 50n) * 3 + 2])) }, '0x'] }) };
      const result = await rpc('eth_call', [request, blockTag]) as Hex;
      withdrawal = { request, result, amounts: decodeFunctionResult({ abi: h.abi, functionName: 'removeLiquidity', data: result }) };
    }
    if (r.events.some(e => e.block === block) || block === end) {
      try {
        const request = { from: '0x0000000000000000000000000000000000000000', to: PROVIDER, data: toFunctionSelector('getQuote()') };
        const result = await rpc('eth_call', [request, blockTag]) as Hex;
        const [bidX64, askX64, referenceX64] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], result);
        marks.push({ block, blockHash: header.hash, timestamp: header.timestamp, request, result, bidX64, askX64, referenceX64, kind: 'BLOCK_END' });
      } catch (e) { if (e instanceof RpcFailure && e.kind === 'rate') throw e; marks.push({ block, status: 'UNAVAILABLE', error: e instanceof RpcFailure ? e.message : 'Mark unavailable' }); }
    }
    const confirmed = await rpc('eth_getBlockByNumber', [blockTag, false]) as any;
    if (header.hash !== confirmed.hash) throw new Error('Historical checkpoint hash changed during capture; incomplete evidence');
    states.push({ block, blockHash: header.hash, timestamp: header.timestamp, call, raw, withdrawal, postCallHash: confirmed.hash });
    status.completedCheckpoints++; save('status.json', status); save('states.json', states); save('marks.json', marks);
    console.log(JSON.stringify({ block, checkpoints: status.completedCheckpoints, total: blocks.length, requests: status.requests }));
  }
  for (const tx of new Set(r.funding.map(f => f.transactionHash))) save('receipts/' + tx + '.json', await rpc('eth_getTransactionReceipt', [tx]));
  status.phase = 'bounded execution witnesses'; const quotes = [];
  for (const tx of new Set(r.events.filter(e => e.type === 'swap').map(e => e.transactionHash))) {
    const trace = await rpc('debug_traceTransaction', [tx, { tracer: 'callTracer', timeout: '15s' }]) as any;
    writeFileSync(new URL('traces/' + tx + '.json.gz', root), gzipSync(JSON.stringify(trace)));
    const extracted = executionQuotes(trace), swaps = h.logs.filter(l => l.transactionHash === tx).map(l => ({ log: l, event: decodeEventLog({ abi: h.abi, topics: l.topics as any, data: l.data as any }) })).filter(x => x.event.eventName === 'Swap');
    if (swaps.length !== extracted.length) throw new Error('Trace/log boundary mismatch');
    for (const [i, q] of extracted.entries()) {
      const pair = signedPair((swaps[i].event.args as any).amountDeltas);
      if (pair.high !== q.amount0 || pair.low !== q.amount1) throw new Error('Trace native flow mismatch');
      quotes.push({ transactionHash: tx, block: BigInt(swaps[i].log.blockNumber).toString(), blockHash: swaps[i].log.blockHash, logIndex: BigInt(swaps[i].log.logIndex).toString(), ...q });
    }
  }
  save('quotes.json', quotes);
  save('config.json', { id, slug, name: 'Public provider/salt position', pool: POOL, chainId: 56, through: end, indexEndHash: h.acquisition.endHash, sourceHash: keccak256(readFileSync(new URL('../fixtures/history/pool-logs.json.gz', import.meta.url))), funding: r.funding, eventCount: r.events.length, swaps: r.events.filter(e => e.type === 'swap').length, final: r.final, ownerCode });
  status.status = 'PARTIAL'; status.phase = 'evidence captured; offline reconciliation required'; save('status.json', status);
} catch (e) {
  status.status = e instanceof RpcFailure && e.kind === 'rate' ? 'RATE_LIMITED' : e instanceof Error && e.message.startsWith('UNSUPPORTED') ? 'UNSUPPORTED' : 'FAILED';
  status.error = e instanceof RpcFailure ? e.message : e instanceof Error ? e.message : 'Evidence collection failed'; status.method = method;
  save('status.json', status); console.error(JSON.stringify(status)); process.exitCode = 1;
}
