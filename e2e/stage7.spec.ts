import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { inspectWallet } from '../scripts/inspect-public-wallet';
const config = JSON.parse(readFileSync('config/production-acceptance.json', 'utf8'));
const registry = JSON.parse(readFileSync('.web-data/registry.json', 'utf8'));
test('Stage 7 candidate uses the operational acceptance interaction with truthful current registration', async ({ page, context, baseURL }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.setViewportSize({ width: 390, height: 844 });
  const ready = registry.some((p: any) => p.id === config.positionId), requests: string[] = [];
  page.on('request', r => { if (/solidrpc|debug_trace|eth_get/.test(r.url()) || r.method() === 'POST' && /\/api\/analysis/.test(r.url())) requests.push(r.url()); });
  const proof = await inspectWallet(page, context, baseURL!, config.positionId, ready, null, 'LOCAL_REGRESSION');
  expect(proof.state).toBe(ready ? 'VERIFIED_PUBLIC_REPLAY_PROVEN' : 'ANALYSIS_NEEDED_OWNER_HANDOFF_PROVEN');
  expect(proof.mode).toBe('LOCAL_REGRESSION'); expect(requests).toEqual([]);
  const response = await context.request.get(baseURL + '/api/release');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect((await response.json()).playable.includes(config.positionId)).toBe(ready);
});
test('operational verifier steps every event of an existing published small closed replay', async ({ page, context, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const proof = await inspectWallet(page, context, baseURL!, '0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba:880320313732695054146242', true, null, 'LOCAL_REGRESSION');
  expect(proof).toMatchObject({ state: 'VERIFIED_PUBLIC_REPLAY_PROVEN', swaps: 1, rpcRequests: 0 });
  expect(proof.events).toBeGreaterThan(2);
});
