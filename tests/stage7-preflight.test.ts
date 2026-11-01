import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { historyInputs } from '../scripts/reconstruct-history';
import { indexedSwapActivity, offlinePreflight } from '../lib/analysis/preflight';
import { GET as release } from '../app/api/release/route';
const h = historyInputs(), config = JSON.parse(readFileSync('config/production-acceptance.json', 'utf8'));
describe('Stage 7 genuine new-provider offline preflight', () => {
  it('counts attributable swaps rather than all pool swaps during the LP lifetime', () => {
    const activity = indexedSwapActivity(h.logs, h.abi);
    const known = [
      ['0x3216fbdef81be1842a80d648c83c7aa10bc00787:198136120981933274567974', 26202],
      ['0x3eb210eaa4026f62d027fafaba1fa5592febb06a:363274826789293944322560', 9],
      ['0xd85440db4b63cd61e0be731b5dcb36e2f36f9eba:880320313732695054146242', 1],
      ['0xa19899f6b8416d8266f0d4f14688c8c6eeaec818:671085802901633847509096', 10],
    ] as const;
    for (const [id, n] of known) expect(activity.get(id)?.swaps).toBe(n);
    const providers = new Set(known.map(([id]) => id.split(':')[0]));
    expect([...activity].filter(([id, a]) => !providers.has(id.split(':')[0]) && a.swaps >= 1 && a.swaps <= 10)).toEqual([]);
    // This LP spans real pool swaps, but none touch its owned bins.
    expect(activity.get('0xdda42f12b8b2ccc6717c053a2b772bad24b08cbd:1017403693895484371394990')).toBeUndefined();
    expect(activity.get(config.positionId)).toBeUndefined();
  }, 60000);
  it('reproduces the new fully withdrawn candidate without live calls or registration', () => {
    const p = offlinePreflight(config.positionId);
    expect(p).toMatchObject({ confidence: 'INDEX_PREFLIGHT_NOT_INDEPENDENTLY_VERIFIED', swaps: 0, traces: 0, checkpoints: 5, closedInIndex: true, expected: { total: 26 }, hardLimit: 31, liveRequestsIssued: 0, moneyAuthorised: false });
    expect(p.events.map(e => [e.type, e.block])).toEqual([['deposit', '128019133'], ['withdrawal', '128019250']]);
    expect(JSON.parse(readFileSync('.web-data/registry.json', 'utf8')).some((p: any) => p.id === config.positionId)).toBe(existsPilotProof());
  }, 60000);
  it('exposes only prepared public release provenance with no-store', async () => {
    const response = await release(), value = await response.json();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(value.playable).toEqual(JSON.parse(readFileSync('.web-data/registry.json', 'utf8')).map((p: any) => p.id));
    expect(value.commit === null || /^[a-f0-9]{40}$/.test(value.commit)).toBe(true);
    expect(JSON.stringify(value)).not.toMatch(/BNB_RPC_URL|GH_TOKEN|solidrpc/);
  });
});
function existsPilotProof() {
  // Future actual fifth evidence may be added; test never creates a sample.
  const positions = JSON.parse(readFileSync('.web-data/positions.json', 'utf8'));
  return positions.some((p: any) => p.id === config.positionId && p.status === 'reconciled');
}
