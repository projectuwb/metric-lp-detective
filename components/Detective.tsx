'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Search, Play, Pause, SkipBack, SkipForward, ShieldCheck, Activity, Layers3, ExternalLink, Wallet, ScanLine, AlertCircle, LoaderCircle, RefreshCw, Database, Check, ChevronRight } from 'lucide-react';
import type { ReplayMeta, ReplayEvent, PositionSummary } from '../lib/domain/web';
import { tokens, price, short, eventTitle } from '../lib/domain/format';
import { SMALL_SAMPLE_ID } from '../lib/domain/samples';
import SelectedComparison from './SelectedComparison';
import OutcomeSummary from './OutcomeSummary';
import AnalysisPanel from './AnalysisPanel';
import { holdingExplanation } from '../lib/domain/holding';
import Coverage from './DiscoveryCoverage';
import type { DiscoveryCoverage, DiscoveryResult } from '../lib/domain/discovery';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000);
  try {
    const response = await fetch(url, { ...options, signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'Unable to read verified data. Please retry.');
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('The request timed out. Please retry.');
    throw error;
  }
}
function InventoryChart({ meta, current, metric, select }: { meta: ReplayMeta; current: number; metric: 0 | 1; select: (index: number) => void }) {
  // Floating point is used only for SVG coordinates; accounting stays in base-unit strings.
  const values = meta.chart.map(p => Number(p.balances[metric]) / 1e18);
  const max = Math.max(...values, 1) * 1.08;
  const coords = meta.chart.map((p, i) => [44 + p.index / Math.max(meta.eventCount - 1, 1) * 906, 194 - values[i] / max * 155]);
  const path = coords.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  const x = 44 + current / Math.max(meta.eventCount - 1, 1) * 906;
  return <svg className={`inventory-chart ${metric ? 'teal-chart' : ''}`} viewBox="0 0 980 235" role="img" aria-label={`${metric ? 'USDT' : 'CRCLB'} inventory, sampled verified event overview`} onClick={e => { const bounds = e.currentTarget.getBoundingClientRect(); const scaled = (e.clientX - bounds.left) / bounds.width * 980; select(Math.round(Math.max(0, Math.min(1, (scaled - 44) / 906)) * (meta.eventCount - 1))); }}>
    <defs><linearGradient id="inventory-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
    {[0, 1, 2, 3].map(i => <g key={i}><line x1="44" x2="950" y1={39 + i * 51.7} y2={39 + i * 51.7} className="grid-line" /><text x="3" y={43 + i * 51.7}>{(max * (1 - i / 3)).toFixed(metric ? 0 : 1)}</text></g>)}
    <path d={`${path} L950,194 L44,194 Z`} fill="url(#inventory-fill)" /><path d={path} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    <line x1={x} x2={x} y1="26" y2="202" className="playhead" /><circle cx={x} cy="26" r="4" fill="currentColor" />
    <text x="44" y="223">FIRST DEPOSIT</text><text x="950" y="223" textAnchor="end">VERIFIED ENDPOINT</text>
  </svg>;
}

