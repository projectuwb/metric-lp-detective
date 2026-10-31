import { readFileSync, statSync } from 'node:fs';
import { positionIdentity } from '../lib/domain/position.js';
import { context, submit } from '../lib/analysis/store.js';
const file = process.argv[process.argv.indexOf('--file') + 1];
if (process.env.VERCEL || !process.argv.includes('--file') || !file || statSync(file).size > 4096) throw new Error('Use --file with a small downloaded owner analysis request');
const request = JSON.parse(readFileSync(file, 'utf8')), current = context();
if (request.schema !== 1 || JSON.stringify(request.context) !== JSON.stringify(current)) throw new Error('Request uses a different indexed head/accounting version. Download a current request.');
const id = positionIdentity(request.positionId);
const position = JSON.parse(readFileSync('.web-data/positions.json', 'utf8')).find((p: any) => p.id === id);
if (!position) throw new Error('Position is not in this fixed pool index');
if (position.status === 'reconciled') { console.log(JSON.stringify({ accepted: false, replayAvailable: true, message: 'Verified replay already published; no job or RPC work created.' })); process.exit(0); }
const { job, created } = submit(id, current);
console.log(JSON.stringify({ accepted: true, created, key: job.key, status: job.status, message: 'Persisted locally. Run npm run beta to process; no hosted queue or production deployment was created.' }));
