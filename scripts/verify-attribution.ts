import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { decodeFunctionData, decodeFunctionResult, type Abi } from 'viem';
import { replayPool, portfolio, positionId, snapshot, type Bin, type Transition } from '../lib/metric/positionLedger.js';
import { DEPLOYMENT_BLOCK, POOL } from '../lib/chain/poolConfig.js';

const folder = new URL('../fixtures/attribution/', import.meta.url);
const read = (name: string) => JSON.parse(readFileSync(new URL(name, folder), 'utf8'));
const stringJson = (v: unknown) => JSON.stringify(v, (_, n) => typeof n === 'bigint' ? n.toString() : n, 2) + '\n';
class MissingEvidence extends Error {}
const required = <T>(value: T | undefined, name: string): T => { if (value === undefined) throw new MissingEvidence(name); return value; };
const empty = (): Bin => ({ reserve0: 0n, reserve1: 0n, totalShares: 0n, positions: new Map() });

export function validateAttribution() {
  const source = read('pool-logs.json'), historical = read('historical-state.json');
  const abi: Abi = JSON.parse(readFileSync(new URL('../fixtures/abi/MetricOmmPool.json', import.meta.url), 'utf8'));
  const batchAbi = abi.filter(e => e.type === 'function' && e.name === 'extsload' && e.inputs.length === 1 && e.inputs[0].type === 'bytes32[]');
  assert.equal(BigInt(source.from), DEPLOYMENT_BLOCK, 'Replay must begin at deployment, not at a recent window');
  const full = replayPool(source.logs, abi);
  const primary = required([...full.positions.keys()][0], 'Primary position missing');
  const secondary = required([...full.positions.keys()][1], 'Secondary position missing');
  const snapshots = new Map<string, any>((historical.snapshots as any[]).map(s => [s.block, s]));
  let storageComparisons = 0, quoteComparisons = 0;
  for (const s of historical.snapshots) {
    const state = replayPool(source.logs.filter((l: any) => BigInt(l.blockNumber) <= BigInt(s.block)), abi);
    const decoded = decodeFunctionResult({ abi: batchAbi, functionName: 'extsload', data: s.raw }) as readonly string[];
    assert.equal(decoded.length, 80, 'Incomplete batch storage evidence');
    let cursor = 0;
    for (const row of s.reserves) {
      const bin = state.bins.get(BigInt(row.bin)) ?? empty(), raw = BigInt(decoded[cursor++]);
      assert.equal(raw & ((1n << 104n) - 1n), BigInt(row.reserve0), 'Decoded reserve0 differs from raw response');
      assert.equal(raw >> 104n & ((1n << 104n) - 1n), BigInt(row.reserve1), 'Decoded reserve1 differs from raw response');
      assert.equal(BigInt(decoded[cursor++]), BigInt(row.totalShares), 'Decoded total shares differs from raw response');
      assert.equal(bin.reserve0, BigInt(row.reserve0), `reserve0 mismatch at ${s.block}/${row.bin}`);
      assert.equal(bin.reserve1, BigInt(row.reserve1), `reserve1 mismatch at ${s.block}/${row.bin}`);
      assert.equal(bin.totalShares, BigInt(row.totalShares), `total shares mismatch at ${s.block}/${row.bin}`);
      storageComparisons += 3;
      for (const [i, p] of historical.positions.entries()) {
        const key = positionId({ owner: p.owner, salt: BigInt(p.salt) });
        const rawShares = BigInt(decoded[cursor++]);
        assert.equal(rawShares, BigInt(row.shares[i]));
        assert.equal(bin.positions.get(key) ?? 0n, rawShares, `position shares mismatch at ${s.block}/${row.bin}`);
        storageComparisons++;
      }
    }
    const bin1Word = decoded[11 * 4]; // bins -10..9, four slots per bin
    assert.equal(s.directStorage.raw, bin1Word, 'Independent eth_getStorageAt disagrees with extsload');
    for (const q of s.quotes) {
      if (q.error) throw new MissingEvidence(`Historical removal eth_call failed at ${s.block}`);
      const key = positionId({ owner: q.position.owner, salt: BigInt(q.position.salt) });
      assert.equal(q.call.from.toLowerCase(), q.position.owner.toLowerCase(), 'Withdrawal quote caller differs from position owner');
      assert.equal(q.call.to, POOL, 'Withdrawal quote targets another contract');
      const decodedCall = decodeFunctionData({ abi, data: q.call.data });
      assert.equal(decodedCall.functionName, 'removeLiquidity');
      const [owner, salt, deltas, extensionData] = decodedCall.args as readonly [string, bigint, { binIdxs: bigint[]; shares: bigint[] }, string];
      assert.equal(owner.toLowerCase(), q.position.owner.toLowerCase());
      assert.equal(salt, BigInt(q.position.salt));
      assert.equal(extensionData, '0x');
      const requested = [...state.bins.entries()].sort(([a], [b]) => a < b ? -1 : 1).filter(([bin, value]) => (value.positions.get(key) ?? 0n) > 0n && (q.choice === 'full' || bin === BigInt(q.choice.slice(3))));
      assert.deepEqual(deltas.binIdxs, requested.map(([bin]) => bin));
      assert.deepEqual(deltas.shares, requested.map(([, bin]) => bin.positions.get(key)));
      const expected = q.choice === 'full' ? portfolio(state.bins, key) : snapshot(state.bins.get(BigInt(q.choice.slice(3))) ?? empty()).entitlements[key] ?? [0n, 0n];
      const actual = decodeFunctionResult({ abi, functionName: 'removeLiquidity', data: q.result }) as readonly bigint[];
      assert.deepEqual([...actual], expected, `Historical withdrawal execution differs at ${s.block}/${q.choice}`);
      assert.deepEqual(q.amounts.map(BigInt), expected);
      quoteComparisons++;
    }
  }
  // Full receipts independently confirm that every retrieved event is genuine and
  // that no pool log in any sampled transaction was omitted by the range reader.
  for (const tx of new Set<string>(source.logs.map((l: any) => l.transactionHash))) {
    const receipt = read(`receipts/${tx}.json`);
    assert.equal(receipt.status, '0x1');
    const poolLogs = receipt.logs.filter((l: any) => l.address.toLowerCase() === source.pool.toLowerCase());
    const queried = source.logs.filter((l: any) => l.transactionHash === tx);
    assert.equal(queried.length, poolLogs.length, 'Receipt contains omitted pool logs');
    for (const log of queried) {
      assert.equal(log.blockHash, receipt.blockHash);
      assert.equal(snapshots.get(BigInt(log.blockNumber).toString())?.blockHash ?? log.blockHash, log.blockHash);
      const fromReceipt = poolLogs.find((l: any) => l.logIndex === log.logIndex);
      assert.ok(fromReceipt, 'Queried log missing from receipt');
      assert.deepEqual([log.data, log.topics, log.transactionIndex], [fromReceipt.data, fromReceipt.topics, receipt.transactionIndex]);
    }
  }
  function quoteAt(block: bigint, key: string, bin: bigint | 'full'): [bigint, bigint] {
    const s = required(snapshots.get(block.toString()), `Snapshot ${block} missing`);
    const q = required<any>(s.quotes.find((q: any) => positionId({ owner: q.position.owner, salt: BigInt(q.position.salt) }) === key && q.choice === (bin === 'full' ? 'full' : `bin${bin}`)), 'Independent quote missing');
    if (q.error) throw new MissingEvidence('Independent quote failed');
    return q.amounts.map(BigInt) as [bigint, bigint];
  }
  function verifyLeg(t: Transition, key: string) {
    // Suitable examples have exactly one relevant transition in this bin/block;
    // otherwise a block-end read cannot validate an intra-block boundary.
    assert.equal(full.transitions.filter(r => r.bin === t.bin && r.block === t.block).length, 1);
    const before = quoteAt(t.block - 1n, key, t.bin), after = quoteAt(t.block, key, t.bin);
    assert.deepEqual(t.before.entitlements[key], before);
    assert.deepEqual(t.after.entitlements[key], after);
    assert.deepEqual(t.positionDelta[key], [after[0] - before[0], after[1] - before[1]]);
    return { transactionHash: t.transactionHash, block: t.block, logIndex: t.logIndex, bin: t.bin, before: t.before, after: t.after, poolDelta: t.poolDelta, positionDelta: t.positionDelta, fee: t.fee, independentlyQuotedBefore: before, independentlyQuotedAfter: after };
  }
  const results: Record<string, { status: 'PASS' | 'FAIL' | 'NOT VERIFIED'; evidence?: unknown; reason?: string }> = {};
  function check(name: string, run: () => unknown) {
    try { results[name] = { status: 'PASS', evidence: run() }; }
    catch (error) { results[name] = { status: error instanceof MissingEvidence ? 'NOT VERIFIED' : 'FAIL', reason: error instanceof Error ? error.message : 'Unknown validation failure' }; }
  }
  check('A', () => {
    const leg = required(full.transitions.find(t => t.event === 'BinSwapped' && t.before.shares[primary] === t.before.totalShares && t.before.totalShares > 0n && Object.values(t.before.shares).filter(s => s > 0n).length === 1), 'No single-position swap found');
    assert.deepEqual(leg.positionDelta[primary], leg.poolDelta);
    return verifyLeg(leg, primary);
  });
  check('B', () => {
    const leg = required(full.transitions.find(t => t.event === 'BinSwapped' && (t.before.shares[primary] ?? 0n) > 0n && (t.before.shares[secondary] ?? 0n) > 0n), 'No shared-bin swap found');
    const a = verifyLeg(leg, primary), b = verifyLeg(leg, secondary);
    assert.notDeepEqual(leg.positionDelta[primary], leg.poolDelta, 'Selected LP incorrectly allocated whole bin swap');
    const dust = (s: typeof leg.before): [bigint, bigint] => [s.reserve0 - Object.values(s.entitlements).reduce((n, p) => n + p[0], 0n), s.reserve1 - Object.values(s.entitlements).reduce((n, p) => n + p[1], 0n)];
    const beforeDust = dust(leg.before), afterDust = dust(leg.after);
    for (const i of [0, 1]) assert.equal(leg.positionDelta[primary][i] + leg.positionDelta[secondary][i] + afterDust[i] - beforeDust[i], leg.poolDelta[i]);
    return { primary: a, secondary: b, beforeDust, afterDust };
  });
  check('C', () => {
    const change = required(full.transitions.find(t => t.event === 'LiquidityAdded' && (t.before.shares[primary] ?? 0n) > 0n && (t.after.shares[secondary] ?? 0n) > (t.before.shares[secondary] ?? 0n) && t.bin === 1n), 'No competing add in a selected bin found');
    assert.equal(change.before.shares[primary], change.after.shares[primary]);
    assert.notEqual(change.before.totalShares, change.after.totalShares);
    const boundary = verifyLeg(change, primary);
    const swap = required(full.transitions.find(t => t.event === 'BinSwapped' && t.block > change.block && t.bin === change.bin), 'No subsequent swap in changed-share bin');
    assert.equal(swap.before.totalShares, change.after.totalShares);
    verifyLeg(swap, primary);
    return { competitorAdd: boundary, firstSubsequentSwap: { transactionHash: swap.transactionHash, block: swap.block, logIndex: swap.logIndex, bin: swap.bin, selectedDelta: swap.positionDelta[primary] } };
  });
  check('D', () => {
    const endpoint = BigInt(source.to);
    const independentlyExecuted = quoteAt(endpoint, primary, 'full');
    const reconstructed = portfolio(full.bins, primary);
    assert.deepEqual(reconstructed, independentlyExecuted);
    const firstAdd = required(full.transitions.find(t => t.event === 'LiquidityAdded' && (t.after.shares[primary] ?? 0n) > 0n), 'Selected deposit missing');
    const startState = replayPool(source.logs.filter((l: any) => BigInt(l.blockNumber) <= firstAdd.block), abi);
    const start = portfolio(startState.bins, primary);
    const swapDelta: [bigint, bigint] = [0n, 0n], competitorRoundingDelta: [bigint, bigint] = [0n, 0n];
    for (const t of full.transitions.filter(t => t.block > firstAdd.block)) {
      const delta = t.positionDelta[primary] ?? [0n, 0n];
      const sum = t.event === 'BinSwapped' ? swapDelta : competitorRoundingDelta;
      sum[0] += delta[0]; sum[1] += delta[1];
    }
    assert.deepEqual([start[0] + swapDelta[0] + competitorRoundingDelta[0], start[1] + swapDelta[1] + competitorRoundingDelta[1]], reconstructed);
    return { startBlock: firstAdd.block, endBlock: endpoint, startingEntitlement: start, swapDelta, competitorRoundingDelta, reconstructed, independentlyExecuted, difference: [0n, 0n], toleranceBaseUnits: '0', checkpointOnly: true };
  });
  const swaps = full.swaps.map(s => {
    const before = replayPool(source.logs.filter((l: any) => BigInt(l.blockNumber) < s.block || BigInt(l.blockNumber) === s.block && BigInt(l.logIndex) < s.legs[0].logIndex), abi);
    const after = replayPool(source.logs.filter((l: any) => BigInt(l.blockNumber) < s.block || BigInt(l.blockNumber) === s.block && BigInt(l.logIndex) <= s.logIndex), abi);
    const selectedBefore = portfolio(before.bins, primary), selectedAfter = portfolio(after.bins, primary);
    const selectedTokenDeltas = s.legs.reduce<[bigint, bigint]>((n, l) => [n[0] + (l.positionDelta[primary]?.[0] ?? 0n), n[1] + (l.positionDelta[primary]?.[1] ?? 0n)], [0n, 0n]);
    assert.deepEqual([selectedAfter[0] - selectedBefore[0], selectedAfter[1] - selectedBefore[1]], selectedTokenDeltas);
    return { ...s, selectedBefore, selectedAfter, selectedTokenDeltas, referencePrice: null, referenceReason: 'Exact provider quote at execution not recovered', legs: s.legs.map(l => ({ ...l, feeOwnershipRationals: Object.fromEntries(Object.entries(l.before.shares).map(([key, shares]) => [key, { numerator: l.fee!.lp * shares, denominator: l.before.totalShares, inputToken: l.fee!.inputToken, note: 'Economic fee share before claim rounding; already in reserves, never add again' }])), classification: (l.before.shares[primary] ?? 0n) === 0n ? 'TOUCHES_BIN_WITH_NO_SELECTED_SHARES' : l.positionDelta[primary]?.every(d => d === 0n) ? 'SELECTED_SHARES_BUT_ZERO_ROUNDED_DELTA' : 'CHANGES_SELECTED_ENTITLEMENT' })) };
  });
  const notAttributableToBackup = full.transitions.filter(t => t.event === 'BinSwapped' && (t.before.shares[secondary] ?? 0n) === 0n && (full.bins.get(t.bin)?.positions.get(secondary) ?? 0n) > 0n).map(t => ({ transactionHash: t.transactionHash, block: t.block, logIndex: t.logIndex, bin: t.bin, position: secondary, sharesAtExecution: 0n, delta: [0n, 0n], reason: 'Bin was funded by this position only later; historical ownership was zero' }));
  return { sourceRevision: 'ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3', coverage: { from: source.from, to: source.to, logCount: source.logs.length, swapCount: full.swaps.length, binStepCount: full.swaps.reduce((n, s) => n + s.legs.length, 0), unknownEvents: 0 }, primary, secondary, results, storageComparisons, quoteComparisons, swaps, notAttributableToBackup, ignored: full.ignored, fixtures: ['pool-logs.json', 'historical-state.json'].map(file => ({ file, sha256: createHash('sha256').update(readFileSync(new URL(file, folder))).digest('hex') })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = validateAttribution();
    writeFileSync(new URL('validation-results.json', folder), stringJson(report));
    mkdirSync(new URL('../fixtures/expected/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../fixtures/expected/preferred-position-checkpoint.json', import.meta.url), stringJson({ position: report.primary, ...report.results.D }));
    console.log(stringJson({ results: Object.fromEntries(Object.entries(report.results).map(([name, r]) => [name, r.status])), coverage: report.coverage, storageComparisons: report.storageComparisons, quoteComparisons: report.quoteComparisons, final: report.results.D }));
    if (Object.values(report.results).some(r => r.status !== 'PASS')) process.exitCode = 1;
  } catch (error) {
    const status = error instanceof MissingEvidence || error instanceof SyntaxError || (error as { code?: string })?.code === 'ENOENT' ? 'NOT VERIFIED' : 'FAIL';
    const reason = 'Global fixture/state integrity check did not pass; no individual test success is asserted';
    writeFileSync(new URL('validation-results.json', folder), stringJson({ results: Object.fromEntries(['A', 'B', 'C', 'D'].map(name => [name, { status, reason }])) }));
    mkdirSync(new URL('../fixtures/expected/', import.meta.url), { recursive: true });
    writeFileSync(new URL('../fixtures/expected/preferred-position-checkpoint.json', import.meta.url), stringJson({ status, reason }));
    console.error(`${status}: ${reason}. Inspect fixture completeness and typecheck.`);
    process.exitCode = 1;
  }
}
