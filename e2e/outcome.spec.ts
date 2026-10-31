import { test, expect } from '@playwright/test';
test('full exit is explained as contributions, actual received tokens and net outcome', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /Try the smaller sample/ }).click();
  await page.getByRole('button', { name: /Exit Summary · #14/ }).click();
  await expect(page.getByRole('heading', { name: 'Your tokens came back. Here’s the result.' })).toBeVisible();
  await expect(page.getByTestId('outcome-net')).toHaveText('-1.812248');
  await expect(page.getByTestId('outcome-bridge-usdt')).toContainText('4543.728066 received + 0.000000 still invested − 4545.540314 contributed');
  await expect(page.getByTestId('outcome-stock-net')).toHaveText('0.085800');
  await page.getByLabel('Outcome currency').selectOption('CRCLB');
  await expect(page.getByTestId('outcome-net')).toHaveText('0.085800');
  await page.getByText('Choose hypothetical settlement currency', { exact: true }).click();
  await page.getByLabel('Hypothetical settlement currency', { exact: true }).selectOption('CRCLB');
  await expect(page.getByTestId('hypothetical-settlement')).toContainText('56.504077 CRCLB — hypothetical');
  await page.screenshot({ path: 'test-results/stage3-exit-desktop.png', fullPage: true });
});
test('mobile start vs selected point and partial withdrawal keep distributions visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  await page.getByRole('button', { name: /Try the verified sample/ }).click();
  await page.getByRole('button', { name: /Partial withdrawal/ }).click();
  await expect(page.getByLabel('LP financial outcome')).toContainText('1,489.456801526 USDT');
  await expect(page.getByLabel('LP financial outcome')).toContainText('Still held in LP');
  await expect(page.getByTestId('outcome-net')).not.toHaveText('Unavailable');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/stage3-partial-mobile.png', fullPage: true });
});
