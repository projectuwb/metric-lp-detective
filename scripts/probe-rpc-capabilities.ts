// Read-only owner-approved research. No account/payment/management API exists here.
import { readFileSync, existsSync } from 'node:fs';
import { decodeFunctionData, decodeAbiParameters, keccak256, type Hex } from 'viem';
import { gunzipSync } from 'node:zlib';
import { configuredRpc, checkedLogs, RpcFailure, type RpcObservation } from '../lib/chain/rpc';
import { sourceAbi } from '../lib/chain/decode';
import { POOL, RUNTIME_CODE_HASH } from '../lib/chain/poolConfig';
import { liquidityTopics, providerFilter } from '../lib/chain/discovery';
import { executionQuotes } from '../lib/metric/oracleTrace';
import { comparableExecutionQuotes } from '../lib/chain/rpcCapabilities';
import { historyInputs } from './reconstruct-history';
import { atomicJson } from '../lib/analysis/store';

const stateFile = 'work/rpc-probe-12-attempts.json';
async function main() {
  if (process.env.LP_RPC_PROBE_APPROVED !== '12' || process.env.VERCEL) throw new Error('Explicit approval for this separate 12-attempt research probe is required');
  if (existsSync(stateFile) || existsSync('fixtures/rpc/solidrpc-free-probe.json')) throw new Error('Probe already has a durable or published attempt record; a new probe needs a separate explicit approval and research identifier');
  const report: any = { schema: 1, approvedAttempts: 12, attempts: 0, mode: 'EXISTING_ACCOUNT_READ_ONLY_RESEARCH', observedAt: new Date().toISOString(), observations: [] as RpcObservation[], results: [], newPositionVerified: false, moneyAuthorised: false };
  const save = () => atomicJson(stateFile, report);
  save();
  const rpc = configuredRpc({ beforeAttempt: () => { if (report.attempts >= 12) throw new Error('Probe budget exhausted'); report.attempts++; save(); }, observe: o => { report.observations.push(o); save(); } });
  const call = async (name: string, method: string, params: unknown[], check: (r: any) => unknown) => {
    await new Promise(resolve => setTimeout(resolve, 1000)); const start = Date.now();
    try { const result = check(await rpc(method, params)); report.results.push({ name, method, status: 'PASS', milliseconds: Date.now() - start, result }); save(); return true; }
    catch (e) { report.results.push({ name, method, status: 'FAILED', milliseconds: Date.now() - start, error: e instanceof RpcFailure ? { kind: e.kind, code: e.code } : 'Independent fixture/capability check failed' }); save(); if (!(e instanceof RpcFailure) || e.kind !== 'range') throw new Error('Probe stopped on method/capability failure; details redacted'); return false; }
  };
  try {
    await call('chain and quota observation', 'eth_chainId', [], result => { if (result !== '0x38') throw 0; return { chainId: 56 }; });
    const quota = report.observations.at(-1);
    if (quota.quotaWindow !== 'day' || quota.quotaLimit !== 10000 || !Number.isSafeInteger(quota.quotaRemaining) || quota.quotaRemaining < 12) throw new Error('Existing-key Free quota not established; no further probe calls sent');
    const h = historyInputs();
    await call('finalised chain head', 'eth_getBlockByNumber', ['finalized', false], r => { if (!r?.hash || !r?.number) throw 0; return { block: BigInt(r.number).toString(), hash: r.hash, gapFromPinnedHead: String(BigInt(r.number) - BigInt(h.acquisition.to)) }; });
    await call('pinned canonical head', 'eth_getBlockByNumber', ['0x' + BigInt(h.acquisition.to).toString(16), false], r => { if (r?.hash !== h.acquisition.endHash) throw 0; return { block: h.acquisition.to, hash: r.hash }; });
    await call('verified pool runtime', 'eth_getCode', [POOL, '0x' + BigInt(h.acquisition.to).toString(16)], r => { if (keccak256(r) !== RUNTIME_CODE_HASH) throw 0; return { runtimeHash: RUNTIME_CODE_HASH }; });
    const from = 129628000n;
    const fields = (logs: any[]) => logs.map(l => [l.address.toLowerCase(), BigInt(l.blockNumber).toString(), l.blockHash, l.transactionHash, BigInt(l.logIndex).toString(), l.topics, l.data]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    for (const size of [1000n, 5000n, 10000n, 30000n]) {
      const to = from + size - 1n;
      const ok = await call('historical liquidity range ' + size, 'eth_getLogs', [{ address: POOL, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16), topics: [liquidityTopics] }], r => {
        const logs = checkedLogs(r, from, to), expected = h.logs.filter(l => BigInt(l.blockNumber) >= from && BigInt(l.blockNumber) <= to && liquidityTopics.includes(l.topics[0] as Hex));
        if (JSON.stringify(fields(logs)) !== JSON.stringify(fields(expected))) throw 0;
        return { from: String(from), through: String(to), blocks: String(size), logCount: logs.length, matchesPinnedIndexExactly: true };
      });
      if (!ok) break;
    }
    const provider = '0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba', to = from + 29999n;
    // Targeted response must independently match the saved complete pool index.
    if (report.results.some((r: any) => r.name === 'historical liquidity range 30000' && r.status === 'PASS')) await call('targeted provider 30000', 'eth_getLogs', [{ address: POOL, fromBlock: '0x' + from.toString(16), toBlock: '0x' + to.toString(16), topics: providerFilter(provider) }], r => {
      const logs = checkedLogs(r, from, to), expected = h.logs.filter(l => BigInt(l.blockNumber) >= from && BigInt(l.blockNumber) <= to && liquidityTopics.includes(l.topics[0] as Hex) && l.topics[1] === providerFilter(provider)[1]);
      if (JSON.stringify(fields(logs)) !== JSON.stringify(fields(expected))) throw 0;
      return { from: String(from), through: String(to), logCount: logs.length, matchesPinnedIndexExactly: true };
    });
    const root = 'fixtures/positions/145ef95b632fc382/', states = JSON.parse(readFileSync(root + 'states.json', 'utf8')), marks = JSON.parse(readFileSync(root + 'marks.json', 'utf8'));
    const mark = marks.find((m: any) => m.result);
    await call('historical eth_call reference', 'eth_call', [mark.request, '0x' + BigInt(mark.block).toString(16)], r => { if (r !== mark.result) throw 0; return { block: mark.block, matchesSavedQuote: true }; });
    const state = states[0], abi = h.abi.filter((e: any) => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
    const decoded = decodeFunctionData({ abi, data: state.call.data }), slots = decoded.args![0] as Hex[], words = decodeAbiParameters([{ type: 'bytes32[]' }], state.raw)[0];
    await call('historical archive storage', 'eth_getStorageAt', [POOL, slots[0], '0x' + BigInt(state.block).toString(16)], r => { if (BigInt(r) !== BigInt(words[0])) throw 0; return { block: state.block, matchesSavedStorage: true }; });
    const tx = '0xe7f667bc4e71febdb65fc026eb3b6f0ec6ddb95ddcd7b060b6ed2ba835265af0';
    const witness = JSON.parse(gunzipSync(readFileSync(root + 'traces/' + tx + '.json.gz')).toString());
    await call('historical callTracer compatibility', 'debug_traceTransaction', [tx, { tracer: 'callTracer', timeout: '15s' }], r => { if (JSON.stringify(comparableExecutionQuotes(executionQuotes(r))) !== JSON.stringify(comparableExecutionQuotes(executionQuotes(witness)))) throw 0; return { transactionHash: tx, matchesSavedExecutionWitness: true }; });
    report.status = 'COMPLETED';
  } catch { report.status = 'STOPPED'; }
  save(); console.log(JSON.stringify(report));
}
main().catch(() => { console.error('RPC probe refused or failed; details redacted. Inspect the local sanitized attempt record.'); process.exitCode = 1; });
