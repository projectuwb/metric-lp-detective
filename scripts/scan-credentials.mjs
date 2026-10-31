import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { relative, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

// Reports file/rule only, never matching text, environment values or endpoint.
const root = process.cwd();
const staged = process.argv.includes('--staged');
const excluded = new Set(['.git', 'node_modules', 'artifacts', 'coverage']);
const configured = new Set();
for (const [name, value] of Object.entries(process.env)) {
  if (value && value.length >= 12 && /(?:API_KEY|TOKEN|PASSWORD|SECRET|RPC_URL)$/.test(name)) configured.add(value);
}
try {
  const url = process.env.BNB_RPC_URL ? new URL(process.env.BNB_RPC_URL) : null;
  if (url) {
    for (const value of url.searchParams.values()) if (value.length >= 8) configured.add(value);
    for (const value of url.pathname.split('/')) if (value.length >= 24) configured.add(value);
    for (const value of [url.username, url.password]) if (value.length >= 8) configured.add(value);
  }
} catch { console.error('Credential scan: invalid configured RPC URL (value redacted)'); process.exit(1); }
const rules = [
  ['GitHub credential', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Private key block', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['Credential assignment', /(?:api[_-]?key|password|secret)\s*[:=]\s*["'][A-Za-z0-9_+\/-]{32,}["']/i],
  ['Keyed RPC URL', /https?:\/\/[^\s"'`<>]*(?:solidrpc\.io|alchemy\.com|quiknode\.pro|infura\.io)[^\s"'`<>]*(?:[?&](?:key|token|apikey|api_key)=|\/v[23]\/)[A-Za-z0-9_-]{12,}/i],
];
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (excluded.has(entry.name)) continue;
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.isFile()) files.push(relative(root, path));
  }
}
try {
  if (staged) {
    files.push(...execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean));
  } else walk(root);
  let failures = 0;
  for (const file of files) {
    const bytes = staged ? execFileSync('git', ['show', `:${file}`], { maxBuffer: 64 * 1024 * 1024 }) : readFileSync(resolve(root, file));
    // Public history/trace fixtures are compressed; scan their contents too.
    const content = (file.endsWith('.gz') ? gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 }) : bytes).toString('utf8');
    const basename = file.split('/').at(-1);
    if ((/^\.env(?:\.|$)/.test(basename) && basename !== '.env.example') || /^(?:id_rsa|id_ed25519|credentials(?:\.json)?)$/.test(basename)) {
      console.error(`Credential scan: prohibited file: ${file}`); failures++;
    }
    if (basename === '.env.example' && content.split('\n').some(line => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*\S/.test(line))) {
      console.error(`Credential scan: template must have empty values: ${file}`); failures++;
    }
    if ([...configured].some(value => content.includes(value))) {
      console.error(`Credential scan: configured credential/endpoint match: ${file}`); failures++;
    }
    for (const [label, pattern] of rules) if (pattern.test(content)) { console.error(`Credential scan: ${label}: ${file}`); failures++; }
  }
  console.log(`Credential scan: ${files.length} ${staged ? 'staged' : 'project'} files checked; ${failures} findings`);
  if (failures) process.exitCode = 1;
} catch { console.error('Credential scan could not complete (details redacted); refusing success'); process.exitCode = 1; }
