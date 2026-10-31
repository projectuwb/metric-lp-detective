import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { configuredRpc, checkedLogs, RpcFailure, type RawLog } from '../lib/chain/rpc.js';
import { POOL, DEPLOYMENT_BLOCK, RUNTIME_CODE_HASH } from '../lib/chain/poolConfig.js';
import { keccak256, type Hex } from 'viem';

const root = new URL('../fixtures/history/', import.meta.url);
const cache = new URL('../artifacts/history-pages/', import.meta.url);
const save = (path: URL, v: unknown) => writeFileSync(path, JSON.stringify(v));
mkdirSync(root, { recursive: true }); mkdirSync(cache, { recursive: true });
let method = 'configuration';
try {
  const transport = configuredRpc();
  const rpc = async (m: string, args: unknown[]) => { method = m; return transport(m, args); };
  if (await rpc('eth_chainId', []) !== '0x38') throw new Error('Wrong chain');
  const manifestPath = new URL('acquisition.json', root);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { chainId: 56, pool: POOL, from: DEPLOYMENT_BLOCK.toString(), to: (BigInt(await rpc('eth_blockNumber', []) as string) - 200n).toString(), observedAt: new Date().toISOString(), status: 'INCOMPLETE', pages: [] };
  const end = BigInt(manifest.to);
  const header = await rpc('eth_getBlockByNumber', [`0x${end.toString(16)}`, false]) as { hash: string };
  if (manifest.endHash && manifest.endHash !== header.hash) throw new Error('Endpoint block changed');
  manifest.endHash = header.hash; save(manifestPath, manifest);
  const code = await rpc('eth_getCode', [POOL, `0x${end.toString(16)}`]) as Hex;
  if (keccak256(code) !== RUNTIME_CODE_HASH) throw new Error('Pool source identity changed');
  async function page(from: bigint, to: bigint): Promise<RawLog[]> {
    for (let attempt = 0; ; attempt++) {
      try {
        const logs = checkedLogs(await rpc('eth_getLogs', [{ address: POOL, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}` }]), from, to);
        if (logs.length >= 1000) throw new RpcFailure('range');
        return logs;
      } catch (e) {
        if (e instanceof RpcFailure && e.kind === 'range' && from < to) { const mid = (from + to) / 2n; return [...await page(from, mid), ...await page(mid + 1n, to)]; }
        if (!(e instanceof RpcFailure) || !['rate', 'temporary'].includes(e.kind) || attempt >= 3) throw e;
        await new Promise(r => setTimeout(r, 250 * 2 ** attempt));
      }
    }
  }
  const ranges: [bigint, bigint][] = [];
  for (let start = DEPLOYMENT_BLOCK; start <= end; start += 10000n) ranges.push([start, start + 9999n < end ? start + 9999n : end]);
  let cursor = 0, completed = 0;
  const records: { from: string; to: string; count: number }[] = [];
  async function worker() {
    for (;;) {
      const index = cursor++; if (index >= ranges.length) return;
      const [from, to] = ranges[index], file = new URL(`${from}-${to}.json`, cache);
      const logs = existsSync(file) ? checkedLogs(JSON.parse(readFileSync(file, 'utf8')), from, to) : await page(from, to);
      if (!existsSync(file)) save(file, logs);
      records[index] = { from: String(from), to: String(to), count: logs.length };
      if (++completed % 25 === 0) console.log(JSON.stringify({ pages: completed, total: ranges.length }));
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const logs = ranges.flatMap(([from, to]) => JSON.parse(readFileSync(new URL(`${from}-${to}.json`, cache), 'utf8')) as RawLog[]);
  const verifyHeader = await rpc('eth_getBlockByNumber', [`0x${end.toString(16)}`, false]) as { hash: string };
  if (verifyHeader.hash !== header.hash) throw new Error('Endpoint reorg; acquisition invalid');
  writeFileSync(new URL('pool-logs.json.gz', root), gzipSync(JSON.stringify(logs)));
  manifest.status = 'ACQUIRED_NOT_RECONCILED'; manifest.pages = records; manifest.logCount = logs.length;
  save(manifestPath, manifest);
  console.log(JSON.stringify({ ...manifest, pages: records.length }));
} catch (e) { console.error(JSON.stringify({ method, error: e instanceof RpcFailure ? e.message : 'Acquisition failed; no complete coverage claimed' })); process.exitCode = 1; }
