import { readFileSync } from 'node:fs';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const release = JSON.parse(readFileSync('.web-data/release.json', 'utf8'));
    return Response.json(release, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Release provenance is unavailable; deployment identity is not verified.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
