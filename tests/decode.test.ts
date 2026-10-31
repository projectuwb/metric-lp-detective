import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, type Hex } from 'viem';
import { decodeSourceLog, signedPair, unsignedPair, swapDetails, sourceAbi } from '../lib/chain/decode.js';
import { POOL } from '../lib/chain/poolConfig.js';

describe('artificial codec mechanics; real receipt tests are separate', () => {
  const vectors = JSON.parse(readFileSync(new URL('../fixtures/unit/packed-words.json', import.meta.url), 'utf8'));
  for (const row of vectors.pairs) it(`unpacks signed word ${row.word}`, () => {
    expect(signedPair(BigInt(row.word))).toEqual({ high: BigInt(row.high), low: BigInt(row.low) });
  });
  it('preserves uint128 fee legs and rejects overflow', () => {
    expect(unsignedPair((1n << 256n) - 1n)).toEqual({ high: (1n << 128n) - 1n, low: (1n << 128n) - 1n });
    expect(() => unsignedPair(1n << 256n)).toThrow();
    expect(() => signedPair(-1n)).toThrow();
  });
  it('sign extends bin without bleeding into exact-input bit', () => {
    expect(swapDetails((1n << 120n) | (65535n << 104n) | 7n)).toEqual({ exactInput: true, binIdx: -1n, posInBin: 7n });
    expect(swapDetails(32768n << 104n).binIdx).toBe(-32768n);
    expect(() => swapDetails(1n << 121n)).toThrow();
  });
  // Artificial ABI encodings exercise the source schema only; these are not receipts.
  for (const eventName of ['LiquidityAdded', 'LiquidityRemoved'] as const) it(`decodes ${eventName} ABI shape`, () => {
    const sign = eventName === 'LiquidityAdded' ? 1n : -1n;
    const topics = encodeEventTopics({ abi: sourceAbi, eventName, args: { provider: POOL, salt: (1n << 80n) - 1n } }) as [Hex, ...Hex[]];
    const data = encodeAbiParameters([
      { type: 'int256[]' },
      { type: 'tuple[]', components: [{ name: 'delta0Scaled', type: 'int256' }, { name: 'delta1Scaled', type: 'int256' }] },
      { type: 'uint256[]' },
    ], [[-2n], [{ delta0Scaled: sign * 123n, delta1Scaled: 0n }], [1n << 100n]]);
    const result = decodeSourceLog({ address: POOL, topics, data });
    expect(result.eventName).toBe(eventName);
    expect(result.deployedVersionVerified).toBe(true);
    if (result.eventName === eventName) {
      expect(result.args.binIdxs).toEqual([-2n]);
      expect(result.args.shares).toEqual([1n << 100n]);
    }
    expect(() => decodeSourceLog({ address: '0x0000000000000000000000000000000000000000', topics, data })).toThrow('Wrong emitting pool');
    expect(() => decodeSourceLog({ address: POOL, topics, data: '0x' })).toThrow();
  });
  it('decodes packed swap words without treating pool flows as LP flows', () => {
    const topics = encodeEventTopics({ abi: sourceAbi, eventName: 'Swap', args: { sender: POOL, recipient: POOL } }) as [Hex, ...Hex[]];
    const data = encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }], [0n, (1n << 128n) | ((1n << 128n) - 1n), 0n]);
    const result = decodeSourceLog({ address: POOL, topics, data });
    expect(result.eventName).toBe('Swap');
    if (result.eventName === 'Swap') expect(signedPair(result.args.amountDeltas)).toEqual({ high: 1n, low: -1n });
  });
  it('decodes a bin step with independently signed deltas and unsigned fee legs', () => {
    const topics = encodeEventTopics({ abi: sourceAbi, eventName: 'BinSwapped' }) as [Hex, ...Hex[]];
    const data = encodeAbiParameters([{ type: 'int256' }, { type: 'uint256' }, { type: 'uint256' }], [-7n, (BigInt.asUintN(128, -10n) << 128n) | 20n, (3n << 128n) | 2n]);
    const result = decodeSourceLog({ address: POOL, topics, data });
    expect(result.eventName).toBe('BinSwapped');
    if (result.eventName === 'BinSwapped') {
      expect(result.args.binIdx).toBe(-7n);
      expect(signedPair(result.args.binDeltas)).toEqual({ high: -10n, low: 20n });
      expect(unsignedPair(result.args.fees)).toEqual({ high: 3n, low: 2n });
    }
  });
});
