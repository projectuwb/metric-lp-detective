'use client';
import { useEffect, useRef, useState } from 'react';
import type { AnalysisContext, AnalysisJob } from '../lib/analysis/types';
interface Info { mode: string; queueAvailable: boolean; workerOnline: boolean; message: string; context: AnalysisContext; job: AnalysisJob | null }
async function api<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(8000) }), body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Analysis service unavailable'); return body;
}
export default function AnalysisPanel({ positionId, ready }: { positionId: string; ready: (id: string) => void }) {
  const [info, setInfo] = useState<Info | null>(null), [job, setJob] = useState<AnalysisJob | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [downloaded, setDownloaded] = useState(false);
  const generation = useRef(0);
  const loaded = useRef(''), active = useRef(true), callback = useRef(ready); callback.current = ready;
  async function refresh() {
    setError(''); const version = generation.current;
    try { const next = await api<Info>('/api/analysis?positionId=' + encodeURIComponent(positionId)); if (active.current && version === generation.current) { setInfo(next); setJob(next.job); } }
    catch { if (active.current && version === generation.current) setError('Analysis capabilities are unavailable. No request has been accepted. Retry.'); }
  }
  useEffect(() => { active.current = true; generation.current++; loaded.current = ''; setInfo(null); setJob(null); setDownloaded(false); setBusy(false); setError(''); void refresh(); return () => { active.current = false; }; }, [positionId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!job || !['QUEUED', 'RUNNING'].includes(job.status)) return;
    const version = generation.current;
    const timer = setInterval(() => { void api<{ job: AnalysisJob; workerOnline: boolean }>('/api/analysis/' + job.key).then(next => { if (active.current && version === generation.current) { setError(''); setJob(next.job); setInfo(old => old ? { ...old, workerOnline: next.workerOnline } : old); } }).catch(() => { if (active.current && version === generation.current) setError('Job status request failed. The saved job is not cancelled; refresh to check it.'); }); }, 2000);
    return () => clearInterval(timer);
  }, [job?.key, job?.status]);
  useEffect(() => { if (job?.status === 'VERIFIED' && job.id === positionId && loaded.current !== job.key) { loaded.current = job.key; callback.current(positionId); } }, [job, positionId]);
  async function submit() {
    setBusy(true); setError(''); const version = generation.current;
    try { const result = await api<{ accepted: boolean; job?: AnalysisJob; replayAvailable?: boolean }>('/api/analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positionId }) }); if (active.current && version === generation.current) { if (result.replayAvailable) callback.current(positionId); else if (result.accepted && result.job) setJob(result.job); else throw new Error('No request was accepted'); } }
    catch (e) { if (active.current && version === generation.current) setError(e instanceof Error ? e.message : 'Request failed; no acceptance confirmed'); }
    finally { if (active.current && version === generation.current) setBusy(false); }
  }
  async function action(action: 'retry' | 'cancel') {
    if (!job) return; setBusy(true); setError(''); const version = generation.current;
    try { const result = await api<{ job: AnalysisJob }>('/api/analysis/' + job.key, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); if (active.current && version === generation.current) setJob(result.job); }
    catch (e) { if (active.current && version === generation.current) setError(e instanceof Error ? e.message : 'Action failed'); }
    finally { if (active.current && version === generation.current) setBusy(false); }
  }
  function download() {
    if (!info) return;
    const file = new Blob([JSON.stringify({ schema: 1, positionId, context: info.context, createdAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file), link = document.createElement('a'); link.href = url; link.download = 'metric-owner-analysis-request.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
  }
  return <section className="analysis-panel" aria-label="Verified position analysis"><div className="eyebrow">NEW POSITION · INDEPENDENT VERIFICATION REQUIRED</div><h3>Reconstruct this position</h3><p>{info?.message ?? 'Checking whether a real analysis worker is available…'}</p>
    {info && !info.queueAvailable && <><button className="sample-button" onClick={download}>Download owner analysis request</button><p>No hosted request is saved. The owner imports this file into the bounded worker and publishes independently verified evidence through the existing repository. No turnaround is promised.</p>{downloaded && <p role="status">Request file downloaded to your browser. It has not been sent or queued. Owner import is required.</p>}</>}
    {info?.queueAvailable && !job && <><button className="sample-button" disabled={busy} onClick={() => void submit()}>{busy ? 'Saving request…' : 'Request verified reconstruction'}</button><p>Owner-local limited beta: up to 100 swaps, 20 checkpoints, 10 trace transactions and 100 RPC attempts. No billable fallback. An explicit job saves this public position ID. Jobs expire after one day (seven after verification); local files are purged by worker maintenance while it is running. Discovery searches are not saved. If the owner publishes the verified proof, its public position and transaction evidence remain in the repository.</p></>}
    {job && <div className="analysis-progress" data-testid="analysis-progress"><strong>{job.status}</strong><p>{job.phase}</p><p>{job.completedCheckpoints} / {job.totalCheckpoints || 'not yet determined'} checkpoints · {job.requests} / 100 RPC attempts · attempt {job.attempts} / 3</p><p>Fixed coverage through {job.context.indexEnd}. {info?.workerOnline ? 'Owner worker is responding. You can close the browser; the saved job continues.' : 'Owner worker is paused or not responding. Job state remains on disk; restart the owner worker to continue.'}</p>{job.error && <p role="alert">{job.method ? job.method + ': ' : ''}{job.error}</p>}{['QUEUED', 'RUNNING'].includes(job.status) ? <button disabled={busy} onClick={() => void action('cancel')}>Cancel analysis</button> : job.status !== 'VERIFIED' && <button disabled={busy} onClick={() => void action('retry')}>Retry within remaining budget</button>}</div>}
    {error && <div className="error" role="alert">{error}</div>}<button className="analysis-refresh" disabled={busy} onClick={() => void refresh()}>Refresh analysis status</button>
  </section>;
}
