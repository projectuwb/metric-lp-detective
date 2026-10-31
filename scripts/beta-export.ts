import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { atomicJson, getJob, jobFolder } from '../lib/analysis/store.js';
import { verifyPosition } from './verify-position.js';
const key = process.argv[process.argv.indexOf('--job') + 1];
if (!process.argv.includes('--job')) throw new Error('Use --job with a verified owner-beta job identifier');
const job = getJob(key); if (!job || job.status !== 'VERIFIED') throw new Error('Only an independently verified, unexpired job can be published');
const source = path.join(jobFolder(key), 'capture'); verifyPosition(job.slug, pathToFileURL(source + '/'));
const destination = path.join('fixtures/positions', job.slug);
if (existsSync(destination)) { const old = verifyPosition(job.slug); if (old.config.id !== job.id || old.config.indexEndHash !== job.context.indexEndHash || old.config.sourceHash !== job.context.sourceHash) throw new Error('Existing immutable evidence has different identity/coverage; a versioned migration is required'); }
else cpSync(source, destination, { recursive: true, errorOnExist: true });
atomicJson(path.join(destination, 'request-proof.json'), { schema: 1, key: job.key, id: job.id, context: job.context, createdAt: job.createdAt, verifiedAt: job.updatedAt, requests: job.requests, attempts: job.attempts, verification: job.verification, processingMode: 'OWNER_LOCAL_DURABLE', note: 'A real explicit job, not an anonymous hosted queue; browser proof and source evidence are independently checked.' });
console.log(JSON.stringify({ exported: true, slug: job.slug, requests: job.requests, next: 'npm run check; npm run build; npm run check:client; npm run test:e2e, then credential-scanned Git publication through the authorized feature-branch workflow.' }));
