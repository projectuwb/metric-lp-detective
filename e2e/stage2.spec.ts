import { test, expect } from '@playwright/test';
test('smaller verified lifecycle: initial funding, swaps, selected marks and full withdrawal', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: /Try the smaller sample/ }).click();
  await expect(page.getByTestId('outcome-net')).toHaveText('-1.812248');
  await page.getByRole('button', { name: /Initial deposit · #1/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('5.581308');
  await expect(page.getByTestId('initial-value')).toContainText('4355.903941');
  await expect(page.getByLabel('Replay event', { exact: true })).toHaveAttribute('max', '13');
  await expect(page.getByTestId('source-link')).toHaveAttribute('href', /0xa072e353ca8cd375bbc562df0693f5955f48308fdd9b04eab7cfc0ed090d0ce6/);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('8.081029');
  await expect(page.getByTestId('selected-valuation')).toContainText('128750042');
  await expect(page.getByText('VERIFIED EXECUTION-TIME REFERENCE', { exact: true })).toBeVisible();
  await page.getByLabel('Playback speed').selectOption('64');
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect(page.getByTestId('selected-pnl')).toHaveText('-1.812248');
  await expect(page.getByTestId('stock-balance')).toHaveText('0 CRCLB');
  await expect(page.getByTestId('stable-balance')).toHaveText('0 USDT');
  await expect(page.getByTestId('selected-holding')).toContainText('would need an assumed stock sale; not calculated');
  await expect(page.getByText('Fully withdrawn', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play replay' })).toBeVisible();
  await expect(page.getByTestId('source-link')).toHaveAttribute('href', /0x1eecbac1ff505109332535ec78f76c26079a1120ab99383012e9dcf645f1633a/);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/stage2-closed-desktop.png', fullPage: true });
});
test('multi-salt wallet selects its reconciled position, switches samples and fits mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0x3eB210eAa4026f62D027fafABA1fa5592feBb06A');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: /salt 363274826789293944322560/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('5.581308');
  await expect(page.getByTestId('comparison-CRCLB')).toHaveText('5.581308503');
  await expect(page.getByTestId('selected-valuation')).toContainText('128750025');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stage2-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /Try the verified sample/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(page.getByTestId('selected-valuation')).toContainText('PnL unavailable');
});
test('smaller-sample failures retry the requested position, without an endless loader', async ({ page }) => {
  let fail = true;
  await page.route('**/api/replay?id=*', async route => {
    if (fail) { fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Small sample temporarily unavailable.' }) }); }
    else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: /Try the smaller sample/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Small sample temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByTestId('outcome-net')).toHaveText('-1.812248');
  await page.getByRole('button', { name: /Initial deposit · #1/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('5.581308');
});
