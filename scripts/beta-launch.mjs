// One owner command, loopback only. This never starts or configures a hosted service.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
if (process.env.VERCEL) throw new Error('Owner-local beta cannot start on Vercel');
if (!process.env.BNB_RPC_URL) throw new Error('Server-only BNB_RPC_URL is required for the owner worker');
if (!existsSync('.next/BUILD_ID')) throw new Error('Run npm run build first');
const port = process.env.BETA_PORT ?? '3100'; if (!/^\d{4,5}$/.test(port)) throw new Error('Invalid local beta port');
const env = { ...process.env, LP_ANALYSIS_MODE: 'owner-local', NODE_USE_ENV_PROXY: '1' };
const worker = spawn(process.execPath, ['--max-old-space-size=4096', '--import', 'tsx', 'scripts/analysis-worker.ts'], { env, stdio: 'inherit' });
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], { env, stdio: 'inherit' });
let stopping = false;
function stop() { if (stopping) return; stopping = true; worker.kill('SIGTERM'); server.kill('SIGTERM'); setTimeout(() => { worker.kill('SIGKILL'); server.kill('SIGKILL'); }, 5000).unref(); }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of [worker, server]) { child.on('error', () => { process.exitCode = 1; stop(); }); child.on('exit', code => { if (!stopping) { process.exitCode = code ?? 1; stop(); } }); }
console.log(`Owner-local beta: http://127.0.0.1:${port}. Disk-backed jobs persist after this browser closes; keep the owner process and disk available.`);
