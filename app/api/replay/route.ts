import { getMeta } from '../../../lib/server/replay';
export const runtime = 'nodejs';
export async function GET() {
  try { return Response.json(getMeta(), { headers: { 'Cache-Control': 'public, max-age=300' } }); }
  catch { return Response.json({ error: 'The verified replay index is unavailable. Please retry.' }, { status: 503 }); }
}
