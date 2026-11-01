// Read-only browser proof. Never dispatches work or receives RPC/GitHub credentials.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inspectWallet } from './inspect-public-wallet';
import { positionIdentity } from '../lib/domain/position';
const config = JSON.parse(readFileSync('config/production-acceptance.json', 'utf8'));
const base = new URL(config.baseURL), id = positionIdentity(config.positionId);
if (base.origin !== 'https://metric-lp-detective.vercel.app' || base.pathname !== '/' || base.username || base.password) throw new Error('Only the existing public production origin is allowed');
const sha = process.env.EXPECTED_COMMIT;
if (!sha || !/^[a-f0-9]{40}$/.test(sha)) throw new Error('An exact expected production commit is required');
const registry = JSON.parse(readFileSync('.web-data/registry.json', 'utf8'));
const expectedReady = registry.some((p: any) => p.id === id);
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage(), violations: string[] = [];
  await context.route('**/*', async route => {
    const r = route.request();
    if (/solidrpc|alchemy|infura|eth_get|debug_trace/i.test(r.url()) || /"method"\s*:\s*"(?:eth_|debug_)/.test(r.postData() ?? '') || r.method() === 'POST' && /\/api\/analysis(?:\?|\/|$)/.test(r.url())) { violations.push('Forbidden RPC/job request'); await route.abort(); }
    else await route.continue();
  });
  // Read actual deployment identity. A Ready badge or branch push is insufficient.
  const deadline = Date.now() + 8 * 60 * 1000; let release: any;
  while (Date.now() < deadline) {
    try { const r = await context.request.get(base.origin + '/api/release', { timeout: 15000, failOnStatusCode: false }); if (r.ok()) { const value = await r.json(); if (value.commit === sha && value.playable.includes(id) === expectedReady) { release = value; break; } } } catch { /* Keep waiting for this exact actual deployment; no job/RPC is submitted. */ }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  if (!release) throw new Error('Expected production commit/registry was not observed within eight minutes; public deployment NOT VERIFIED');
  const proof = await inspectWallet(page, context, base.origin, id, expectedReady, sha, 'REAL_PUBLIC_BROWSER_NO_RPC');
  if (violations.length) throw new Error('Browser attempted a forbidden RPC or job submission');
  console.log('PUBLIC_BROWSER_PROOF ' + JSON.stringify(proof));
} finally { await browser.close(); }