export default function Detective({ coverage }: { coverage: DiscoveryCoverage }) {
  const [discovery, setDiscovery] = useState<DiscoveryResult | null>(null);
  const [wallet, setWallet] = useState(''), [positions, setPositions] = useState<PositionSummary[] | null>(null);
  const [meta, setMeta] = useState<ReplayMeta | null>(null), [pages, setPages] = useState<Record<number, ReplayEvent[]>>({});
  const [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [speed, setSpeed] = useState(1), [metric, setMetric] = useState<0 | 1>(0);
  const [busy, setBusy] = useState(''), [pageLoading, setPageLoading] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [selectedId, setSelectedId] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const lookupId = useRef(0);
  const sampleId = useRef<string | undefined>(undefined);
  const sampleExit = useRef(false);
  const lastAction = useRef<'sample' | 'lookup' | 'events'>('sample');
  const page = meta ? Math.floor(index / meta.pageSize) : 0;
  const event = pages[page]?.find(e => e.index === index);
  async function sample(positionId?: string, showExit = false) {
    sampleId.current = positionId; sampleExit.current = showExit; setAnalysisId('');
    lastAction.current = 'sample';
    const id = ++lookupId.current;
    setBusy('Loading verified sample…'); setError(''); setNotice(''); setPlaying(false);
    try {
      const data = await request<ReplayMeta>('/api/replay' + (positionId ? '?id=' + encodeURIComponent(positionId) : ''));
      const first = await request<{ events: ReplayEvent[] }>(`/api/replay/${encodeURIComponent(data.id)}/events?page=0`);
      if (id !== lookupId.current) return;
      setMeta(data); setSelectedId(data.id); setPages({ 0: first.events }); setIndex(showExit ? [...data.milestones].reverse().find(m => m.kind === 'FULL_CLOSE')?.index ?? 0 : 0);
      setPositions(old => old?.map(p => p.id === data.id ? { ...p, status: 'reconciled' as const } : p) ?? null);
    } catch (e) { if (id === lookupId.current) setError(e instanceof Error ? e.message : 'Unable to load sample.'); }
    finally { if (id === lookupId.current) setBusy(''); }
  }
  async function lookup(e?: FormEvent) {
    e?.preventDefault(); lastAction.current = 'lookup'; const id = ++lookupId.current;
    setAnalysisId(''); setDiscovery(null); setPositions(null); setMeta(null); setPages({}); setSelectedId(''); setBusy('Finding direct-provider positions in the published index…'); setError(''); setNotice(''); setPlaying(false);
    try {
      const result = await request<DiscoveryResult>('/api/positions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallet: wallet.trim() }) });
      if (id !== lookupId.current) return;
      setPositions(result.positions); setDiscovery(result);
      if (!result.positions.length) setNotice(`No position found for this provider in verified coverage ${result.from}–${result.through}. This does not rule out later activity or a manager-owned position.`);
    } catch (e) { if (id === lookupId.current) setError(e instanceof Error ? e.message : 'Lookup failed.'); }
    finally { if (id === lookupId.current) setBusy(''); }
  }
  useEffect(() => {
    if (!meta || pages[page]) { setPageLoading(false); return; }
    lastAction.current = 'events';
    const controller = new AbortController();
    setPageLoading(true);
    request<{ events: ReplayEvent[] }>(`/api/replay/${encodeURIComponent(meta.id)}/events?page=${page}`, { signal: controller.signal }).then(data => {
      setPages(old => { const next = { ...old, [page]: data.events }; const keys = Object.keys(next).map(Number).sort((a, b) => Math.abs(a - page) - Math.abs(b - page)); for (const k of keys.slice(3)) delete next[k]; return next; });
      setPageLoading(false);
    }).catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : 'Event page failed.'); setPlaying(false); setPageLoading(false); } });
    return () => controller.abort();
  }, [meta, page, pages]);
  useEffect(() => {
    if (!playing || !event || !meta) return;
    if (index >= meta.eventCount - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(() => setIndex(i => Math.min(i + 1, meta.eventCount - 1)), 1000 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, event, index, meta, speed]);
  function seek(value: number) { setPlaying(false); setError(''); setIndex(value); if (meta && !pages[Math.floor(value / meta.pageSize)]) setPages(old => ({ ...old })); }
  function retry() { setError(''); if (lastAction.current === 'lookup') void lookup(); else if (!meta || lastAction.current === 'sample') void sample(sampleId.current, sampleExit.current); else setPages(old => { const next = { ...old }; delete next[page]; return next; }); }
  const change = event?.delta;
  const narrative = event ? event.type === 'swap' ? 'A real swap changed this position’s withdrawable inventory, using its shares in each touched bin.' : event.type === 'deposit' ? 'The provider added liquidity. These are the actual token credits and minted bin shares.' : event.type === 'withdrawal' ? 'The provider removed liquidity. These token amounts left the position.' : 'Another LP changed liquidity. Contract rounding changed this position’s entitlement; no trade is invented.' : '';
  return <div className="shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="Metric LP Detective home"><span className="brand-icon"><ScanLine size={23} /></span><span>metric<span className="brand-sub">LP DETECTIVE</span></span></a>
      <div className="sidebar-caption">YOUR INVESTIGATION</div><a className="nav active" href="#investigate"><Activity size={17} /> Position replay <ChevronRight size={14} /></a><a className="nav" href="#evidence"><ShieldCheck size={17} /> Evidence & limits</a>
      <div className="scope-card"><span className="live-dot" /> SINGLE POOL · READ ONLY<strong>CRCLB / USDT</strong><span>BNB Chain <span className="chain-dot">56</span></span><small>No connection. No signatures.<br />Just the public record.</small></div>
      <div className="sidebar-footer">FOLLOW THE EVIDENCE.<br /><span>Understand your liquidity.</span></div>
    </aside>
    <main id="investigate">
      <header className="topbar"><span>THE ON-CHAIN INVESTIGATION TOOL</span><a href="https://bscscan.com/address/0xdC2b2F96bC1eb01E7286C688d5354e081AF188C4" target="_blank" rel="noreferrer">Verified pool <ArrowUpRight size={14} /></a></header>
      <section className="hero"><div><div className="eyebrow"><span className="live-dot" /> METRIC · CRCLB / USDT · BNB CHAIN</div><h1>Your liquidity.<br /><span>The whole story.</span></h1><p>Follow the real trades. See how your tokens changed.<br className="desktop" /> Understand what happened to your Metric LP.</p></div><div className="hero-seal"><ShieldCheck size={25} /><strong>Evidence, not estimates.</strong><span>Every inventory change links<br />back to a real transaction.</span></div></section>
      <section className="search-panel" aria-label="Find a liquidity position"><form onSubmit={lookup}><label htmlFor="wallet">START WITH A PUBLIC WALLET</label><div className="search-row"><div className="input-wrap"><Wallet size={18} /><input id="wallet" disabled={!!busy} autoComplete="off" spellCheck={false} placeholder="0x… public wallet address" value={wallet} onChange={e => setWallet(e.target.value)} aria-describedby="privacy" /></div><button className="primary" disabled={!!busy || !wallet.trim()}><Search size={16} /> Find positions</button></div><p className="privacy" id="privacy"><ShieldCheck size={12} /> No wallet connection. Address used for lookup, not saved as search history.</p></form><div className="search-divider">OR</div><div className="sample"><span>Start with a real exit. Replay every step.</span><button className="sample-button primary-sample" onClick={() => void sample(SMALL_SAMPLE_ID, true)} disabled={!!busy}>Try the smaller sample · 9 swaps <ArrowRight size={16} /></button><button className="sample-button" onClick={() => void sample()} disabled={!!busy}>Try the verified sample <ArrowRight size={16} /></button></div></section>
      {busy && <div className="status" role="status"><LoaderCircle className="spin" size={17} /> {busy}</div>}
      {error && <div className="error" role="alert"><AlertCircle size={18} /><span>{error}</span><button onClick={retry}><RefreshCw size={14} /> Retry</button></div>}
      {notice && <div className="notice" role="status">{notice}</div>}
      <Coverage coverage={discovery?.coverage ?? coverage} result={discovery} />
      {positions && positions.length > 0 && <section className="position-results"><h2>Detected positions <span>{positions.length}</span></h2><div>{positions.map(p => <button key={p.id} className={`position-choice ${selectedId === p.id ? 'chosen' : ''}`} onClick={() => { setSelectedId(p.id); if (p.status === 'reconciled') void sample(p.id); else { setAnalysisId(p.id); ++lookupId.current; setMeta(null); setPages({}); setPlaying(false); setNotice('INDEXED_ONLY: Position detected in this pool, but its inventory is not independently reconciled. Choose the analysis option below or either verified sample.'); } }}><Layers3 size={17} /><span><strong>{short(p.provider)} <small>· salt {p.salt}</small></strong><small>First activity · block {p.firstBlock} · last activity · block {p.lastBlock}</small><small>{p.adds} adds · {p.removals} removals · {p.episodes} funding episode(s) · {p.liquidityState === 'CLOSED_IN_CHECKED_WINDOW' ? 'Closed in checked window' : 'Shares remain in checked window'}</small></span><b>{p.status === 'reconciled' ? 'Verified replay' : 'Indexed only'}</b></button>)}</div></section>}
      {analysisId && !meta && <AnalysisPanel positionId={analysisId} ready={id => void sample(id)} />}
      {!meta && !busy && !analysisId && <section className="intro-grid"><article><span>01</span><Layers3 /><h3>Find your position</h3><p>Keep each provider and salt separate. Follow one real LP.</p></article><article><span>02</span><Activity /><h3>Play the public record</h3><p>Watch attributable swaps change CRCLB and USDT inventory.</p></article><article><span>03</span><ShieldCheck /><h3>Inspect the evidence</h3><p>Open source transactions. Know what is verified and what is missing.</p></article></section>}
      {meta && <>
        <section className="replay-heading"><div><div className="eyebrow">{meta.label.toUpperCase()}</div><h2>A position. Every change.</h2><p><span className="mono">{short(meta.id.split(':')[0])}</span><span>Salt <span className="mono">{meta.id.split(':')[1]}</span></span></p><p className="coverage-label">Verified through block {meta.through} · historical snapshot, not a live balance</p></div><span className="verified-badge"><Check size={14} /> Inventory reconciled{meta.closed ? ' · closed' : ''}</span></section>
        <nav className="milestone-nav" aria-label="Liquidity milestones">{meta.milestones.map(m => <button key={m.index} className={m.kind === 'FULL_CLOSE' ? 'exit-jump' : ''} onClick={() => { seek(m.index); document.getElementById('lifecycle-outcome')?.scrollIntoView({ block: 'start' }); }}>{m.kind === 'FULL_CLOSE' ? 'Exit Summary' : m.kind === 'PARTIAL_WITHDRAWAL' ? 'Partial withdrawal' : m.kind === 'INITIAL_DEPOSIT' ? 'Initial deposit' : m.kind === 'REENTRY' ? 'Re-entry' : 'Additional deposit'} · #{m.index + 1}</button>)}<button onClick={() => { setPlaying(false); document.getElementById('lifecycle-outcome')?.scrollIntoView({ block: 'start' }); }}>Compare start ↔ selected point</button></nav>
        {event && <OutcomeSummary meta={meta} event={event} />}
        <div className="balance-grid"><article className="balance-card stock"><span><i /> CRCLB INVENTORY <span>AT PLAYHEAD</span></span><strong data-testid="stock-balance">{event ? tokens(event.after[0]) : '—'} <small>CRCLB</small></strong><div>{change ? <><span className={BigInt(change[0]) >= 0n ? 'positive' : 'negative'}>{BigInt(change[0]) > 0n ? '+' : ''}{tokens(change[0], 8)}</span> this event</> : error ? 'Unavailable until retry.' : 'Loading exact inventory…'}</div></article><article className="balance-card stable"><span><i /> USDT INVENTORY <span>AT PLAYHEAD</span></span><strong data-testid="stable-balance">{event ? tokens(event.after[1]) : '—'} <small>USDT</small></strong><div>{change ? <><span className={BigInt(change[1]) >= 0n ? 'positive' : 'negative'}>{BigInt(change[1]) > 0n ? '+' : ''}{tokens(change[1], 8)}</span> this event</> : error ? 'Unavailable until retry.' : 'Loading exact inventory…'}</div></article><article className="balance-card event-stat"><span><Activity size={14} /> REAL EVENT</span><strong>{(index + 1).toLocaleString()} <small>/ {meta.eventCount.toLocaleString()}</small></strong><div>Block <span className="mono">{event?.block ?? '…'}</span> · fixed historical coverage</div></article></div>

        <section className="chart-panel"><div className="panel-heading"><div><h3>Inventory, explained over time</h3><p>Sampled overview. Every event is available for exact inspection.</p></div><div className="segmented" aria-label="Chart asset"><button className={!metric ? 'selected' : ''} onClick={() => setMetric(0)}><i className="purple-dot" />CRCLB</button><button className={metric ? 'selected' : ''} onClick={() => setMetric(1)}><i className="teal-dot" />USDT</button></div></div><InventoryChart meta={meta} current={index} metric={metric} select={seek} /><div className="player"><div className="play-buttons"><button className="icon-button" aria-label="Previous event" disabled={!index} onClick={() => seek(Math.max(0, index - 1))}><SkipBack size={17} /></button><button className="play-button" aria-label={playing ? 'Pause replay' : 'Play replay'} disabled={!!error || !!busy} onClick={() => { if (index === meta.eventCount - 1) setIndex(0); setPlaying(v => !v); }}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button className="icon-button" aria-label="Next event" disabled={index >= meta.eventCount - 1} onClick={() => seek(Math.min(meta.eventCount - 1, index + 1))}><SkipForward size={17} /></button></div><div className="scrubber"><input type="range" min="0" max={meta.eventCount - 1} value={index} aria-label="Replay event" onChange={e => seek(Number(e.target.value))} /><span>Event order · not elapsed wall time</span></div><select aria-label="Playback speed" value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[0.5, 1, 4, 16, 64].map(s => <option key={s} value={s}>{s}× speed</option>)}</select><button className="reset" onClick={() => seek(0)}>Reset</button></div></section>
        <div className="investigation-grid"><section className="event-panel"><div className="panel-heading"><h3>What just happened?</h3><span className="micro-label">EVENT INSPECTOR</span></div>{error && !event ? <div className="notice">Event data is unavailable. Use Retry to load this page.</div> : pageLoading || !event ? <div className="status" role="status"><LoaderCircle size={17} className="spin" /> Loading event {index + 1}…</div> : <><div className={`event-label ${event.type}`}><Activity size={16} />{eventTitle(event.type)}<span>#{event.index + 1}</span></div><p className="narrative">{narrative}</p><div className="token-flow"><span><i className="purple-dot" />CRCLB<strong>{BigInt(event.delta[0]) > 0n ? '+' : ''}{tokens(event.delta[0], 9)}</strong></span><span><i className="teal-dot" />USDT<strong>{BigInt(event.delta[1]) > 0n ? '+' : ''}{tokens(event.delta[1], 9)}</strong></span></div><dl className="event-facts"><div><dt>Source block</dt><dd>{event.block}</dd></div><div><dt>Log index</dt><dd>{event.logIndex}</dd></div><div><dt>Position bins affected</dt><dd>{event.bins.map(b => b.bin).join(', ')}</dd></div></dl><a className="source-link" data-testid="source-link" href={`https://bscscan.com/tx/${event.transactionHash}`} target="_blank" rel="noreferrer">Inspect source transaction <ExternalLink size={14} /></a><details className="bin-details"><summary>Bin shares & exact token balances <span>{event.bins.length} bins</span></summary><div className="table-scroll"><table><thead><tr><th>Bin</th><th>LP shares before → after</th><th>Total bin shares before → after</th></tr></thead><tbody>{event.bins.map((b, i) => <tr key={`${b.bin}-${i}`}><td>{b.bin}</td><td>{b.sharesBefore}<br />→ {b.sharesAfter}</td><td>{b.totalBefore}<br />→ {b.totalAfter}</td></tr>)}</tbody></table></div><div className="exact-balances">Position inventory in token base units (18 decimals)<br />CRCLB: {event.before[0]} → {event.after[0]}<br />USDT: {event.before[1]} → {event.after[1]}</div></details></> }</section>
          <section className="reference-panel"><div className="panel-heading"><h3>Price evidence</h3><span className="partial-badge">Stage 1B · partial</span></div>{event?.reference ? <div className="price-observation"><span className="confidence execution"><ShieldCheck size={13} /> VERIFIED EXECUTION-TIME REFERENCE</span><strong>{price(event.reference.referenceX64)} <small>USDT / CRCLB</small></strong><p>Provider output consumed inside this exact swap. Recovered from its transaction trace.</p><div className="quote-pair"><span>Oracle bid <b>{price(event.reference.bidX64)}</b></span><span>Oracle ask <b>{price(event.reference.askX64)}</b></span></div></div> : <div className="missing-price"><span className="confidence missing"><AlertCircle size={13} /> {event?.type === 'swap' ? 'EXECUTION REFERENCE UNAVAILABLE' : 'NO EXECUTION PRICE FOR A LIQUIDITY EVENT'}</span><strong>—</strong><p>{event?.type === 'swap' ? 'No verified execution-time quote is indexed for this swap. No later price has been substituted.' : 'Adding or removing liquidity is not a swap. No trade price is invented.'}</p></div>}
          {event?.execution && BigInt(event.execution.stockBase) > 0n && <div className="actual-execution"><span>Pool swap’s actual average exchange ratio</span><strong>{tokens((BigInt(event.execution.stableBase) * 10n ** 18n / BigInt(event.execution.stockBase)).toString(), 5)} USDT / CRCLB</strong><small>Native whole-swap flows; includes fee effects. Distinct from this LP’s attribution and the oracle reference.</small></div>}
          <div className="block-mark"><span className="confidence block"><Database size={13} /> HISTORICAL BLOCK-END REFERENCE</span><strong>{price(meta.endpointReference.referenceX64)} <small>USDT / CRCLB</small></strong><p>At endpoint block {meta.endpointReference.block}. Used for endpoint valuation only.</p></div><div className="coverage-note">{meta.executionQuotes.toLocaleString()} replay events have execution references. Gaps remain visible.</div></section></div>
        {event && <details className="expert-comparison"><summary>Exact inventory changes and optional holding comparison</summary><SelectedComparison meta={meta} event={event} /></details>}
        <section className="performance-panel"><div><div className="eyebrow">AT FIXED ENDPOINT · BLOCK {meta.through}</div><h3>Value and performance are different questions.</h3><p>Historical block-end provider reference marks. USDT-equivalent, not independently verified USD. Gas excluded.</p></div><div className="performance-grid"><div><span>LP marked value</span><strong>{meta.performance.finalValue}</strong><small>USDT-equivalent</small></div><div><span>Cashflow-aware absolute PnL</span><strong className={meta.performance.cashflowPnl.startsWith('-') ? 'negative' : 'positive'}>{meta.performance.cashflowPnl}</strong><small>All actual deposits and withdrawals included</small></div></div>{meta.performance.vsHolding === null ? <p>{holdingExplanation(meta.funding)} This does not prevent the verified cashflow-aware LP PnL above.</p> : <details><summary>Compare with simply holding</summary><p>Retain every funded token and supply the same token withdrawals, without a hypothetical trade. Each cashflow uses its own verified block-end reference. Holding PnL: {meta.performance.holdingPnl} USDT-equivalent. LP ahead / behind holding: <strong>{meta.performance.vsHolding}</strong> USDT-equivalent.</p></details>}<details><summary>How these values were calculated</summary><p>Absolute PnL is endpoint inventory value plus marked withdrawals minus marked deposits. Each flow uses its own historical block-end provider reference. Holding retains all deposits’ actual token quantities and funds the same token withdrawals; its marked PnL is {meta.performance.holdingPnl ?? 'unsupported because the same token withdrawals exceed holding inventory'}. LP fees already remain in inventory and are not added again. The original pre-funding wallet and gas costs are not reconstructed. These are reference-marked results, not realized trading profit.</p></details></section>
      </>}
      <section className="evidence-panel" id="evidence"><div><ShieldCheck size={21} /><h3>Built to tell the truth.</h3></div><p>One pool. Public blockchain evidence. Inventory reconciled independently with zero base-unit tolerance. Price recovery remains partial; missing values stay missing.</p><div className="evidence-tags"><span><Check size={13} /> Real events only</span><span><Check size={13} /> No wallet connection</span><span><Check size={13} /> No search-history database</span></div><details><summary>Coverage, privacy & limitations</summary><p>This MVP discovers provider/salt positions from pool deployment block 126502643 through fixed block 130841348. Both curated samples and independently verified owner-published positions have replay enabled. Remaining detected positions stay indexed-only; manager-to-wallet ownership is not inferred. The data is not a live current balance. Wallet queries are sent to this app’s server and are not intentionally logged or stored; hosting infrastructure may record request metadata. Sample data and public pool events are retained. The browser never receives RPC credentials. No trades, signatures or withdrawals are initiated.</p></details></section>
      <footer><span>METRIC LP DETECTIVE</span><span>Read the chain. Understand the change.</span></footer>
    </main>
  </div>;
}
