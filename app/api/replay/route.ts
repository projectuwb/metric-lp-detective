import { getMeta } from '../../../lib/server/replay';
export const runtime = 'nodejs';
export async function GET(request?: Request) {
  const id = request ? new URL(request.url).searchParams.get('id') ?? undefined : undefined;
  try { return Response.json(getMeta(id), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch (e) { return Response.json({ error: e instanceof Error && e.message === 'UNSUPPORTED_POSITION' ? 'This position is indexed only; independent reconciliation is required before replay.' : 'The verified replay index is unavailable. Please retry.' }, { status: e instanceof Error && e.message === 'UNSUPPORTED_POSITION' ? 409 : 503 }); }
}
