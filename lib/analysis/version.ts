import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
export function accountingVersion() {
  const hash = createHash('sha256');
  for (const file of ['lib/metric/positionLedger.ts', 'lib/metric/positionReplay.ts', 'lib/metric/valuation.ts', 'lib/metric/rational.ts', 'lib/metric/outcome.ts', 'lib/chain/decode.ts', 'fixtures/abi/MetricOmmPool.json', 'lib/analysis/bundle.ts', 'scripts/verify-position.ts', 'lib/analysis/version.ts']) hash.update(readFileSync(file));
  return hash.digest('hex');
}
