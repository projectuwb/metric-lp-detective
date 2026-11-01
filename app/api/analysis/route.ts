import { capabilities, localAccess, boundedJson } from '../../../lib/server/analysis';
import { context, submit, getJob, jobKey, AnalysisLimit } from '../../../lib/analysis/store';
import { positionIdentity } from '../../../lib/domain/position';
import { getPositions } from '../../../lib/server/replay';
import { limited } from '../../../lib/server/limit';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  try {
    const info = capabilities(request), id = new URL(request.url).searchParams.get('positionId');
    const job = info.queueAvailable && id ? getJob(jobKey(positionIdentity(id), context())) : null;
    const position = id ? getPositions().find(p => p.id === id) : null;
    const eligibility = !position ? 'NO_INDEXED_POSITION' : position.status === 'reconciled' ? 'VERIFIED_REPLAY' : BigInt(position.lastBlock) > BigInt(info.context.indexEnd) ? 'ACCOUNTING_INDEX_REQUIRED' : 'OWNER_PREFLIGHT_REQUIRED';
    return Response.json({ ...info, job, eligibility }, { headers });
  } catch { return Response.json({ error: 'Analysis status is unavailable. Retry shortly.' }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  if (!localAccess(request, true)) return Response.json({ accepted: false, error: 'Hosted analysis is not enabled or this is not an authenticated loopback origin. No request was saved. Use the owner request download.' }, { status: 403, headers });
  if (limited(request, 'analysis-submit', 6)) return Response.json({ accepted: false, error: 'Too many analysis requests. Retry in a minute.' }, { status: 429, headers });
  try {
    const body = await boundedJson(request), id = positionIdentity(body?.positionId ?? '');
    const position = getPositions().find(p => p.id === id);
    if (!position) return Response.json({ accepted: false, error: 'No provider/salt in this fixed index; no job created.' }, { status: 404, headers });
    if (position.status === 'reconciled') return Response.json({ accepted: false, replayAvailable: true, status: 'VERIFIED', id, message: 'Verified replay already exists; no additional job or RPC requests created.' }, { headers });
    if (BigInt(position.lastBlock) > BigInt(context().indexEnd)) return Response.json({ accepted: false, status: 'ACCOUNTING_INDEX_REQUIRED', error: 'Position activity extends beyond the verified accounting index. Discovery alone cannot start a replay job; a versioned accounting-index extension is required.' }, { status: 409, headers });
    const result = submit(id);
    return Response.json({ accepted: true, ...result }, { status: result.created ? 202 : 200, headers });
  } catch (e) { return Response.json({ accepted: false, error: e instanceof AnalysisLimit ? e.message : 'Invalid request or queue temporarily busy. Retry shortly.' }, { status: e instanceof AnalysisLimit ? 429 : 400, headers }); }
}
