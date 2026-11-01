import { test, expect } from '@playwright/test';

test('empty wallet is checked only within named coverage; recent activity and managed ownership stay unknown', async ({ page }) => {
  await page.goto('/');
  const coverage = page.getByLabel('Wallet discovery coverage');
  await expect(coverage).toContainText('last scanned block 130841348');
  await expect(coverage).toContainText('Recent-head lag unknown');
  await expect(coverage).toContainText('BNB Chain (56)');
  await expect(coverage).toContainText('0xdc2b2f96bc1eb01e7286c688d5354e081af188c4');
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0x000000000000000000000000000000000000dEaD');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await expect(coverage).toContainText('NONE FOUND IN CHECKED WINDOW');
  await expect(coverage).toContainText('NOT CHECKED YET: blocks after 130841348');
  await expect(coverage).toContainText('manager, vault or proxy');
  await expect(page.getByRole('button', { name: 'Play replay' })).toHaveCount(0);
  const response = await page.request.post('/api/positions', { data: { wallet: '0x000000000000000000000000000000000000dEaD', fromBlock: '130841349', throughBlock: '130842348' } });
  expect(response.status()).toBe(409);
  expect((await response.json()).status).toBe('NOT_CHECKED_YET');
});

test('the already published fourth position remains generically discoverable and playable with exact exit evidence', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await expect(page.getByLabel('Wallet discovery coverage')).toContainText('FOUND');
  const position = page.getByRole('button', { name: /salt 880320313732695054146242/ });
  await expect(position).toContainText('129628417'); await expect(position).toContainText('129629243');
  await expect(position).toContainText('2 adds · 1 removals'); await expect(position).toContainText('Verified replay');
  await position.click();
  await expect(page.getByLabel('Replay event', { exact: true })).toHaveAttribute('max', '3');
  await page.getByRole('button', { name: 'Next event', exact: true }).click();
  await expect(page.getByText('VERIFIED EXECUTION-TIME REFERENCE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Exit Summary · #4/ }).click();
  await expect(page.getByTestId('stock-balance')).toHaveText('0 CRCLB');
  await expect(page.getByTestId('stable-balance')).toHaveText('0 USDT');
  await expect(page.getByTestId('outcome-net')).toHaveText('-0.261231');
  await expect(page.getByTestId('source-link')).toHaveAttribute('href', /0x464dcae72fa48897c3dd75056217d4fa95bf3e4510dcc86c0397f4d6d40e72cc/);
});

test('holding comparison is optional when feasible and explains an assumed stock sale when infeasible', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /Try the smaller sample/ }).click();
  await expect(page.getByTestId('outcome-net')).toHaveText('-1.812248');
  await expect(page.locator('.performance-panel .performance-grid')).not.toContainText('Unsupported');
  await expect(page.locator('.performance-panel')).toContainText('would need an assumed stock sale; not calculated');
  await expect(page.locator('.performance-panel summary', { hasText: 'Compare with simply holding' })).toHaveCount(0);
  await page.getByRole('button', { name: /Initial deposit · #1/ }).click();
  await page.getByText('Exact inventory changes and optional holding comparison', { exact: true }).click();
  const optional = page.locator('.holding-comparison');
  await expect(optional).not.toHaveAttribute('open', '');
  await optional.locator('summary').click();
  await expect(optional).toContainText('without exchanging tokens');
  await expect(optional.getByTestId('selected-holding')).toBeVisible();
});

test('a failed new lookup clears the old wallet results and never reuses its replay', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /Try the smaller sample/ }).click();
  await expect(page.getByTestId('outcome-net')).toHaveText('-1.812248');
  await page.route('**/api/positions', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Index unavailable for this test.' }) }));
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0x000000000000000000000000000000000000dEaD');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Index unavailable' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play replay' })).toHaveCount(0);
  await expect(page.getByLabel('Wallet discovery coverage')).not.toContainText('NONE FOUND');
});
