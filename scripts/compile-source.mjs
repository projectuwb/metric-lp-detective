// Compile the pinned public core checkout; no RPC credentials are accessed here.
import solc from 'solc';
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
const root = resolve(process.argv[2] ?? '/workspace/scratch/metric-pool-contracts');
const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (revision !== 'ddf8ae0cdb2ad0041c3ff3aebc200cf488d5b0d3') throw new Error('Unexpected source revision');
execFileSync('git', ['-C', root, 'diff', '--exit-code', 'HEAD', '--', 'contracts', 'foundry.toml'], { stdio: 'pipe' });
const dependencyRoot = resolve(root, 'lib/openzeppelin-contracts');
const dependencyRevision = execFileSync('git', ['-C', dependencyRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (dependencyRevision !== 'dde766bd542e4a1695fe8e4a07dc03b77305f367') throw new Error('Unexpected OpenZeppelin revision');
execFileSync('git', ['-C', dependencyRoot, 'diff', '--exit-code', 'HEAD', '--', 'contracts'], { stdio: 'pipe' });
const sources = {};
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith('.sol')) sources[relative(root, path)] = { content: readFileSync(path, 'utf8') };
  }
}
walk(resolve(root, 'contracts'));
const settings = {
  optimizer: { enabled: true, runs: 1999 }, viaIR: true, evmVersion: 'cancun',
  metadata: { bytecodeHash: 'none' },
  outputSelection: { '*': { '*': ['abi', 'evm.deployedBytecode', 'evm.bytecode', 'metadata'] } },
};
const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings }), {
  import: path => {
    if (!path.startsWith('@openzeppelin/contracts/')) return { error: 'Unsupported dependency' };
    return { contents: readFileSync(resolve(root, 'lib/openzeppelin-contracts/contracts', path.slice('@openzeppelin/contracts/'.length)), 'utf8') };
  },
}));
const errors = output.errors?.filter(e => e.severity === 'error') ?? [];
if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/compiled-core.json', JSON.stringify(output));
console.log(JSON.stringify({ revision, compiler: solc.version(), poolBytes: output.contracts['contracts/MetricOmmPool.sol'].MetricOmmPool.evm.deployedBytecode.object.length / 2 }));
