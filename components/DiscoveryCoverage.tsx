import type { DiscoveryCoverage, DiscoveryResult } from '../lib/domain/discovery';
export default function Coverage({ coverage, result }: { coverage: DiscoveryCoverage; result: DiscoveryResult | null }) {
  return <section className="discovery-coverage" aria-label="Wallet discovery coverage">
    <h3>{result ? result.status === 'FOUND' ? `FOUND · ${result.positions.length} direct-provider position(s)` : result.status === 'NOT_CHECKED_YET' ? 'NOT CHECKED YET · requested window outside the index' : 'NONE FOUND IN CHECKED WINDOW' : 'Wallet discovery · checked coverage'}</h3>
    {result && <p>{result.message}</p>}
    <p>BNB Chain (56) · CRCLB/USDT · <a href={'https://bscscan.com/address/' + coverage.pool} target="_blank" rel="noreferrer">{coverage.pool}</a></p>
    <p>Deployment block {coverage.from} → last scanned block <b>{coverage.through}</b>. {coverage.observedFinalizedHead ? <>Finalised head observed at {coverage.observedFinalizedHead.block} on {coverage.observedFinalizedHead.observedAt}; index lag then: {coverage.recentHeadLag} blocks. This is a dated observation, not live head tracking.</> : 'Recent-head lag unknown: no live head is queried by wallet searches.'}</p>
    <p><b>NOT CHECKED YET:</b> blocks after {coverage.through}. Refresh: owner-authorised index update required; no background scan is running. This does not rule out later activity.</p>
    <p><b>Managed positions / ownership unknown:</b> discovery matches the provider named in pool events. A manager, vault or proxy may hold shares for a wallet; that beneficial-owner link is not verified. No result here is a lifetime “no LP” claim.</p>
    <details><summary>Discovery source and replay coverage</summary><p>Index head hash: <code>{coverage.headHash}</code>. Source index hash: <code>{coverage.sourceHash}</code>. Accounting version: <code>{coverage.accountingVersion}</code>. Independently verified replay covers its own pinned window through {coverage.replayThrough}; finding a position does not unlock replay.</p></details>
  </section>;
}
