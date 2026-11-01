import { test, expect } from '@playwright/test';
test('public site offers a real request download and does not pretend a hosted queue', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: /salt 1068754547228601823113491/ }).click();
  const panel = page.getByLabel('Verified position analysis');
  await expect(panel).toContainText('Nothing is queued or saved here');
  await expect(page.getByRole('button', { name: 'Request verified reconstruction', exact: true })).toHaveCount(0);
  const download = page.waitForEvent('download');
  await panel.getByText('Alternative: existing owner-local file handoff', { exact: true }).click();
  await page.getByRole('button', { name: 'Download owner analysis request', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('metric-owner-analysis-request.json');
  await expect(panel.getByRole('status')).toContainText('has not been sent or queued');
  const denied = await page.request.post('/api/analysis', { data: { positionId: '0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4:1068754547228601823113491' } });
  expect(denied.status()).toBe(403); expect((await denied.json()).accepted).toBe(false);
});
test('capability failure terminates and can be refreshed', async ({ page }) => {
  let fail = true;
  await page.route('**/api/analysis?positionId=*', async route => { if (fail) { fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) }); } else await route.continue(); });
  await page.goto('/'); await page.getByLabel('START WITH A PUBLIC WALLET').fill('0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: /salt 1068754547228601823113491/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Analysis capabilities are unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh analysis status', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Open owner-run workflow ↗', exact: true })).toBeVisible();
});
