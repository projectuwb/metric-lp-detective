import { readFileSync } from 'node:fs';
import { configuredRpc, getPoolLogs, RpcFailure, type RawLog } from '../lib/chain/rpc.js';
import { POOL } from '../lib/chain/poolConfig.js';
import { keccak256 } from 'viem';

// Fixed public audit targets; no wallet-query persistence and no endpoint output.
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/raw/${name}`, import.meta.url), 'utf8'));
const manifest = read('manifest.json');
const identity = read('code-and-identity.json');
let method = 'configuration';
try {
  const transport = configuredRpc();
  const rpc = async (name: string, params: unknown[]) => { method = name; return transport(name, params); };
  if (await rpc('eth_chainId', []) !== '0x38') throw new Error('Wrong chain');
  const head = await rpc('eth_blockNumber', []);
  if (typeof head !== 'string') throw new Error('Invalid head');
  console.log(JSON.stringify({ method: 'eth_chainId', chainId: 56, head: BigInt(head).toString() }));
  for (const [block, expected] of [[BigInt(manifest.deploymentBlock) - 1n, '0x'], [BigInt(manifest.deploymentBlock), identity.codeAtDeployment]] as const) {
    if (await rpc('eth_getCode', [POOL, `0x${block.toString(16)}`]) !== expected) throw new Error('Historical code differs from fixture');
  }
  for (const entry of manifest.receiptFiles as { file: string; tx: string; blockNumber: string }[]) {
    const expected = read(entry.file);
    const actual = await rpc('eth_getTransactionReceipt', [entry.tx]) as typeof expected;
    if (!actual || actual.status !== '0x1' || actual.transactionHash !== expected.transactionHash || actual.blockHash !== expected.blockHash || actual.blockNumber !== expected.blockNumber) throw new Error('Receipt identity mismatch');
    const fields = (logs: RawLog[]) => logs.map(l => [l.address.toLowerCase(), l.topics, l.data, l.logIndex, l.transactionIndex]);
    if (JSON.stringify(fields(actual.logs)) !== JSON.stringify(fields(expected.logs))) throw new Error('Receipt log mismatch');
    const block = await rpc('eth_getBlockByNumber', [actual.blockNumber, false]) as { hash: string };
    if (block.hash !== actual.blockHash) throw new Error('Canonical block mismatch');
    console.log(JSON.stringify({ method: 'eth_getTransactionReceipt', transactionHash: entry.tx, status: 'matched' }));
  }
  for (const candidate of manifest.candidates as { blockNumber: string; transactionHash: string; logIndex: number }[]) {
    const block = BigInt(candidate.blockNumber);
    const logs = await getPoolLogs(rpc, block, block);
    if (!logs.some(l => l.transactionHash === candidate.transactionHash && BigInt(l.logIndex) === BigInt(candidate.logIndex))) throw new Error('Deposit absent from bounded log query');
  }
  const recent = manifest.coverage.allEventsRecent;
  const logs = await getPoolLogs(rpc, BigInt(recent.from), BigInt(recent.to));
  if (logs.length !== recent.count) throw new Error('Historical range count changed');
  console.log(JSON.stringify({ method: 'eth_getLogs', from: recent.from, to: recent.to, count: logs.length, status: 'matched' }));
  console.log(JSON.stringify({ verifiedHistoricalFixtures: true, runtimeCodeHash: keccak256(identity.runtimeCode) }));
} catch (error) {
  // Transport failures are already redacted; all other messages here are fixed strings.
  console.error(`${method}: ${error instanceof RpcFailure ? error.message : 'Verification failed (identity, receipt or coverage mismatch); details redacted'}`);
  process.exitCode = 1;
}
