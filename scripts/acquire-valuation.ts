import { readFileSync, writeFileSync } from 'node:fs';
import { configuredRpc, RpcFailure } from '../lib/chain/rpc.js';
import { PROVIDER } from '../lib/metric/oracleTrace.js';
import { decodeAbiParameters, toFunctionSelector, type Hex } from 'viem';
const folder = new URL('../fixtures/history/', import.meta.url);
const history = JSON.parse(readFileSync(new URL('position-history.json', folder), 'utf8'));
const rpc = configuredRpc();
const blocks = [...new Set<string>([history.through, ...history.funding.map((f: any) => f.block)])];
const records = [];
for (const block of blocks) {
  const tag = `0x${BigInt(block).toString(16)}`;
  try {
    const header = await rpc('eth_getBlockByNumber', [tag, false]) as { hash: string; timestamp: string };
    const call = { from: '0x0000000000000000000000000000000000000000', to: PROVIDER, data: toFunctionSelector('getQuote()') };
    const raw = await rpc('eth_call', [call, tag]) as Hex;
    const [bidX64, askX64, referenceX64] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], raw);
    if (!(bidX64 > 0n && bidX64 < askX64 && bidX64 <= referenceX64 && referenceX64 <= askX64)) throw new Error('Invalid quote');
    records.push({ block, blockHash: header.hash, timestamp: header.timestamp, method: 'eth_call', call, raw, bidX64, askX64, referenceX64, provenance: 'HISTORICAL_BLOCK_END_PROVIDER_CALL', executionTimeQuote: false });
    console.log({ block, status: 'historical reference read' });
  } catch (e) { const method = e instanceof RpcFailure ? e.method : 'eth_call'; records.push({ block, method, status: 'UNAVAILABLE', error: e instanceof RpcFailure ? e.message : 'Quote validation failed' }); console.log({ block, method, status: 'UNAVAILABLE' }); }
}
writeFileSync(new URL('valuation-inputs.json', folder), JSON.stringify({ convention: 'On-chain provider reference at cashflow block end and fixed endpoint; values in USDT-equivalent, not independently verified USD; gas excluded', records }, (_, n) => typeof n === 'bigint' ? n.toString() : n, 2) + '\n');
