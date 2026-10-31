import { configuredRpc, getPoolLogs, RpcFailure } from '../lib/chain/rpc.js';
import { POOL, TOKEN0, TOKEN1, RUNTIME_CODE_HASH, DEPLOYMENT_BLOCK } from '../lib/chain/poolConfig.js';
import { decodeAbiParameters, keccak256, toFunctionSelector, type Hex } from 'viem';

let method = 'configuration';
try {
  const transport = configuredRpc();
  const rpc = async (name: string, params: unknown[]) => { method = name; return transport(name, params); };
  if (await rpc('eth_chainId', []) !== '0x38') throw new Error('Wrong chain: BNB Chain 56 required');
  const [from, to] = process.argv.slice(2);
  if (!from || !to || !/^\d+$/.test(from) || !/^\d+$/.test(to)) throw new Error('Usage: npm run audit:rpc -- FROM_BLOCK TO_BLOCK (explicit decimal blocks)');
  if (BigInt(from) < DEPLOYMENT_BLOCK) throw new Error('Start precedes verified pool deployment');
  const block = `0x${BigInt(to).toString(16)}`;
  const code = await rpc('eth_getCode', [POOL, block]);
  if (typeof code !== 'string' || code === '0x') throw new Error('No code at candidate pool in requested end block');
  if (keccak256(code as Hex) !== RUNTIME_CODE_HASH) throw new Error('Pool runtime differs from verified source fixture');
  const raw = await rpc('eth_call', [{ to: POOL, data: toFunctionSelector('getImmutables()') }, block]);
  if (typeof raw !== 'string') throw new Error('Missing pool immutables');
  const [factory, token0, token1] = decodeAbiParameters([{ type: 'address' }, { type: 'address' }, { type: 'address' }], raw as Hex);
  if (factory.toLowerCase() !== '0x2a53833cc95548cf52c7b159110e22d3a9018f32' || token0 !== TOKEN0 || token1 !== TOKEN1) throw new Error('Pool immutable token/factory identity mismatch');
  for (const token of [TOKEN0, TOKEN1]) {
    const decimals = await rpc('eth_call', [{ to: token, data: toFunctionSelector('decimals()') }, block]);
    if (typeof decimals !== 'string' || BigInt(decimals) !== 18n) throw new Error('Token decimals differ from verified fixture');
  }
  const logs = await getPoolLogs(rpc, BigInt(from), BigInt(to), { progress: p => console.error(JSON.stringify(p)) });
  console.log(JSON.stringify({ chainId: 56, pool: POOL, verifiedIdentity: true, from, to, count: logs.length, logs }, null, 2));
} catch (error) {
  console.error(`${method}: ${error instanceof RpcFailure ? error.message : 'Audit failed (invalid input, identity mismatch or incomplete coverage); details redacted'}`);
  process.exitCode = 1;
}
