import { boundedJson, localAccess } from '../../../../lib/server/analysis';
import { getJob, updateJob, retryJob, AnalysisLimit, workerOnline } from '../../../../lib/analysis/store';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request, route: { params: Promise<{ key: string }> }) {
  if (!localAccess(request)) return Response.json({ error: 'Owner-local job status is unavailable on this host.' }, { status: 403, headers });
  try { const job = getJob((await route.params).key); return Response.json({ job, workerOnline: workerOnline() }, { status: job ? 200 : 404, headers }); }
  catch { return Response.json({ error: 'Invalid or unavailable job.' }, { status: 400, headers }); }
}
export async function POST(request: Request, route: { params: Promise<{ key: string }> }) {
  if (!localAccess(request, true)) return Response.json({ error: 'Owner-local same-origin access required.' }, { status: 403, headers });
  try {
    const key = (await route.params).key, body = await boundedJson(request), job = getJob(key);
    if (!job) return Response.json({ error: 'Job is absent or expired.' }, { status: 404, headers });
    if (body?.action === 'retry') return Response.json({ job: retryJob(key) }, { headers });
    if (body?.action === 'cancel' && ['QUEUED', 'RUNNING'].includes(job.status)) return Response.json({ job: updateJob(key, { cancelled: true, status: 'FAILED', phase: 'Owner cancelled; successful evidence retained' }) }, { headers });
    return Response.json({ error: 'Invalid action or terminal job.' }, { status: 400, headers });
  } catch (e) { return Response.json({ error: e instanceof AnalysisLimit ? e.message : 'Job action unavailable. Retry shortly.' }, { status: e instanceof AnalysisLimit ? 429 : 400, headers }); }
}
