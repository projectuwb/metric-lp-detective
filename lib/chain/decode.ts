import { decodeEventLog, parseAbi, type Hex } from 'viem';
import { POOL, DECODER_VERSION } from './poolConfig.js';

// MIT interfaces at SOURCE_REVISION, matched to compiled deployed runtime and
// actual add/swap receipts in fixtures/raw. Schema provenance does not prove an
// arbitrary input log came from the chain; receipt identity must also be checked.
export const sourceAbi = parseAbi([
  'event LiquidityAdded(address indexed provider, uint80 indexed salt, int256[] binIdxs, (int256 delta0Scaled, int256 delta1Scaled)[] binBalanceDeltas, uint256[] shares)',
  'event LiquidityRemoved(address indexed provider, uint80 indexed salt, int256[] binIdxs, (int256 delta0Scaled, int256 delta1Scaled)[] binBalanceDeltas, uint256[] shares)',
  'event BinSwapped(int256 binIdx, uint256 binDeltas, uint256 fees)',
  'event Swap(address indexed sender, address indexed recipient, uint256 details, uint256 amountDeltas, uint256 platformFees)',
]);

function word(v: bigint) {
  if (v < 0n || v >= 1n << 256n) throw new Error('Invalid uint256');
  return v;
}
export function unsignedPair(v: bigint) {
  word(v);
  return { high: v >> 128n, low: v & ((1n << 128n) - 1n) };
}
export function signedPair(v: bigint) {
  const p = unsignedPair(v);
  return { high: BigInt.asIntN(128, p.high), low: BigInt.asIntN(128, p.low) };
}
export function swapDetails(v: bigint) {
  word(v);
  if (v >> 121n) throw new Error('Unknown swap details layout');
  return {
    posInBin: v & ((1n << 104n) - 1n),
    binIdx: BigInt.asIntN(16, v >> 104n),
    exactInput: Boolean((v >> 120n) & 1n),
  };
}
export function decodeSourceLog(log: { address: string; data: Hex; topics: [Hex, ...Hex[]] }) {
  if (log.address.toLowerCase() !== POOL.toLowerCase()) throw new Error('Wrong emitting pool');
  const event = decodeEventLog({ abi: sourceAbi, ...log, strict: true });
  if (event.eventName === 'LiquidityAdded' || event.eventName === 'LiquidityRemoved') {
    const { binIdxs, binBalanceDeltas, shares } = event.args;
    if (binIdxs.length !== shares.length || shares.length !== binBalanceDeltas.length)
      throw new Error('Non-parallel liquidity arrays');
    for (const row of binBalanceDeltas) {
      const sign = event.eventName === 'LiquidityAdded' ? 1n : -1n;
      if (row.delta0Scaled * sign < 0n || row.delta1Scaled * sign < 0n)
        throw new Error('Unexpected liquidity delta sign');
    }
  }
  return { ...event, decoderVersion: DECODER_VERSION, deployedVersionVerified: true as const };
}
