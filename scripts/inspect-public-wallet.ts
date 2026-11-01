// Shared read-only interaction: local regressions and actual public acceptance.
import { expect, type Page, type BrowserContext } from '@playwright/test';
import { tokens } from '../lib/domain/format';
export async function inspectWallet(page: Page, context: BrowserContext, origin: string, id: string, expectedReady: boolean, commit: string | null, mode: 'LOCAL_REGRESSION' | 'REAL_PUBLIC_BROWSER_NO_RPC') {
  await page.goto(origin, { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByLabel('START WITH A PUBLIC WALLET').fill(id.split(':')[0]);
  await page.getByRole('button', { name: 'Find positions', exact: true }).click();
  await page.getByRole('button', { name: new RegExp('salt ' + id.split(':')[1]) }).click();
  const proof: any = { schema: 1, mode, origin: origin, commit, positionId: id, observedAt: new Date().toISOString(), ownerWorkflowDispatchPerformedByThisTest: false, rpcRequests: 0 };
  if (!expectedReady) {
    const panel = page.getByLabel('Verified position analysis'); await panel.getByRole('link', { name: 'Open owner-run workflow ↗', exact: true }).waitFor();
    if (await page.getByLabel('Position ID for owner workflow').inputValue() !== id) throw new Error('Wrong public handoff position');
    await panel.getByRole('button', { name: 'Copy position ID', exact: true }).click();
    if (await page.evaluate(() => navigator.clipboard.readText()) !== id || await page.getByRole('button', { name: 'Play replay' }).count()) throw new Error('Unverified position was playable or wrong ID copied');
    proof.state = 'ANALYSIS_NEEDED_OWNER_HANDOFF_PROVEN';
  } else {
    const metaResponse = await context.request.get(origin + '/api/replay?id=' + encodeURIComponent(id));
    if (!metaResponse.ok()) throw new Error('Published position metadata is unavailable');
    const meta = await metaResponse.json();
    if (meta.id !== id || !meta.closed || !Number.isSafeInteger(meta.eventCount) || meta.eventCount > 1000) throw new Error('Acceptance requires this small, fully closed independently verified position');
    const events: any[] = [];
    for (let p = 0; p < Math.ceil(meta.eventCount / meta.pageSize); p++) { const response = await context.request.get(origin + '/api/replay/' + encodeURIComponent(id) + '/events?page=' + p); if (!response.ok()) throw new Error('Published event page missing'); events.push(...(await response.json()).events); }
    for (const e of events) {
      await page.getByTestId('stock-balance').waitFor();
      await page.waitForFunction(i => (document.querySelector('input[aria-label="Replay event"]') as HTMLInputElement)?.value === String(i), e.index);
      await expect(page.getByTestId('stock-balance')).toHaveText(tokens(e.after[0]) + ' CRCLB');
      await expect(page.getByTestId('stable-balance')).toHaveText(tokens(e.after[1]) + ' USDT');
      if (e.type === 'swap' && !e.reference) throw new Error('Small accepted replay lacks its execution witness');
      if (e.index < events.length - 1) await page.getByRole('button', { name: 'Next event', exact: true }).click();
    }
    await expect(page.getByTestId('outcome-net')).toHaveText(meta.performance.cashflowPnl);
    if (!await page.getByTestId('source-link').getAttribute('href') || !(await page.getByLabel('LP financial outcome').innerText()).includes('Fully withdrawn')) throw new Error('Exit/source evidence not visible');
    proof.state = 'VERIFIED_PUBLIC_REPLAY_PROVEN'; proof.events = events.length; proof.swaps = events.filter(e => e.type === 'swap').length; proof.cashflowPnl = meta.performance.cashflowPnl; proof.through = meta.through; proof.sourceHashes = meta.sourceHashes;
  }
  if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) throw new Error('Production mobile layout overflows');
  return proof;
}
