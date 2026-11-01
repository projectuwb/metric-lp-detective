import { positionIdentity } from '../lib/domain/position';
import { offlinePreflight } from '../lib/analysis/preflight';
console.log(JSON.stringify(offlinePreflight(positionIdentity(process.argv[2] ?? '')), null, 2));
