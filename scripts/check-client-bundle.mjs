import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
const forbidden = ['BNB_RPC_URL', 'rpc.solidrpc.io'];
for (const [name, value] of Object.entries(process.env)) if (value && value.length >= 12 && /(?:API_KEY|TOKEN|PASSWORD|SECRET|RPC_URL)$/.test(name)) forbidden.push(value);
let files = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else { files++; const text = readFileSync(p, 'utf8'); if (forbidden.some(value => text.includes(value))) throw new Error('Server credential/name detected in public client assets (matching text redacted)'); }
  }
}
walk('.next/static');
console.log(`Client asset credential check: ${files} files; PASS`);
