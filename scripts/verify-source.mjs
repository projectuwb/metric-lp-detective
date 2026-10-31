import { readFileSync, writeFileSync } from 'node:fs';
import { keccak256 } from 'viem';
const compiled = JSON.parse(readFileSync('artifacts/compiled-core.json', 'utf8'));
const raw = JSON.parse(readFileSync('fixtures/raw/code-and-identity.json', 'utf8'));
const pool = compiled.contracts['contracts/MetricOmmPool.sol'].MetricOmmPool.evm.deployedBytecode;
function normalize(hex, refs) {
  let value = hex.replace(/^0x/, '');
  for (const { start, length } of refs) value = value.slice(0, start * 2) + '0'.repeat(length * 2) + value.slice((start + length) * 2);
  return value;
}
const immutableRegions = Object.values(pool.immutableReferences).flat();
const links = Object.values(pool.linkReferences).flatMap(libs => Object.values(libs).flat());
const library = compiled.contracts['contracts/libraries/LiquidityLib.sol'].LiquidityLib.evm.deployedBytecode;
const guardRegions = Object.values(library.immutableReferences).flat();
const poolMatch = normalize(raw.runtimeCode, [...immutableRegions, ...links]) === normalize(pool.object, [...immutableRegions, ...links]);
const libraryMatch = normalize(raw.libraryRuntimeCode, guardRegions) === normalize(library.object, guardRegions);
const linkAddressesMatch = links.every(r => '0x' + raw.runtimeCode.slice(2 + r.start * 2, 2 + (r.start + r.length) * 2) === raw.libraryAddress);
const libraryGuardMatch = guardRegions.every(r => BigInt('0x' + raw.libraryRuntimeCode.slice(2 + r.start * 2, 2 + (r.start + r.length) * 2)) === BigInt(raw.libraryAddress));
const report = {
  sourceRevision: 'ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3',
  openzeppelinRevision: 'dde766bd542e4a1695fe8e4a07dc03b77305f367',
  compiler: '0.8.35+commit.47b9dedd',
  settings: { optimizerRuns: 1999, viaIR: true, evmVersion: 'cancun', bytecodeHash: 'none' },
  poolMatch, libraryMatch, linkAddressesMatch, libraryGuardMatch,
  poolCodeHash: keccak256(raw.runtimeCode), libraryCodeHash: keccak256(raw.libraryRuntimeCode),
  poolBytes: (raw.runtimeCode.length - 2) / 2, libraryBytes: (raw.libraryRuntimeCode.length - 2) / 2,
  immutableReferences: pool.immutableReferences, linkReferences: pool.linkReferences,
  libraryImmutableReferences: library.immutableReferences,
  normalization: 'Only compiler-declared immutable and link regions masked; library link and self-address verified separately; pool immutable values saved from getImmutables.',
};
if (![poolMatch, libraryMatch, linkAddressesMatch, libraryGuardMatch].every(Boolean)) throw new Error('Source/runtime comparison failed');
writeFileSync('fixtures/raw/source-match.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ poolMatch, libraryMatch, linkAddressesMatch, libraryGuardMatch, codeHash: report.poolCodeHash }));
