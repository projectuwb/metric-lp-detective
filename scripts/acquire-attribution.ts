import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, keccak256, type Abi, type Hex } from 'viem';
import { configuredRpc, getPoolLogs, type RawLog } from '../lib/chain/rpc.js';
import { POOL, RUNTIME_CODE_HASH, DEPLOYMENT_BLOCK } from '../lib/chain/poolConfig.js';
import { replayPool } from '../lib/metric/positionLedger.js';

const folder = new URL('../fixtures/attribution/', import.meta.url);
const json = (name: string, value: unknown) => writeFileSync(new URL(name, folder), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2) + '\n');
const source = JSON.parse(readFileSync(new URL('pool-logs.json', folder), 'utf8'));
const abi: Abi = JSON.parse(readFileSync(new URL('../fixtures/abi/MetricOmmPool.json', import.meta.url), 'utf8'));
// Restrict the overload for RETURN decoding too; name-only lookup can select
// extsload(bytes32) and interpret an array result as a single word.
const batchAbi = abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
const slotsAbi = [{ type: 'int256' }, { type: 'uint256' }] as const;
const mapSlot = (bin: bigint, base: bigint) => keccak256(encodeAbiParameters(slotsAbi, [bin, base]));
const positionSlot = (owner: string, salt: bigint, bin: bigint) => keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint80' }, { type: 'int16' }], [owner as Hex, salt, Number(bin)])), 6n]));
let method = 'configuration', blockContext = '';
try {
  const rawRpc = configuredRpc();
  const rpc = async (name: string, params: unknown[]) => { method = name; return rawRpc(name, params); };
  if (await rpc('eth_chainId', []) !== '0x38') throw new Error('Wrong chain');
  if (BigInt(source.from) !== DEPLOYMENT_BLOCK || source.to !== '126553642') throw new Error('Unexpected attribution coverage');
  // A failed/partial refresh must never leave an older PASS report looking current.
  json('validation-results.json', { results: Object.fromEntries(['A', 'B', 'C', 'D'].map(name => [name, { status: 'NOT VERIFIED', reason: 'Evidence refresh started; run verify:fixture after successful acquisition' }])) });
  writeFileSync(new URL('../fixtures/expected/preferred-position-checkpoint.json', import.meta.url), JSON.stringify({ status: 'NOT VERIFIED', reason: 'Evidence refresh requires new reconciliation' }, null, 2) + '\n');
  if (process.argv.includes('--refresh-logs')) {
    source.logs = await getPoolLogs(rpc, BigInt(source.from), BigInt(source.to));
    source.observedAt = new Date().toISOString(); json('pool-logs.json', source);
  }
  const code = await rpc('eth_getCode', [POOL, `0x${BigInt(source.to).toString(16)}`]);
  if (typeof code !== 'string' || keccak256(code as Hex) !== RUNTIME_CODE_HASH) throw new Error('Runtime changed');
  const all = replayPool(source.logs, abi);
  const positions = [...all.positions.values()];
  const bins = Array.from({ length: 20 }, (_, i) => BigInt(i - 10));
  const blocks = new Set<bigint>([BigInt(source.from), BigInt(source.to)]);
  for (const event of all.transitions) { blocks.add(event.block); blocks.add(event.block - 1n); }
  // Includes both direct storage and ephemeral removal-contract execution. Never
  // calls eth_send*, signs, connects a wallet or persists a state transition.
  const snapshots: unknown[] = [];
  for (const block of [...blocks].sort((a, b) => a < b ? -1 : 1)) {
    blockContext = block.toString();
    const tag = `0x${block.toString(16)}`;
    const header = await rpc('eth_getBlockByNumber', [tag, false]) as { hash: string; number: string; timestamp: string };
    const slots: Hex[] = [];
    for (const bin of bins) {
      slots.push(mapSlot(bin, 4n), mapSlot(bin, 5n));
      for (const p of positions) slots.push(positionSlot(p.owner, p.salt, bin));
    }
    const data = encodeFunctionData({ abi: batchAbi, functionName: 'extsload', args: [slots] });
    const raw = await rpc('eth_call', [{ to: POOL, data }, tag]) as Hex;
    const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: raw }) as readonly Hex[];
    if (words.length !== slots.length) throw new Error('Storage response length mismatch');
    const reserves: unknown[] = [];
    let cursor = 0;
    const positionShares = positions.map(() => [] as bigint[]);
    for (const bin of bins) {
      const packed = BigInt(words[cursor++]);
      const totalShares = BigInt(words[cursor++]);
      const shares = positions.map((_, i) => { const s = BigInt(words[cursor++]); positionShares[i].push(s); return s; });
      reserves.push({ bin, reserve0: packed & ((1n << 104n) - 1n), reserve1: packed >> 104n & ((1n << 104n) - 1n), totalShares, shares });
    }
    const quotes: unknown[] = [];
    for (const [pIndex, p] of positions.entries()) {
      for (const choice of ['full', 'bin0', 'bin1', 'bin2']) {
        const selected = bins.map((bin, i) => ({ bin, shares: positionShares[pIndex][i] })).filter(r => r.shares > 0n && (choice === 'full' || r.bin === BigInt(choice.slice(3))));
        if (!selected.length) continue;
        const call = { from: p.owner, to: POOL, data: encodeFunctionData({ abi, functionName: 'removeLiquidity', args: [p.owner, p.salt, { binIdxs: selected.map(b => b.bin), shares: selected.map(b => b.shares) }, '0x'] }) };
        try {
          const result = await rpc('eth_call', [call, tag]) as Hex;
          const amounts = decodeFunctionResult({ abi, functionName: 'removeLiquidity', data: result });
          quotes.push({ position: p, choice, call, result, amounts });
        } catch (error) { quotes.push({ position: p, choice, error: error instanceof Error ? error.message : 'redacted' }); }
      }
    }
    // Independent eth_getStorageAt cross-check for selected bin 1's reserves.
    const storageSlot = mapSlot(1n, 4n);
    const storageRaw = await rpc('eth_getStorageAt', [POOL, storageSlot, tag]);
    const snapshot = { block, blockHash: header.hash, timestamp: header.timestamp, batchCall: { to: POOL, data }, slots, raw, reserves, quotes, directStorage: { bin: '1', slot: storageSlot, raw: storageRaw } };
    snapshots.push(snapshot); json('historical-state.json', { chainId: 56, pool: POOL, positions, bins, snapshots });
    console.log(JSON.stringify({ block: block.toString(), readWords: words.length, quotes: quotes.length, quoteFailures: quotes.filter((q: any) => q.error).length }));
  }
  mkdirSync(new URL('receipts/', folder), { recursive: true });
  for (const tx of new Set((source.logs as RawLog[]).map(l => l.transactionHash))) {
    blockContext = tx;
    const receipt = await rpc('eth_getTransactionReceipt', [tx]);
    writeFileSync(new URL(`receipts/${tx}.json`, folder), JSON.stringify(receipt, null, 2) + '\n');
  }
} catch (error) {
  console.error(JSON.stringify({ method, context: blockContext, error: error instanceof Error ? error.message : 'redacted failure' }));
  process.exitCode = 1;
}
