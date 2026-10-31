import { test, expect } from '@playwright/test';
test('a wallet published by the real owner job is discoverable, playable and financially understandable', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('START WITH A PUBLIC WALLET').fill('0xA19899f6B8416D8266F0D4f14688C8c6eeAec818');
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: /salt 671085802901633847509096/ }).click();
  await expect(page.getByTestId('stock-balance')).toHaveText('0 CRCLB');
  await expect(page.getByLabel('Replay event', { exact: true })).toHaveAttribute('max', '11');
  await page.getByRole('button', { name: 'Next event', exact: true }).click();
  await expect(page.getByText('VERIFIED EXECUTION-TIME REFERENCE', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Exit Summary · #12/ }).click();
  await expect(page.getByTestId('outcome-net')).toHaveText('-0.043362');
  await expect(page.getByTestId('outcome-net')).toHaveClass(/negative/);
  await expect(page.getByText('Fully withdrawn', { exact: true })).toBeVisible();
  await expect(page.getByTestId('source-link')).toHaveAttribute('href', /0xf468cdefc138331bddc0d8bef4d52bc304ce3345b0e32e56cb9dae2f5d943829/);
});
