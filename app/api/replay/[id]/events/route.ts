import { getPage } from '../../../../../lib/server/replay';
import { limited } from '../../../../../lib/server/limit';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (limited(request, 'events', 300)) return Response.json({ error: 'Too many event requests. Wait a minute and retry.' }, { status: 429, headers: { 'Retry-After': '60' } });
  const { id } = await context.params;
  const value = new URL(request.url).searchParams.get('page') ?? '0';
  if (!/^\d{1,5}$/.test(value)) return Response.json({ error: 'Invalid event page.' }, { status: 400 });
  try {
    const result = getPage(id, Number(value));
    if (!result) return Response.json({ error: 'This position was detected, but its inventory has not been independently reconciled. Replay is not yet supported. Try the verified sample.' }, { status: 409 });
    return Response.json(result, { headers: { 'Cache-Control': 'public, max-age=300' } });
  } catch (e) {
    return Response.json({ error: e instanceof Error && e.message === 'INVALID_PAGE' ? 'Event page is outside verified history.' : 'Event data is temporarily unavailable. Please retry.' }, { status: e instanceof Error && e.message === 'INVALID_PAGE' ? 400 : 503 });
  }
}
