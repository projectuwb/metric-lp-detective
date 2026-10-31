import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decodeEventLog, encodeAbiParameters, encodeEventTopics, keccak256, parseAbi, type Hex, type Abi } from 'viem';
import { decodeSourceLog, sourceAbi, signedPair, unsignedPair, swapDetails } from '../lib/chain/decode.js';
import { POOL, TOKEN0, TOKEN1, RUNTIME_CODE_HASH } from '../lib/chain/poolConfig.js';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/raw/${name}`, import.meta.url), 'utf8'));
const manifest = read('manifest.json');
const identity = read('code-and-identity.json');
const historical = read('historical-reads.json');
const factoryAbi: Abi = JSON.parse(readFileSync(new URL('../fixtures/abi/MetricOmmPoolFactory.json', import.meta.url), 'utf8'));
const poolAbi: Abi = JSON.parse(readFileSync(new URL('../fixtures/abi/MetricOmmPool.json', import.meta.url), 'utf8'));
const transferAbi = parseAbi(['event Transfer(address indexed from,address indexed to,uint256 value)']);
const transferTopic = encodeEventTopics({ abi: transferAbi, eventName: 'Transfer' })[0];
type Log = { address: string; topics: [Hex, ...Hex[]]; data: Hex; logIndex: string; transactionHash: string; blockHash: string; blockNumber: string; transactionIndex: string };

describe('real SolidRPC public receipts, fixed historical blocks', () => {
  it('pins full receipt bytes and matches block headers/log identities', () => {
    for (const entry of manifest.receiptFiles) {
      const bytes = readFileSync(new URL(`../fixtures/raw/${entry.file}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
      const receipt = JSON.parse(bytes.toString());
      const header = read(`${receipt.blockNumber}.header.json`);
      expect(receipt.status).toBe('0x1');
      expect(receipt.transactionHash).toBe(entry.tx);
      expect(BigInt(receipt.blockNumber)).toBe(BigInt(entry.blockNumber));
      expect(receipt.blockHash).toBe(header.hash);
      const indexes = new Set<string>();
      for (const log of receipt.logs as Log[]) {
        expect(log.transactionHash).toBe(receipt.transactionHash);
        expect(log.blockHash).toBe(receipt.blockHash);
        expect(log.blockNumber).toBe(receipt.blockNumber);
        expect(log.transactionIndex).toBe(receipt.transactionIndex);
        expect(indexes.has(log.logIndex)).toBe(false);
        indexes.add(log.logIndex);
      }
    }
  });
  it('matches the independently compiled ABI event shapes and topics', () => {
    for (const event of sourceAbi) {
      const compiled = poolAbi.find(e => e.type === 'event' && e.name === event.name);
      expect(compiled).toBeDefined();
      expect(encodeEventTopics({ abi: [compiled!], eventName: event.name })[0]).toBe(manifest.topic0[event.name]);
      expect(encodeEventTopics({ abi: sourceAbi, eventName: event.name })[0]).toBe(manifest.topic0[event.name]);
    }
  });
  it('verifies factory creation identity, tokens, provider and permanent provider mode', () => {
    const receipt = read(`${manifest.creationTransaction}.receipt.json`);
    const log = receipt.logs.find((l: Log) => l.address.toLowerCase() === identity.immutables.factory.toLowerCase());
    const decoded = decodeEventLog({ abi: factoryAbi, ...log });
    expect(decoded.eventName).toBe('PoolCreated');
    const args = decoded.args as Record<string, unknown>;
    expect(args.poolAddress).toBe(POOL);
    expect(args.token0).toBe(TOKEN0);
    expect(args.token1).toBe(TOKEN1);
    expect(args.priceProvider).toBe(identity.immutables.immutablePriceProvider);
    expect(args.priceProviderTimelock).toBe((1n << 256n) - 1n);
    expect(receipt.to.toLowerCase()).toBe(identity.immutables.factory.toLowerCase());
    expect(BigInt(receipt.blockNumber)).toBe(126502643n);
  });
  for (const [index, candidate] of manifest.candidates.entries()) it(`verifies real deposit ${index + 1}: position, bins, transfers and archive share read`, () => {
    const receipt = read(`${candidate.transactionHash}.receipt.json`);
    const log = receipt.logs.find((l: Log) => Number(BigInt(l.logIndex)) === candidate.logIndex);
    const decoded = decodeSourceLog(log);
    expect(decoded.eventName).toBe('LiquidityAdded');
    if (decoded.eventName !== 'LiquidityAdded') throw new Error('Wrong fixture');
    expect(decoded.args.provider).toBe(candidate.provider);
    expect(decoded.args.salt).toBe(BigInt(candidate.salt));
    expect(receipt.from.toLowerCase()).toBe(candidate.provider.toLowerCase());
    expect(decoded.args.binIdxs).toEqual(candidate.bins.map((b: { bin: string }) => BigInt(b.bin)));
    expect(decoded.args.shares).toEqual(candidate.bins.map((b: { shares: string }) => BigInt(b.shares)));
    expect(decoded.args.binBalanceDeltas).toEqual(candidate.bins.map((b: { delta0Scaled: string; delta1Scaled: string }) => ({ delta0Scaled: BigInt(b.delta0Scaled), delta1Scaled: BigInt(b.delta1Scaled) })));
    const deposits = [0n, 0n];
    for (const l of receipt.logs as Log[]) {
      if (![TOKEN0.toLowerCase(), TOKEN1.toLowerCase()].includes(l.address.toLowerCase()) || l.topics[0] !== transferTopic) continue;
      const transfer = decodeEventLog({ abi: transferAbi, ...l });
      if (transfer.args.to.toLowerCase() !== POOL.toLowerCase()) continue;
      expect(transfer.args.from.toLowerCase()).toBe(candidate.provider.toLowerCase());
      deposits[l.address.toLowerCase() === TOKEN0.toLowerCase() ? 0 : 1] += transfer.args.value;
    }
    expect(identity.immutables.token0ScaleMultiplier).toBe('1');
    expect(identity.immutables.token1ScaleMultiplier).toBe('1');
    expect(deposits).toEqual([BigInt(candidate.totalToken0), BigInt(candidate.totalToken1)]);
    expect(decoded.args.binBalanceDeltas.reduce((n, d) => n + d.delta0Scaled, 0n)).toBe(deposits[0]);
    expect(decoded.args.binBalanceDeltas.reduce((n, d) => n + d.delta1Scaled, 0n)).toBe(deposits[1]);
    const archive = historical.find((r: { provider: string; function: string }) => r.provider === candidate.provider && r.function === 'extsload(positionBinShares)');
    const key = keccak256(encodeAbiParameters([{ type: 'address' }, { type: 'uint80' }, { type: 'int16' }], [candidate.provider, BigInt(candidate.salt), Number(archive.bin)]));
    const slot = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [key, 6n]));
    expect(slot).toBe(archive.slot);
    expect(BigInt(archive.raw)).toBe(decoded.args.shares[0]);
  });
  it('reconciles real BinSwapped and Swap to native token transfers without adding LP fees twice', () => {
    const entry = manifest.receiptFiles.find((e: { blockNumber: string }) => e.blockNumber === '130794396');
    const receipt = read(entry.file);
    const events = (receipt.logs as Log[]).filter(l => l.address.toLowerCase() === POOL.toLowerCase()).map(l => decodeSourceLog(l));
    const step = events.find(e => e.eventName === 'BinSwapped');
    const swap = events.find(e => e.eventName === 'Swap');
    if (step?.eventName !== 'BinSwapped' || swap?.eventName !== 'Swap') throw new Error('Missing events');
    const bin = signedPair(step.args.binDeltas), native = signedPair(swap.args.amountDeltas);
    const fees = unsignedPair(step.args.fees), platform = unsignedPair(swap.args.platformFees);
    expect(step.args.binIdx).toBe(4n);
    expect(swapDetails(swap.args.details).binIdx).toBe(4n);
    expect(native.high).toBe(-4311896455105456463n);
    expect(native.low).toBe(315695719201870999999n);
    expect(bin.high).toBe(native.high);
    expect(bin.low + fees.low).toBe(native.low);
    expect(platform.high + platform.low).toBe(fees.low);
    expect(fees.high).toBeGreaterThan(0n); // already included in bin.low
    const flows = [0n, 0n];
    for (const l of receipt.logs as Log[]) {
      if (![TOKEN0.toLowerCase(), TOKEN1.toLowerCase()].includes(l.address.toLowerCase()) || l.topics[0] !== transferTopic) continue;
      const t = decodeEventLog({ abi: transferAbi, ...l });
      const leg = l.address.toLowerCase() === TOKEN0.toLowerCase() ? 0 : 1;
      if (t.args.to.toLowerCase() === POOL.toLowerCase()) flows[leg] += t.args.value;
      if (t.args.from.toLowerCase() === POOL.toLowerCase()) flows[leg] -= t.args.value;
    }
    expect(flows).toEqual([native.high, native.low]);
  });
  it('pins direct-deployment code and source-comparison evidence', () => {
    expect(identity.codeBeforeDeployment).toBe('0x');
    expect(identity.codeAtDeployment).toBe(identity.runtimeCode);
    expect(keccak256(identity.runtimeCode)).toBe(RUNTIME_CODE_HASH);
    const match = read('source-match.json');
    expect([match.poolMatch, match.libraryMatch, match.linkAddressesMatch, match.libraryGuardMatch]).toEqual([true, true, true, true]);
    expect(identity.tokens.map((t: { decimals: number }) => t.decimals)).toEqual([18, 18]);
  });
});
