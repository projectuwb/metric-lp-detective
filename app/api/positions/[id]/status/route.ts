import { getMeta, getPositions, getRegistry } from '../../../../../lib/server/replay';
import { limited } from '../../../../../lib/server/limit';
import { positionIdentity } from '../../../../../lib/domain/position';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'no-store' };
  if (limited(request, 'analysis-status', 120)) return Response.json({ status: 'RATE_LIMITED', error: 'Too many status requests. Retry in a minute.' }, { status: 429, headers: { ...headers, 'Retry-After': '60' } });
  let id: string;
  try { id = positionIdentity((await context.params).id); }
  catch { return Response.json({ error: 'Invalid provider:uint80Salt position identifier.' }, { status: 400, headers }); }
  try {
    const meta = getMeta(), indexed = getPositions().some(p => p.id === id), verified = getRegistry().some(p => p.id === id);
    return Response.json({ id, status: verified ? 'VERIFIED' : indexed ? 'INDEXED_ONLY' : 'UNSUPPORTED',
      coverage: { from: meta.from, through: meta.through, blockHash: meta.marks.find(m => m.block === meta.through)?.blockHash },
      lastVerifiedBlock: verified ? meta.through : null, queueAvailable: false, progress: null,
      message: verified ? 'Independently reconciled replay is available within this fixed coverage.' : indexed ? 'Detected liquidity events only. No analysis is queued or running. A bounded offline worker must collect and independently reconcile evidence before replay can be enabled.' : 'No liquidity event for this provider/salt in the fixed index. Later events and manager ownership are not excluded.' }, { status: indexed ? 200 : 404, headers });
  } catch { return Response.json({ status: 'FAILED', error: 'The public index is unavailable. Retry shortly.' }, { status: 503, headers }); }
}
