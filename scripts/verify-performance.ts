import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeAbiParameters } from 'viem';
import { performance, formatUsdt, type Flow } from '../lib/metric/valuation.js';
import { PROVIDER, QUOTE_SELECTOR } from '../lib/metric/oracleTrace.js';
export function verifiedPerformance() {
  const folder = new URL('../fixtures/history/', import.meta.url);
  const h = JSON.parse(readFileSync(new URL('position-history.json', folder), 'utf8'));
  const inputs = JSON.parse(readFileSync(new URL('valuation-inputs.json', folder), 'utf8'));
  const states = JSON.parse(readFileSync(new URL('historical-state.json', folder), 'utf8')).states;
  const prices = new Map<string, bigint>();
  for (const r of inputs.records) {
    if (r.status === 'UNAVAILABLE') continue;
    if (r.call.to !== PROVIDER || r.call.data !== QUOTE_SELECTOR || states.find((s: any) => s.block === r.block)?.blockHash !== r.blockHash) throw new Error('Valuation call target or historical block differs');
    const [bid, ask, reference] = decodeAbiParameters([{ type: 'uint128' }, { type: 'uint128' }, { type: 'uint128' }], r.raw);
    if (bid <= 0n || bid >= ask || reference < bid || reference > ask || reference !== BigInt(r.referenceX64) || r.provenance !== 'HISTORICAL_BLOCK_END_PROVIDER_CALL' || r.executionTimeQuote !== false) throw new Error('Valuation provenance mismatch');
    prices.set(r.block, reference);
  }
  const aggregate = new Map<string, [bigint, bigint]>();
  for (const row of h.funding) { const tokens = aggregate.get(row.block) ?? [0n, 0n]; tokens[0] += BigInt(row.tokenDelta[0]); tokens[1] += BigInt(row.tokenDelta[1]); aggregate.set(row.block, tokens); }
  const flows: Flow[] = [...aggregate].map(([block, tokens]) => ({ block, tokens }));
  return { flows, result: performance(h.final.map(BigInt), flows, prices, h.through) };
}
if (process.argv[1]?.endsWith('verify-performance.ts')) {
  try {
    const report = verifiedPerformance(); const r = report.result;
    const display = r.status === 'DERIVED_FROM_VERIFIED_INPUTS' ? { finalValue: formatUsdt(r.finalValue), cashflowPnl: formatUsdt(r.cashflowPnl), holdingPnl: r.holdingPnl === null ? null : formatUsdt(r.holdingPnl), vsHolding: r.vsHolding === null ? null : formatUsdt(r.vsHolding), unit: 'USDT-equivalent; six decimals truncated toward zero' } : null;
    writeFileSync(new URL('../fixtures/history/performance.json', import.meta.url), JSON.stringify({ ...report, display }, (_, n) => typeof n === 'bigint' ? n.toString() : n, 2) + '\n');
    console.log(JSON.stringify({ status: r.status, display }));
  } catch { console.error('Performance verification failed; no result asserted'); process.exitCode = 1; }
}
