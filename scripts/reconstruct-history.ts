import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { encodeAbiParameters, encodeFunctionData, decodeFunctionResult, encodeEventTopics, keccak256, type Abi, type Hex } from 'viem';
import { sourceAbi } from '../lib/chain/decode.js';
import { configuredRpc, type RawLog } from '../lib/chain/rpc.js';
import { POOL } from '../lib/chain/poolConfig.js';
import { replayPool, portfolio } from '../lib/metric/positionLedger.js';
const folder = new URL('../fixtures/history/', import.meta.url);
const json = (name: string, value: unknown) => writeFileSync(new URL(name, folder), JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v) + '\n');
export const owner = '0x3216FBdef81Be1842A80D648C83C7aa10bc00787' as const;
export const salt = 198136120981933274567974n;
export const key = `${owner.toLowerCase()}:${salt}`;
export function historyInputs() {
  const acquisition = JSON.parse(readFileSync(new URL('acquisition.json', folder), 'utf8'));
  const logs: RawLog[] = JSON.parse(gunzipSync(readFileSync(new URL('pool-logs.json.gz', folder)) as Uint8Array).toString());
  const abi: Abi = JSON.parse(readFileSync(new URL('../fixtures/abi/MetricOmmPool.json', import.meta.url), 'utf8'));
  return { acquisition, logs, abi };
}
export function reconstruct() {
  const { acquisition, logs, abi } = historyInputs();
  if (acquisition.status !== 'ACQUIRED_NOT_RECONCILED' || logs.length !== acquisition.logCount) throw new Error('Incomplete acquisition');
  const replay = replayPool(logs, abi, { entitlementPositions: [key] });
  const liquidityTopics = new Set((['LiquidityAdded', 'LiquidityRemoved'] as const).map(eventName => encodeEventTopics({ abi: sourceAbi, eventName })[0]));
  const selectedLogIds = new Set(logs.filter(l => liquidityTopics.has(l.topics[0] as Hex) && l.topics.length === 3 && l.topics[1]?.toLowerCase().endsWith(owner.slice(2).toLowerCase()) && BigInt(l.topics[2]) === salt).map(l => `${l.transactionHash}:${BigInt(l.logIndex)}`));
  const funding = replay.transitions.filter(t => ['LiquidityAdded', 'LiquidityRemoved'].includes(t.event) && selectedLogIds.has(`${t.transactionHash}:${t.logIndex}`));
  const relevant = replay.swaps.filter(s => s.legs.some(l => (l.before.shares[key] ?? 0n) > 0n));
  const counts = { positions: replay.positions.size, swaps: replay.swaps.length, relevantSwaps: relevant.length, relevantBinSteps: relevant.reduce((n, s) => n + s.legs.filter(l => (l.before.shares[key] ?? 0n) > 0n).length, 0) };
  return { acquisition, logs, abi, replay, funding, relevant, counts, final: portfolio(replay.bins, key) };
}

if (process.argv[1]?.endsWith('reconstruct-history.ts')) {
  let method = 'offline replay';
  try {
    const h = reconstruct();
    const rpcBase = configuredRpc(), rpc = async (m: string, args: unknown[]) => { method = m; return rpcBase(m, args); };
    const batchAbi = h.abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
    const blocks = [...new Set([h.acquisition.to, ...h.funding.flatMap(t => [t.block.toString(), (t.block - 1n).toString()])])].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
    const states = [];
    for (const block of blocks) {
      const tag = `0x${BigInt(block).toString(16)}`, slots: Hex[] = [], bins = Array.from({ length: 100 }, (_, i) => BigInt(i - 50));
      for (const bin of bins) {
        for (const base of [4n, 5n]) slots.push(keccak256(encodeAbiParameters([{ type: 'int256' }, { type: 'uint256' }], [bin, base])));
        const pos = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint80' }, { type: 'int16' }], [owner, salt, Number(bin)]));
        slots.push(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [pos, 6n])));
      }
      const call = { to: POOL, data: encodeFunctionData({ abi: batchAbi, functionName: 'extsload', args: [slots] }) };
      const raw = await rpc('eth_call', [call, tag]) as Hex;
      const words = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: raw }) as readonly Hex[];
      const header = await rpc('eth_getBlockByNumber', [tag, false]) as { hash: string; timestamp: string };
      const partial = replayPool(h.logs.filter(l => BigInt(l.blockNumber) <= BigInt(block)), h.abi, { entitlementPositions: [key] });
      let index = 0; const ownedBins: bigint[] = [], shares: bigint[] = [];
      for (const bin of bins) {
        const packed = BigInt(words[index++]), total = BigInt(words[index++]), held = BigInt(words[index++]);
        const actual = partial.bins.get(bin);
        if ((actual?.reserve0 ?? 0n) !== (packed & ((1n << 104n) - 1n)) || (actual?.reserve1 ?? 0n) !== (packed >> 104n & ((1n << 104n) - 1n)) || (actual?.totalShares ?? 0n) !== total || (actual?.positions.get(key) ?? 0n) !== held) throw new Error(`Historical state mismatch at block ${block}, bin ${bin}`);
        if (held) { ownedBins.push(bin); shares.push(held); }
      }
      let withdrawal: unknown = null;
      if (shares.length) {
        const request = { from: owner, to: POOL, data: encodeFunctionData({ abi: h.abi, functionName: 'removeLiquidity', args: [owner, salt, { binIdxs: ownedBins, shares }, '0x'] }) };
        const result = await rpc('eth_call', [request, tag]) as Hex;
        const amounts = decodeFunctionResult({ abi: h.abi, functionName: 'removeLiquidity', data: result }) as readonly bigint[];
        if (String(amounts) !== String(portfolio(partial.bins, key))) throw new Error('Withdrawal execution mismatch');
        withdrawal = { request, result, amounts };
      }
      states.push({ block, blockHash: header.hash, timestamp: header.timestamp, call, raw, withdrawal });
      console.log(JSON.stringify({ block, reconciledBins: 100, entitled: portfolio(partial.bins, key).map(String) }));
    }
    mkdirSync(new URL('receipts/', folder), { recursive: true });
    for (const tx of new Set(h.funding.map(t => t.transactionHash))) json(`receipts/${tx}.json`, await rpc('eth_getTransactionReceipt', [tx]));
    json('historical-state.json', { chainId: 56, pool: POOL, states });
    json('position-history.json', { position: key, through: h.acquisition.to, status: 'RECONCILED_TO_FIXED_HEAD', ...h.counts, final: h.final, funding: h.funding.map(t => ({ event: t.event, transactionHash: t.transactionHash, block: t.block, logIndex: t.logIndex, bin: t.bin, tokenDelta: t.poolDelta, sharesBefore: t.before.shares[key] ?? 0n, sharesAfter: t.after.shares[key] ?? 0n })), swaps: h.relevant.map(s => ({ transactionHash: s.transactionHash, block: s.block, logIndex: s.logIndex, deltas: s.legs.reduce<[bigint, bigint]>((n, l) => [n[0] + (l.positionDelta[key]?.[0] ?? 0n), n[1] + (l.positionDelta[key]?.[1] ?? 0n)], [0n, 0n]), legs: s.legs.filter(l => (l.before.shares[key] ?? 0n) > 0n).map(l => ({ bin: l.bin, logIndex: l.logIndex, shares: l.before.shares[key], totalShares: l.before.totalShares, before: l.before.entitlements[key], after: l.after.entitlements[key], delta: l.positionDelta[key] })) })) });
  } catch (e) { console.error(JSON.stringify({ method, error: e instanceof Error ? e.message : 'Reconstruction failed' })); process.exitCode = 1; }
}
