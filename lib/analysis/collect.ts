// Owner worker only: never imported into a web request or browser component.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, decodeEventLog, keccak256, toFunctionSelector, decodeAbiParameters, type Hex } from 'viem';
import { historyInputs } from '../../scripts/reconstruct-history';
import { positionReplay } from '../metric/positionReplay';
import { POOL, RUNTIME_CODE_HASH } from '../chain/poolConfig';
import { PROVIDER, executionQuotes } from '../metric/oracleTrace';
import { signedPair } from '../chain/decode';
import { RpcFailure, type Rpc } from '../chain/rpc';
import { atomicJson, readJson, AnalysisLimit } from './store';
import { SERVICE_LIMITS } from './types';
export async function collectPosition(id: string, slug: string, root: URL, rpc: Rpc, requests: () => number, report: (progress: { phase: string; completedCheckpoints: number; totalCheckpoints: number }) => void) {
  mkdirSync(root, { recursive: true }); mkdirSync(new URL('receipts/', root), { recursive: true }); mkdirSync(new URL('traces/', root), { recursive: true });
  const save = (name: string, value: unknown) => atomicJson(fileURLToPath(new URL(name, root)), value);
  const read = (name: string, fallback: any) => existsSync(new URL(name, root)) ? readJson(fileURLToPath(new URL(name, root))) : fallback;
  const h = historyInputs(), r = positionReplay(h.logs, h.abi, id), [owner, salt] = id.split(':');
  const swapTransactions = [...new Set(r.events.filter(e => e.type === 'swap').map(e => e.transactionHash))];
  const fundingTransactions = [...new Set(r.funding.map(f => f.transactionHash))];
  const blocks = [...new Set([h.acquisition.to, (BigInt(r.events[0].block) - 1n).toString(), (BigInt(r.events.at(-1)!.block) - 1n).toString(), ...r.events.map(e => e.block)])].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
  const upperBound = 4 + blocks.length * 5 + fundingTransactions.length + swapTransactions.length;
  if (r.events.filter(e => e.type === 'swap').length > SERVICE_LIMITS.maxSwaps || blocks.length > SERVICE_LIMITS.maxCheckpoints || swapTransactions.length > SERVICE_LIMITS.maxTraceTransactions || upperBound > SERVICE_LIMITS.jobRequests) throw new AnalysisLimit('UNSUPPORTED', `Too large for the conservative beta: ${r.events.filter(e => e.type === 'swap').length} swaps, ${blocks.length} checkpoints, ${swapTransactions.length} trace transactions, at most ${upperBound} reads. No RPC scan started. Owner review required.`);
  const fingerprint = { id, indexEndHash: h.acquisition.endHash, sourceHash: keccak256(readFileSync(new URL('../../fixtures/history/pool-logs.json.gz', import.meta.url))) };
  const previous = read('capture-context.json', null);
  if (previous && JSON.stringify(previous) !== JSON.stringify(fingerprint)) throw new Error('Capture/index context changed; cached state is not reusable');
  save('capture-context.json', fingerprint);
  const states: any[] = read('states.json', []), marks: any[] = read('marks.json', []);
  const status = { id, slug, status: 'PROCESSING', phase: 'Historical checkpoint reads', requests: requests(), completedCheckpoints: states.length, totalCheckpoints: blocks.length };
  const progress = () => { status.requests = requests(); status.completedCheckpoints = states.length; save('status.json', status); report({ phase: status.phase, completedCheckpoints: states.length, totalCheckpoints: blocks.length }); };
  progress();
  if (await rpc('eth_chainId', []) !== '0x38') throw new Error('Wrong chain');
  const headTag = '0x' + BigInt(h.acquisition.to).toString(16);
  const head = await rpc('eth_getBlockByNumber', [headTag, false]) as any;
  if (head?.hash !== h.acquisition.endHash) throw new Error('Pinned indexed head is no longer canonical');
  if (keccak256(await rpc('eth_getCode', [POOL, headTag]) as Hex) !== RUNTIME_CODE_HASH) throw new Error('Pool runtime changed');
  const ownerCode = await rpc('eth_getCode', [owner, '0x' + BigInt(r.events[0].block).toString(16)]);
  if (ownerCode !== '0x') throw new AnalysisLimit('UNSUPPORTED', 'Contract-provider beneficial ownership requires separate proof');
  const batchAbi = h.abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
  const slots: Hex[] = [], bins = Array.from({ length: 100 }, (_, i) => BigInt(i - 50));
  for (const bin of bins) {
    for (const base of [4n, 5n]) slots.push(keccak256(encodeAbiParameters([{ type: 'int256' }, { type: 'uint256' }], [bin, base])));
    const key = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint80' }, { type: 'int16' }], [owner as Hex, BigInt(salt), Number(bin)]));
    slots.push(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [key, 6n])));
  }
  for (const block of blocks) {
    const blockTag = '0x' + BigInt(block).toString(16), header = await rpc('eth_getBlockByNumber', [blockTag, false]) as any;
    if (!header?.hash || h.logs.some(l => BigInt(l.blockNumber) === BigInt(block) && l.blockHash !== header.hash)) throw new Error('Checkpoint/source-index canonical hash mismatch');
    const prior = states.find(s => s.block === block);
    if (prior) {
      if (prior.blockHash !== header.hash || prior.postCallHash !== header.hash) throw new Error('Resumed checkpoint changed canonical hash');
      // Reuse a complete checkpoint only after an uncached canonical-header confirmation.
      if (marks.some(m => m.block === block && m.result) || !r.events.some(e => e.block === block) && block !== h.acquisition.to) { progress(); continue; }
    }
    const call = { to: POOL, data: encodeFunctionData({ abi: batchAbi, functionName: 'extsload', args: [slots] }) };
    const raw = await rpc('eth_call', [call, blockTag]) as Hex;
    const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: raw }) as readonly Hex[];
    if (words.length !== 300) throw new Error('Incomplete storage response');
    const owned = bins.filter((_, i) => BigInt(words[i * 3 + 2]) > 0n); let withdrawal = null;
    if (owned.length) {
      const request = { from: owner, to: POOL, data: encodeFunctionData({ abi: h.abi, functionName: 'removeLiquidity', args: [owner, BigInt(salt), { binIdxs: owned, shares: owned.map(b => BigInt(words[Number(b + 50n) * 3 + 2])) }, '0x'] }) };
      const result = await rpc('eth_call', [request, blockTag]) as Hex;
      withdrawal = { request, result, amounts: decodeFunctionResult({ abi: h.abi, functionName: 'removeLiquidity', data: result }) };
    }
    if (r.events.some(e => e.block === block) || block === h.acquisition.to) {
      let mark: any;
      try {
        const request = { from: '0x0000000000000000000000000000000000000000', to: PROVIDER, data: toFunctionSelector('getQuote()') };
        const result = await rpc('eth_call', [request, blockTag]) as Hex;
        const [bidX64, askX64, referenceX64] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], result);
        mark = { block, blockHash: header.hash, timestamp: header.timestamp, request, result, bidX64, askX64, referenceX64, kind: 'BLOCK_END' };
      } catch (e) { if (e instanceof AnalysisLimit || e instanceof RpcFailure) throw e; mark = { block, status: 'UNAVAILABLE', error: 'Reference decode unavailable' }; }
      const i = marks.findIndex(m => m.block === block); if (i < 0) marks.push(mark); else marks[i] = mark;
    }
    const confirmed = await rpc('eth_getBlockByNumber', [blockTag, false]) as any;
    if (header.hash !== confirmed?.hash) throw new Error('Checkpoint hash changed during reads');
    const state = { block, blockHash: header.hash, timestamp: header.timestamp, call, raw, withdrawal, postCallHash: confirmed.hash };
    if (prior) states[states.indexOf(prior)] = state; else states.push(state);
    save('states.json', states); save('marks.json', marks); progress();
  }
  status.phase = 'Liquidity receipt reconciliation inputs'; progress();
  for (const tx of fundingTransactions) save('receipts/' + tx + '.json', await rpc('eth_getTransactionReceipt', [tx]));
  status.phase = 'Bounded execution witnesses'; progress(); const quotes = [];
  for (const tx of swapTransactions) {
    const trace = await rpc('debug_traceTransaction', [tx, { tracer: 'callTracer', timeout: '15s' }]) as any;
    writeFileSync(new URL('traces/' + tx + '.json.gz', root), gzipSync(JSON.stringify(trace)));
    const extracted = executionQuotes(trace), swaps = h.logs.filter(l => l.transactionHash === tx).map(log => ({ log, decoded: decodeEventLog({ abi: h.abi, topics: log.topics as any, data: log.data as Hex }) })).filter(e => e.decoded.eventName === 'Swap');
    if (swaps.length !== extracted.length) throw new Error('Trace/log boundary mismatch');
    for (const [i, q] of extracted.entries()) {
      const pair = signedPair((swaps[i].decoded.args as any).amountDeltas);
      if (pair.high !== q.amount0 || pair.low !== q.amount1) throw new Error('Trace native-flow mismatch');
      quotes.push({ transactionHash: tx, block: BigInt(swaps[i].log.blockNumber).toString(), blockHash: swaps[i].log.blockHash, logIndex: BigInt(swaps[i].log.logIndex).toString(), ...q });
    }
    progress();
  }
  save('quotes.json', quotes);
  save('config.json', { id, slug, name: 'Owner-requested public position', pool: POOL, chainId: 56, through: h.acquisition.to, indexEndHash: h.acquisition.endHash, sourceHash: fingerprint.sourceHash, funding: r.funding, eventCount: r.events.length, swaps: r.events.filter(e => e.type === 'swap').length, final: r.final, ownerCode });
  status.status = 'PARTIAL'; status.phase = 'Captured; independent reconciliation required'; progress();
}
