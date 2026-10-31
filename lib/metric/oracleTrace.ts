import { decodeAbiParameters, toFunctionSelector, type Hex } from 'viem';
import { POOL } from '../chain/poolConfig.js';
export const PROVIDER = '0xd352e157fd2bad7b8b524013151b19b0a90b79bc';
export const SWAP_SELECTOR = toFunctionSelector('swap(address,bool,int128,uint128,bytes,bytes)');
export const QUOTE_SELECTOR = toFunctionSelector('getQuote()');
export interface CallFrame { type?: string; from?: string; to?: string; input?: Hex; output?: Hex; error?: string; calls?: CallFrame[] }
export function executionQuotes(root: CallFrame) {
  const result: { path: number[]; poolInput: Hex; poolOutput: Hex; providerCall: CallFrame; bidX64: bigint; askX64: bigint; referenceX64: bigint; amount0: bigint; amount1: bigint }[] = [];
  function walk(frame: CallFrame, path: number[]) {
    if (frame.error) return; // Failed parents discard every nested operation.
    if (frame.to?.toLowerCase() === POOL.toLowerCase() && frame.input?.startsWith(SWAP_SELECTOR)) {
      const quotes: CallFrame[] = [];
      function find(c: CallFrame) {
        if (c.error) return;
        if (c.from?.toLowerCase() === POOL.toLowerCase() && c.to?.toLowerCase() === PROVIDER && c.input?.startsWith(QUOTE_SELECTOR)) quotes.push(c);
        for (const child of c.calls ?? []) find(child);
      }
      find(frame);
      if (quotes.length !== 1 || !quotes[0].output || !frame.output) throw new Error('Ambiguous or incomplete execution quote');
      const [bidX64, askX64, referenceX64] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], quotes[0].output);
      const [amount0, amount1] = decodeAbiParameters([{ type: 'int128' }, { type: 'int128' }], frame.output);
      if (!(bidX64 > 0n && bidX64 < askX64 && bidX64 <= referenceX64 && referenceX64 <= askX64)) throw new Error('Invalid executed quote');
      result.push({ path, poolInput: frame.input, poolOutput: frame.output, providerCall: quotes[0], bidX64, askX64, referenceX64, amount0, amount1 });
      return;
    }
    for (const [i, child] of (frame.calls ?? []).entries()) walk(child, [...path, i]);
  }
  walk(root, []); return result;
}
