import type { ReplayEvent, ReplayMeta } from '../lib/domain/web';
import { holdingExplanation } from '../lib/domain/holding';
import { selectedComparison } from '../lib/metric/comparison';
import { tokens, price } from '../lib/domain/format';
function percentage(n: bigint | null) {
  if (n === null) return 'N/A · no initial tokens';
  const v = n < 0n ? -n : n;
  return `${n < 0n ? '-' : '+'}${v / 100n}.${String(v % 100n).padStart(2, '0')}%`;
}
export default function SelectedComparison({ meta, event }: { meta: ReplayMeta; event: ReplayEvent }) {
  const c = selectedComparison(meta, event), v = c.valuation;
  const rows = [
    ['Initially funded', c.initial], ['Selected inventory', c.current], ['Inventory difference', c.difference],
    ['Total deposits to here', c.deposits], ['Total withdrawals to here', c.withdrawals],
    ['Net contributions', c.net], ['Inventory + withdrawals − deposits', c.flowAdjusted],
  ] as const;
  return <section className="comparison-panel" aria-label="Initial versus selected point">
    <div className="panel-heading"><div><div className="eyebrow">INITIAL → SELECTED POINT · EVENT {event.index + 1}</div><h3>Detailed inventory comparison</h3><p>Token inventory change excludes tokens already withdrawn; it is not investment return.</p></div><span className="verified-badge">{meta.closed && event.index === meta.eventCount - 1 ? 'Closed position' : 'Verified inventory'}</span></div>
    <div className="comparison-assets">{(['CRCLB', 'USDT'] as const).map((asset, i) => <article key={asset}><h4><i className={i ? 'teal-dot' : 'purple-dot'} />{asset}</h4><dl>{rows.map(([label, values]) => <div key={label}><dt>{label}</dt><dd data-testid={label === 'Selected inventory' ? `comparison-${asset}` : undefined} title={`${values[i]} base units`}>{tokens(String(values[i]), 9)}</dd></div>)}<div><dt>Inventory difference / initially funded</dt><dd>{percentage(c.percent[i])}</dd></div></dl></article>)}</div>
    <p className="comparison-note">A withdrawal moves tokens out of the position; it is not an investment loss. Token differences include swaps, funding and contract rounding. They do not isolate fee income.</p>
    <div className="selected-valuation" data-testid="selected-valuation"><h4>Value at the selected point</h4>
      <p data-testid="initial-value">Initially funded value: <strong>{c.initialValue ?? 'Not calculated — no verified mark at the initial funding block'}</strong>{c.initialValue !== null && ' USDT-equivalent'}{c.initialMark && <> · {price(c.initialMark.referenceX64)} USDT / CRCLB at <a href={'https://bscscan.com/block/' + c.initialMark.block} title={c.initialMark.blockHash} target="_blank" rel="noreferrer">block {c.initialMark.block}</a> · {new Date(Number(BigInt(c.initialMark.timestamp)) * 1000).toISOString()}</>}. Actual initially deposited tokens at that block’s end reference; subsequent funding is separate.</p>
      {c.mark ? <p><span className="confidence block">VERIFIED HISTORICAL BLOCK-END MARK</span>{price(c.mark.referenceX64)} USDT / CRCLB · <a href={'https://bscscan.com/block/' + c.mark.block} title={c.mark.blockHash} target="_blank" rel="noreferrer">block {c.mark.block}</a> · {new Date(Number(BigInt(c.mark.timestamp)) * 1000).toISOString()}<br />Selected event inventory × that block’s end reference, not an execution-time valuation.</p> : <p>Selected-point reference unavailable. No execution quote, endpoint mark or interpolated price is substituted.</p>}
      {v.status === 'UNAVAILABLE' ? <div className="notice">PnL unavailable: {v.reason}. Required sources are the selected block and every contribution/withdrawal block; no price is substituted.</div> : <><div className="performance-grid"><div><span>Selected inventory value</span><strong>{v.value}</strong><small>USDT-equivalent</small></div><div><span>Cashflow-aware absolute PnL</span><strong data-testid="selected-pnl" className={v.pnl!.startsWith('-') ? 'negative' : 'positive'}>{v.pnl}</strong><small>Inventory + marked withdrawals − marked deposits</small></div></div>{v.vsHolding === null ? <p data-testid="selected-holding">{holdingExplanation(meta.funding.filter(f => f.index <= event.index))} Cashflow-aware LP PnL above uses verified reference marks.</p> : <details className="holding-comparison"><summary>Compare with simply holding</summary><p>Keep each funded token and supply the same actual token withdrawals, without exchanging tokens. Every cashflow uses its own verified block-end mark.</p><p>Holding PnL: {v.holdingPnl} USDT-equivalent. LP ahead / behind holding: <strong data-testid="selected-holding">{v.vsHolding}</strong> USDT-equivalent.</p></details>}</>}
      <p className="comparison-note">Source: historical <a href="https://bscscan.com/address/0xd352e157fd2bad7b8b524013151b19b0a90b79bc" target="_blank" rel="noreferrer">Metric provider</a> getQuote() reads. Each cashflow uses its own verified block-end mark. USDT-equivalent reference valuation; USD peg and gas excluded. Fees remain in inventory and are not added twice. Exact Q64 integer arithmetic; displayed tokens truncate to 9 decimals and values to 6.</p>
    </div>
  </section>;
}
