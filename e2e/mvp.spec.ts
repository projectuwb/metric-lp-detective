import { test, expect } from '@playwright/test';
const provider = '0x3216FBdef81Be1842A80D648C83C7aa10bc00787';
test('sample replays actual swaps, pauses, scrubs full history and exposes sources', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const external: string[] = []; page.on('request', req => { if (/solidrpc|alchemy|infura|eth_get/.test(req.url())) external.push(req.url()); });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/landing-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Try the verified sample/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  await expect(page.getByTestId('stable-balance')).toContainText('2,999.999999');
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('33.354519');
  await expect(page.getByText('VERIFIED EXECUTION-TIME REFERENCE', { exact: true })).toBeVisible();
  await expect(page.getByTestId('source-link')).toHaveAttribute('href', /0xb4f8bea7a1ba7a5b89cc4876c7d9bc215d5a5dec615a6c4508ff31b484a6918c/);
  await page.getByLabel('Playback speed').selectOption('4');
  await page.getByRole('button', { name: 'Play replay' }).click();
  await expect.poll(async () => Number(await page.getByLabel('Replay event', { exact: true }).inputValue())).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Pause replay' }).click();
  const stopped = await page.getByLabel('Replay event', { exact: true }).inputValue();
  await page.waitForTimeout(400);
  expect(await page.getByLabel('Replay event', { exact: true }).inputValue()).toBe(stopped);
  await page.getByLabel('Replay event', { exact: true }).focus(); await page.keyboard.press('End');
  await expect(page.getByTestId('stock-balance')).toContainText('22.973419');
  await expect(page.getByTestId('stable-balance')).toContainText('5,657.408436');
  await expect(page.getByText('EXECUTION REFERENCE UNAVAILABLE', { exact: true })).toBeVisible();
  await page.getByText('Bin shares & exact token balances').click();
  await expect(page.getByText(/22973419195727555217/)).toBeVisible();
  expect(await page.locator('tbody tr').count()).toBeLessThan(101);
  expect(external).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/replay-desktop.png', fullPage: true });
});
test('wallet lookup, selection and unsupported/no-results states', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('START WITH A PUBLIC WALLET').fill(provider);
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: /salt 198136120981933274567974/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0xaDD454F43AFf689f0B694161a950Dd8f82a5d0D4');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: /salt 1068754547228601823113491/ }).click();
  await expect(page.getByRole('status')).toContainText('not independently reconciled');
  await expect(page.getByRole('button', { name: 'Play replay' })).toHaveCount(0);
  await page.getByLabel('START WITH A PUBLIC WALLET').fill('0x000000000000000000000000000000000000dEaD');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('does not rule out later activity');
});
test('errors stop loading; retry works; mobile stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let fail = true;
  await page.route('**/api/replay', async route => {
    if (fail) { fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Replay temporarily unavailable.' }) }); }
    else await route.continue();
  });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/landing-mobile.png', fullPage: true });
  await page.getByRole('button', { name: /Try the verified sample/ }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Replay temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/replay-mobile.png', fullPage: true });
});
test('event-page failures stop the spinner and retry the selected event', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Try the verified sample/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  let fail = true;
  await page.route(/\/api\/replay\/.*\/events\?page=205$/, async route => {
    if (fail) { fail = false; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Event page temporarily unavailable.' }) }); }
    else await route.continue();
  });
  await page.getByLabel('Replay event', { exact: true }).focus(); await page.keyboard.press('End');
  await expect(page.getByRole('alert').filter({ hasText: 'Event page temporarily unavailable' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('22.973419');
});
test('returning to a cached page cancels pending loading state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Try the verified sample/ }).click();
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  await page.route(/\/api\/replay\/.*\/events\?page=205$/, async route => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    await route.continue().catch(() => {});
  });
  await page.getByLabel('Replay event', { exact: true }).focus(); await page.keyboard.press('End');
  await expect(page.getByRole('status')).toContainText('Loading event');
  await page.getByLabel('Replay event', { exact: true }).focus(); await page.keyboard.press('Home');
  await expect(page.getByTestId('stock-balance')).toContainText('37.037279');
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('.event-label')).toContainText('Liquidity added');
});
